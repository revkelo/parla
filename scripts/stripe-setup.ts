/**
 * Crea en Stripe un producto y un precio recurrente por cada plan de pago de la
 * base, y guarda el `stripe_price_id` de vuelta en `plans`.
 *
 *   npm run stripe:setup
 *
 * Es idempotente: identifica los precios por `lookup_key`, así que volver a
 * correrlo no duplica nada. Si cambias el importe de un plan, archiva el precio
 * viejo y crea uno nuevo (Stripe no permite editar el importe de un precio).
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("Falta STRIPE_SECRET_KEY (corre `vercel env pull`).");
  process.exit(1);
}

const stripe = new Stripe(secret);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Plan = {
  id: string;
  name: string;
  price_cents: number;
  monthly_minutes: number;
  stripe_price_id: string | null;
};

async function ensurePrice(plan: Plan): Promise<string> {
  const lookupKey = `parla_${plan.id}_monthly`;

  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });

  const found = existing.data[0];
  if (found) {
    if (found.unit_amount === plan.price_cents) {
      console.log(`  = ${plan.id}: precio ya existe (${found.id})`);
      return found.id;
    }
    // El importe cambió: Stripe no deja editarlo, así que se archiva y se
    // libera el lookup_key para el precio nuevo.
    console.log(`  ~ ${plan.id}: importe cambió, archivando ${found.id}`);
    await stripe.prices.update(found.id, {
      active: false,
      lookup_key: `${lookupKey}_archivado_${Date.now()}`,
    });
  }

  const product = await stripe.products.create({
    name: `parla · ${plan.name}`,
    description: `${plan.monthly_minutes.toLocaleString("es")} minutos de interpretación al mes.`,
    metadata: { plan_id: plan.id },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.price_cents,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    metadata: { plan_id: plan.id },
  });

  console.log(`  + ${plan.id}: precio creado (${price.id})`);
  return price.id;
}

async function main() {
  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, name, price_cents, monthly_minutes, stripe_price_id")
    .gt("price_cents", 0)
    .order("sort_order");

  if (error) throw error;
  if (!plans?.length) {
    console.log("No hay planes de pago que configurar.");
    return;
  }

  console.log(`Configurando ${plans.length} plan(es) en Stripe:\n`);

  for (const plan of plans as Plan[]) {
    const priceId = await ensurePrice(plan);
    if (priceId !== plan.stripe_price_id) {
      const { error: upErr } = await supabase
        .from("plans")
        .update({ stripe_price_id: priceId })
        .eq("id", plan.id);
      if (upErr) throw upErr;
    }
  }

  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
