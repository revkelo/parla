"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Textos } from "@/app/lib/i18n";
import { type PerfilState, guardarNombre } from "./acciones";

/**
 * Editar el nombre de la cuenta.
 *
 * Es lo único que el usuario decide sobre su propio perfil: desde la migración
 * 0005, `plan_id`, `role` y `email` no son escribibles por ningún cliente
 * autenticado, así que aquí ni se ofrecen.
 */
export function PerfilForm({
  nombreInicial,
  email,
  t,
}: {
  nombreInicial: string;
  email: string;
  t: Textos;
}) {
  const [estado, accion] = useActionState<PerfilState, FormData>(guardarNombre, {
    error: null,
  });

  return (
    <form action={accion} className="mt-4 max-w-md">
      <label className="block">
        <span className="text-[13px] font-medium">{t.cuenta.nombre}</span>
        <input
          name="full_name"
          defaultValue={nombreInicial}
          maxLength={80}
          autoComplete="name"
          className="mt-1.5 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <span className="mt-1 block text-[11.5px] text-muted">
          {t.cuenta.nombrePie}
        </span>
      </label>

      <div className="mt-4">
        <span className="text-[13px] font-medium">{t.cuenta.correo}</span>
        <p className="mt-1.5 rounded-lg bg-foreground/[0.04] px-3 py-2 text-sm text-muted">
          {email}
        </p>
        <span className="mt-1 block text-[11.5px] text-faint">
          {t.cuenta.correoPie}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Guardar t={t} />
        {estado.ok && (
          <span role="status" className="text-[13px] text-accent">
            {t.comun.guardado}
          </span>
        )}
        {estado.error && (
          <span role="status" className="text-[13px] text-live">
            {estado.error}
          </span>
        )}
      </div>
    </form>
  );
}

function Guardar({ t }: { t: Textos }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50"
    >
      {pending ? t.comun.guardando : t.comun.guardar}
    </button>
  );
}
