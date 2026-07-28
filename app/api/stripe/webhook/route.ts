import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, toSubscriptionStatus } from "@/app/lib/stripe";
import { createAdminClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Webhook de Stripe. Es la única fuente de verdad sobre qué plan tiene cada
 * usuario: el retorno del checkout en el navegador no basta, porque el usuario
 * puede cerrarlo antes de que vuelva y porque es falsificable.
 *
 * Esta ruta queda fuera del matcher del proxy a propósito: se autentica con la
 * firma de Stripe, no con la sesión del usuario.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Falta STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json({ error: "No configurado." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Sin firma." }, { status: 400 });
  }

  // La firma se valida contra el cuerpo crudo: parsear el JSON antes la
  // invalidaría.
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.warn("Firma de webhook inválida:", (err as Error).message);
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        // El resto de eventos no nos cambia el estado; se aceptan y ya.
        break;
    }
  } catch (err) {
    // Devolver 500 hace que Stripe reintente, que es lo que queremos ante un
    // fallo transitorio de base de datos.
    console.error(`Error procesando ${event.type}:`, err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Vuelca el estado de la suscripción de Stripe a la base. */
async function syncSubscription(sub: Stripe.Subscription) {
  const admin = createAdminClient();

  const userId = sub.metadata?.user_id;
  const planId = sub.metadata?.plan_id;
  if (!userId || !planId) {
    console.error("Suscripción sin metadata user_id/plan_id:", sub.id);
    return;
  }

  const status = toSubscriptionStatus(sub.status);
  // El período vive en el item de la suscripción.
  const item = sub.items.data[0];
  const periodStart = item?.current_period_start ?? sub.start_date;
  const periodEnd = item?.current_period_end ?? sub.start_date;

  const { error: subErr } = await admin.from("subscriptions").upsert({
    id: sub.id,
    user_id: userId,
    plan_id: planId,
    status,
    current_period_start: new Date(periodStart * 1000).toISOString(),
    current_period_end: new Date(periodEnd * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  if (subErr) throw subErr;

  // El plan efectivo del perfil: el de pago mientras esté vigente, `free` en
  // cuanto deje de estarlo. Un impago no debe seguir dando minutos de pago.
  const isLive = status === "active" || status === "trialing";
  const { error: profErr } = await admin
    .from("profiles")
    .update({ plan_id: isLive ? planId : "free", updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (profErr) throw profErr;
}
