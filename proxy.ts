import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rutas que exigen sesión iniciada. `/admin` además comprueba el rol dentro
 * de la propia página: el proxy solo garantiza que haya sesión.
 */
const PROTECTED = ["/app", "/cuenta", "/admin"];
/** Rutas de autenticación: si ya hay sesión, sobran. */
const AUTH_ROUTES = ["/login", "/registro"];

export async function proxy(request: NextRequest) {
  // La respuesta se va mutando para poder arrastrar las cookies renovadas.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() valida el token contra Supabase. getSession() solo lee la cookie
  // y por tanto es falsificable: no sirve para decidir accesos.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Para devolver al usuario a donde iba después de entrar.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Todo salvo estáticos, imágenes optimizadas y los webhooks (Stripe y el
    // hook de correo de Supabase), que se autentican con su propia firma y no
    // deben pasar por sesión.
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/auth/email-hook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
