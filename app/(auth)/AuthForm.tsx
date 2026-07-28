"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm " +
  "placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent/40";

const labelClass =
  "block font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint";

function SubmitButton({
  label,
  bloqueado = false,
}: {
  label: string;
  bloqueado?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || bloqueado}
      className="w-full rounded-lg bg-foreground px-3.5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50"
    >
      {pending ? "Un momento…" : label}
    </button>
  );
}

export function AuthForm({
  mode,
  action,
  next,
  aviso = null,
}: {
  mode: "login" | "registro";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next: string;
  /** Motivo por el que el usuario fue devuelto aquí desde otro flujo. */
  aviso?: string | null;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(action, {
    error: null,
  });
  const isLogin = mode === "login";

  // Solo para el aviso en vivo. La comprobación que manda está en el servidor:
  // esto es para que el usuario se entere ANTES de pulsar, no después.
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const avisoRepetida = useId();
  const cortaAun = !isLogin && clave.length > 0 && clave.length < 8;
  const noCoinciden = !isLogin && repetida.length > 0 && clave !== repetida;
  const coinciden = !isLogin && repetida.length > 0 && clave === repetida;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-lg bg-accent/15 font-mono text-[17px] font-semibold text-accent"
        >
          p
        </span>
        <h1 className="text-lg font-semibold tracking-tight">
          {isLogin ? "Entra a parla" : "Crea tu cuenta"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isLogin
            ? "Interpretación médica ES ⇄ EN en vivo."
            : "Prueba gratis, sin tarjeta."}
        </p>
      </div>

      {aviso && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2.5 text-sm text-amber-600"
        >
          {aviso}
        </p>
      )}

      {/* Google queda anunciado pero inactivo hasta configurar OAuth: un botón
          que falla al pulsarlo da peor impresión que uno que avisa. */}
      <div className="mb-4">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Todavía no disponible"
          className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-sm font-medium opacity-60"
        >
          <GoogleMark />
          <span className="text-muted">Continuar con Google</span>
          <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
            Próximamente
          </span>
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
          o
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form action={formAction} className="space-y-3.5">
        <input type="hidden" name="next" value={next} />

        {!isLogin && (
          <div className="space-y-1.5">
            <label htmlFor="full_name" className={labelClass}>
              Nombre
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              placeholder="Andrés Gómez"
              className={inputClass}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>
            {isLogin && (
              <Link
                href="/recuperar"
                className="text-[13px] text-muted hover:text-foreground hover:underline"
              >
                ¿La olvidaste?
              </Link>
            )}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "••••••••" : "Mínimo 8 caracteres"}
            className={inputClass}
            value={isLogin ? undefined : clave}
            onChange={isLogin ? undefined : (e) => setClave(e.target.value)}
          />
          {cortaAun && (
            <p className="text-[12.5px] text-muted">
              Le faltan {8 - clave.length} caracteres.
            </p>
          )}
        </div>

        {/* Repetir la contraseña. Al registrarse no hay forma de comprobar que
            se escribió lo que se quería: un dedo torcido deja al usuario fuera
            de una cuenta recién creada, y encima con el correo ya consumido. */}
        {!isLogin && (
          <div className="space-y-1.5">
            <label htmlFor="confirm" className={labelClass}>
              Repite la contraseña
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              placeholder="La misma otra vez"
              aria-describedby={noCoinciden ? avisoRepetida : undefined}
              aria-invalid={noCoinciden || undefined}
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              className={`${inputClass} ${
                noCoinciden ? "border-live/50" : coinciden ? "border-accent/50" : ""
              }`}
            />
            {noCoinciden && (
              <p id={avisoRepetida} className="text-[12.5px] text-live">
                Las dos contraseñas no coinciden.
              </p>
            )}
            {coinciden && (
              <p className="text-[12.5px] text-accent">Coinciden.</p>
            )}
          </div>
        )}

        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-live/30 bg-live/[0.07] px-3 py-2 text-sm text-live"
          >
            {state.error}
          </p>
        )}

        <SubmitButton
          label={isLogin ? "Entrar" : "Crear cuenta"}
          bloqueado={noCoinciden || cortaAun}
        />
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {isLogin ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
        <Link
          href={isLogin ? "/registro" : "/login"}
          className="font-medium text-accent hover:underline"
        >
          {isLogin ? "Regístrate" : "Entra"}
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
