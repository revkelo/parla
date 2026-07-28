import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

/**
 * Punto de retorno de OAuth y de los enlaces de confirmación por correo:
 * canjea el `code` por una sesión y deja al usuario dentro de la app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/app";
  // Mismo cuidado que en las acciones: nada de redirigir fuera del sitio.
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
