import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/app/components/Marca";
import { PieDePagina } from "@/app/components/PieDePagina";
import { SelectorIdioma } from "@/app/components/SelectorIdioma";
import { UserMenu } from "@/app/components/UserMenu";
import { LOCALE, fmt } from "@/app/lib/i18n";
import { getIdioma, getTextos } from "@/app/lib/idioma-servidor";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";
import { CheckoutButton, PortalButton } from "./BillingButtons";
import { CheckoutResult } from "./CheckoutResult";
import { PerfilForm } from "./PerfilForm";

export const metadata: Metadata = { title: "Tu cuenta · parla" };
export const dynamic = "force-dynamic";

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string }>;
}) {
  const { pago } = await searchParams;
  const quota = await getQuota();
  if (!quota) redirect("/login?next=/cuenta");

  const [idioma, t] = await Promise.all([getIdioma(), getTextos()]);
  const loc = LOCALE[idioma];
  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(loc, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const supabase = await createClient();
  const [{ data: sessions }, { data: plans }, { data: subscription }, { data: perfil }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("id, started_at, duration_secs")
        .order("started_at", { ascending: false })
        .limit(5),
      supabase
        .from("plans")
        .select("id, name, price_cents, monthly_minutes")
        .gt("price_cents", 0)
        .order("sort_order"),
      supabase
        .from("subscriptions")
        .select("status, current_period_end, cancel_at_period_end")
        .in("status", ["active", "trialing", "past_due"])
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle<{
          status: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
        }>(),
      supabase
        .from("profiles")
        .select("created_at")
        .eq("id", quota.userId)
        .maybeSingle<{ created_at: string }>(),
    ]);

  const pct =
    quota.limitMinutes > 0
      ? Math.min(100, Math.round((quota.usedMinutes / quota.limitMinutes) * 100))
      : 0;
  // Umbral doble: 10 % de la cuota o 5 minutos, lo que sea mayor. Con un
  // porcentaje solo, el plan de prueba avisaría medio minuto antes del final;
  // con minutos solos, al plan Intensivo le quedarían horas tras el aviso.
  const porAgotarse =
    !quota.exhausted &&
    quota.remainingMinutes <= Math.max(5, quota.limitMinutes * 0.1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Marca etiqueta={t.cuenta.titulo} />
        <div className="flex items-center gap-2">
          <Link
            href="/app"
            className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/[0.04]"
          >
            {t.comun.abrirParla}
          </Link>
          <UserMenu
            email={quota.email}
            fullName={quota.fullName}
            planName={quota.planName}
            esAdmin={quota.esAdmin}
            t={t}
          />
        </div>
      </div>

      {(pago === "ok" || pago === "cancelado") && (
        <CheckoutResult
          status={pago === "ok" ? "ok" : "cancelado"}
          planActivo={quota.planId !== "free"}
        />
      )}

      {/* ── Consumo ── */}
      <Seccion titulo={t.cuenta.consumo}>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {quota.usedMinutes.toLocaleString(loc)}
          <span className="text-base font-normal text-muted">
            {" "}
            / {quota.limitMinutes.toLocaleString(loc)} {t.comun.min}
          </span>
        </p>
        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
          {t.app.plan} {quota.planName}
        </p>

        <div className="mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className={`h-full rounded-full transition-[width] ${
              quota.exhausted
                ? "bg-live"
                : porAgotarse
                  ? "bg-amber-500"
                  : "bg-accent"
            }`}
            // Un mínimo visible: con 12 de 4000 minutos la barra caía por
            // debajo de un píxel y parecía que no se había usado nada.
            style={{ width: `${Math.max(pct, quota.usedMinutes > 0 ? 1.5 : 0)}%` }}
          />
        </div>

        {/* El aviso llega antes de quedarse a cero: enterarse a mitad de una
            consulta es mucho peor que verlo venir. */}
        <p
          className={`mt-3 text-sm ${
            quota.exhausted
              ? "text-live"
              : porAgotarse
                ? "text-amber-600"
                : "text-muted"
          }`}
        >
          {quota.exhausted
            ? t.cuenta.agotados
            : fmt(porAgotarse ? t.cuenta.restantesPocos : t.cuenta.restantes, {
                n: quota.remainingMinutes,
              })}
        </p>
      </Seccion>

      {/* ── Facturación ── */}
      <Seccion titulo={t.cuenta.facturacion}>
        {subscription ? (
          <>
            <p className="text-sm text-muted">
              {fmt(
                subscription.cancel_at_period_end
                  ? t.cuenta.seCancela
                  : t.cuenta.seRenueva,
                { fecha: fecha(subscription.current_period_end) }
              )}
              {subscription.status === "past_due" && (
                <span className="text-live"> · {t.cuenta.pagoPendiente}</span>
              )}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-faint">
              {t.cuenta.gestionarPie}
            </p>
            <div className="mt-4">
              <PortalButton />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{t.cuenta.ampliarPie}</p>
            <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
              {(plans ?? []).map((p) => (
                <div key={p.id} className="flex flex-col items-start">
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    ${(p.price_cents / 100).toFixed(0)}
                    <span className="text-sm font-normal text-muted">
                      {" "}
                      {t.cuenta.porMes}
                    </span>
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-muted">
                    {p.name} · {p.monthly_minutes.toLocaleString(loc)}{" "}
                    {t.cuenta.minMes}
                  </p>
                  <div className="mt-4">
                    <CheckoutButton
                      planId={p.id}
                      label={t.cuenta.elegirPlan}
                      variant={p.id === "pro" ? "primary" : "secondary"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Seccion>

      {/* ── Perfil ── */}
      <Seccion titulo={t.cuenta.perfil}>
        <PerfilForm
          nombreInicial={quota.fullName ?? ""}
          email={quota.email}
          t={t}
        />
        {perfil?.created_at && (
          <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            {t.cuenta.miembroDesde} {fecha(perfil.created_at)}
          </p>
        )}
      </Seccion>

      {/* ── Preferencias ── */}
      <Seccion titulo={t.cuenta.preferencias}>
        <p className="text-[13px] font-medium">{t.ajustes.idioma}</p>
        <p className="mt-1 mb-3 text-[12.5px] text-muted">{t.cuenta.idiomaPie}</p>
        <SelectorIdioma actual={idioma} />
      </Seccion>

      {/* ── Últimas consultas ── */}
      <Seccion titulo={t.cuenta.ultimasSesiones}>
        {sessions && sessions.length > 0 ? (
          <>
            <ul className="max-w-md">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-muted">
                    {new Date(s.started_at).toLocaleString(loc, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-faint">
                    {Math.round(s.duration_secs / 60)} {t.comun.min}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/historial"
              className="mt-3 inline-block font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent hover:underline"
            >
              {t.cuenta.verHistorial}
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted">{t.cuenta.sinSesiones}</p>
        )}
      </Seccion>

      <PieDePagina t={t} />
    </main>
  );
}

/**
 * Una sección de la cuenta. Rótulo pequeño arriba y contenido debajo, sin
 * marco: la separación la da el espacio, igual que en el resto del producto.
 */
function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
