import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTextos } from "@/app/lib/idioma-servidor";
import { getQuota } from "@/app/lib/quota";
import Transcriptor, { type Usage } from "./Transcriptor";

export const metadata: Metadata = { title: "parla · intérprete en vivo" };
export const dynamic = "force-dynamic";

/**
 * Envoltorio de servidor: resuelve el plan y el consumo antes de pintar nada,
 * para que el transcriptor no arranque sin saber si al usuario le quedan
 * minutos.
 */
export default async function AppPage() {
  const [quota, t] = await Promise.all([getQuota(), getTextos()]);
  // El proxy ya exige sesión; esto cubre el caso de un perfil incompleto.
  if (!quota) redirect("/login?next=/app");

  const usoInicial: Usage = {
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

  return <Transcriptor usoInicial={usoInicial} t={t} />;
}
