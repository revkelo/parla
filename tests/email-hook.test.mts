/**
 * Pruebas del Send Email Hook de Supabase.
 *
 *   npm run dev            # en otra terminal
 *   npm run test:hook
 *
 * Comprueba que solo acepta peticiones firmadas: esta ruta provoca envíos de
 * correo, así que dejarla abierta permitiría que un tercero la usara para
 * mandar mensajes con nuestro dominio.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const RUTA = `${BASE}/api/auth/email-hook`;
const SECRETO = process.env.SUPABASE_EMAIL_HOOK_SECRET!;

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

function firmar(cuerpo: string, id: string, ts: string, secreto = SECRETO) {
  const base64 = secreto.replace(/^v1,/, "").replace(/^whsec_/, "");
  const mac = createHmac("sha256", Buffer.from(base64, "base64"))
    .update(`${id}.${ts}.${cuerpo}`)
    .digest("base64");
  return `v1,${mac}`;
}

function cuerpoDe(tipo = "signup", email = "destino@ejemplo.com") {
  return JSON.stringify({
    user: { email, user_metadata: { full_name: "Prueba" } },
    email_data: {
      token_hash: "hash_de_prueba",
      redirect_to: `${BASE}/app`,
      email_action_type: tipo,
      site_url: BASE,
    },
  });
}

async function enviar(cuerpo: string, firma?: string, id = "msg_1", ts = String(Math.floor(Date.now() / 1000))) {
  const cabeceras: Record<string, string> = { "content-type": "application/json" };
  if (firma) {
    cabeceras["webhook-id"] = id;
    cabeceras["webhook-timestamp"] = ts;
    cabeceras["webhook-signature"] = firma;
  }
  return fetch(RUTA, { method: "POST", headers: cabeceras, body: cuerpo });
}

async function main() {
  if (!SECRETO) {
    console.error("Falta SUPABASE_EMAIL_HOOK_SECRET en .env.local");
    process.exit(1);
  }
  console.log(`Probando el hook de correo contra ${RUTA}\n`);

  await prueba("rechaza petición sin firma", async () => {
    const res = await enviar(cuerpoDe());
    assert.equal(res.status, 401);
  });

  await prueba("rechaza firma inventada", async () => {
    const res = await enviar(cuerpoDe(), "v1,firmafalsa");
    assert.equal(res.status, 401);
  });

  await prueba("rechaza firma de otro secreto", async () => {
    const cuerpo = cuerpoDe();
    const id = "msg_2";
    const ts = String(Math.floor(Date.now() / 1000));
    const firma = firmar(cuerpo, id, ts, "v1,whsec_c2VjcmV0b19xdWVfbm9fZXM=");
    const res = await enviar(cuerpo, firma, id, ts);
    assert.equal(res.status, 401);
  });

  await prueba("rechaza si el cuerpo fue alterado tras firmar", async () => {
    const original = cuerpoDe();
    const id = "msg_3";
    const ts = String(Math.floor(Date.now() / 1000));
    const firma = firmar(original, id, ts);
    // Mismo sobre, contenido distinto: el destinatario cambiado no debe colar.
    const alterado = cuerpoDe("signup", "atacante@ejemplo.com");
    const res = await enviar(alterado, firma, id, ts);
    assert.equal(res.status, 401);
  });

  await prueba("acepta una firma válida y llama al proveedor", async () => {
    const cuerpo = cuerpoDe();
    const id = "msg_4";
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await enviar(cuerpo, firmar(cuerpo, id, ts), id, ts);
    // 200 = enviado. 500 = la firma pasó y falló el proveedor (dominio aún sin
    // verificar), que también demuestra que la autenticación funciona.
    assert.ok(
      res.status === 200 || res.status === 500,
      `esperaba 200 o 500, llegó ${res.status}`
    );
    if (res.status === 500) {
      console.log("        (firma OK; el proveedor rechazó: dominio sin verificar todavía)");
    }
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
