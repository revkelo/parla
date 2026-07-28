"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { type Textos, textosDe } from "@/app/lib/i18n";
import { borrarConsulta } from "./acciones-consulta";

export type TurnoExportable = {
  hora: string;
  origen: "es" | "en";
  source: string;
  target: string;
};

/**
 * Descargar y borrar una consulta guardada.
 *
 * El borrado pide confirmación en el propio botón en lugar de abrir un diálogo:
 * son dos pulsaciones igualmente, y el segundo estado ("¿Seguro?") dice qué va
 * a pasar sin tapar la consulta que el usuario está mirando para decidir.
 */
export function AccionesConsulta({
  sessionId,
  titulo,
  fecha,
  turnos,
  t = textosDe("es"),
}: {
  sessionId: string;
  titulo: string;
  fecha: string;
  turnos: TurnoExportable[];
  t?: Textos;
}) {
  const [confirmando, setConfirmando] = useState(false);

  const descargar = () => {
    const cabecera =
      `PARLA — Registro de interpretación médica (ES ⇄ EN)\n` +
      `${titulo}\n` +
      `${new Date(fecha).toLocaleString("es")}\n` +
      `Turnos: ${turnos.length}\n` +
      `${"—".repeat(48)}\n\n`;

    const cuerpo = turnos
      .map((t) => {
        const destino = t.origen === "es" ? "EN" : "ES";
        return `[${t.hora}] (${t.origen.toUpperCase()}) ${t.source}\n(${destino}) ${t.target}`;
      })
      .join("\n\n");

    const blob = new Blob([cabecera + cuerpo + "\n"], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parla-${fecha.slice(0, 10)}-${sessionId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiar = () => {
    void navigator.clipboard.writeText(
      turnos
        .map((t) => `${t.source}\n${t.target}`)
        .join("\n\n")
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Boton onClick={copiar}>{t.app.copiar}</Boton>
      <Boton onClick={descargar}>{t.app.descargar}</Boton>

      {confirmando ? (
        <form action={borrarConsulta} className="flex items-center gap-1.5">
          <input type="hidden" name="sessionId" value={sessionId} />
          <BotonBorrar t={t} />
          <Boton onClick={() => setConfirmando(false)}>
            {t.comun.cancelar}
          </Boton>
        </form>
      ) : (
        <Boton onClick={() => setConfirmando(true)} peligro>
          {t.app.borrar}
        </Boton>
      )}
    </div>
  );
}

function Boton({
  onClick,
  children,
  peligro,
}: {
  onClick: () => void;
  children: React.ReactNode;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        peligro
          ? "border-hairline text-muted hover:border-live/40 hover:text-live"
          : "border-hairline text-muted hover:bg-foreground/[0.05] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function BotonBorrar({ t }: { t: Textos }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-live/40 bg-live/[0.08] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-live transition-colors hover:bg-live/[0.14] disabled:opacity-50"
    >
      {pending ? t.historial.borrando : t.historial.confirmarBorrado}
    </button>
  );
}
