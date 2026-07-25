"use client";

// Motores de transcripción (STT) con una interfaz común, para una cadena de
// respaldo: Deepgram (streaming) → Groq Whisper (por trozos) → Web Speech API.

export type EngineName = "deepgram" | "groq" | "webspeech";

export const ENGINE_LABEL: Record<EngineName, string> = {
  deepgram: "Deepgram",
  groq: "Groq Whisper",
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

/* ───────────────────────── Groq Whisper (por trozos) ──────────────────────── */

export async function startGroqWhisper(
  handlers: SttHandlers
): Promise<SttController> {
  const stream = await getMic();
  const mime = pickMime();
  const WINDOW_MS = 4000;

  let stopped = false;
  let recorder: MediaRecorder | null = null;
  let opened = false;

  const recordWindow = () => {
    if (stopped) return;
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      if (chunks.length) {
        const blob = new Blob(chunks, { type: mime });
        const fd = new FormData();
        fd.append("audio", blob, "audio.webm");
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: fd,
          });
          if (res.ok) {
            const { text } = (await res.json()) as { text: string };
            if (text) handlers.onFinal(text);
          }
        } catch {
          /* una ventana fallida no corta la sesión */
        }
      }
      if (!stopped) recordWindow();
    };
    recorder.start();
    if (!opened) {
      opened = true;
      handlers.onOpen?.();
    }
    handlers.onInterim("Escuchando…");
    setTimeout(() => {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }, WINDOW_MS);
  };

  recordWindow();

  return {
    stop: () => {
      stopped = true;
      handlers.onInterim("");
      if (recorder && recorder.state !== "inactive") recorder.stop();
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
  if (name === "groq") return startGroqWhisper(handlers);
  return startWebSpeech(handlers);
}
