import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccionesConsulta } from "@/app/components/AccionesConsulta";
import { type TurnoLeido, hora } from "@/app/components/HojaConsulta";
import { LOCALE } from "@/app/lib/i18n";
import { getIdioma, getTextos } from "@/app/lib/idioma-servidor";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";
import Transcriptor, { type Usage } from "../../Transcriptor";

export const metadata: Metadata = { title: "Consulta · parla" };
export const dynamic = "force-dynamic";

/**
 * Una consulta guardada, abierta para seguir donde se quedó.
 *
 * No es una vista de solo lectura: monta el mismo intérprete que `/app` con los
 * turnos anteriores ya cargados, así que pulsar Continuar retoma la MISMA
 * consulta —los turnos nuevos se guardan en ella y la IA conserva el contexto—
 * en lugar de abrir una aparte. Volver a una conversación y seguir hablando es
 * lo que uno espera de un chat.
 */
export default async function ConsultaGuardadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quota, t, idioma] = await Promise.all([
    getQuota(),
    getTextos(),
    getIdioma(),
  ]);
  if (!quota) redirect(`/login?next=/app/c/${id}`);

  const supabase = await createClient();
  const [{ data: sesion }, { data: turnos }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, started_at, duration_secs, title")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        started_at: string;
        duration_secs: number;
        title: string | null;
      }>(),
    supabase
      .from("segments")
      .select("ordinal, source_text, target_text, source_lang, created_at")
      .eq("session_id", id)
      .order("ordinal"),
  ]);

  // RLS ya impide leer la sesión de otro: si no hay fila, para este usuario esa
  // consulta no existe, y un 404 es la respuesta honesta.
  if (!sesion) notFound();

  const filas = (turnos ?? []) as TurnoLeido[];

  const uso: Usage = {
    email: quota.email,
    fullName: quota.fullName,
    esAdmin: quota.esAdmin,
    verTecnico: quota.verTecnico,
    plan: quota.planName,
    planId: quota.planId,
    usedMinutes: quota.usedMinutes,
    limitMinutes: quota.limitMinutes,
    remainingMinutes: quota.remainingMinutes,
    exhausted: quota.exhausted,
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="habla max-w-lg text-[20px] leading-snug">
              {sesion.title ?? t.historial.sinTitulo}
            </h1>
            <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
              {new Date(sesion.started_at).toLocaleString(LOCALE[idioma], {
                dateStyle: "long",
                timeStyle: "short",
              })}{" "}
              · {Math.max(1, Math.round(sesion.duration_secs / 60))} {t.comun.min} ·{" "}
              {filas.length}{" "}
              {filas.length === 1 ? t.comun.turno : t.comun.turnos}
            </p>
          </div>

          <AccionesConsulta
            sessionId={sesion.id}
            titulo={sesion.title ?? t.historial.sinTitulo}
            fecha={sesion.started_at}
            t={t}
            turnos={filas.map((turno) => ({
              hora: hora(turno.created_at),
              origen: turno.source_lang,
              source: turno.source_text,
              target: turno.target_text ?? "",
            }))}
          />
        </div>
      </div>

      <Transcriptor
        usoInicial={uso}
        previa={{ id: sesion.id, turnos: filas }}
        t={t}
      />
    </div>
  );
}
