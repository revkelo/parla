"use client";

// Motores de transcripción (STT) con una interfaz común, para una cadena de
// respaldo: Deepgram (streaming) → Groq Whisper (por trozos) → Web Speech API.

export type EngineName = "deepgram" | "webspeech";

export const ENGINE_LABEL: Record<EngineName, string> = {
  deepgram: "Deepgram",
  webspeech: "Navegador",
};

/** Idioma de origen de un enunciado, según lo detecta el motor de STT. */
export type SourceLang = "es" | "en";

export type SttHandlers = {
  /** Texto provisional que aún puede cambiar. */
  onInterim: (text: string) => void;
  /**
   * Un enunciado terminado. `lang` viene del propio motor cuando puede
   * detectarlo (Deepgram multi); si es `null`, el servidor lo infiere.
   */
  onFinal: (text: string, lang: SourceLang | null) => void;
  /** El motor falló; la cadena debe pasar al siguiente. */
  onError: (err: unknown) => void;
  /** El motor quedó escuchando. */
  onOpen?: () => void;
  /** Se agotaron los minutos del plan a mitad de sesión. */
  onQuotaExhausted?: () => void;
  /**
   * Id de la sesión abierta en el servidor. Solo lo emiten los motores que
   * facturan (Deepgram); sin él no hay dónde colgar los turnos del historial.
   */
  onSession?: (sessionId: string) => void;
};

export type SttController = { stop: () => void };

/**
 * Fallo del motor. `fatal` marca los que no tiene sentido reintentar con otro
 * motor (sin sesión, sin cuota): cambiar de motor no los arregla.
 */
export class SttError extends Error {
  readonly fatal: boolean;
  constructor(message: string, fatal = false) {
    super(message);
    this.name = "SttError";
    this.fatal = fatal;
  }
}

/** Cada cuánto avisamos al servidor de que la sesión sigue viva (y facturando). */
const HEARTBEAT_MS = 30_000;

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

/** Normaliza códigos tipo "es-419", "en-US" a "es" / "en"; ignora el resto. */
function normalizeLang(code: unknown): SourceLang | null {
  if (typeof code !== "string") return null;
  const base = code.toLowerCase().split("-")[0];
  return base === "es" ? "es" : base === "en" ? "en" : null;
}

/**
 * Con `language=multi`, Deepgram etiqueta el idioma palabra por palabra. Contamos
 * esas etiquetas en lugar de fiarnos de una sola, porque en frases mixtas
 * ("me duele el chest") la mayoría es más representativa que la primera palabra.
 */
function collectLangVotes(
  alternative: unknown,
  votes: { es: number; en: number }
) {
  const alt = alternative as
    | { words?: Array<{ language?: string }>; languages?: string[] }
    | undefined;

  let counted = false;
  for (const w of alt?.words ?? []) {
    const l = normalizeLang(w.language);
    if (l) {
      votes[l]++;
      counted = true;
    }
  }
  // Algunos mensajes traen solo `languages` a nivel de alternativa.
  if (!counted) {
    for (const code of alt?.languages ?? []) {
      const l = normalizeLang(code);
      if (l) votes[l]++;
    }
  }
}

function dominantLang(votes: { es: number; en: number }): SourceLang | null {
  if (votes.es === 0 && votes.en === 0) return null;
  return votes.es >= votes.en ? "es" : "en";
}

export async function startDeepgram(
  handlers: SttHandlers,
  language = "multi",
  /** Consulta guardada que se reanuda; si se omite, se abre una nueva. */
  reanudar?: string
): Promise<SttController> {
  const tokenRes = await fetch(
    reanudar
      ? `/api/deepgram/token?sessionId=${encodeURIComponent(reanudar)}`
      : "/api/deepgram/token"
  );
  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => null);
    // La cuota agotada no es un fallo del motor: no debe activar el respaldo,
    // porque el respaldo también consume plataforma.
    throw new SttError(
      body?.error ?? "No se pudo obtener el token de Deepgram.",
      body?.code === "quota_exhausted" || tokenRes.status === 401
    );
  }
  const { access_token, session_id } = (await tokenRes.json()) as {
    access_token: string;
    session_id: string;
  };

  handlers.onSession?.(session_id);

  const stream = await getMic();

  const params = new URLSearchParams({
    model: "nova-3",
    language,
    smart_format: "true",
    interim_results: "true",
    punctuate: "true",
    // 500 ms cortaba a mitad de frase en cuanto el hablante dudaba; a 900 ms se
    // respetan las pausas naturales sin que la latencia se note en consulta.
    endpointing: "900",
    utterance_end_ms: "1200",
  });
  const socket = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params.toString()}`,
    ["bearer", access_token]
  );

  let pending = "";
  // Votos de idioma por palabra acumulados para el enunciado en curso.
  let langVotes: { es: number; en: number } = { es: 0, en: 0 };
  let recorder: MediaRecorder | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  /** Reporta que la sesión sigue viva y corta si el plan se quedó sin minutos. */
  const beat = async () => {
    try {
      const res = await fetch("/api/usage/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session_id }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { exhausted: boolean };
      if (data.exhausted && !stopped) {
        stopped = true;
        flush();
        cleanup();
        handlers.onQuotaExhausted?.();
      }
    } catch {
      // Un latido perdido no debe tumbar la sesión; el siguiente recupera el
      // tiempo, acotado por el tope del servidor.
    }
  };

  const flush = () => {
    const t = pending.trim();
    const lang = dominantLang(langVotes);
    pending = "";
    langVotes = { es: 0, en: 0 };
    handlers.onInterim("");
    if (t) handlers.onFinal(t, lang);
  };

  const cleanup = () => {
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = null;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
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
    heartbeat = setInterval(() => void beat(), HEARTBEAT_MS);
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
      const alt = data.channel?.alternatives?.[0];
      const text: string = alt?.transcript ?? "";
      if (data.is_final) {
        if (text) {
          pending = pending ? `${pending} ${text}` : text;
          collectLangVotes(alt, langVotes);
        }
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
      // Latido final: cobra el tramo desde el último latido, si no los
      // segundos sueltos de cada sesión se perderían.
      void beat();
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
        // Web Speech no expone el idioma detectado: lo infiere el servidor.
        if (trimmed) handlers.onFinal(trimmed, null);
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
  language: string,
  /** Consulta guardada que se reanuda; si se omite, se abre una nueva. */
  reanudar?: string
): Promise<SttController> {
  if (name === "deepgram") return startDeepgram(handlers, language, reanudar);
  // El respaldo del navegador no factura ni abre sesión, así que no hay nada
  // que reanudar: los turnos se siguen colgando de la sesión ya abierta.
  return startWebSpeech(handlers);
}
