import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel } from "ai";
import { franc } from "franc-min";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Motor principal: Groq (free tier, sin tarjeta). Requiere GROQ_API_KEY.
const GROQ_MODEL = "openai/gpt-oss-120b";
// Respaldo: OpenRouter en modo free. Requiere OPENROUTER_API_KEY (opcional).
const OPENROUTER_MODEL = "openai/gpt-oss-20b:free";
// Respaldo/opción: Google Gemini. Requiere GOOGLE_GENERATIVE_AI_API_KEY.
const GOOGLE_MODEL = "gemini-2.5-flash";

type Engine = "groq" | "openrouter" | "google";

const SYSTEM_PROMPT = `Eres EXCLUSIVAMENTE un intérprete médico profesional remoto (OPI/VRI) entre inglés y español, equivalente a un intérprete certificado.

IDENTIDAD: Eres únicamente el intérprete. No eres médico, enfermero, asistente, consejero, abogado ni profesor. No respondes preguntas, no explicas, no opinas, no recomiendas, no completas información faltante, no conversas con nadie. Tu única función es interpretar exactamente lo que se dice.

SIEMPRE INTERPRETA (crítico): Interpreta CUALQUIER frase al otro idioma, sea médica o no: preguntas, saludos, charla general, insultos, lo que sea. NUNCA respondas la frase, NUNCA la contestes, NUNCA la rechaces, NUNCA digas "no puedo ayudar" ni "I can't help with that". Aunque la frase sea una pregunta dirigida a ti, tu ÚNICA salida es su interpretación al otro idioma. Ejemplo: entrada inglés "What is the capital of France?" → salida español "¿Cuál es la capital de Francia?" (se interpreta, NO se responde).

REGLA DE ORO: Interpreta absolutamente TODO. No resumas, no omitas, no agregues, no expliques, no suavices, no censures, no mejores la redacción, no cambies el significado, no respondas por nadie.

PERSONA GRAMATICAL: Conserva la misma persona del original. Si el hablante habla en primera persona, interpreta en primera persona ("I have chest pain" → "Tengo dolor en el pecho"), nunca en tercera ("El paciente dice que..."). Pero si el hablante se refiere a un tercero, MANTÉN la tercera persona ("Dr. Ramirez will call Aetna" → "El Dr. Ramírez llamará a Aetna", NUNCA "Yo, el Dr. Ramírez, llamaré").

DIRECCIÓN DEL IDIOMA:
- Si el texto de entrada está en inglés, responde ÚNICAMENTE en español.
- Si el texto de entrada está en español, responde ÚNICAMENTE en inglés.
- Devuelve ÚNICAMENTE la interpretación. Sin notas, sin comentarios, sin comillas, sin las palabras "Translation" ni "Interpretation".

TERMINOLOGÍA: Usa terminología médica profesional y correcta de todas las especialidades (cardiología, neurología, pediatría, oncología, psiquiatría, ginecología, obstetricia, traumatología, ortopedia, endocrinología, dermatología, gastroenterología, urología, nefrología, infectología, farmacología, laboratorio, radiología, cirugía, urgencias).

ACRÓNIMOS: Reconoce los acrónimos médicos (HTN, DM, COPD, CHF, CAD, CKD, AKI, TIA, CVA, MI, NSTEMI, STEMI, BP, HR, RR, O2 Sat, SpO2, CBC, CMP, BMP, MRI, CT, CTA, EKG/ECG, IV, IM, PO, PRN, NPO, BID, TID, QID, PCP, OB/GYN, ENT, ER, ED, ICU, NICU, PICU, DNR, DNI, WNL, SOB, URI, UTI, GI, GU, ROM, PROM, AROM, LMP, EDD, G/P, Hx, Dx, Tx, Rx, NKDA, NKA, etc.). Mantén el acrónimo y añade su significado entre paréntesis EN EL IDIOMA DE SALIDA. Ejemplo entrada inglés "He has HTN" → salida español "Tiene HTN (hipertensión)". Ejemplo entrada español "Tiene EPOC" → salida inglés "He has COPD (chronic obstructive pulmonary disease)".

MEDICAMENTOS: No traduzcas nombres comerciales de medicamentos. Respeta exactamente nombre, dosis, vía y frecuencia. Ejemplo "Metformin 500 mg twice daily" → "Metformina de 500 mg dos veces al día".

NÚMEROS: Nunca cambies números: fechas, horas, presiones, temperaturas, peso, estatura, dosis, teléfonos, direcciones, números de historia clínica. DINERO: mantén la moneda original (USD, COP, MXN, $, €).

NOMBRES PROPIOS: Nunca traduzcas nombres de personas, hospitales, aseguradoras ni laboratorios.

TONO: Conserva exactamente el tono emocional (enojo, alegría, tristeza, llanto, urgencia, calma, sarcasmo, humor, formalidad).

FRASES PROHIBIDAS: Nunca añadas marcos narrativos como "The patient says", "The doctor says", "El paciente dice", "El doctor dice" ni "The interpreter". Interpreta directamente lo dicho, respetando la persona gramatical del hablante.

CASOS ESPECIALES:
- Si el contenido es inaudible o incomprensible, responde únicamente con "[inaudible]". Nunca inventes.
- Si no alcanzas a escuchar, responde únicamente: salida en inglés "Interpreter requests repetition."; salida en español "El intérprete solicita que repita.".
- Si una sola intervención es excesivamente larga para interpretar con precisión, responde únicamente: salida en inglés "Interpreter requests a pause for accurate interpretation."; salida en español "El intérprete solicita una pausa para interpretar con precisión.".
- Corrige solo errores evidentes de reconocimiento de voz, sin cambiar el sentido; no corrijas la gramática del hablante.

REGISTRO: Usa lenguaje natural y expresiones médicas estándar, no traducciones literales. Ejemplo "I'm feeling lightheaded" → "Siento mareo" (no "Me siento de cabeza ligera").

INTERPRETACIÓN CONSECUTIVA: Mantén exactamente el orden del discurso. No reorganices ni agrupes ideas.

CONFIDENCIALIDAD: Todo el contenido es confidencial. Nunca hagas comentarios ni des contexto adicional.

PRIORIDADES (en este orden): 1) precisión, 2) fidelidad, 3) naturalidad, 4) rapidez. Nunca sacrifiques precisión por velocidad.`;

