"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type AdminState,
  cambiarPlan,
  cambiarRol,
  cambiarVistaTecnica,
  reiniciarConsumo,
} from "./actions";

function Boton({
  children,
  tono = "neutro",
  title,
}: {
  children: React.ReactNode;
  tono?: "neutro" | "peligro";
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${
        tono === "peligro"
          ? "border-live/30 text-live hover:bg-live/10"
          : "border-hairline text-muted hover:bg-foreground/[0.05] hover:text-foreground"
      }`}
    >
      {pending ? "…" : children}
    </button>
  );
}

export function FilaAcciones({
  userId,
  planActual,
  rolActual,
  verTecnico,
  planes,
}: {
  userId: string;
  planActual: string;
  rolActual: "user" | "admin";
  verTecnico: boolean;
  planes: Array<{ id: string; name: string }>;
}) {
  const [estadoPlan, accionPlan] = useActionState<AdminState, FormData>(
    cambiarPlan,
    { error: null }
  );
  const [estadoConsumo, accionConsumo] = useActionState<AdminState, FormData>(
    reiniciarConsumo,
    { error: null }
  );
  const [estadoRol, accionRol] = useActionState<AdminState, FormData>(
    cambiarRol,
    { error: null }
  );
  const [estadoTecnica, accionTecnica] = useActionState<AdminState, FormData>(
    cambiarVistaTecnica,
    { error: null }
  );

  const mensaje =
    estadoPlan.ok ??
    estadoConsumo.ok ??
    estadoRol.ok ??
    estadoTecnica.ok ??
    estadoPlan.error ??
    estadoConsumo.error ??
    estadoRol.error ??
    estadoTecnica.error;
  const esError = !!(
    estadoPlan.error ??
    estadoConsumo.error ??
    estadoRol.error ??
    estadoTecnica.error
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={accionPlan} className="flex items-center gap-1.5">
          <input type="hidden" name="userId" value={userId} />
          <select
            name="planId"
            defaultValue={planActual}
            aria-label="Plan del usuario"
            className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {planes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Boton title="Aplicar el plan seleccionado">Aplicar</Boton>
        </form>

        <form action={accionConsumo}>
          <input type="hidden" name="userId" value={userId} />
          <Boton title="Pone a cero los minutos del período en curso">
            Reiniciar
          </Boton>
        </form>

        <form action={accionTecnica}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="valor" value={verTecnico ? "no" : "si"} />
          <Boton
            title={
              verTecnico
                ? "Dejar de mostrarle motores y diagnóstico"
                : "Convertir en cuenta de pruebas: ve motores y diagnóstico"
            }
          >
            {verTecnico ? "Quitar pruebas" : "Cuenta pruebas"}
          </Boton>
        </form>

        <form action={accionRol}>
          <input type="hidden" name="userId" value={userId} />
          <input
            type="hidden"
            name="rol"
            value={rolActual === "admin" ? "user" : "admin"}
          />
          <Boton
            tono={rolActual === "admin" ? "peligro" : "neutro"}
            title={
              rolActual === "admin"
                ? "Retirar el acceso al panel de administración"
                : "Dar acceso al panel de administración"
            }
          >
            {rolActual === "admin" ? "Quitar admin" : "Hacer admin"}
          </Boton>
        </form>
      </div>

      {mensaje && (
        <p
          role="status"
          className={`text-[11px] ${esError ? "text-live" : "text-accent"}`}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
