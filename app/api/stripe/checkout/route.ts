import { NextResponse } from "next/server";
import { getStripe } from "@/app/lib/stripe";
import { createAdminClient, createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  }

  let planId: string;
  try {
    const body = await req.json();
    planId = String(body?.planId ?? "");
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // El precio se lee de la base, nunca del cliente: si viniera del navegador,
  // cualquiera podría pedir el checkout del plan caro pagando el barato.
  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, stripe_price_id")
    .eq("id", planId)
    .single<{ id: string; name: string; stripe_price_id: string | null }>();

  if (!plan?.stripe_price_id) {
    return NextResponse.json(
      { error: "Ese plan no admite pago." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single<{ stripe_customer_id: string | null; email: string }>();

  const stripe = getStripe();
  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    // Service role: `stripe_customer_id` no debe ser escribible por el cliente.
    await createAdminClient()
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/cuenta?pago=ok`,
    cancel_url: `${origin}/cuenta?pago=cancelado`,
    // El webhook necesita saber a quién y a qué plan corresponde el cobro.
    subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
    metadata: { user_id: user.id, plan_id: plan.id },
    allow_promotion_codes: true,
    // No fijamos payment_method_types: así Stripe muestra los métodos que el
    // cliente puede usar según su país y que además admiten cobro recurrente.
    // Fijarlos a mano dejaría fuera métodos locales sin ganar nada.
    billing_address_collection: "auto",
    // Sin esto, Checkout no puede guardar la dirección en un cliente que ya
    // existe, y hace falta si algún día se activa el cálculo de impuestos.
    customer_update: { address: "auto", name: "auto" },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "No se pudo iniciar el pago." },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: session.url });
}
