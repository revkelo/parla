import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marca } from "@/app/components/Marca";
import { UserMenu } from "@/app/components/UserMenu";
import {
  COSTO_MIN,
  METRICAS_CERO,
  type FilaUsuario,
  type Metricas,
  type PuntoSerie,
  type RepartoPlan,
  esAdmin,
  usd,
} from "@/app/lib/admin";
import { saldoDeepgram } from "@/app/lib/costos";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";
import { Costos } from "./Costos";
import { GraficaUso } from "./GraficaUso";
import { TablaUsuarios } from "./TablaUsuarios";

export const metadata: Metadata = { title: "Administración · parla" };
export const dynamic = "force-dynamic";

const DIAS_SERIE = 30;

export default async function AdminPage() {
  // Un 404 en vez de un 403: quien no es admin no tiene por qué enterarse
  // siquiera de que esta página existe.
  if (!(await esAdmin())) notFound();

  const supabase = await createClient();
  const [{ data: metricas }, { data: usuarios }, { data: serie }, { data: reparto }, quota] =
    await Promise.all([
      supabase.rpc("admin_metricas").single<Metricas>(),
      supabase.rpc("admin_usuarios", { p_limite: 200 }),
      supabase.rpc("admin_serie_diaria", { p_dias: DIAS_SERIE }),
      supabase.rpc("admin_reparto_planes"),
      getQuota(),
    ]);

  // El saldo va aparte del Promise.all: es una llamada a un tercero y no debe
  // retrasar el resto del panel si Deepgram tarda.
  const saldo = await saldoDeepgram();

  const filas = (usuarios ?? []) as FilaUsuario[];
  const puntos = (serie ?? []) as PuntoSerie[];
  const planes = (reparto ?? []) as RepartoPlan[];
  const m = metricas ?? METRICAS_CERO;

  const costoMes = m.minutos_mes * COSTO_MIN;
  const ingresosMes = m.ingresos_mes_cent / 100;
  const margen =
    ingresosMes > 0 ? Math.round(((ingresosMes - costoMes) / ingresosMes) * 100) : 0;

  // Cuánto de la cuota vendida se está usando de verdad. Por debajo del 10 %
  // se está cobrando por minutos que nadie gasta: margen alto hoy, riesgo de
  // baja mañana.
  const cuotaVendida = filas.reduce((a, u) => a + u.plan_minutos, 0);
  const aprovechamiento =
    cuotaVendida > 0 ? Math.round((m.minutos_mes / cuotaVendida) * 100) : 0;

  const conversion =
    m.usuarios > 0 ? Math.round((m.usuarios_pago / m.usuarios) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Marca etiqueta="Administración" sub="panel interno" />

        <div className="flex items-center gap-2">
          {m.sesiones_vivas > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-live/30 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-live">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
              {m.sesiones_vivas} en vivo
            </span>
          )}
          <Link
            href="/app"
            className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/[0.04]"
          >
            Abrir parla
          </Link>
          {quota && (
            <UserMenu
              email={quota.email}
              fullName={quota.fullName}
              planName={quota.planName}
              esAdmin
            />
          )}
        </div>
      </header>

      {/* ── Cifras principales ── */}
      <section className="mt-10 grid grid-cols-2 gap-x-8 gap-y-7 lg:grid-cols-4">
        <Kpi
          etiqueta="Usuarios"
          valor={m.usuarios.toLocaleString("es")}
          pie={`+${m.usuarios_nuevos_7d} en 7 días`}
        />
        <Kpi
          etiqueta="Ingresos / mes"
          valor={usd(m.ingresos_mes_cent)}
          pie={`${m.usuarios_pago} de pago · ${conversion}% de conversión`}
        />
        <Kpi
          etiqueta="Minutos del mes"
          valor={m.minutos_mes.toLocaleString("es")}
          pie={`${m.minutos_hoy.toLocaleString("es")} hoy · ${m.sesiones_mes} sesiones`}
        />
        <Kpi
          etiqueta="Margen"
          valor={ingresosMes > 0 ? `${margen}%` : "—"}
          pie={`costo $${costoMes.toFixed(2)} a $${COSTO_MIN}/min`}
          tono={ingresosMes === 0 ? "neutro" : margen >= 60 ? "ok" : "aviso"}
        />
      </section>

      {/* ── Uso y planes ── */}
      <section className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GraficaUso serie={puntos} />
        </div>

        <div>
          <h2 className="text-sm font-medium">Reparto por plan</h2>
          <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            usuarios e ingresos
          </p>

          <ul className="mt-4 space-y-3">
            {planes.map((p) => {
              const share =
                m.usuarios > 0 ? Math.round((p.usuarios / m.usuarios) * 100) : 0;
              return (
                <li key={p.plan_id}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium">{p.plan_nombre}</span>
                    <span className="font-mono text-[11px] tabular-nums text-muted">
                      {p.usuarios}
                      <span className="text-faint">
                        {" · "}
                        {usd(p.precio_cent * p.usuarios)}/mes
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div
                      className={`h-full rounded-full ${
                        p.precio_cent === 0 ? "bg-foreground/25" : "bg-accent"
                      }`}
                      style={{ width: `${Math.max(share, p.usuarios > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-7">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              Aprovechamiento de la cuota vendida
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {aprovechamiento}%
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {m.minutos_mes.toLocaleString("es")} de{" "}
              {cuotaVendida.toLocaleString("es")} minutos contratados. Muy por
              debajo del 100 % es margen hoy y riesgo de baja mañana.
            </p>
          </div>
        </div>
      </section>

      <Costos
        minutosMes={m.minutos_mes}
        minutosTotales={m.minutos_totales}
        peticionesIa={m.ia_peticiones_mes}
        saldoDeepgram={saldo}
        ingresosMesUsd={ingresosMes}
      />

      <TablaUsuarios
        filas={filas}
        planes={planes.map((p) => ({ id: p.plan_id, name: p.plan_nombre }))}
      />

      <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-muted">
        Las transcripciones e interpretaciones no son accesibles desde aquí, ni
        siquiera para un administrador: son contenido clínico de una consulta
        médica. Este panel solo ve cuánto se usa la plataforma, nunca lo que se
        dice en ella.
      </p>
    </main>
  );
}

function Kpi({
  etiqueta,
  valor,
  pie,
  tono = "neutro",
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
  tono?: "ok" | "aviso" | "neutro";
}) {
  const color =
    tono === "ok" ? "text-accent" : tono === "aviso" ? "text-amber-500" : "";
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
        {etiqueta}
      </p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${color}`}>
        {valor}
      </p>
      {pie && (
        <p className="mt-1 font-mono text-[9.5px] tabular-nums text-faint">
          {pie}
        </p>
      )}
    </div>
  );
}
