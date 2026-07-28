import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Revisa tu correo · parla" };

export default function EnviadoPage() {
  return (
    <div className="w-full max-w-sm text-center">
      <h1 className="text-lg font-semibold tracking-tight">Revisa tu correo</h1>
      <p className="mt-2 text-sm text-muted">
        Si ese correo tiene una cuenta en parla, le acaba de llegar un enlace
        para elegir una contraseña nueva. Caduca en una hora.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
      >
        Volver a entrar
      </Link>
    </div>
  );
}
