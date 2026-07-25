"use client";

// Motores de transcripción (STT) con una interfaz común, para una cadena de
// respaldo: Deepgram (streaming) → Groq Whisper (por trozos) → Web Speech API.

export type EngineName = "deepgram" | "google" | "webspeech";

export const ENGINE_LABEL: Record<EngineName, string> = {
  deepgram: "Deepgram",
  google: "Google (Gemini)",
  webspeech: "Navegador",
};

export type SttHandlers = {
  /** Texto provisional que aún puede cambiar. */
  onInterim: (text: string) => void;
  /** Un enunciado terminado. */
  onFinal: (text: string) => void;
  /** El motor falló; la cadena debe pasar al siguiente. */
  onError: (err: unknown) => void;
  /** El motor quedó escuchando. */
  onOpen?: () => void;
};

export type SttController = { stop: () => void };

async function getMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
}

function pickMime(): string {
  return MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
}

/* ─────────────────────────── Deepgram (streaming) ─────────────────────────── */

export async function startDeepgram(
  handlers: SttHandlers,
  language = "multi"
): Promise<SttController> {
  const tokenRes = await fetch("/api/deepgram/token");
  if (!tokenRes.ok) throw new Error("No se pudo obtener el token de Deepgram.");
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const stream = await getMic();

  const params = new URLSearchParams({
    model: "nova-3",
    language,
    smart_format: "true",
    interim_results: "true",
    punctuate: "true",
    endpointing: "500",
    utterance_end_ms: "1000",
  });
  const socket = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params.toString()}`,
    ["bearer", access_token]
  );

  let pending = "";
  let recorder: MediaRecorder | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const flush = () => {
    const t = pending.trim();
    pending = "";
    handlers.onInterim("");
    if (t) handlers.onFinal(t);
  };

  const cleanup = () => {
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorder = null;
    stream.getTracks().forEach((t) => t.stop());
    if (socket.readyState === WebSocket.OPEN) socket.close(1000, "detenido");
  };

  socket.onopen = () => {
    handlers.onOpen?.();
    recorder = new MediaRecorder(stream, { mimeType: pickMime() });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        socket.send(e.data);
      }
    };
    recorder.start(250);
    keepAlive = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, 8000);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "Error") {
        handlers.onError(new Error(data.description ?? "Deepgram error"));
        return;
      }
      if (data.type === "UtteranceEnd") {
        flush();
        return;
      }
      if (data.type !== "Results") return;
      const text: string = data.channel?.alternatives?.[0]?.transcript ?? "";
      if (data.is_final) {
        if (text) pending = pending ? `${pending} ${text}` : text;
        if (data.speech_final) flush();
        else handlers.onInterim(pending);
      } else {
        handlers.onInterim(
          text ? (pending ? `${pending} ${text}` : text) : pending
        );
      }
    } catch {
      /* ignorar mensajes no-JSON */
    }
  };

  socket.onerror = () => {
    if (stopped) return;
    handlers.onError(new Error("Fallo de conexión con Deepgram."));
  };

  return {
    stop: () => {
      stopped = true;
      flush();
      cleanup();
    },
  };
}

/* ────────────────── Google Gemini (graba WAV por ventanas) ────────────────── */

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

function downsample(
  buffer: Float32Array,
  inRate: number,
  outRate = 16000
): Float32Array {
  if (outRate >= inRate) return buffer;
  const ratio = inRate / outRate;
  const len = Math.round(buffer.length / ratio);
  const out = new Float32Array(len);
  let oi = 0;
  let ib = 0;
  while (oi < len) {
    const next = Math.round((oi + 1) * ratio);
    let sum = 0;
    let cnt = 0;
    for (let i = ib; i < next && i < buffer.length; i++) {
      sum += buffer[i];
      cnt++;
    }
    out[oi] = cnt ? sum / cnt : 0;
    oi++;
    ib = next;
  }
  return out;
}

export async function startGoogleStt(
  handlers: SttHandlers
): Promise<SttController> {
  const stream = await getMic();
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AC();
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);

  let chunks: Float32Array[] = [];
  let stopped = false;
  let sending = false;

  proc.onaudioprocess = (e) => {
    if (stopped) return;
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(proc);
  proc.connect(ctx.destination); // no escribimos salida → silencio, sin eco

  const flushWindow = async () => {
    if (sending || chunks.length === 0) return;
    sending = true;
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const merged = new Float32Array(total);
    let o = 0;
    for (const c of chunks) {
      merged.set(c, o);
      o += c.length;
    }
    chunks = [];
    try {
      const wav = encodeWav(downsample(merged, ctx.sampleRate, 16000), 16000);
      const fd = new FormData();
      fd.append("audio", wav, "audio.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (res.ok) {
        const { text } = (await res.json()) as { text: string };
        if (text) handlers.onFinal(text);
      }
    } catch {
      /* una ventana fallida no corta la sesión */
    } finally {
      sending = false;
    }
  };

  handlers.onOpen?.();
  handlers.onInterim("Escuchando…");
  const timer = setInterval(flushWindow, 4000);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      handlers.onInterim("");
      void flushWindow();
      try {
        proc.disconnect();
        source.disconnect();
        void ctx.close();
      } catch {
        /* noop */
      }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/* ───────────────────────── Web Speech API (navegador) ─────────────────────── */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal: boolean }
        >;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function isWebSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startWebSpeech(
  handlers: SttHandlers,
  lang = "es-ES"
): SttController {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
  if (!Ctor) throw new Error("Web Speech API no disponible.");

  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;

  let stopped = false;

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) {
        const trimmed = t.trim();
        if (trimmed) handlers.onFinal(trimmed);
      } else {
        interim += t;
      }
    }
    handlers.onInterim(interim);
  };

  rec.onerror = (e) => {
    // "no-speech"/"aborted" son transitorios; el resto sí es fallo real.
    if (e.error === "no-speech" || e.error === "aborted") return;
    handlers.onError(new Error(`Web Speech: ${e.error}`));
  };

  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start();
      } catch {
        /* ya iniciado */
      }
    }
  };

  rec.start();
  handlers.onOpen?.();

  return {
    stop: () => {
      stopped = true;
      handlers.onInterim("");
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
  };
}

export async function startEngine(
  name: EngineName,
  handlers: SttHandlers,
  language: string
): Promise<SttController> {
  if (name === "deepgram") return startDeepgram(handlers, language);
  if (name === "google") return startGoogleStt(handlers);
  return startWebSpeech(handlers);
}
