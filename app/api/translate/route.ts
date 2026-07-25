import { franc } from "franc-min";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Traducción sin IA usando MyMemory (gratis, sin API key).
// Límite anónimo: 5.000 palabras/día; con email válido sube a 50.000/día.
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const CONTACT_EMAIL = "kgagudelo@gmail.com";

/**
 * Decide la dirección de traducción (ES⇄EN).
 * Usa franc para detectar el idioma; si es muy corto o ambiguo,
 * recurre a una heurística de acentos/palabras comunes en español.
 */
function pickLangPair(text: string): { pair: string; detected: "es" | "en" } {
  const lang = franc(text, { only: ["spa", "eng"] });

  if (lang === "spa") return { pair: "es|en", detected: "es" };
  if (lang === "eng") return { pair: "en|es", detected: "en" };

  // Fallback: acentos o palabras típicas del español => tratarlo como español.
  const looksSpanish =
    /[áéíóúñ¿¡ü]/i.test(text) ||
    /\b(el|la|los|las|que|de|y|un|una|por|para|con|es|está|pero)\b/i.test(text);
  return looksSpanish
    ? { pair: "es|en", detected: "es" }
    : { pair: "en|es", detected: "en" };
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

  const { pair, detected } = pickLangPair(text);

  try {
    const url = new URL(MYMEMORY_URL);
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", pair);
    url.searchParams.set("de", CONTACT_EMAIL);

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Servicio de traducción no disponible." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const translation: string = data?.responseData?.translatedText ?? "";

    if (!translation) {
      return NextResponse.json(
        { error: "No se obtuvo traducción." },
        { status: 502 }
      );
    }

    return NextResponse.json({ translation, detected });
  } catch (err) {
    console.error("Error traduciendo:", err);
    return NextResponse.json(
      { error: "No se pudo traducir el texto." },
      { status: 502 }
    );
  }
}
