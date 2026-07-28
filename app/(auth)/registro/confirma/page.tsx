"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type AuthState, resendConfirmation } from "../../actions";

function Reenviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/[0.04] disabled:opacity-50"
    >
      {pending ? "Reenviando…" : "Reenviar correo"}
    </button>
  );
}

export default function ConfirmaPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    resendConfirmation,
    { error: null }
  );

  return (
    <div className="w-full max-w-sm text-center">
      <h1 className="text-lg font-semibold tracking-tight">Revisa tu correo</h1>
      <p className="mt-2 text-sm text-muted">
        Te enviamos un enlace para confirmar tu cuenta. Ábrelo y entras directo
        a parla.
      </p>

      <form action={formAction} className="mt-6 space-y-3 text-left">
        <p className="text-[13px] text-muted">
          ¿No llegó? Mira en spam, o pídelo otra vez:
        </p>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          className="w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />

        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-live/30 bg-live/[0.07] px-3 py-2 text-sm text-live"
          >
            {state.error}
          </p>
        )}
        {state.ok && (
          <p
            role="status"
            className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent"
          >
            {state.ok}
          </p>
        )}

        <Reenviar />
      </form>

      <Link
        href="/login"
        className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
      >
        Volver a entrar
      </Link>
    </div>
  );
}
