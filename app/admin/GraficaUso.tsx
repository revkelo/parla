"use client";

import { useState } from "react";
import type { PuntoSerie } from "@/app/lib/admin-tipos";

/**
 * Minutos transcritos por día. Una sola serie, así que no lleva leyenda: el
 * título dice qué se está midiendo y el color no codifica identidad, solo
 * magnitud.
 *
 * La escala arranca en cero siempre. Recortar el eje para "que se note la
 * variación" es la forma más rápida de mentir con una barra.
 */
export function GraficaUso({ serie }: { serie: PuntoSerie[] }) {
  const [activo, setActivo] = useState<number | null>(null);

  const max = Math.max(...serie.map((p) => p.minutos), 1);
  const total = serie.reduce((a, p) => a + p.minutos, 0);
  const vacia = total === 0;
  const iMax = serie.findIndex((p) => p.minutos === max);
  const punto = activo === null ? null : serie[activo];

  const fecha = (iso: string, largo = false) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es", {
      day: "numeric",
      month: largo ? "long" : "short",
    });

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-sm font-medium">Minutos transcritos por día</h2>
          <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            últimos {serie.length} días
          </p>
        </div>
        <p className="text-right">
          <span className="text-2xl font-semibold tabular-nums">
            {total.toLocaleString("es")}
          </span>
          <span className="ml-1 text-[13px] text-muted">min en total</span>
        </p>
      </div>

      {vacia ? (
        <p className="mt-6 mb-2 text-sm text-muted">
          Todavía no hay consumo registrado en este rango.
        </p>
      ) : (
        <>
          <div className="relative mt-5">
            {/* Sin rejilla: basta con rotular el techo de la escala. Las líneas
                de referencia compiten con las barras y no añaden precisión que
                el rótulo no dé ya. */}
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 font-mono text-[9px] tabular-nums text-faint"
            >
              {max.toLocaleString("es")}
            </span>

            <div
              className="flex h-28 items-end gap-[2px]"
              onPointerLeave={() => setActivo(null)}
            >
              {serie.map((p, i) => {
                const alto = (p.minutos / max) * 100;
                return (
                  <div
                    key={p.dia}
                    onPointerEnter={() => setActivo(i)}
                    // La zona sensible es toda la columna, no la barra: con
                    // días de 2 px de alto, apuntar a la barra es imposible.
                    className="group relative flex h-full flex-1 cursor-default items-end"
                  >
                    <div
                      className={`w-full rounded-t-[4px] transition-colors ${
                        activo === i ? "bg-accent" : "bg-accent/45"
                      }`}
                      // Un mínimo visible para no confundir "un minuto" con
                      // "ningún minuto"; el cero sí queda a ras de la línea.
                      style={{
                        height: p.minutos === 0 ? "0" : `max(2px, ${alto}%)`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Etiquetas directas: solo el pico y el último día. Un número
                sobre cada barra sería ruido. */}
            <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
              <span>{fecha(serie[0].dia)}</span>
              {iMax > 2 && iMax < serie.length - 3 && (
                <span className="text-muted">
                  pico {max.toLocaleString("es")} min · {fecha(serie[iMax].dia)}
                </span>
              )}
              <span>hoy</span>
            </div>

            {punto && (
              <div
                role="status"
                className="pointer-events-none absolute -top-1 left-0 right-0 flex justify-center"
              >
                <span className="rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[10px] tabular-nums text-muted shadow-sm">
                  {fecha(punto.dia, true)} ·{" "}
                  <span className="text-foreground">{punto.minutos} min</span> ·{" "}
                  {punto.sesiones} {punto.sesiones === 1 ? "sesión" : "sesiones"}
                </span>
              </div>
            )}
          </div>

          {/* Alternativa no visual: quien no distinga las barras, o lea con
              lector de pantalla, tiene los mismos números aquí. */}
          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-muted">
              Ver como tabla
            </summary>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-hairline">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-hairline text-left">
                    <th className="px-3 py-1.5 font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-faint">
                      Día
                    </th>
                    <th className="px-3 py-1.5 text-right font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-faint">
                      Minutos
                    </th>
                    <th className="px-3 py-1.5 text-right font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-faint">
                      Sesiones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...serie].reverse().map((p) => (
                    <tr key={p.dia} className="border-b border-hairline/60 last:border-0">
                      <td className="px-3 py-1 text-muted">{fecha(p.dia, true)}</td>
                      <td className="px-3 py-1 text-right font-mono tabular-nums">
                        {p.minutos}
                      </td>
                      <td className="px-3 py-1 text-right font-mono tabular-nums text-muted">
                        {p.sesiones}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
