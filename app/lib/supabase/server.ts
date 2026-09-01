import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Route Handlers y Server Actions.
 * Respeta RLS: actúa como el usuario de la sesión.
 *
 * Las tablas de parla viven en el esquema `parla`, no en `public`. Se declara
 * aquí, en el cliente, y no en cada consulta: así las decenas de `.from(...)`
 * repartidas por la app siguen escribiéndose igual. `public` se quedó solo con
 * la extensión btree_gist, que no es de nadie en particular.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "parla" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. El refresco de
            // sesión lo hace el proxy, así que aquí se puede ignorar.
          }
        },
      },
    }
  );
}

/**
 * Cliente con service role: se salta RLS por completo.
 *
 * Úsalo SOLO en código de servidor que ya verificó la identidad por su cuenta
 * (webhook de Stripe, escritura de consumo). Nunca lo expongas a una ruta que
 * acepte el user_id desde el cliente.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    db: { schema: "parla" },
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
