"use client";

import { useCallback, useRef, useState } from "react";

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
  /** Segmentos ya confirmados por Deepgram (resultados finales), con id estable. */
  segments: TranscriptSegment[];
  /** Todo el texto confirmado, unido (útil para copiar). */
  transcript: string;
  /** Fragmento provisional que aún puede cambiar. */
  interim: string;
  error: string | null;
  /** Inicia la transcripción. `language` es un código Deepgram (ej. "es", "en", "multi"). */
  start: (language?: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

// Modelo por defecto. nova-3 soporta modo multilingüe con code-switching.
const DEEPGRAM_MODEL = "nova-3";
const DEFAULT_LANGUAGE = "multi";

export function useLiveTranscription(): UseLiveTranscription {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const segmentIdRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (socketRef.current) {
      // 1000 = cierre normal.
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close(1000, "cliente detuvo la grabación");
      }
      socketRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setInterim("");
    setStatus("idle");
  }, [cleanup]);

  const reset = useCallback(() => {
    setSegments([]);
    setInterim("");
    setError(null);
  }, []);

  const start = useCallback(async (language: string = DEFAULT_LANGUAGE) => {
    setError(null);
    setStatus("connecting");

    try {
      // 1. Pedir token temporal al backend.
      const tokenRes = await fetch("/api/deepgram/token");
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo obtener el token.");
      }
      const { access_token } = (await tokenRes.json()) as {
        access_token: string;
      };

      // 2. Acceder al micrófono.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // 3. Abrir WebSocket con Deepgram usando el token temporal.
      const params = new URLSearchParams({
        model: DEEPGRAM_MODEL,
        language,
        smart_format: "true",
        interim_results: "true",
        punctuate: "true",
      });
      const socket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        // Los tokens temporales (JWT) se pasan con el esquema "bearer"
        // vía Sec-WebSocket-Protocol (el navegador no permite headers custom).
        ["bearer", access_token]
      );
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus("listening");

        // Elegir un mime type soportado por el navegador.
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        // Enviar audio en trozos cada 250 ms para baja latencia.
        recorder.start(250);

        // KeepAlive para que Deepgram no cierre por inactividad.
        keepAliveRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 8000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "Results") return;

          const alt = data.channel?.alternatives?.[0];
          const text: string = alt?.transcript ?? "";
          if (!text) return;

          if (data.is_final) {
            setSegments((prev) => [
              ...prev,
              { id: segmentIdRef.current++, text },
            ]);
            setInterim("");
          } else {
            setInterim(text);
          }
        } catch {
          // Ignorar mensajes que no sean JSON válido.
        }
      };

      socket.onerror = () => {
        setError("Error en la conexión con Deepgram.");
        setStatus("error");
        cleanup();
      };

      socket.onclose = () => {
        setStatus((prev) => (prev === "error" ? prev : "idle"));
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al iniciar la transcripción.";
      setError(message);
      setStatus("error");
      cleanup();
    }
  }, [cleanup]);

  const transcript = segments.map((s) => s.text).join(" ");

  return { status, segments, transcript, interim, error, start, stop, reset };
}
