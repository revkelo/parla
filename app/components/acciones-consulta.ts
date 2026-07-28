"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";

/**
 * Borra una consulta del historial.
 *
 * Los turnos se van con ella por la clave foránea. El consumo NO: los
 * `usage_events` apuntan a la sesión con `on delete set null`, así que borrar
 * una consulta no devuelve minutos ni descuadra la facturación. Borrar el
 * historial es un derecho del usuario; borrar el contador no.
 */
export async function borrarConsulta(formData: FormData) {
  const id = String(formData.get("sessionId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS acota el borrado a las sesiones propias: un id ajeno no borra nada.
  await supabase.from("sessions").delete().eq("id", id);

  revalidatePath("/historial");
  redirect("/historial");
}
