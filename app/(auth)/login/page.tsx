import type { Metadata } from "next";
import { AuthForm } from "../AuthForm";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Entrar · parla" };

/** Motivos por los que se puede llegar aquí rebotado desde otro flujo. */
const MOTIVOS: Record<string, string> = {
  google: "No pudimos conectar con Google. Entra con tu correo y contraseña.",
  callback:
    "El enlace caducó o ya se usó. Vuelve a intentarlo desde aquí.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <AuthForm
      mode="login"
      action={signIn}
      next={next ?? "/app"}
      aviso={error ? (MOTIVOS[error] ?? MOTIVOS.callback) : null}
    />
  );
}
