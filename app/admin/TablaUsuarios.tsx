"use client";

import { useMemo, useState } from "react";
import { type FilaUsuario, haceCuanto } from "@/app/lib/admin-tipos";
import { FilaAcciones } from "./FilaAcciones";

type Orden = "recientes" | "consumo" | "nombre";

const ORDENES: Array<{ id: Orden; etiqueta: string }> = [
  { id: "recientes", etiqueta: "Más recientes" },
  { id: "consumo", etiqueta: "Mayor consumo" },
  { id: "nombre", etiqueta: "Nombre" },
];

/** Porcentaje de cuota consumida, acotado para que la barra no se desborde. */
function pct(usados: number, limite: number): number {
  if (limite <= 0) return 0;
  return Math.min(100, Math.round((usados / limite) * 100));
}

function Medidor({ usados, limite }: { usados: number; limite: number }) {
  const p = pct(usados, limite);
  const agotado = usados >= limite;
  const alerta = !agotado && p >= 85;

  // Los tres estados van acompañados del número, nunca solo del color: quien
  // no distinga rojo de verde lee "912/900" igual de bien.
  const color = agotado ? "bg-live" : alerta ? "bg-amber-500" : "bg-accent";

  return (
    <div className="w-36">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {usados.toLocaleString("es")}
          <span className="text-faint">/{limite.toLocaleString("es")}</span>
        </span>
        <span className="font-mono text-[9.5px] tabular-nums text-faint">
          {p}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(p, usados > 0 ? 2 : 0)}%` }}
        />
      </div>
      {agotado && (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-live">
          Cuota agotada
        </p>
      )}
    </div>
  );
}

export function TablaUsuarios({
  filas,
  planes,
}: {
  filas: FilaUsuario[];
  planes: Array<{ id: string; name: string }>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [soloPago, setSoloPago] = useState(false);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = filas.filter((u) => {
      if (soloPago && u.plan_id === "free") return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.plan_nombre.toLowerCase().includes(q)
      );
    });

    // Copia antes de ordenar: `sort` muta, y `filas` es la prop del servidor.
    return [...filtradas].sort((a, b) => {
      if (orden === "consumo") return b.minutos_usados - a.minutos_usados;
      if (orden === "nombre") {
        return (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email, "es");
      }
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
  }, [filas, busqueda, orden, soloPago]);

  return (
    <section className="mt-8">
      {/* Los filtros van en una fila sobre la tabla, no repartidos por la
          página: se leen como un solo control del conjunto. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
          Usuarios ({visibles.length}
          {visibles.length !== filas.length && ` de ${filas.length}`})
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, correo o plan…"
            aria-label="Buscar usuarios"
            className="w-56 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-[13px] placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={soloPago}
              onChange={(e) => setSoloPago(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Solo de pago
          </label>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            aria-label="Ordenar usuarios"
            className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full min-w-[58rem] text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface/60 text-left">
              <Th>Usuario</Th>
              <Th>Plan</Th>
              <Th>Consumo del período</Th>
              <Th>Actividad</Th>
              <Th>Alta</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((u) => {
              const ultima = haceCuanto(u.ultima_actividad);
              return (
                <tr
                  key={u.id}
                  className="border-b border-hairline/60 transition-colors last:border-0 hover:bg-foreground/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.full_name ?? "—"}</span>
                      {u.ver_tecnico && u.role !== "admin" && (
                        <span className="rounded-full border border-hairline px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted">
                          pruebas
                        </span>
                      )}
                      {u.role === "admin" && (
                        <span className="rounded-full border border-live/40 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-live">
                          admin
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-muted">{u.email}</div>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
                        u.plan_precio_cent === 0
                          ? "bg-foreground/[0.06] text-muted"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {u.plan_nombre}
                    </span>
                    {u.plan_precio_cent > 0 && (
                      <div className="mt-1 font-mono text-[9.5px] tabular-nums text-faint">
                        ${(u.plan_precio_cent / 100).toFixed(0)}/mes
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Medidor usados={u.minutos_usados} limite={u.plan_minutos} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-mono text-[11px] tabular-nums text-muted">
                      {u.sesiones} {u.sesiones === 1 ? "sesión" : "sesiones"}
                    </div>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                      {ultima ?? "sin actividad"}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-faint">
                    {new Date(u.created_at).toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>

                  <td className="px-4 py-3">
                    <FilaAcciones
                      userId={u.id}
                      planActual={u.plan_id}
                      rolActual={u.role}
                      verTecnico={u.ver_tecnico}
                      planes={planes}
                    />
                  </td>
                </tr>
              );
            })}

            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                  Ningún usuario coincide con «{busqueda}».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-faint">
      {children}
    </th>
  );
}
