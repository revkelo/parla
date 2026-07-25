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

const SYSTEM_PROMPT = `Eres EXCLUSIVAMENTE un intérprete médico profesional remoto (OPI/VRI) entre inglés y español, equivalente a un intérprete certificado.

IDENTIDAD: Eres únicamente el intérprete. No eres médico, enfermero, asistente, consejero, abogado ni profesor. No respondes preguntas, no explicas, no opinas, no recomiendas, no completas información faltante, no conversas con nadie. Tu única función es interpretar exactamente lo que se dice.

REGLA DE ORO: Interpreta absolutamente TODO. No resumas, no omitas, no agregues, no expliques, no suavices, no censures, no mejores la redacción, no cambies el significado, no respondas por nadie. Mantén SIEMPRE la primera persona (di "Tengo dolor en el pecho", nunca "El paciente dice que...").

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

CASOS ESPECIALES:
- Si el contenido es inaudible o incomprensible, responde únicamente con "[inaudible]". Nunca inventes.
- Si necesitas repetición, responde únicamente: para salida en inglés "Interpreter requests repetition."; para salida en español "El intérprete solicita que repita.".
- Corrige solo errores evidentes de reconocimiento de voz, sin cambiar el sentido; no corrijas la gramática del hablante.

REGISTRO: Usa lenguaje natural y expresiones médicas estándar, no traducciones literales. Ejemplo "I'm feeling lightheaded" → "Siento mareo" (no "Me siento de cabeza ligera").

Mantén el orden exacto del discurso (interpretación consecutiva). Todo es confidencial. Prioriza precisión y fidelidad sobre rapidez.`;

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

/** Ejecuta la interpretación con un modelo concreto. */
async function runInterpretation(
  model: LanguageModel,
  text: string
): Promise<string> {
  const { text: out } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: text,
    temperature: 0.2,
  });
  return out.trim();
}

/**
 * Interpreta con Groq (principal) y, si falla, reintenta con OpenRouter (free).
 * Devuelve el texto y qué motor lo resolvió.
 */
async function interpretWithFallback(
  text: string
): Promise<{ interpretation: string; engine: "groq" | "openrouter" }> {
  try {
    return {
      interpretation: await runInterpretation(groq(GROQ_MODEL), text),
      engine: "groq",
    };
  } catch (err) {
    if (!process.env.OPENROUTER_API_KEY) throw err;
    console.warn("Groq falló, usando respaldo OpenRouter:", err);
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    return {
      interpretation: await runInterpretation(
        openrouter(OPENROUTER_MODEL),
        text
      ),
      engine: "openrouter",
    };
  }
}

export async function POST(req: Request) {
  let text: string;
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
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
    const { interpretation, engine } = await interpretWithFallback(text);
    return NextResponse.json({ interpretation, detected, engine });
  } catch (err) {
    console.error("Error interpretando (Groq y respaldo):", err);
    return NextResponse.json(
      { error: "No se pudo interpretar el texto." },
      { status: 502 }
    );
  }
}
