import { createClient } from "./supabase/server";

// Los tipos y los formateadores viven en `admin-tipos` para que los componentes
// de cliente puedan usarlos sin arrastrar el cliente de servidor de Supabase.
export * from "./admin-tipos";

/** `true` si el usuario de la sesión es administrador. */
export async function esAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // Se pregunta a la base, no a nada que venga del cliente.
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
