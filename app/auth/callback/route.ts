import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

/**
 * Punto de retorno de OAuth y de los enlaces de confirmación por correo.
 *
 * Un enlace de correo puede llegar de tres formas distintas, y esto se
 * comprobó contra producción: la versión anterior solo entendía la primera y
 * dejaba a la persona en `/login?error=callback`. En confirmación era feo
 * -la cuenta sí quedaba confirmada-; en recuperación era peor, porque nunca
 * llegaba al formulario para poner la contraseña nueva.
 *
 *   1. `?code=…`        el flujo PKCE, el que usa @supabase/ssr cuando el
 *                       registro sale de nuestra propia web.
 *   2. `?token_hash=…`  lo que manda la plantilla de correo si usa
 *                       `{{ .TokenHash }}`.
 *   3. `#access_token=` el flujo implícito, que es lo que devuelve un enlace
 *                       generado por la API de administración.
 *
 * Las dos primeras se resuelven aquí. La tercera NO se puede: el fragmento de
 * una URL no viaja al servidor, el navegador se lo queda. Por eso se reenvía a
 * una página cliente, que sí lo ve. El fragmento sobrevive a la redirección
 * porque el navegador lo conserva cuando el destino no trae uno propio.
 */

/** Mismo cuidado que en las acciones: nada de redirigir fuera del sitio. */
function destinoSeguro(valor: string | null): string {
  if (!valor || !valor.startsWith("/")) return "/app";
  if (valor.startsWith("//") || valor.startsWith("/\\")) return "/app";
  return valor;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = destinoSeguro(searchParams.get("next"));

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo as "signup" | "recovery" | "invite" | "email_change",
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  // Ni código ni token: o viene en el fragmento, o el enlace no vale nada.
  // Lo decide la página cliente, que es la única que puede mirar.
  return NextResponse.redirect(
    `${origin}/auth/completar?next=${encodeURIComponent(next)}`
  );
}
