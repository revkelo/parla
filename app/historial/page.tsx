import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/app/components/Marca";
import { PieDePagina } from "@/app/components/PieDePagina";
import { UserMenu } from "@/app/components/UserMenu";
import { LOCALE } from "@/app/lib/i18n";
import { getIdioma, getTextos } from "@/app/lib/idioma-servidor";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";

export const metadata: Metadata = { title: "Historial · parla" };
export const dynamic = "force-dynamic";

type FilaSesion = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number;
  title: string | null;
  segments: Array<{ count: number }>;
};

function duracion(segundos: number, min: string): string {
  if (segundos < 60) return `${segundos} s`;
  const m = Math.round(segundos / 60);
  if (m < 60) return `${m} ${min}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} ${min}`;
}

function fecha(iso: string, loc: string): string {
  return new Date(iso).toLocaleString(loc, {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HistorialPage() {
  const [quota, t, idioma] = await Promise.all([
    getQuota(),
    getTextos(),
    getIdioma(),
  ]);
  if (!quota) redirect("/login?next=/historial");
  const loc = LOCALE[idioma];

  const supabase = await createClient();
  // El conteo de turnos viene en la misma consulta: pedirlo aparte sería una
  // consulta por sesión, y esta lista puede tener cien.
  const { data } = await supabase
    .from("sessions")
    .select("id, started_at, ended_at, duration_secs, title, segments(count)")
    .order("started_at", { ascending: false })
    .limit(100);

  const sesiones = (data ?? []) as FilaSesion[];
  // Una sesión sin turnos es una que se abrió y se cerró sin que nadie hablara.
  // Aparece en el consumo, pero en el historial solo sería ruido.
  const conTurnos = sesiones.filter((s) => (s.segments[0]?.count ?? 0) > 0);

  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 sm:px-6">
        <header className="flex items-center justify-between py-6">
          <Marca etiqueta={t.historial.titulo} />
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="rounded-md border border-hairline px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/[0.04]"
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
        </header>

        {conTurnos.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <p className="habla text-xl">{t.historial.vacioTitulo}</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              {t.historial.vacioCuerpo}
            </p>
            <Link
              href="/app"
              className="mt-7 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {t.historial.empezar}
            </Link>
          </div>
        ) : (
          <>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
              {conTurnos.length}{" "}
              {conTurnos.length === 1
                ? t.historial.consulta
                : t.historial.consultas}
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {conTurnos.map((s) => {
                const turnos = s.segments[0]?.count ?? 0;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/app/c/${s.id}`}
                      className="block rounded-lg bg-surface px-5 py-4 shadow-pliego transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      <p className="habla text-[17px] leading-snug">
                        {s.title ?? t.historial.sinTitulo}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                        {fecha(s.started_at, loc)} ·{" "}
                        {duracion(s.duration_secs, t.comun.min)} ·{" "}
                        {turnos} {turnos === 1 ? t.comun.turno : t.comun.turnos}
                        {!s.ended_at && (
                          <span className="ml-2 text-live">{t.historial.sinCerrar}</span>
                        )}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <PieDePagina t={t} />
      </main>
    </>
  );
}
