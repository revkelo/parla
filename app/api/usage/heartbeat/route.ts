import { NextResponse } from "next/server";
import { getQuota, recordUsage } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Tope por latido. El cliente late cada 30 s; si tarda más (pestaña dormida,
 * red caída) no cobramos el hueco entero, solo hasta este límite. Sin el tope,
 * una pestaña reabierta al día siguiente facturaría 24 horas.
 */
const MAX_SECONDS_PER_BEAT = 90;

export async function POST(req: Request) {
  const quota = await getQuota();
  if (!quota) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  }

  let sessionId: string;
  try {
    const body = await req.json();
    sessionId = String(body?.sessionId ?? "");
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: "Falta sessionId." }, { status: 400 });
  }

  const supabase = await createClient();

  // RLS garantiza que solo se lea una sesión propia: no hace falta comparar
  // user_id a mano, un id ajeno simplemente no devuelve fila.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, last_heartbeat_at, duration_secs")
    .eq("id", sessionId)
    .is("ended_at", null)
    .single<{ id: string; last_heartbeat_at: string; duration_secs: number }>();

  if (!session) {
    return NextResponse.json(
      { error: "Sesión no encontrada o ya cerrada." },
      { status: 404 }
    );
  }

  // El delta lo calcula el servidor a partir de su propio reloj.
  const elapsed = Math.min(
    MAX_SECONDS_PER_BEAT,
    Math.max(
      0,
      Math.round((Date.now() - new Date(session.last_heartbeat_at).getTime()) / 1000)
    )
  );

  await supabase
    .from("sessions")
    .update({
      last_heartbeat_at: new Date().toISOString(),
      duration_secs: session.duration_secs + elapsed,
    })
    .eq("id", sessionId);

  await recordUsage(quota.userId, "stt_seconds", elapsed, sessionId);

  const remainingMinutes = Math.max(
    0,
    quota.remainingMinutes - Math.ceil(elapsed / 60)
  );

  return NextResponse.json({
    remainingMinutes,
    exhausted: remainingMinutes <= 0,
  });
}
