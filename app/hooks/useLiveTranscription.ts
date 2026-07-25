"use client";

import { useCallback, useRef, useState } from "react";
import {
  type EngineName,
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
}

export interface UseLiveTranscription {
  status: TranscriptionStatus;
  /** Motor de transcripción activo (para saber si entró un respaldo). */
  activeEngine: EngineName | null;
  segments: TranscriptSegment[];
  transcript: string;
  interim: string;
  error: string | null;
  /** `forced` fija un motor concreto (modo pruebas); si se omite, usa la cadena automática. */
  start: (language?: string, forced?: EngineName) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const DEFAULT_LANGUAGE = "multi";
// Umbral de saldo Deepgram (USD) por debajo del cual saltamos al respaldo.
const DEEPGRAM_MIN_BALANCE = 0.02;

export function useLiveTranscription(): UseLiveTranscription {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [activeEngine, setActiveEngine] = useState<EngineName | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const segmentIdRef = useRef(0);
  const controllerRef = useRef<SttController | null>(null);
  const chainRef = useRef<EngineName[]>([]);
  const chainIdxRef = useRef(0);
  const langRef = useRef(DEFAULT_LANGUAGE);
  const genRef = useRef(0); // invalida callbacks de motores ya reemplazados

  const stop = useCallback(() => {
    controllerRef.current?.stop(); // el motor hace flush de lo pendiente
    controllerRef.current = null;
    genRef.current++;
    setInterim("");
    setActiveEngine(null);
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
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
      void launchCurrent();
    };

    const handlers: SttHandlers = {
      onOpen: () => {
        if (gen !== genRef.current) return;
        setActiveEngine(name);
        setStatus("listening");
      },
      onInterim: (text) => {
        if (gen === genRef.current) setInterim(text);
      },
      onFinal: (text) => {
        if (gen !== genRef.current) return;
        setSegments((prev) => [...prev, { id: segmentIdRef.current++, text }]);
      },
      onError: (err) => {
        console.warn(`Motor "${name}" falló, probando respaldo:`, err);
        advance();
      },
    };

    try {
      controllerRef.current = await startEngine(name, handlers, langRef.current);
    } catch (err) {
      handlers.onError(err);
    }
  }, []);

  const start = useCallback(
    async (language: string = DEFAULT_LANGUAGE, forced?: EngineName) => {
      setError(null);
      setStatus("connecting");
      langRef.current = language;

      let chain: EngineName[] = [];

      if (forced) {
        // Modo pruebas: usar solo el motor elegido, sin respaldo.
        chain = [forced];
      } else {
        // ¿Queda saldo en Deepgram?
        let deepgramOk = true;
        try {
          const usage = await fetch("/api/usage").then((r) =>
            r.ok ? r.json() : null
          );
          if (usage?.deepgram && usage.deepgram.amount <= DEEPGRAM_MIN_BALANCE) {
            deepgramOk = false;
          }
        } catch {
          /* si falla la consulta, igual intentamos Deepgram primero */
        }
        if (deepgramOk) chain.push("deepgram");
        chain.push("groq");
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
    segments,
    transcript,
    interim,
    error,
    start,
    stop,
    reset,
  };
}
