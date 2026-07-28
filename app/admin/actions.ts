"use server";

import { revalidatePath } from "next/cache";
import { esAdmin } from "@/app/lib/admin";
import { createAdminClient, createClient } from "@/app/lib/supabase/server";

export type AdminState = { error: string | null; ok?: string };

/**
 * Cambia el plan de un usuario a mano, sin pasar por Stripe.
 *
 * Solo para soporte y pruebas: si el usuario tiene una suscripción viva, el
 * próximo evento de Stripe volverá a imponer el plan que corresponda al cobro.
 */
export async function cambiarPlan(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  // La comprobación se repite aquí aunque la página ya la haga: una acción de
  // servidor es un endpoint público, y nadie debe poder invocarla sin ser admin.
  if (!(await esAdmin())) {
    return { error: "No tienes permiso." };
  }

  const userId = String(formData.get("userId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  if (!userId || !planId) return { error: "Faltan datos." };

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("id, name")
    .eq("id", planId)
    .single<{ id: string; name: string }>();
  if (!plan) return { error: "Ese plan no existe." };

  // Service role: desde 0005 `plan_id` no es escribible por ningún cliente
  // autenticado, ni siquiera por un admin. El permiso se comprueba arriba y
  // la escritura la hace el servidor.
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ plan_id: planId, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { error: null, ok: `Plan cambiado a ${plan.name}.` };
}

/** Pone a cero el consumo del período en curso de un usuario. */
export async function reiniciarConsumo(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await esAdmin())) {
    return { error: "No tienes permiso." };
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Faltan datos." };

  // El corte tiene que ser el mismo que usa `current_usage_minutes`: el inicio
  // del período facturado si hay suscripción viva, y si no el mes natural. Con
  // un corte distinto, el panel diría "0 min" mientras la cuota sigue contando.
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("current_period_start")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("current_period_start", { ascending: false })
    .limit(1)
    .maybeSingle<{ current_period_start: string }>();

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const desde = sub?.current_period_start ?? inicioMes.toISOString();

  // Service role: `usage_events` no admite borrado desde el cliente, y con
  // razón. El admin actúa a través del servidor, no saltándose las políticas.
  const { error } = await admin
    .from("usage_events")
    .delete()
    .eq("user_id", userId)
    .gte("occurred_at", desde);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { error: null, ok: "Consumo del período reiniciado." };
}

/**
 * Da o quita permisos de administración.
 *
 * Nadie puede degradarse a sí mismo: el caso normal es equivocarse de fila y
 * quedarse fuera del panel, y recuperarlo exige entrar a la base a mano.
 */
export async function cambiarRol(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await esAdmin())) {
    return { error: "No tienes permiso." };
  }

  const userId = String(formData.get("userId") ?? "");
  const rol = String(formData.get("rol") ?? "");
  if (!userId || (rol !== "admin" && rol !== "user")) {
    return { error: "Faltan datos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (rol === "user" && user?.id === userId) {
    return { error: "No puedes quitarte a ti mismo la administración." };
  }

  const admin = createAdminClient();

  // Quedarse sin ningún administrador deja el panel inaccesible para siempre
  // desde la aplicación. Se comprueba antes de escribir, no después.
  if (rol === "user") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Tiene que quedar al menos un administrador." };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: rol, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {
    error: null,
    ok: rol === "admin" ? "Ahora es administrador." : "Permisos retirados.",
  };
}

/**
 * Da o quita la vista técnica (motores, respaldos, diagnóstico).
 *
 * Es para cuentas de prueba, no para clientes: un intérprete en consulta no
 * necesita elegir entre Groq y Gemini, y ofrecérselo solo le da una forma más
 * de estropear su sesión.
 */
export async function cambiarVistaTecnica(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  if (!(await esAdmin())) {
    return { error: "No tienes permiso." };
  }

  const userId = String(formData.get("userId") ?? "");
  const valor = String(formData.get("valor") ?? "") === "si";
  if (!userId) return { error: "Faltan datos." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ ver_tecnico: valor, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {
    error: null,
    ok: valor ? "Ahora ve la vista técnica." : "Vista técnica retirada.",
  };
}
