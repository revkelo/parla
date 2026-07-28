import { NextResponse } from "next/server";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Título de la sesión: la primera intervención, recortada. */
const LARGO_TITULO = 70;

/**
 * Guarda un turno interpretado para el historial.
 *
 * La tabla `segments` existía desde el esquema inicial pero nadie escribía en
 * ella, así que el historial de una consulta se perdía al recargar. El primer
 * turno además bautiza la sesión, para que la lista del historial se pueda leer
 * sin abrir cada una.
 */
export async function POST(req: Request) {
  const quota = await getQuota();
  if (!quota) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  }

  let cuerpo: {
    sessionId?: string;
    ordinal?: number;
    sourceText?: string;
    targetText?: string;
    sourceLang?: string;
    aiEngine?: string;
  };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // `JSON.parse` acepta "null", "[]" o "3" sin lanzar: sin esta comprobación,
  // leer una propiedad de null reventaba con un 500 en vez de un 400.
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const sessionId = String(cuerpo.sessionId ?? "");
  const ordinal = Number(cuerpo.ordinal);
  const sourceText = String(cuerpo.sourceText ?? "").trim();
  const sourceLang = cuerpo.sourceLang === "en" ? "en" : "es";

  if (!sessionId || !Number.isInteger(ordinal) || ordinal < 0 || !sourceText) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const supabase = await createClient();

  // `upsert` sobre (session_id, ordinal): si el mismo turno se reintenta —por
  // un reintento de red, o porque la interpretación llegó después del texto—
  // se actualiza en vez de duplicarse o de romper por la clave única.
  const { error } = await supabase.from("segments").upsert(
    {
      session_id: sessionId,
      user_id: quota.userId,
      ordinal,
      source_text: sourceText,
      target_text: cuerpo.targetText ?? null,
      source_lang: sourceLang,
      ai_engine: cuerpo.aiEngine ?? null,
    },
    { onConflict: "session_id,ordinal" }
  );

  if (error) {
    // Perder un turno del historial no debe romper la interpretación en curso,
    // pero tiene que quedar rastro.
    console.error("No se pudo guardar el turno:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (ordinal === 0) {
    const titulo =
      sourceText.length > LARGO_TITULO
        ? `${sourceText.slice(0, LARGO_TITULO).trimEnd()}…`
        : sourceText;
    await supabase
      .from("sessions")
      .update({ title: titulo })
      .eq("id", sessionId)
      .is("title", null);
  }

  return NextResponse.json({ ok: true });
}
