import { NextResponse } from "next/server";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Marca una sesión como terminada.
 *
 * Hasta ahora nadie ponía `ended_at`: toda sesión quedaba abierta para siempre.
 * El cobro no se veía afectado porque los minutos los cuenta el latido, pero el
 * historial no podía distinguir una consulta acabada de una en curso, y el
 * panel de administración contaba como "en vivo" cualquier pestaña que hubiera
 * latido en los últimos dos minutos.
 */
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

  // RLS se encarga de que solo se pueda cerrar una sesión propia: un id ajeno
  // no encuentra fila y no cierra nada.
  const { data, error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null)
    .select("id, duration_secs")
    .maybeSingle<{ id: string; duration_secs: number }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cerrar dos veces no es un error: el usuario pudo detener y cerrar pestaña.
  return NextResponse.json({ cerrada: !!data, durationSecs: data?.duration_secs ?? 0 });
}
