"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type EngineName,
  type SourceLang,
  SttError,
  type SttController,
  type SttHandlers,
  isWebSpeechSupported,
  startEngine,
} from "../lib/stt";

export type TranscriptionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "error";

export interface TranscriptSegment {
  id: number;
  text: string;
  /** Idioma detectado por el motor de STT; `null` si no lo expone. */
  lang: SourceLang | null;
}

export interface UseLiveTranscription {
  status: TranscriptionStatus;
  /** Motor de transcripción activo (para saber si entró un respaldo). */
  activeEngine: EngineName | null;
  /** Sesión abierta en el servidor, o `null` si el motor activo no factura. */
  sessionId: string | null;
  segments: TranscriptSegment[];
  transcript: string;
  interim: string;
  error: string | null;
  /**
   * `forced` fija un motor concreto (cuenta de pruebas); si se omite, usa la
   * cadena automática. `reanudar` continúa una consulta guardada en vez de
   * abrir una nueva.
   */
  start: (
    language?: string,
    forced?: EngineName,
    reanudar?: string
  ) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const DEFAULT_LANGUAGE = "multi";
// Un enunciado de hasta 3 palabras casi nunca es una intervención completa:
// suele ser el arranque de una frase que el hablante cortó al dudar.
const SHORT_UTTERANCE_WORDS = 3;
// Cuánto esperamos una continuación antes de dar por cerrado ese fragmento.
const MERGE_WINDOW_MS = 700;

export function useLiveTranscription(): UseLiveTranscription {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [activeEngine, setActiveEngine] = useState<EngineName | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const segmentIdRef = useRef(0);
  const controllerRef = useRef<SttController | null>(null);
  const chainRef = useRef<EngineName[]>([]);
  const chainIdxRef = useRef(0);
  const langRef = useRef(DEFAULT_LANGUAGE);
  const reanudarRef = useRef<string | undefined>(undefined);
  // En ref además de en estado: `stop` la necesita sin volver a crearse en cada
  // cambio, y recrear `stop` invalidaría los efectos que dependen de él.
  const sessionIdRef = useRef<string | null>(null);
  const genRef = useRef(0); // invalida callbacks de motores ya reemplazados

  // Fragmento corto en espera de una posible continuación (ver MERGE_WINDOW_MS).
  const heldRef = useRef<{ text: string; lang: SourceLang | null } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Permite que la cadena de respaldo se reinvoque a sí misma (ver `advance`).
  const launchCurrentRef = useRef<(() => Promise<void>) | null>(null);

  const pushSegment = useCallback((text: string, lang: SourceLang | null) => {
    setSegments((prev) => [...prev, { id: segmentIdRef.current++, text, lang }]);
  }, []);

  /** Emite ya el fragmento retenido, si lo hay. */
  const flushHeld = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const held = heldRef.current;
    heldRef.current = null;
    if (held) pushSegment(held.text, held.lang);
  }, [pushSegment]);

  /**
   * Un enunciado terminado. Los fragmentos muy cortos se retienen un instante
   * para poder pegarlos a lo que siga: interpretar "Me duele" y "aquí en el
   * pecho" por separado produce dos traducciones inconexas.
   */
  const handleFinal = useCallback(
    (text: string, lang: SourceLang | null) => {
      const held = heldRef.current;
      if (held) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        heldRef.current = null;
        // El idioma del fragmento retenido manda: es el arranque de la frase.
        pushSegment(`${held.text} ${text}`, held.lang ?? lang);
        return;
      }

      const isShort = text.split(/\s+/).length <= SHORT_UTTERANCE_WORDS;
      if (!isShort) {
        pushSegment(text, lang);
        return;
      }

      heldRef.current = { text, lang };
      holdTimerRef.current = setTimeout(flushHeld, MERGE_WINDOW_MS);
    },
    [flushHeld, pushSegment]
  );

  const stop = useCallback(() => {
    controllerRef.current?.stop(); // el motor hace flush de lo pendiente
    controllerRef.current = null;
    genRef.current++;
    flushHeld(); // no perder un fragmento corto retenido al detener

    // Cerrar la sesión en el servidor. `keepalive` para que la petición
    // sobreviva si el usuario cierra la pestaña en el mismo gesto: sin eso, la
    // sesión se quedaría abierta para siempre y contaría como "en vivo".
    const id = sessionIdRef.current;
    if (id) {
      void fetch("/api/sessions/cerrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
        keepalive: true,
      }).catch(() => {});
      sessionIdRef.current = null;
      setSessionId(null);
    }

    setInterim("");
    setActiveEngine(null);
    setStatus("idle");
  }, [flushHeld]);

  const reset = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    heldRef.current = null;
    setSegments([]);
    setInterim("");
    setError(null);
  }, []);

  const launchCurrent = useCallback(async () => {
    const name = chainRef.current[chainIdxRef.current];
    const gen = ++genRef.current;

    const advance = () => {
      if (gen !== genRef.current) return;
      controllerRef.current?.stop();
      controllerRef.current = null;
      chainIdxRef.current++;
      if (chainIdxRef.current >= chainRef.current.length) {
        setError("No hay motores de transcripción disponibles.");
        setStatus("error");
        return;
      }
      // Vía ref: la función se llama a sí misma para avanzar en la cadena y
      // no puede referenciar su propia const antes de que exista.
      void launchCurrentRef.current?.();
    };

    const handlers: SttHandlers = {
      onSession: (id) => {
        if (gen !== genRef.current) return;
        sessionIdRef.current = id;
        setSessionId(id);
      },
      onOpen: () => {
        if (gen !== genRef.current) return;
        setActiveEngine(name);
        setStatus("listening");
      },
      onInterim: (text) => {
        if (gen === genRef.current) setInterim(text);
      },
      onFinal: (text, lang) => {
        if (gen !== genRef.current) return;
        handleFinal(text, lang);
      },
      onQuotaExhausted: () => {
        if (gen !== genRef.current) return;
        controllerRef.current = null;
        flushHeld();
        setInterim("");
        setActiveEngine(null);
        setError("Se agotaron los minutos de tu plan.");
        setStatus("error");
      },
      onError: (err) => {
        // Sin sesión o sin cuota, cambiar de motor no arregla nada: la cadena
        // de respaldo se salta y el usuario ve el motivo real.
        if (err instanceof SttError && err.fatal) {
          if (gen !== genRef.current) return;
          controllerRef.current = null;
          setError(err.message);
          setStatus("error");
          return;
        }
        console.warn(`Motor "${name}" falló, probando respaldo:`, err);
        advance();
      },
    };

    try {
      controllerRef.current = await startEngine(
        name,
        handlers,
        langRef.current,
        reanudarRef.current
      );
    } catch (err) {
      handlers.onError(err);
    }
  }, [handleFinal, flushHeld]);

  useEffect(() => {
    launchCurrentRef.current = launchCurrent;
  }, [launchCurrent]);

  const start = useCallback(
    async (
      language: string = DEFAULT_LANGUAGE,
      forced?: EngineName,
      reanudar?: string
    ) => {
      setError(null);
      setStatus("connecting");
      langRef.current = language;
      reanudarRef.current = reanudar;

      let chain: EngineName[] = [];

      if (forced) {
        // Modo pruebas: usar solo el motor elegido, sin respaldo.
        chain = [forced];
      } else {
        // Ya no consultamos saldo aquí: la ruta del token verifica sesión y
        // cuota del plan y responde 401/402, que llegan como error fatal.
        chain.push("deepgram");
        if (isWebSpeechSupported()) chain.push("webspeech");
      }

      chainRef.current = chain;
      chainIdxRef.current = 0;

      if (chain.length === 0) {
        setError("No hay motores de transcripción disponibles.");
        setStatus("error");
        return;
      }

      await launchCurrent();
    },
    [launchCurrent]
  );

  const transcript = segments.map((s) => s.text).join(" ");

  return {
    status,
    activeEngine,
    sessionId,
    segments,
    transcript,
    interim,
    error,
    start,
    stop,
    reset,
  };
}
