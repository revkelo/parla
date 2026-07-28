import { DeepgramClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";

// Evita cachear la respuesta: cada petición debe emitir un token nuevo.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta DEEPGRAM_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  // La clave es de la plataforma, así que nadie abre un socket sin sesión
  // iniciada y sin cuota disponible.
  const quota = await getQuota();
  if (!quota) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  }
  if (quota.exhausted) {
    return NextResponse.json(
      {
        error: "Agotaste los minutos de tu plan este mes.",
        code: "quota_exhausted",
        plan: quota.planName,
        limitMinutes: quota.limitMinutes,
      },
      { status: 402 }
    );
  }

  const supabase = await createClient();

  // Reanudar una consulta guardada en vez de abrir una nueva.
  const continuar = new URL(req.url).searchParams.get("sessionId");

  let session: { id: string } | null = null;

  if (continuar) {
    // Reabrir exige poner `last_heartbeat_at` a ahora. El latido factura el
    // tiempo transcurrido desde esa marca, así que reanudar una consulta de
    // ayer sin reiniciarla le cobraría al usuario todas las horas que la
    // sesión estuvo cerrada. RLS acota la escritura a las sesiones propias:
    // un id ajeno no encuentra fila y no devuelve nada.
    const { data, error } = await supabase
      .from("sessions")
      .update({
        ended_at: null,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", continuar)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      console.error("No se pudo reanudar la sesión:", error.message);
    }
    session = data ?? null;

    if (!session) {
      return NextResponse.json(
        { error: "Esa consulta no existe o no es tuya." },
        { status: 404 }
      );
    }
  } else {
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: quota.userId, stt_engine: "deepgram" })
      .select("id")
      .single<{ id: string }>();

    if (error || !data) {
      console.error("No se pudo abrir la sesión:", error?.message);
      return NextResponse.json(
        { error: "No se pudo iniciar la sesión." },
        { status: 500 }
      );
    }
    session = data;
  }

  try {
    const deepgram = new DeepgramClient({ apiKey });

    // Token temporal de corta duración. El navegador lo usa para abrir el
    // WebSocket directo con Deepgram sin exponer la API key real.
    const result = await deepgram.auth.v1.tokens.grant({ ttl_seconds: 30 });

    if (!result?.access_token) {
      return NextResponse.json(
        { error: "No se pudo generar el token de Deepgram." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      access_token: result.access_token,
      expires_in: result.expires_in,
      session_id: session.id,
      remaining_minutes: quota.remainingMinutes,
    });
  } catch (err) {
    console.error("Error generando token de Deepgram:", err);
    return NextResponse.json(
      { error: "Error interno al generar el token." },
      { status: 500 }
    );
  }
}