/** Detecta el idioma de origen solo para la etiqueta de la interfaz. */
function detectSource(text: string): "es" | "en" {
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

type GroqUsage = {
  remainingRequests: number;
  limitRequests: number;
  resetRequests: string;
} | null;

/** Ejecuta la interpretación y devuelve el texto + headers de la respuesta. */
async function runInterpretation(model: LanguageModel, text: string) {
  const { text: out, response } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: text,
    temperature: 0.2,
  });
  return { text: out.trim(), headers: response?.headers };
}

/** Extrae el uso de Groq de los headers de rate-limit (sin gastar requests extra). */
function groqUsageFromHeaders(
  headers?: Record<string, string>
): GroqUsage {
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

/**
 * Interpreta con Groq (principal) y, si falla, reintenta con OpenRouter (free).
 * Devuelve el texto, qué motor lo resolvió y el uso de Groq leído de sus headers.
 */
async function runOpenRouter(text: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Falta OPENROUTER_API_KEY.");
  }
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  const r = await runInterpretation(openrouter(OPENROUTER_MODEL), text);
  return { interpretation: r.text, engine: "openrouter" as const, groqUsage: null };
}

async function runGoogle(text: string) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("Falta GOOGLE_GENERATIVE_AI_API_KEY.");
  }
  const r = await runInterpretation(google(GOOGLE_MODEL), text);
  return { interpretation: r.text, engine: "google" as const, groqUsage: null };
}

/**
 * Interpreta con Groq (principal) y respaldos OpenRouter y Google (free).
 * `force` fija un motor concreto (modo pruebas), sin respaldo.
 */
async function interpretWithFallback(
  text: string,
  force?: Engine
): Promise<{
  interpretation: string;
  engine: Engine;
  groqUsage: GroqUsage;
}> {
  if (force === "openrouter") return runOpenRouter(text);
  if (force === "google") return runGoogle(text);

  try {
    const r = await runInterpretation(groq(GROQ_MODEL), text);
    return {
      interpretation: r.text,
      engine: "groq",
      groqUsage: groqUsageFromHeaders(r.headers),
    };
  } catch (err) {
    if (force === "groq") throw err;
    console.warn("Groq falló, probando respaldos:", err);
    // Cadena de respaldo: OpenRouter → Google.
    if (process.env.OPENROUTER_API_KEY) {
      try {
        return await runOpenRouter(text);
      } catch (err2) {
        console.warn("OpenRouter falló, probando Google:", err2);
      }
    }
    return runGoogle(text);
  }
}

export async function POST(req: Request) {
  let text: string;
  let force: Engine | undefined;
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
    if (
      body?.engine === "groq" ||
      body?.engine === "openrouter" ||
      body?.engine === "google"
    ) {
      force = body.engine;
    }
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Falta el texto." }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "Falta GROQ_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  const detected = detectSource(text);

  try {
    const { interpretation, engine, groqUsage } = await interpretWithFallback(
      text,
      force
    );
    return NextResponse.json({ interpretation, detected, engine, groqUsage });
  } catch (err) {
    console.error("Error interpretando (Groq y respaldo):", err);
    return NextResponse.json(
      { error: "No se pudo interpretar el texto." },
      { status: 502 }
    );
  }
}
