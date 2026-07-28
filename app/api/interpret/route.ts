import { NextResponse } from "next/server";
import { type Engine, interpret } from "@/app/lib/interpret";
import { getQuota, recordUsage } from "@/app/lib/quota";
import {
  CONTEXT_TURNS,
  type ContextTurn,
  type SourceLang,
} from "@/app/lib/interpreter-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseLang(v: unknown): SourceLang | null {
  return v === "es" || v === "en" ? v : null;
}

/** Saneamos el contexto que llega del cliente y nos quedamos con los últimos turnos. */
function parseContext(v: unknown): ContextTurn[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (t): t is { source: string; target: string; sourceLang?: unknown } =>
        !!t && typeof t.source === "string" && typeof t.target === "string"
    )
    .map((t) => ({
      source: t.source.trim(),
      target: t.target.trim(),
      sourceLang: parseLang(t.sourceLang) ?? undefined,
    }))
    .filter((t) => t.source && t.target)
    .slice(-CONTEXT_TURNS);
}

export async function POST(req: Request) {
  // La IA también corre con claves de la plataforma: sin sesión no se llama.
  const quota = await getQuota();
  if (!quota) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  }
  if (quota.exhausted) {
    return NextResponse.json(
      { error: "Agotaste los minutos de tu plan.", code: "quota_exhausted" },
      { status: 402 }
    );
  }

  let text: string;
  let force: Engine | undefined;
  let reportedLang: SourceLang | null;
  let context: ContextTurn[];

  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
    reportedLang = parseLang(body?.sourceLang);
    context = parseContext(body?.context);
    if (body?.engine === "groq" || body?.engine === "google") {
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

  try {
    const result = await interpret({ text, reportedLang, context, force });
    // Contabilidad, no cuota: los minutos de STT son el límite del plan. Esto
    // sirve para conocer el costo real de IA por usuario.
    void recordUsage(quota.userId, "ai_request", 1);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error interpretando (Groq y respaldo):", err);
    return NextResponse.json(
      { error: "No se pudo interpretar el texto." },
      { status: 502 }
    );
  }
}
