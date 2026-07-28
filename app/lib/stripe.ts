import Stripe from "stripe";

let cached: Stripe | null = null;

/** Cliente de Stripe del lado servidor. Nunca importar esto en el navegador. */
export function getStripe(): Stripe {
  if (cached) return cached;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Falta STRIPE_SECRET_KEY.");
  cached = new Stripe(secret);
  return cached;
}

/** Estados de Stripe que mapeamos al enum `subscription_status` de la base. */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Stripe tiene más estados de los que guardamos (`incomplete_expired`,
 * `paused`). Los que no reconocemos se tratan como cancelados: es el lado
 * seguro, porque deja al usuario en el plan gratuito en vez de regalarle uno
 * de pago.
 */
export function toSubscriptionStatus(status: string): SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
    ? (status as SubscriptionStatus)
    : "canceled";
}
