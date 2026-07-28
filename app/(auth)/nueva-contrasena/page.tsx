"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type AuthState, updatePassword } from "../actions";

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm " +
  "placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent/40";
const labelClass =
  "block font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-foreground px-3.5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Guardando…" : "Guardar contraseña"}
    </button>
  );
}

export default function NuevaContrasenaPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    updatePassword,
    { error: null }
  );

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-lg font-semibold tracking-tight">Nueva contraseña</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Elige una de al menos 8 caracteres.
      </p>

      <form action={formAction} className="space-y-3.5">
        <div className="space-y-1.5">
          <label htmlFor="password" className={labelClass}>
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className={labelClass}>
            Repítela
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
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
    </div>
  );
}
