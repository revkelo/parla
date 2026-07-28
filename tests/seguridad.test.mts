/**
 * Pruebas de seguridad: intentan abusar del producto, no usarlo.
 *
 *   npm run dev          # en otra terminal
 *   npm run test:seguridad
 *
 * Las de RLS (leer datos ajenos, ascenderse a admin) viven en `admin` e
 * `historial`. Aquí va la superficie que queda: rutas sin sesión, redirección
 * abierta, cookies manipuladas y datos de entrada hostiles.
 */

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3200";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

async function entrar(email: string, password: string) {
  const sb = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`no pude entrar como ${email}: ${error.message}`);
  return data.session!;
}

function cookieDe(session: unknown): string {
  const ref = new URL(URL_SB).hostname.split(".")[0];
  const valor = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
  const TROZO = 3180;
  if (valor.length <= TROZO) return `sb-${ref}-auth-token=${valor}`;
  const trozos: string[] = [];
  for (let i = 0, n = 0; i < valor.length; i += TROZO, n++) {
    trozos.push(`sb-${ref}-auth-token.${n}=${valor.slice(i, i + TROZO)}`);
  }
  return trozos.join("; ");
}

async function pedir(ruta: string, cookie?: string, init: RequestInit = {}) {
  return fetch(BASE + ruta, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
  });
}

async function main() {
  console.log(`Pruebas de seguridad contra ${BASE}\n`);

  const u = cuenta("USER");
  const a = cuenta("ADMIN");
  const normal = await entrar(u.email, u.password);
  const admin = await entrar(a.email, a.password);
  const cNormal = cookieDe(normal);
  const cAdmin = cookieDe(admin);

  // ── Rutas sin sesión ──

  await prueba("las rutas de API rechazan a quien no ha entrado", async () => {
    const casos: Array<[string, RequestInit]> = [
      ["/api/usage", {}],
      ["/api/deepgram/token", {}],
      [
        "/api/interpret",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "hola" }),
        },
      ],
      [
        "/api/segments",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: "x", ordinal: 0, sourceText: "x" }),
        },
      ],
      [
        "/api/sessions/cerrar",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: "x" }),
        },
      ],
      ["/api/usage/heartbeat", { method: "POST", body: "{}" }],
    ];

    for (const [ruta, init] of casos) {
      const res = await pedir(ruta, undefined, init);
      assert.ok(
        res.status === 401 || res.status === 404 || res.status === 307,
        `${ruta} respondió ${res.status} sin sesión`
      );
    }
  });

  await prueba("las páginas privadas mandan a login sin sesión", async () => {
    for (const ruta of ["/app", "/cuenta", "/historial", "/admin"]) {
      const res = await pedir(ruta);
      assert.equal(res.status, 307, `${ruta} respondió ${res.status}`);
      assert.ok(
        res.headers.get("location")?.includes("/login"),
        `${ruta} no redirige a login`
      );
    }
  });

  // ── El saldo de los proveedores es información del negocio ──

  await prueba("el saldo de Deepgram solo lo ve un administrador", async () => {
    const sin = await pedir("/api/deepgram/balance");
    assert.notEqual(sin.status, 200, "¡el saldo está abierto a internet!");

    const usuario = await pedir("/api/deepgram/balance", cNormal);
    assert.equal(
      usuario.status,
      404,
      `un usuario normal recibió ${usuario.status}`
    );

    const jefe = await pedir("/api/deepgram/balance", cAdmin);
    assert.notEqual(jefe.status, 404, "el admin sí debería poder consultarlo");
  });

  // ── Redirección abierta ──

  await prueba("no se puede usar ?next= para sacar al usuario fuera", async () => {
    // El proxy conserva `next` al mandar a login; el peligro sería que después
    // de entrar redirigiera a un dominio ajeno.
    const res = await pedir("/app?next=https://ejemplo-malicioso.test");
    const destino = res.headers.get("location") ?? "";
    assert.ok(
      !destino.includes("ejemplo-malicioso"),
      `el proxy propagó un destino externo: ${destino}`
    );
  });

  // ── Cookies manipuladas ──

  await prueba("una cookie de sesión inventada no sirve", async () => {
    const ref = new URL(URL_SB).hostname.split(".")[0];
    const falsa = `sb-${ref}-auth-token=base64-${Buffer.from(
      JSON.stringify({
        access_token: "inventado",
        refresh_token: "inventado",
        user: { id: "00000000-0000-0000-0000-000000000000", email: "x@y.z" },
      })
    ).toString("base64")}`;

    const res = await pedir("/app", falsa);
    assert.equal(res.status, 307, "una sesión falsa no debe dar acceso");
    assert.ok(res.headers.get("location")?.includes("/login"));
  });

  await prueba("un idioma inventado en la cookie no rompe nada", async () => {
    for (const valor of ["zz", "<script>", "../../etc/passwd", ""]) {
      const res = await pedir(
        "/",
        `parla-idioma=${encodeURIComponent(valor)}`
      );
      assert.equal(res.status, 200, `la portada falló con idioma "${valor}"`);
    }
  });

  // ── Entradas hostiles ──

  await prueba("un cuerpo inválido no tumba las rutas", async () => {
    const casos = ["", "no-es-json", "[]", '{"sessionId":null}', "null"];
    for (const cuerpo of casos) {
      const res = await pedir("/api/segments", cNormal, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: cuerpo,
      });
      assert.ok(
        res.status === 400 || res.status === 401,
        `cuerpo ${JSON.stringify(cuerpo)} respondió ${res.status}`
      );
    }
  });

  await prueba("un id de sesión que no es un uuid se rechaza", async () => {
    const res = await pedir("/api/sessions/cerrar", cNormal, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "'; drop table sessions;--" }),
    });
    assert.ok(res.status >= 400 && res.status < 600, `respondió ${res.status}`);

    // Y la tabla sigue ahí: el cliente parametriza, no concatena.
    const sb = createClient(
      URL_SB,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { error } = await sb.from("sessions").select("id").limit(1);
    assert.equal(error, null, "¡la tabla sessions ya no responde!");
  });

  // ── Cabeceras ──

  await prueba("las respuestas no anuncian de más", async () => {
    const res = await pedir("/");
    const powered = res.headers.get("x-powered-by");
    assert.ok(
      !powered || !powered.toLowerCase().includes("next"),
      `X-Powered-By revela la tecnología: ${powered}`
    );
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
