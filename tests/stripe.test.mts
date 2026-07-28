/**
 * Pruebas del ciclo de suscripción contra Stripe (modo test) y Supabase.
 *
 *   npm run dev            # en otra terminal
 *   npm run test:stripe
 *
 * No son mocks: crean clientes y suscripciones reales en la cuenta de Stripe
 * de test, disparan los webhooks firmados contra el servidor local y
 * comprueban el efecto en la base. Todo lo creado se borra al final.
 */

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const WEBHOOK = `${BASE}/api/stripe/webhook`;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const whsec = process.env.STRIPE_WEBHOOK_SECRET!;

/* ─────────────────────────────── utilidades ─────────────────────────────── */

const basura: Array<() => Promise<unknown>> = [];
let pasadas = 0;
const fallos: string[] = [];

async function prueba(nombre: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  PASA  ${nombre}`);
    pasadas++;
  } catch (err) {
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${(err as Error).message.split("\n")[0]}`);
    fallos.push(nombre);
  }
}

/** Manda un evento firmado como lo haría Stripe. */
async function enviarEvento(type: string, object: unknown): Promise<Response> {
  const payload = JSON.stringify({
    id: `evt_test_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    data: { object },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: whsec,
  });
  return fetch(WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
}

async function crearUsuario(): Promise<string> {
  const email = `test+${Date.now()}${Math.random().toString(36).slice(2, 6)}@parla.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "prueba-12345678",
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user!.id;
  basura.push(() => admin.auth.admin.deleteUser(id));
  return id;
}

async function planDe(userId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("plan_id")
    .eq("id", userId)
    .single();
  return (data as { plan_id: string }).plan_id;
}

/** Minutos que da el plan que tiene ahora mismo el usuario. */
async function minutosDe(userId: string): Promise<number> {
  return minutosDelPlan(await planDe(userId));
}

/**
 * Minutos de un plan, leídos de la base. Los tests no fijan estos números:
 * los precios y cuotas se ajustan según el modelo de negocio, y un test que
 * los codifique se rompe en cada cambio de precio sin haber detectado nada.
 */
async function minutosDelPlan(planId: string): Promise<number> {
  const { data } = await admin
    .from("plans")
    .select("monthly_minutes")
    .eq("id", planId)
    .single();
  return (data as { monthly_minutes: number }).monthly_minutes;
}

async function precioDe(planId: string): Promise<string> {
  const { data } = await admin
    .from("plans")
    .select("stripe_price_id")
    .eq("id", planId)
    .single();
  const price = (data as { stripe_price_id: string | null }).stripe_price_id;
  assert.ok(price, `El plan ${planId} no tiene stripe_price_id. Corre npm run stripe:setup.`);
  return price;
}

/** Cliente de Stripe con tarjeta válida, listo para suscribirse. */
async function crearCliente(userId: string): Promise<string> {
  const cust = await stripe.customers.create({ metadata: { user_id: userId } });
  basura.push(() => stripe.customers.del(cust.id));
  const pm = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: cust.id,
  });
  await stripe.customers.update(cust.id, {
    invoice_settings: { default_payment_method: pm.id },
  });
  return cust.id;
}

async function suscribir(
  customerId: string,
  userId: string,
  planId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: await precioDe(planId) }],
    metadata: { user_id: userId, plan_id: planId },
  });
}

/* ──────────────────────────────── pruebas ──────────────────────────────── */

