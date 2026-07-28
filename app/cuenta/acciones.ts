"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";

export type PerfilState = { error: string | null; ok?: boolean };

/**
 * Cambia el nombre de la cuenta.
 *
 * Va con el cliente normal, no con service role, a propósito: desde 0005 el
 * único permiso de escritura que tiene un usuario autenticado sobre `profiles`
 * es la columna `full_name`. Que esta acción no pueda tocar nada más aunque
 * quisiera es justo la garantía que queremos.
 */
export async function guardarNombre(
  _prev: PerfilState,
  formData: FormData
): Promise<PerfilState> {
  const nombre = String(formData.get("full_name") ?? "").trim();
  if (nombre.length > 80) {
    return { error: "El nombre es demasiado largo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: nombre || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // El nombre sale en la barra lateral y en el menú de la cuenta.
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}
