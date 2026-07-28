import Link from "next/link";
import { SelectorIdioma } from "@/app/components/SelectorIdioma";
import { LOCALE, fmt } from "@/app/lib/i18n";
import { getIdioma, getTextos } from "@/app/lib/idioma-servidor";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

type Plan = {
  id: string;
  name: string;
  monthly_minutes: number;
  price_cents: number;
};

/**
 * La consulta de muestra. El español siempre en la plana izquierda y el inglés
 * en la derecha, como en una edición enfrentada; `origen` dice cuál de los dos
 * se pronunció de verdad, y ese es el que va en cursiva.
 */
const CONSULTA = [
  {
    hora: "09:41:02",
    origen: "es" as const,
    es: "Doctor, me despierto con el pecho apretado y me falta el aire al subir escaleras.",
    en: "Doctor, I wake up with chest tightness and I get short of breath going up stairs.",
  },
  {
    hora: "09:41:19",
    origen: "en" as const,
    es: "¿Desde cuándo le pasa, y ha notado que se le hinchen los tobillos por la noche?",
    en: "How long has that been going on, and have you noticed any ankle swelling at night?",
  },
  {
    hora: "09:41:36",
    origen: "en" as const,
    es: "Vamos a empezar con 25 miligramos de metoprolol al día y a descartar CHF (insuficiencia cardíaca congestiva).",
    en: "We'll start you on 25 milligrams of metoprolol daily and check for CHF.",
  },
];

function money(cents: number, gratis: string): string {
  return cents === 0 ? gratis : `$${(cents / 100).toFixed(0)}`;
}

