/**
 * Evaluación de la calidad de interpretación.
 *
 *   npm run eval              # motor por defecto (Groq con respaldo)
 *   npm run eval -- --engine=google
 *   npm run eval -- --no-context    # mide cuánto aporta el contexto
 *   npm run eval -- --case=ctx-02   # un solo caso, para depurar
 *
 * Las comprobaciones son deliberadamente mecánicas (invariantes que NUNCA
 * deben romperse: números, dosis, nombres propios, dirección del idioma,
 * ausencia de marcos narrativos). No miden elegancia; miden que no se rompa
 * nada de lo que a un intérprete lo descalificaría.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { type Engine, detectSource, interpret } from "../app/lib/interpret";
import type { ContextTurn, SourceLang } from "../app/lib/interpreter-prompt";

type Expect = {
  /** Todas estas cadenas deben aparecer literalmente. */
  contains?: string[];
  /** De cada grupo, al menos una variante debe aparecer. */
  containsAny?: string[][];
  /** Ninguna de estas debe aparecer. */
  notContains?: string[];
  /** Idioma esperado de la salida. */
  lang?: SourceLang;
};

type Case = {
  id: string;
  lang: SourceLang;
  text: string;
  context?: ContextTurn[];
  expect: Expect;
};

const here = dirname(fileURLToPath(import.meta.url));
const cases: Case[] = JSON.parse(
  readFileSync(join(here, "cases.json"), "utf-8")
);

const args = process.argv.slice(2);
const engineArg = args.find((a) => a.startsWith("--engine="))?.split("=")[1];
const caseArg = args.find((a) => a.startsWith("--case="))?.split("=")[1];
const useContext = !args.includes("--no-context");
const engine =
  engineArg === "groq" || engineArg === "google"
    ? (engineArg as Engine)
    : undefined;

function check(out: string, e: Expect): string[] {
  const fails: string[] = [];
  const lower = out.toLowerCase();

  for (const s of e.contains ?? []) {
    if (!lower.includes(s.toLowerCase())) fails.push(`falta "${s}"`);
  }
  for (const group of e.containsAny ?? []) {
    if (!group.some((s) => lower.includes(s.toLowerCase()))) {
      fails.push(`falta alguna de [${group.join(" | ")}]`);
    }
  }
  for (const s of e.notContains ?? []) {
    if (lower.includes(s.toLowerCase())) fails.push(`no debía contener "${s}"`);
  }
  // La detección automática no es fiable en salidas de pocas palabras
  // ("Three.", "Vale."), así que ahí no la aplicamos: daría falsos fallos.
  const words = out.trim().split(/\s+/).length;
  if (e.lang && words >= 4 && detectSource(out) !== e.lang) {
    fails.push(`idioma de salida esperado ${e.lang} (salida: ${detectSource(out)})`);
  }
  return fails;
}

async function main() {
  const selected = caseArg ? cases.filter((c) => c.id === caseArg) : cases;
  if (selected.length === 0) {
    console.error(`No hay ningún caso con id "${caseArg}".`);
    process.exit(1);
  }

  console.log(
    `Evaluando ${selected.length} casos · motor=${engine ?? "auto"} · ` +
      `contexto=${useContext ? "sí" : "no"}\n`
  );

  let passed = 0;
  const failures: string[] = [];

  for (const c of selected) {
    let out = "";
    let fails: string[];
    try {
      const r = await interpret({
        text: c.text,
        reportedLang: c.lang,
        context: useContext ? (c.context ?? []) : [],
        force: engine,
      });
      out = r.interpretation;
      fails = check(out, c.expect);
    } catch (err) {
      fails = [`error del motor: ${(err as Error).message}`];
    }

    if (fails.length === 0) {
      passed++;
      console.log(`  PASA  ${c.id}`);
    } else {
      console.log(`  FALLA ${c.id}`);
      console.log(`        in : ${c.text}`);
      console.log(`        out: ${out}`);
      for (const f of fails) console.log(`        ✗ ${f}`);
      failures.push(c.id);
    }
  }

  const pct = Math.round((passed / selected.length) * 100);
  console.log(`\n${passed}/${selected.length} (${pct}%)`);
  if (failures.length > 0) {
    console.log(`Fallan: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
