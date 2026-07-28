import { NextResponse } from "next/server";
import { getQuota } from "@/app/lib/quota";

export const dynamic = "force-dynamic";

/**
 * Consumo del usuario contra su plan.
 *
 * Antes esta ruta devolvía el saldo de Deepgram y los límites de Groq de la
 * plataforma. Con un solo usuario daba igual; siendo un servicio de pago eso
 * es información de costos del negocio y no le incumbe al cliente.
 */
export async function GET() {
  const quota = await getQuota();
  if (!quota) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  }

  return NextResponse.json({
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
  });
}
