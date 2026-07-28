/**
 * Pruebas del historial de consultas.
 *
 *   npm run dev          # en otra terminal
 *   npm run test:historial
 *
 * Lo que se guarda aquí es contenido clínico: lo que dijo un paciente. Importa
 * que se guarde, pero importa más que no lo pueda leer nadie más.
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

async function entrar(email: string, password: string) {
  const sb = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`no pude entrar como ${email}: ${error.message}`);
  return { sb, session: data.session!, userId: data.user!.id };
}

/** Cookie de sesión como la parte @supabase/ssr cuando pasa de 4 KB. */
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

async function pedir(
  session: unknown,
  ruta: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(BASE + ruta, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "content-type": "application/json",
      cookie: cookieDe(session),
    },
    redirect: "manual",
  });
}

const TURNOS = [
  {
    sourceText: "Me duele el pecho cuando subo escaleras.",
    targetText: "My chest hurts when I go up stairs.",
    sourceLang: "es",
  },
  {
    sourceText: "How long has this been going on?",
    targetText: "¿Desde cuándo le viene pasando?",
    sourceLang: "en",
  },
  {
    sourceText: "Desde hace unas tres semanas, más o menos.",
    targetText: "For about three weeks now, more or less.",
    sourceLang: "es",
  },
];

async function main() {
  console.log(`Probando el historial contra ${BASE}\n`);

  const DUENO = cuenta("NUEVO");
  const AJENO = cuenta("USER");

  const dueno = await entrar(DUENO.email, DUENO.password);
  const ajeno = await entrar(AJENO.email, AJENO.password);

  // La sesión se crea con service role para no gastar un token de Deepgram
  // real en cada prueba; el resto del camino sí es el de producción.
  const { data: sesion, error: eSesion } = await admin
    .from("sessions")
    .insert({ user_id: dueno.userId, stt_engine: "deepgram" })
    .select("id")
    .single<{ id: string }>();
  if (eSesion) throw new Error(`no pude crear la sesión: ${eSesion.message}`);
  const sessionId = sesion.id;

  await prueba("guarda los turnos de una consulta", async () => {
    for (const [i, t] of TURNOS.entries()) {
      const res = await pedir(dueno.session, "/api/segments", {
        method: "POST",
        body: JSON.stringify({ sessionId, ordinal: i, ...t }),
      });
      assert.equal(res.status, 200, `turno ${i}: HTTP ${res.status}`);
    }

    const { data } = await admin
      .from("segments")
      .select("ordinal, source_text, target_text, source_lang")
      .eq("session_id", sessionId)
      .order("ordinal");

    assert.equal((data ?? []).length, 3, "deberían haberse guardado 3 turnos");
    const primero = (data ?? [])[0] as { source_text: string; source_lang: string };
    assert.equal(primero.source_text, TURNOS[0].sourceText);
    assert.equal(primero.source_lang, "es");
  });

  await prueba("el primer turno bautiza la consulta", async () => {
    const { data } = await admin
      .from("sessions")
      .select("title")
      .eq("id", sessionId)
      .single<{ title: string | null }>();
    assert.ok(data?.title, "la sesión debería tener título");
    assert.ok(
      TURNOS[0].sourceText.startsWith(data!.title!.replace(/…$/, "")),
      `título inesperado: ${data!.title}`
    );
  });

  await prueba("reenviar un turno no lo duplica", async () => {
    const res = await pedir(dueno.session, "/api/segments", {
      method: "POST",
      body: JSON.stringify({ sessionId, ordinal: 0, ...TURNOS[0] }),
    });
    assert.equal(res.status, 200);

    const { count } = await admin
      .from("segments")
      .select("ordinal", { count: "exact", head: true })
      .eq("session_id", sessionId);
    assert.equal(count, 3, `hay ${count} turnos; el upsert debería reemplazar`);
  });

  await prueba("un turno sin texto se rechaza", async () => {
    const res = await pedir(dueno.session, "/api/segments", {
      method: "POST",
      body: JSON.stringify({ sessionId, ordinal: 9, sourceText: "   " }),
    });
    assert.equal(res.status, 400);
  });

  await prueba("nadie puede escribir turnos en una consulta ajena", async () => {
    const res = await pedir(ajeno.session, "/api/segments", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        ordinal: 99,
        sourceText: "inyectado por otro usuario",
        sourceLang: "es",
      }),
    });
    // RLS lo impide: el turno llevaría el user_id del intruso y la política
    // exige que la sesión también sea suya.
    assert.notEqual(res.status, 200, "¡un tercero escribió en la consulta!");

    const { count } = await admin
      .from("segments")
      .select("ordinal", { count: "exact", head: true })
      .eq("session_id", sessionId);
    assert.equal(count, 3, "aparecieron turnos de más");
  });

  await prueba("nadie puede leer los turnos de otro", async () => {
    const { data } = await ajeno.sb
      .from("segments")
      .select("source_text")
      .eq("session_id", sessionId);
    assert.equal(
      (data ?? []).length,
      0,
      "¡se está filtrando lo que dijo un paciente!"
    );
  });

  await prueba("cerrar la consulta marca ended_at", async () => {
    const res = await pedir(dueno.session, "/api/sessions/cerrar", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    assert.equal(res.status, 200);
    const cuerpo = (await res.json()) as { cerrada: boolean };
    assert.equal(cuerpo.cerrada, true);

    const { data } = await admin
      .from("sessions")
      .select("ended_at")
      .eq("id", sessionId)
      .single<{ ended_at: string | null }>();
    assert.ok(data?.ended_at, "ended_at debería estar puesto");
  });

  await prueba("cerrar dos veces no es un error", async () => {
    const res = await pedir(dueno.session, "/api/sessions/cerrar", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    assert.equal(res.status, 200);
    const cuerpo = (await res.json()) as { cerrada: boolean };
    assert.equal(cuerpo.cerrada, false, "la segunda vez no cierra nada");
  });

  await prueba("un tercero no puede cerrar tu consulta", async () => {
    const { data: otra } = await admin
      .from("sessions")
      .insert({ user_id: dueno.userId, stt_engine: "deepgram" })
      .select("id")
      .single<{ id: string }>();

    const res = await pedir(ajeno.session, "/api/sessions/cerrar", {
      method: "POST",
      body: JSON.stringify({ sessionId: otra!.id }),
    });
    const cuerpo = (await res.json()) as { cerrada?: boolean };
    assert.notEqual(cuerpo.cerrada, true, "¡un tercero cerró una sesión ajena!");

    await admin.from("sessions").delete().eq("id", otra!.id);
  });

  await prueba("/historial lista la consulta a su dueño", async () => {
    const res = await pedir(dueno.session, "/historial");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(
      html.includes("Me duele el pecho"),
      "la consulta debería aparecer en el historial"
    );
  });

  await prueba("/app/c/[id] da 404 a quien no es el dueño", async () => {
    const res = await pedir(ajeno.session, `/app/c/${sessionId}`);
    assert.equal(res.status, 404);
  });

  await prueba("/historial exige sesión iniciada", async () => {
    const res = await fetch(`${BASE}/historial`, { redirect: "manual" });
    assert.equal(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login"));
  });

  // ── Reanudar una consulta ──

  await prueba("reanudar reabre la consulta y no factura el hueco", async () => {
    // La sesión quedó cerrada arriba. Se envejece el latido a propósito: si
    // reanudar no lo reiniciara, el primer latido facturaría estas dos horas.
    const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await admin
      .from("sessions")
      .update({ last_heartbeat_at: haceDosHoras })
      .eq("id", sessionId);

    const res = await pedir(
      dueno.session,
      `/api/deepgram/token?sessionId=${sessionId}`
    );
    assert.equal(res.status, 200, `HTTP ${res.status} al reanudar`);
    const cuerpo = (await res.json()) as { session_id: string };
    assert.equal(
      cuerpo.session_id,
      sessionId,
      "debería devolver la MISMA sesión, no abrir otra"
    );

    const { data } = await admin
      .from("sessions")
      .select("ended_at, last_heartbeat_at")
      .eq("id", sessionId)
      .single<{ ended_at: string | null; last_heartbeat_at: string }>();

    assert.equal(data?.ended_at, null, "la consulta debería quedar reabierta");
    const desfase = Date.now() - new Date(data!.last_heartbeat_at).getTime();
    assert.ok(
      desfase < 60_000,
      `el latido quedó ${Math.round(desfase / 1000)} s atrás: se facturaría el hueco`
    );
  });

  await prueba("los turnos nuevos no pisan los guardados", async () => {
    // El cliente numera a continuación de lo que ya había (ordinalBase).
    const res = await pedir(dueno.session, "/api/segments", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        ordinal: TURNOS.length,
        sourceText: "Y una última cosa, doctor.",
        targetText: "And one last thing, doctor.",
        sourceLang: "es",
      }),
    });
    assert.equal(res.status, 200);

    const { data } = await admin
      .from("segments")
      .select("ordinal, source_text")
      .eq("session_id", sessionId)
      .order("ordinal");

    const filas = (data ?? []) as Array<{ ordinal: number; source_text: string }>;
    assert.equal(filas.length, TURNOS.length + 1, "debería haber un turno más");
    assert.equal(
      filas[0].source_text,
      TURNOS[0].sourceText,
      "¡el turno nuevo pisó el primero de la consulta!"
    );
  });

  await prueba("nadie puede reanudar la consulta de otro", async () => {
    const res = await pedir(
      ajeno.session,
      `/api/deepgram/token?sessionId=${sessionId}`
    );
    assert.equal(res.status, 404, "un tercero no debe poder reabrirla");
  });

  // Limpieza: la cuenta "nuevo@" debe quedarse virgen para las demás pruebas.
  await admin.from("sessions").delete().eq("id", sessionId);

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
