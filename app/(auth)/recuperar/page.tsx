"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type AuthState, requestPasswordReset } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-foreground px-3.5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Enviando…" : "Enviar enlace"}
    </button>
  );
}

export default function RecuperarPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    { error: null }
  );

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-lg font-semibold tracking-tight">
        Recuperar contraseña
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Te enviamos un enlace para elegir una nueva.
      </p>

      <form action={formAction} className="space-y-3.5">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint"
          >
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-live/30 bg-live/[0.07] px-3 py-2 text-sm text-live"
          >
            {state.error}
          </p>
        )}

        <Submit />
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}
