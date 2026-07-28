/**
 * Aplica las migraciones SQL de supabase/migrations en orden alfabético.
 *
 *   npm run migrate
 *
 * Lleva registro en la tabla `_migrations`, así que es idempotente: volver a
 * correrlo solo aplica lo que falte. Usa la conexión directa (no el pooler)
 * porque el pooler no admite DDL en transacción.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

function requireConnectionString(): string {
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    console.error("Falta POSTGRES_URL_NON_POOLING (corre `vercel env pull`).");
    process.exit(1);
  }
  return url;
}

const connectionString = requireConnectionString();

/**
 * Supabase entrega `sslmode=require`, que `pg` interpreta hoy como
 * `verify-full` y falla porque su CA no está en el almacén de Node.
 * `uselibpqcompat=true` le devuelve la semántica de libpq, donde `require`
 * significa cifrar sin verificar la cadena. La conexión sigue cifrada.
 */
function withLibpqSsl(url: string): string {
  const u = new URL(url);
  u.searchParams.set("uselibpqcompat", "true");
  u.searchParams.set("sslmode", "require");
  return u.toString();
}

async function main() {
  const client = new Client({ connectionString: withLibpqSsl(connectionString) });
  await client.connect();

  await client.query(`
    create table if not exists public._migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  // Todo lo que vive en `public` queda expuesto vía PostgREST. Esta tabla no
  // le incumbe a nadie salvo a este script (que entra por conexión directa y
  // se salta RLS), así que va con RLS activo y sin políticas: nadie la lee.
  await client.query("alter table public._migrations enable row level security");

  const applied = new Set(
    (await client.query<{ name: string }>("select name from public._migrations"))
      .rows.map((r) => r.name)
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ya aplicada  ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    process.stdout.write(`  aplicando    ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._migrations (name) values ($1)", [
        file,
      ]);
      await client.query("commit");
      console.log("ok");
      ran++;
    } catch (err) {
      await client.query("rollback");
      console.log("FALLÓ");
      console.error(`\n${(err as Error).message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(ran === 0 ? "\nNada que aplicar." : `\n${ran} migración(es) aplicada(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
