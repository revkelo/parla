// Motor de interpretación: selección de modelo, respaldo y detección de idioma.
// Vive aparte de la ruta para poder reutilizarlo desde el script de evaluación.

import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateText, type LanguageModel } from "ai";
import { franc } from "franc-min";
import {
  type ContextTurn,
  SYSTEM_PROMPT,
  type SourceLang,
  buildPrompt,
} from "./interpreter-prompt";

// Motor principal: Groq (free tier, sin tarjeta). Requiere GROQ_API_KEY.
export const GROQ_MODEL = "openai/gpt-oss-120b";
// Respaldo/opción: Google Gemini. Requiere GOOGLE_GENERATIVE_AI_API_KEY.
export const GOOGLE_MODEL = "gemini-2.5-flash";

export type Engine = "groq" | "google";

export type GroqUsage = {
  remainingRequests: number;
  limitRequests: number;
  resetRequests: string;
} | null;

/**
 * Respaldo para cuando el motor de STT no reporta idioma (Web Speech) o no
 * logra etiquetarlo. Deepgram con `language=multi` sí lo reporta y es bastante
 * más fiable que esto sobre enunciados cortos.
 */
export function detectSource(text: string): SourceLang {
  const lang = franc(text, { only: ["spa", "eng"] });
  if (lang === "spa") return "es";
  if (lang === "eng") return "en";
  const looksSpanish =
    /[áéíóúñ¿¡ü]/i.test(text) ||
    /\b(el|la|los|las|que|de|y|un|una|por|para|con|es|está|pero|tengo|dolor)\b/i.test(
      text
    );
  return looksSpanish ? "es" : "en";
}

/**
 * Cuando el enunciado es muy corto, ni Deepgram ni franc son de fiar
 * ("Two", "No", "OK" existen en ambos idiomas). En ese caso el idioma del
 * último turno de contexto es mejor pista: quien responde suele ser el
 * interlocutor, así que el idioma esperado es el contrario al del turno previo.
 */
export function resolveSourceLang(
  text: string,
  reported: SourceLang | null,
  context: ContextTurn[]
): SourceLang {
  const words = text.trim().split(/\s+/).length;
  const hasStrongSpanishCue = /[áéíóúñ¿¡]/i.test(text);

  if (words > 2 || hasStrongSpanishCue) {
    return reported ?? detectSource(text);
  }

  const last = context.at(-1);
  if (last?.sourceLang) {
    return last.sourceLang === "es" ? "en" : "es";
  }
  return reported ?? detectSource(text);
}

type RunResult = { text: string; headers?: Record<string, string> };

async function runInterpretation(
  model: LanguageModel,
  prompt: string
): Promise<RunResult> {
  const { text, response } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    // Traducción quiere determinismo, no creatividad.
    temperature: 0.1,
  });
  return { text: cleanOutput(text), headers: response?.headers };
}

/**
 * Los modelos a veces envuelven la salida pese a las instrucciones: comillas,
 * un prefijo "Interpretación:" o el bloque de contexto repetido.
 */
function cleanOutput(raw: string): string {
  let out = raw.trim();
  out = out.replace(
    /^(interpretación|interpretation|translation|traducción|salida|output)\s*:\s*/i,
    ""
  );
  const first = out[0];
  const last = out[out.length - 1];
  const opens = '"“\'';
  const closes = '"”\'';
  if (out.length > 1 && opens.includes(first) && closes.includes(last)) {
    out = out.slice(1, -1);
  }
  return out.trim();
}

/** Extrae el uso de Groq de los headers de rate-limit (sin gastar requests extra). */
function groqUsageFromHeaders(headers?: Record<string, string>): GroqUsage {
  if (!headers) return null;
  const remaining = headers["x-ratelimit-remaining-requests"];
  const limit = headers["x-ratelimit-limit-requests"];
  if (!remaining || !limit) return null;
  return {
    remainingRequests: Number(remaining),
    limitRequests: Number(limit),
    resetRequests: headers["x-ratelimit-reset-requests"] ?? "",
  };
}

async function runGoogle(prompt: string) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("Falta GOOGLE_GENERATIVE_AI_API_KEY.");
  }
  const r = await runInterpretation(google(GOOGLE_MODEL), prompt);
  return { interpretation: r.text, engine: "google" as const, groqUsage: null };
}

export type InterpretInput = {
  text: string;
  /** Idioma reportado por el motor de STT; `null` si no lo expone. */
  reportedLang: SourceLang | null;
  context: ContextTurn[];
  /** Fija un motor concreto (modo pruebas), sin respaldo. */
  force?: Engine;
};

export type InterpretResult = {
  interpretation: string;
  detected: SourceLang;
  engine: Engine;
  groqUsage: GroqUsage;
};

/** Interpreta con Groq (principal) y, si falla, con Google (Gemini) de respaldo. */
export async function interpret({
  text,
  reportedLang,
  context,
  force,
}: InterpretInput): Promise<InterpretResult> {
  const detected = resolveSourceLang(text, reportedLang, context);
  const prompt = buildPrompt(text, detected, context);

  if (force === "google") {
    return { ...(await runGoogle(prompt)), detected };
  }

  try {
    const r = await runInterpretation(groq(GROQ_MODEL), prompt);
    return {
      interpretation: r.text,
      detected,
      engine: "groq",
      groqUsage: groqUsageFromHeaders(r.headers),
    };
  } catch (err) {
    if (force === "groq") throw err;
    console.warn("Groq falló, usando respaldo Google:", err);
    return { ...(await runGoogle(prompt)), detected };
  }
}
