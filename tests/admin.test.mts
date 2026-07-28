/**
 * Pruebas del rol de administrador.
 *
 *   npm run dev          # en otra terminal
 *   npm run test:admin
 *
 * Lo importante aquí no es que el admin pueda: es que el usuario normal NO
 * pueda. Un panel de administración con RLS mal puesta filtra la base entera.
 */

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/**
 * Credenciales de las cuentas de prueba.
 *
 * Salen de `.env.local`, no del código: este repositorio es público y son
 * cuentas reales de la base de datos. `npm run sembrar` las crea y las imprime.
 */
function cuenta(prefijo: string): { email: string; password: string } {
  const email = process.env[`TEST_${prefijo}_EMAIL`];
  const password = process.env[`TEST_${prefijo}_PASSWORD`];
  if (!email || !password) {
    throw new Error(
      `Faltan TEST_${prefijo}_EMAIL y TEST_${prefijo}_PASSWORD en .env.local`
    );
  }
  return { email, password };
}

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

/** Cliente autenticado como ese usuario, sujeto a RLS. */
async function comoUsuario(email: string, password: string) {
  const sb = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`no pude entrar como ${email}: ${error.message}`);
  return { sb, session: data.session! };
}

/** Petición HTTP con la cookie de sesión que espera @supabase/ssr. */
async function pedirComo(session: unknown, ruta: string) {
  const ref = new URL(URL_SB).hostname.split(".")[0];
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(
    JSON.stringify(session)
  ).toString("base64")}`;
  return fetch(BASE + ruta, { headers: { cookie }, redirect: "manual" });
}

async function main() {
  console.log(`Probando el rol de administrador contra ${BASE}\n`);

  const ROOT = cuenta("ADMIN");
  const NORMAL = cuenta("USER");

  const totalUsuarios = (await admin.auth.admin.listUsers({ perPage: 200 }))
    .data.users.length;

  await prueba("el admin ve todos los perfiles", async () => {
    const { sb } = await comoUsuario(ROOT.email, ROOT.password);
    const { data, error } = await sb.from("profiles").select("id");
    assert.equal(error, null, error?.message);
    assert.ok(
      (data ?? []).length > 1,
      `solo vio ${(data ?? []).length} perfil(es) de ${totalUsuarios}`
    );
  });

  await prueba("el usuario normal solo ve su propio perfil", async () => {
    const { sb } = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data } = await sb.from("profiles").select("id, email");
    assert.equal(
      (data ?? []).length,
      1,
      `vio ${(data ?? []).length} perfiles; debería ver solo el suyo`
    );
    assert.equal((data as Array<{ email: string }>)[0].email, NORMAL.email);
  });

  await prueba("el usuario normal no ve el consumo de otros", async () => {
    const { sb } = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data: mio } = await sb.from("usage_events").select("user_id");
    const ajenos = new Set((mio ?? []).map((r) => (r as { user_id: string }).user_id));
    assert.ok(ajenos.size <= 1, "está viendo consumo de más de un usuario");
  });

  await prueba("is_admin() distingue correctamente", async () => {
    const a = await comoUsuario(ROOT.email, ROOT.password);
    const n = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data: esRoot } = await a.sb.rpc("is_admin");
    const { data: esNormal } = await n.sb.rpc("is_admin");
    assert.equal(esRoot, true, "root debería ser admin");
    assert.equal(esNormal, false, "un usuario normal NO debería ser admin");
  });

  await prueba("las métricas solo responden al admin", async () => {
    const a = await comoUsuario(ROOT.email, ROOT.password);
    const n = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data: m } = await a.sb.rpc("admin_metricas");
    assert.ok(
      Array.isArray(m) ? m.length === 1 : !!m,
      "el admin debería recibir métricas"
    );
    const { data: vacio } = await n.sb.rpc("admin_metricas");
    assert.equal(
      Array.isArray(vacio) ? vacio.length : vacio,
      0,
      "un usuario normal no debe obtener métricas"
    );
  });

  await prueba("/admin responde 200 al administrador", async () => {
    const { session } = await comoUsuario(ROOT.email, ROOT.password);
    const res = await pedirComo(session, "/admin");
    assert.equal(res.status, 200);
  });

  await prueba("/admin da 404 a un usuario normal", async () => {
    const { session } = await comoUsuario(NORMAL.email, NORMAL.password);
    const res = await pedirComo(session, "/admin");
    assert.equal(
      res.status,
      404,
      "no debe revelar que la ruta existe siquiera"
    );
  });

  await prueba("/admin redirige a login sin sesión", async () => {
    const res = await fetch(`${BASE}/admin`, { redirect: "manual" });
    assert.equal(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login"));
  });

  await prueba("el usuario normal no puede ascenderse a admin", async () => {
    const { sb } = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data: yo } = await sb.from("profiles").select("id").single();
    await sb
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", (yo as { id: string }).id);

    // Se comprueba con service role: lo que diga el cliente da igual.
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("email", NORMAL.email)
      .single();
    assert.equal(
      (data as { role: string }).role,
      "user",
      "¡un usuario normal consiguió hacerse administrador!"
    );
  });

  await prueba("el usuario normal no puede regalarse un plan", async () => {
    const { sb } = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data: yo } = await sb.from("profiles").select("id").single();
    await sb
      .from("profiles")
      .update({ plan_id: "scale" })
      .eq("id", (yo as { id: string }).id);

    const { data } = await admin
      .from("profiles")
      .select("plan_id")
      .eq("email", NORMAL.email)
      .single();
    assert.equal(
      (data as { plan_id: string }).plan_id,
      "pro",
      "¡un usuario normal se cambió el plan solo!"
    );
  });

  // ── RPC nuevas del panel (0006) ──
  // Cada una lleva su propio `where is_admin()`: si a alguna se le olvidara,
  // un usuario normal se llevaría el correo y el consumo de toda la base.

  await prueba("admin_usuarios devuelve el consumo de todos al admin", async () => {
    const { sb } = await comoUsuario(ROOT.email, ROOT.password);
    const { data, error } = await sb.rpc("admin_usuarios", { p_limite: 200 });
    assert.equal(error, null, error?.message);
    const filas = (data ?? []) as Array<{
      email: string;
      minutos_usados: number;
      plan_minutos: number;
    }>;
    assert.ok(filas.length > 1, `solo vio ${filas.length} usuario(s)`);

    const gastador = filas.find((f) => f.email === "intensivo@parla.local");
    assert.ok(gastador, "falta la cuenta sembrada intensivo@parla.local");
    assert.ok(
      gastador!.minutos_usados > 0,
      "el consumo debería venir agregado, no en cero"
    );
    assert.ok(gastador!.plan_minutos > 0, "falta el límite del plan");
  });

  await prueba("admin_usuarios no filtra nada a un usuario normal", async () => {
    const { sb } = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data } = await sb.rpc("admin_usuarios", { p_limite: 200 });
    assert.equal(
      (data ?? []).length,
      0,
      "¡un usuario normal está viendo la lista completa de usuarios!"
    );
  });

  await prueba("admin_serie_diaria da un punto por día, sin huecos", async () => {
    const { sb } = await comoUsuario(ROOT.email, ROOT.password);
    const { data } = await sb.rpc("admin_serie_diaria", { p_dias: 30 });
    const serie = (data ?? []) as Array<{ dia: string; minutos: number }>;
    assert.equal(serie.length, 30, `devolvió ${serie.length} puntos de 30`);

    // Sin días ausentes la gráfica no puede unir dos picos separados por una
    // semana muerta y hacerlos parecer continuos.
    for (let i = 1; i < serie.length; i++) {
      const dif =
        (+new Date(serie[i].dia) - +new Date(serie[i - 1].dia)) / 86_400_000;
      assert.equal(dif, 1, `hueco en la serie entre ${serie[i - 1].dia} y ${serie[i].dia}`);
    }
  });

  await prueba("admin_serie_diaria no responde a un usuario normal", async () => {
    const { sb } = await comoUsuario(NORMAL.email, NORMAL.password);
    const { data } = await sb.rpc("admin_serie_diaria", { p_dias: 30 });
    assert.equal((data ?? []).length, 0);
  });

  await prueba("admin_reparto_planes cuadra con el total de usuarios", async () => {
    const { sb } = await comoUsuario(ROOT.email, ROOT.password);
    const [{ data: reparto }, { data: metricas }] = await Promise.all([
      sb.rpc("admin_reparto_planes"),
      sb.rpc("admin_metricas"),
    ]);
    const suma = ((reparto ?? []) as Array<{ usuarios: number }>).reduce(
      (a, p) => a + p.usuarios,
      0
    );
    const m = (Array.isArray(metricas) ? metricas[0] : metricas) as {
      usuarios: number;
    };
    assert.equal(
      suma,
      m.usuarios,
      "el reparto por plan no suma el total de usuarios"
    );

    const { data: vacio } = await (
      await comoUsuario(NORMAL.email, NORMAL.password)
    ).sb.rpc("admin_reparto_planes");
    assert.equal((vacio ?? []).length, 0, "un usuario normal no debe verlo");
  });

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
