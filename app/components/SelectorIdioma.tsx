"use client";

import { useTransition } from "react";
import { IDIOMAS, type Idioma, NOMBRE_IDIOMA } from "@/app/lib/i18n";
import { cambiarIdioma } from "./acciones-idioma";

/**
 * Elige el idioma de la interfaz.
 *
 * Guarda una cookie y recarga desde el servidor, en vez de traducir en el
 * cliente: así la próxima visita ya llega en el idioma correcto y no hay un
 * parpadeo de español a inglés en cada carga.
 */
export function SelectorIdioma({
  actual,
  variante = "normal",
}: {
  actual: Idioma;
  /**
   * `marca` reutiliza el rótulo «es ⇄ en» que acompaña al logotipo como
   * conmutador. Es el sitio natural: ya anuncia el par de idiomas del producto,
   * así que solo faltaba que se pudiera pulsar.
   */
  variante?: "normal" | "marca";
}) {
  const [pendiente, empezar] = useTransition();

  if (variante === "marca") {
    return (
      <span
        role="group"
        aria-label="Idioma de la interfaz"
        className="inline-flex items-baseline gap-1 font-mono text-[9.5px] uppercase tracking-[0.18em]"
      >
        {IDIOMAS.map((id, i) => (
          <span key={id} className="inline-flex items-baseline gap-1">
            {i > 0 && (
              <span aria-hidden className="text-faint">
                ⇄
              </span>
            )}
            <button
              onClick={() => empezar(() => cambiarIdioma(id))}
              disabled={pendiente}
              aria-pressed={id === actual}
              title={NOMBRE_IDIOMA[id]}
              className={`rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                id === actual
                  ? "text-accent"
                  : "text-faint hover:text-foreground"
              }`}
            >
              {id}
            </button>
          </span>
        ))}
      </span>
    );
  }

  return (
    <div
      role="group"
      aria-label="Idioma de la interfaz"
      className="inline-flex items-center rounded-lg border border-hairline p-0.5"
    >
      {IDIOMAS.map((id) => {
        const activo = id === actual;
        return (
          <button
            key={id}
            onClick={() => empezar(() => cambiarIdioma(id))}
            disabled={pendiente || activo}
            aria-pressed={activo}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default ${
              activo
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground disabled:opacity-50"
            }`}
          >
            {NOMBRE_IDIOMA[id]}
          </button>
        );
      })}
    </div>
  );
}
