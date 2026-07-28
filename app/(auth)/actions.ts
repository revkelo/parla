"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/app/lib/supabase/server";
import { MENSAJE_CLAVE, validarClaveNueva } from "./validacion";

export type AuthState = { error: string | null; ok?: string };

/** Evita open redirect: solo admitimos rutas internas. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/**
 * A dónde va alguien recién autenticado.
 *
 * Si venía de una ruta concreta, ahí vuelve. Si no, el administrador aterriza
 * en su panel y el resto en el intérprete: quien entra con una cuenta de
 * administración viene a administrar, y obligarle a buscar el enlace en el menú
 * de la cuenta es hacerle dar un rodeo cada vez.
 */
async function destinoTrasEntrar(next: FormDataEntryValue | null) {
  const pedido = safeNext(next);
  if (pedido) return pedido;

  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true ? "/admin" : "/app";
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Escribe tu correo y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // No distinguimos "no existe" de "contraseña incorrecta": decirlo permitiría
    // averiguar qué correos están registrados.
    return { error: "Correo o contraseña incorrectos." };
  }

  const destino = await destinoTrasEntrar(formData.get("next"));
  revalidatePath("/", "layout");
  redirect(destino);
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "");

  if (!email) {
    return { error: MENSAJE_CLAVE.vacia };
  }
  // Se valida aquí y no solo en el formulario: sin esto, quien mande el
  // formulario a mano se crearía una cuenta con una contraseña que escribió
  // mal y no podría volver a entrar, con el correo ya consumido.
  const clave = validarClaveNueva(password, confirm);
  if (!clave.ok) {
    return { error: MENSAJE_CLAVE[clave.motivo] };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || null },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Si Supabase no exige confirmación, devuelve sesión y el usuario ya está
  // dentro: mandarlo a "revisa tu correo" sería mentirle y dejarlo esperando
  // un mensaje que nunca va a llegar.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(safeNext(formData.get("next")) ?? "/app");
  }

  redirect("/registro/confirma");
}

/**
 * Sin usar por ahora: el botón de Google está como "Próximamente" hasta que
 * existan credenciales de OAuth en Google Cloud y el proveedor esté activado
 * en Supabase. Se conserva para volver a engancharlo entonces.
 */
export async function signInWithGoogle(formData: FormData) {
  const origin = (await headers()).get("origin");
  const next = safeNext(formData.get("next")) ?? "/app";
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }
  redirect(data.url);
}

export async function resendConfirmation(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe el correo con el que te registraste." };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  // El límite de envíos sí conviene decirlo: si no, el usuario reintenta en
  // bucle creyendo que no funciona.
  if (error) {
    return {
      error: error.message.toLowerCase().includes("rate")
        ? "Demasiados intentos. Espera unos minutos y vuelve a probar."
        : error.message,
    };
  }
  return { error: null, ok: "Te lo reenviamos. Revisa tu bandeja y el spam." };
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe tu correo." };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/nueva-contrasena`,
  });

  // No revelamos si el correo existe: contestar distinto permitiría averiguar
  // qué cuentas están registradas.
  redirect("/recuperar/enviado");
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  // Las mismas reglas que al registrarse: cambiar la contraseña por el enlace
  // de recuperación no debería admitir una más débil que la original.
  const clave = validarClaveNueva(password, confirm);
  if (!clave.ok) {
    return { error: MENSAJE_CLAVE[clave.motivo] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "El enlace caducó. Pide uno nuevo." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