export default async function LandingPage() {
  const [idioma, t] = await Promise.all([getIdioma(), getTextos()]);
  const loc = LOCALE[idioma];

  /**
   * La cuota como la piensa quien factura por hora. Por debajo de una hora no
   * se añade la equivalencia: "5 min · 5 min" no informa de nada.
   */
  const cuota = (minutos: number) => {
    const min = fmt(t.portada.minAlMes, { n: minutos.toLocaleString(loc) });
    return minutos < 60
      ? min
      : `${min} · ${fmt(t.portada.horas, { n: Math.round(minutos / 60) })}`;
  };

  const PITCH: Record<string, string> = {
    free: t.portada.pitchFree,
    pro: t.portada.pitchPro,
    scale: t.portada.pitchScale,
  };

  const supabase = await createClient();

  const [{ data: plans }, { data: userData }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, monthly_minutes, price_cents")
      .order("sort_order"),
    supabase.auth.getUser(),
  ]);

  const isLoggedIn = !!userData.user;
  // Los minutos de prueba salen de la base para que la promesa de la portada
  // no se desfase del plan real cuando se ajuste.
  const libre = (plans ?? []).find((p: Plan) => p.price_cents === 0);

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-baseline gap-2.5">
            <Link
              href="/"
              className="habla rounded text-[19px] font-medium lowercase tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              parla
            </Link>
            {/* El rótulo del par de idiomas ES el conmutador. */}
            <SelectorIdioma actual={idioma} variante="marca" />
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/guia"
              className="hidden rounded px-3 py-2 text-sm text-muted transition-colors hover:text-foreground sm:block"
            >
              {t.portada.guia}
            </Link>
            <a
              href="#precios"
              className="hidden rounded px-3 py-2 text-sm text-muted transition-colors hover:text-foreground sm:block"
            >
              {t.portada.precios}
            </a>
            {isLoggedIn ? (
              <Link
                href="/app"
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                {t.comun.abrirParla}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
                >
                  {t.portada.entrar}
                </Link>
                <Link
                  href="/registro"
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  {t.portada.empezarGratis}
                </Link>
              </>
            )}
          </nav>
        </header>

        {/* ═══ La doble página ═══
            Un solo lomo recorre el titular y la consulta entera: el titular es
            ya la demostración, y los turnos son su continuación natural. El
            español siempre a la izquierda, el inglés a la derecha; la cursiva
            marca lo que se pronunció y la romana lo que rindió parla. */}
        <section className="pt-12 sm:pt-16">
          <p className="sobre-lomo flex items-center justify-center gap-2 bg-background pb-10 font-mono text-[9.5px] uppercase tracking-[0.2em] text-accent">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {t.portada.eyebrow}
          </p>

          <div className="lomo">
            <div className="grid grid-cols-1 gap-y-5 pb-16 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-y-0 md:pb-20">
              <h1 className="habla-origen text-balance text-muted text-[clamp(1.7rem,4.2vw,2.6rem)] font-normal leading-[1.14] tracking-tight md:pr-10 md:text-right">
                Cada palabra, en el otro idioma. Ni una de más.
              </h1>

              <span
                aria-hidden
                className="hidden bg-background px-2.5 font-mono text-[13px] text-accent md:block"
              >
                ⇄
              </span>

              <p
                lang="en"
                className="rendir habla text-balance text-[clamp(1.7rem,4.2vw,2.6rem)] font-normal leading-[1.14] tracking-tight md:pl-10"
                style={{ ["--desfase" as string]: "0.65s" }}
              >
                Every word, in the other language. Not one more.
              </p>
            </div>

            {CONSULTA.map((t, i) => (
              <div
                key={t.hora}
                className="grid grid-cols-1 gap-y-2 border-l border-hairline py-5 pl-4 md:grid-cols-[1fr_auto_1fr] md:gap-y-0 md:border-l-0 md:py-6 md:pl-0"
              >
                <p
                  className={`text-[16.5px] leading-[1.6] md:pr-10 md:text-right ${
                    t.origen === "es" ? "habla-origen text-muted" : "habla rendir"
                  }`}
                  style={{ ["--desfase" as string]: `${0.85 + i * 0.12}s` }}
                >
                  {t.es}
                </p>

                <span
                  aria-hidden
                  className="hidden self-start bg-background px-2.5 py-1 font-mono text-[9px] tabular-nums text-faint md:block"
                >
                  {t.hora}
                </span>

                <p
                  lang="en"
                  className={`text-[16.5px] leading-[1.6] md:pl-10 ${
                    t.origen === "en" ? "habla-origen text-muted" : "habla rendir"
                  }`}
                  style={{ ["--desfase" as string]: `${0.85 + i * 0.12}s` }}
                >
                  {t.en}
                </p>
              </div>
            ))}
          </div>

          {/* La leyenda va debajo, donde ya se ha visto el patrón: puesta
              arriba sería una instrucción antes de tener qué leer. */}
          <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
            <span className="habla-origen text-[11px] normal-case tracking-normal text-muted">
              {t.portada.leyendaCursiva}
            </span>
            {t.portada.leyendaResto}
          </p>

          <div className="mx-auto mt-16 max-w-lg text-center sm:mt-20">
            <p className="text-[15px] leading-relaxed text-muted">
              {t.portada.lede}
            </p>
            <div className="mt-7 flex flex-col items-center gap-3">
              <Link
                href={isLoggedIn ? "/app" : "/registro"}
                className="rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {isLoggedIn ? t.comun.abrirParla : t.portada.empezarGratis}
              </Link>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                {libre
                  ? fmt(t.portada.pruebaSinTarjeta, { n: libre.monthly_minutes })
                  : t.portada.pruebaSinTarjetaSimple}
              </span>
            </div>
          </div>
        </section>

        {/* ═══ Las tres reglas ═══
            Son los principios del oficio, no pasos de un proceso: nada de
            numerarlas, porque no hay un orden que el lector deba seguir. */}
        <section className="mt-20 sm:mt-28">
          <h2 className="habla text-[26px] font-normal tracking-tight">
            {t.portada.reglasTitulo}
          </h2>
          <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-3">
            {[
              { t: t.portada.regla1, d: t.portada.regla1d },
              { t: t.portada.regla2, d: t.portada.regla2d },
              { t: t.portada.regla3, d: t.portada.regla3d },
            ].map((f) => (
              <div key={f.t}>
                <dt className="text-[15px] font-medium">{f.t}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                  {f.d}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ═══ Precios ═══
            Pliegos sobre el papel: hojas con sombra, sin borde dibujado. */}
        <section id="precios" className="mt-20 scroll-mt-8 sm:mt-28">
          <h2 className="habla text-[26px] font-normal tracking-tight">
            {t.portada.preciosTitulo}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t.portada.preciosPie}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(plans ?? []).map((plan: Plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-lg bg-surface px-6 py-6 shadow-pliego ${
                  plan.id === "pro" ? "ring-1 ring-accent/25" : ""
                }`}
              >
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                  {plan.name}
                </p>
                <p className="habla mt-3 text-[2rem] font-normal leading-none tracking-tight tabular-nums">
                  {money(plan.price_cents, t.portada.gratis)}
                  {plan.price_cents > 0 && (
                    <span className="font-sans text-sm text-muted">
                      {" "}
                      {t.cuenta.porMes}
                    </span>
                  )}
                </p>
                <p className="mt-2.5 font-mono text-[11px] tabular-nums text-muted">
                  {cuota(plan.monthly_minutes)}
                </p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">
                  {PITCH[plan.id] ?? ""}
                </p>
                <Link
                  href={isLoggedIn ? "/cuenta" : "/registro"}
                  className={`mt-6 rounded-md py-2.5 text-center text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    plan.id === "pro"
                      ? "bg-foreground text-background"
                      : "bg-foreground/[0.06] text-foreground"
                  }`}
                >
                  {plan.price_cents === 0
                    ? t.portada.empezarGratis
                    : t.portada.elegirPlan}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ Guía ═══ */}
        <section className="mt-20 sm:mt-28">
          <div className="rounded-lg bg-surface px-6 py-7 shadow-pliego sm:px-8">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
              {t.portada.docEtiqueta}
            </p>
            <h2 className="habla mt-2 text-[24px] font-normal tracking-tight">
              {t.portada.docTitulo}
            </h2>
            <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-muted">
              {t.portada.docPie}
            </p>
            <Link
              href="/guia"
              className="mt-5 inline-block rounded-md border border-hairline px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.04]"
            >
              {t.portada.docEnlace}
            </Link>
          </div>
        </section>

        {/* ═══ Preguntas ═══ */}
        <section className="mt-20 sm:mt-28">
          <h2 className="habla text-[26px] font-normal tracking-tight">
            {t.portada.preguntasTitulo}
          </h2>
          <dl className="mt-8 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {[
              { q: t.portada.p1, a: t.portada.r1 },
              { q: t.portada.p2, a: t.portada.r2 },
              { q: t.portada.p3, a: t.portada.r3 },
              { q: t.portada.p4, a: t.portada.r4 },
            ].map((f) => (
              <div key={f.q}>
                <dt className="text-[15px] font-medium">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-20 flex flex-wrap items-end justify-between gap-5 py-10 sm:mt-28">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
              {t.portada.pieMarca}
            </p>
            <Link
              href="/guia"
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-foreground"
            >
              {t.portada.pieGuia}
            </Link>
          </div>
          <p className="max-w-sm text-[11px] leading-relaxed text-faint">
            {t.comun.aviso}
          </p>
        </footer>
      </main>
    </>
  );
}
