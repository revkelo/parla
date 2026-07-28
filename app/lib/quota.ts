import { createAdminClient, createClient } from "./supabase/server";

export type QuotaState = {
  userId: string;
  email: string;
  fullName: string | null;
  esAdmin: boolean;
  /** Ve motores, respaldos y diagnóstico. Cuenta de pruebas, no de cliente. */
  verTecnico: boolean;
  planId: string;
  planName: string;
  limitMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  exhausted: boolean;
};

/**
 * Estado de cuota del usuario de la sesión actual.
 * Devuelve `null` si no hay sesión válida.
 */
export async function getQuota(): Promise<QuotaState | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id, email, full_name, role, ver_tecnico, plans (name, monthly_minutes)")
    .eq("id", user.id)
    .single<{
      plan_id: string;
      email: string;
      full_name: string | null;
      role: "user" | "admin";
      ver_tecnico: boolean;
      plans: { name: string; monthly_minutes: number } | null;
    }>();

  if (!profile?.plans) return null;

  const { data: used } = await supabase.rpc("current_usage_minutes", {
    p_user_id: user.id,
  });

  const usedMinutes = typeof used === "number" ? used : 0;
  const limitMinutes = profile.plans.monthly_minutes;
  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);

  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name,
    esAdmin: profile.role === "admin",
    // El administrador la tiene siempre: si no, no podría diagnosticar nada.
    verTecnico: profile.role === "admin" || profile.ver_tecnico === true,
    planId: profile.plan_id,
    planName: profile.plans.name,
    limitMinutes,
    usedMinutes,
    remainingMinutes,
    exhausted: remainingMinutes <= 0,
  };
}

/**
 * Registra consumo. Va con service role a propósito: si el cliente pudiera
 * escribir aquí, bastaría con no reportar los minutos para no pagarlos.
 */
export async function recordUsage(
  userId: string,
  kind: "stt_seconds" | "ai_request",
  quantity: number,
  sessionId?: string | null
): Promise<void> {
  if (quantity <= 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("usage_events").insert({
    user_id: userId,
    session_id: sessionId ?? null,
    kind,
    quantity: Math.round(quantity),
  });

  if (error) {
    // No tumbamos la interpretación del usuario por un fallo de contabilidad,
    // pero tiene que quedar rastro para poder cuadrarlo después.
    console.error("No se pudo registrar consumo:", error.message, {
      userId,
      kind,
      quantity,
    });
  }
}