async function main() {
  console.log(`Probando contra ${BASE}\n`);

  // El servidor tiene que estar arriba, si no todo falla por la misma razón.
  try {
    const ping = await fetch(WEBHOOK, { method: "POST", body: "{}" });
    assert.equal(ping.status, 400, "el webhook debería rechazar sin firma");
  } catch {
    console.error(`No hay servidor en ${BASE}. Arranca "npm run dev" primero.`);
    process.exit(1);
  }

  await prueba("rechaza petición sin firma", async () => {
    const res = await fetch(WEBHOOK, { method: "POST", body: "{}" });
    assert.equal(res.status, 400);
  });

  await prueba("rechaza firma falsificada", async () => {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=falso" },
      body: JSON.stringify({ type: "customer.subscription.created" }),
    });
    assert.equal(res.status, 400);
  });

  await prueba("rechaza firma de otro secreto", async () => {
    const payload = JSON.stringify({ type: "customer.subscription.created", data: { object: {} } });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_secreto_que_no_es_el_nuestro",
    });
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: payload,
    });
    assert.equal(res.status, 400);
  });

  await prueba("usuario nuevo arranca en plan gratuito", async () => {
    const uid = await crearUsuario();
    assert.equal(await planDe(uid), "free");
  });

  await prueba("suscripción activa sube el plan y la cuota", async () => {
    const uid = await crearUsuario();
    const cust = await crearCliente(uid);
    const sub = await suscribir(cust, uid, "pro");

    const res = await enviarEvento("customer.subscription.created", sub);
    assert.equal(res.status, 200);
    assert.equal(await planDe(uid), "pro");
    assert.equal(await minutosDe(uid), await minutosDelPlan("pro"));
    // Y que de verdad sea más que la prueba gratuita, no el mismo número.
    assert.ok((await minutosDelPlan("pro")) > (await minutosDelPlan("free")));
  });

  await prueba("guarda la fila de suscripción con su período", async () => {
    const uid = await crearUsuario();
    const cust = await crearCliente(uid);
    const sub = await suscribir(cust, uid, "pro");
    await enviarEvento("customer.subscription.created", sub);

    const { data } = await admin
      .from("subscriptions")
      .select("id, status, plan_id, current_period_end")
      .eq("user_id", uid)
      .single();
    const fila = data as {
      id: string; status: string; plan_id: string; current_period_end: string;
    };
    assert.equal(fila.id, sub.id);
    assert.equal(fila.status, "active");
    assert.equal(fila.plan_id, "pro");
    assert.ok(new Date(fila.current_period_end) > new Date(), "el período debe terminar en el futuro");
  });

  await prueba("cancelar devuelve al plan gratuito", async () => {
    const uid = await crearUsuario();
    const cust = await crearCliente(uid);
    const sub = await suscribir(cust, uid, "pro");
    await enviarEvento("customer.subscription.created", sub);
    assert.equal(await planDe(uid), "pro");

    const cancelada = await stripe.subscriptions.cancel(sub.id);
    await enviarEvento("customer.subscription.deleted", cancelada);
    assert.equal(await planDe(uid), "free");
  });

  await prueba("un impago corta el acceso al plan de pago", async () => {
    const uid = await crearUsuario();
    const cust = await crearCliente(uid);
    const sub = await suscribir(cust, uid, "pro");
    await enviarEvento("customer.subscription.created", sub);

    // Simulamos lo que manda Stripe cuando el cobro recurrente falla.
    await enviarEvento("customer.subscription.updated", { ...sub, status: "past_due" });
    assert.equal(
      await planDe(uid),
      "free",
      "past_due no debe seguir dando minutos de pago"
    );
  });

  await prueba("cambio de plan actualiza la cuota", async () => {
    const uid = await crearUsuario();
    const cust = await crearCliente(uid);
    const sub = await suscribir(cust, uid, "pro");
    await enviarEvento("customer.subscription.created", sub);
    assert.equal(await planDe(uid), "pro");

    await enviarEvento("customer.subscription.updated", {
      ...sub,
      metadata: { user_id: uid, plan_id: "scale" },
    });
    assert.equal(await planDe(uid), "scale");
    assert.equal(await minutosDe(uid), await minutosDelPlan("scale"));
    assert.ok((await minutosDelPlan("scale")) > (await minutosDelPlan("pro")));
  });

  await prueba("reenviar el mismo evento no duplica nada", async () => {
    const uid = await crearUsuario();
    const cust = await crearCliente(uid);
    const sub = await suscribir(cust, uid, "pro");

    // Stripe reintenta ante un 5xx o un timeout: el reenvío debe ser inocuo.
    await enviarEvento("customer.subscription.created", sub);
    await enviarEvento("customer.subscription.created", sub);

    const { data, count } = await admin
      .from("subscriptions")
      .select("id", { count: "exact" })
      .eq("user_id", uid);
    assert.equal(count ?? (data ?? []).length, 1, "debería haber exactamente una fila");
    assert.equal(await planDe(uid), "pro");
  });

  await prueba("ignora suscripción sin metadata sin romperse", async () => {
    // Una suscripción creada a mano en el dashboard no lleva nuestra metadata.
    const res = await enviarEvento("customer.subscription.created", {
      id: "sub_sin_metadata",
      status: "active",
      metadata: {},
      items: { data: [] },
      start_date: Math.floor(Date.now() / 1000),
      cancel_at_period_end: false,
    });
    assert.equal(res.status, 200, "debe aceptarse para que Stripe no reintente en bucle");
  });

  await prueba("el consumo de meses anteriores no cuenta (plan gratuito)", async () => {
    const uid = await crearUsuario();
    const mesPasado = new Date();
    mesPasado.setMonth(mesPasado.getMonth() - 1);

    // Todas las filas del lote deben traer las mismas columnas: PostgREST
    // rechaza el insert entero si una lleva `occurred_at` y otra no.
    const { error } = await admin.from("usage_events").insert([
      {
        user_id: uid,
        kind: "stt_seconds",
        quantity: 120,
        occurred_at: new Date().toISOString(),
      },
      {
        user_id: uid,
        kind: "stt_seconds",
        quantity: 6000,
        occurred_at: mesPasado.toISOString(),
      },
    ]);
    assert.equal(error, null, `no se pudo registrar el consumo: ${error?.message}`);

    const { data } = await admin.rpc("current_usage_minutes", { p_user_id: uid });
    assert.equal(data, 2, "solo deben contar los 2 minutos de este mes");
  });

  await prueba("al renovar el período la cuota vuelve a cero", async () => {
    const uid = await crearUsuario();
    const ahora = new Date();
    const dias = (n: number) => {
      const d = new Date(ahora);
      d.setDate(d.getDate() + n);
      return d.toISOString();
    };

    await admin.from("subscriptions").insert({
      id: `sub_rollover_${uid}`,
      user_id: uid,
      plan_id: "pro",
      status: "active",
      current_period_start: dias(-40),
      current_period_end: dias(-10),
    });
    await admin.from("profiles").update({ plan_id: "pro" }).eq("id", uid);

    // Consumo cargado dentro del período que está a punto de cerrarse.
    await admin.from("usage_events").insert({
      user_id: uid,
      kind: "stt_seconds",
      quantity: 800 * 60,
      occurred_at: dias(-20),
    });
    const antes = await admin.rpc("current_usage_minutes", { p_user_id: uid });
    assert.equal(antes.data, 800);

    // Lo que hace Stripe al renovar: adelantar el período.
    await admin
      .from("subscriptions")
      .update({ current_period_start: dias(-2), current_period_end: dias(28) })
      .eq("id", `sub_rollover_${uid}`);

    const despues = await admin.rpc("current_usage_minutes", { p_user_id: uid });
    assert.equal(
      despues.data,
      0,
      "el consumo del período anterior no puede seguir descontando"
    );
  });

  await prueba("checkout y portal exigen sesión", async () => {
    for (const ruta of ["checkout", "portal"]) {
      const res = await fetch(`${BASE}/api/stripe/${ruta}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "pro" }),
      });
      assert.equal(res.status, 401, `/api/stripe/${ruta} debería pedir sesión`);
    }
  });

  await prueba("los planes de pago tienen precio en Stripe", async () => {
    const { data } = await admin
      .from("plans")
      .select("id, stripe_price_id")
      .gt("price_cents", 0);
    for (const p of (data ?? []) as Array<{ id: string; stripe_price_id: string | null }>) {
      assert.ok(p.stripe_price_id, `${p.id} sin stripe_price_id`);
      const price = await stripe.prices.retrieve(p.stripe_price_id);
      assert.equal(price.active, true, `el precio de ${p.id} está archivado`);
      assert.equal(price.recurring?.interval, "month");
    }
  });

  /* ───────────────────────────── limpieza ───────────────────────────── */

  for (const limpiar of basura.reverse()) {
    await limpiar().catch(() => {});
  }

  const total = pasadas + fallos.length;
  console.log(`\n${pasadas}/${total}`);
  if (fallos.length) {
    console.log(`Fallan: ${fallos.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
