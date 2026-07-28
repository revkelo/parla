import { redirect } from "next/navigation";
import { getIdioma, getTextos } from "@/app/lib/idioma-servidor";
import { getQuota } from "@/app/lib/quota";
import { createClient } from "@/app/lib/supabase/server";
import { Marco, type SesionListada } from "./Marco";

export const dynamic = "force-dynamic";

/** Cuántas consultas caben en la barra sin volverla un archivo. */
const RECIENTES = 40;

type Fila = {
  id: string;
  started_at: string;
  title: string | null;
  segments: Array<{ count: number }>;
};

/**
 * Marco común del intérprete: la barra lateral con las consultas y el pie de
 * cuenta viven aquí, no en la página, para que no se desmonten al abrir una
 * consulta anterior. Cambiar de conversación no debe redibujar la navegación.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const quota = await getQuota();
  if (!quota) redirect("/login?next=/app");

  const [idioma, t] = await Promise.all([getIdioma(), getTextos()]);

  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("id, started_at, title, segments(count)")
    .order("started_at", { ascending: false })
    .limit(RECIENTES);

  // Una sesión sin turnos es una que se abrió y se cerró sin que nadie hablara:
  // consume minutos, pero en la barra solo sería ruido.
  const sesiones: SesionListada[] = ((data ?? []) as Fila[])
    .filter((s) => (s.segments[0]?.count ?? 0) > 0)
    .map((s) => ({
      id: s.id,
      titulo: s.title ?? t.historial.sinTitulo,
      iniciada: s.started_at,
      turnos: s.segments[0]?.count ?? 0,
    }));

  return (
    <Marco
      perfil={{
        email: quota.email,
        fullName: quota.fullName,
        plan: quota.planName,
        esAdmin: quota.esAdmin,
        usedMinutes: quota.usedMinutes,
        limitMinutes: quota.limitMinutes,
        remainingMinutes: quota.remainingMinutes,
        exhausted: quota.exhausted,
        verTecnico: quota.verTecnico,
      }}
      sesiones={sesiones}
      idioma={idioma}
      t={t}
    >
      {children}
    </Marco>
  );
}
