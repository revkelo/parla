/**
 * Mide empíricamente el costo de interpretar, para poder fijar precios con
 * datos en vez de con intuición.
 *
 *   npm run medir:costo
 *
 * Corre los casos reales de evaluación contra el motor de IA y contabiliza
 * tokens de entrada y salida por turno. El contexto conversacional hace que
 * cada turno cargue con los anteriores, así que el costo por turno NO es
 * constante: crece hasta estabilizarse en la ventana de contexto.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import {
  CONTEXT_TURNS,
  type ContextTurn,
  SYSTEM_PROMPT,
  type SourceLang,
  buildPrompt,
} from "../app/lib/interpreter-prompt";
import { GOOGLE_MODEL, GROQ_MODEL } from "../app/lib/interpret";

const here = dirname(fileURLToPath(import.meta.url));
const casos: Array<{ lang: SourceLang; text: string }> = JSON.parse(
  readFileSync(join(here, "..", "eval", "cases.json"), "utf-8")
);

/**
 * Precios por millón de tokens (USD), a julio de 2026. Si cambian, este es el
 * único sitio que hay que tocar.
 */
const PRECIOS = {
  groq: { entrada: 0.15, salida: 0.6 },
  google: { entrada: 0.3, salida: 2.5 },
} as const;

/** Deepgram nova-3 streaming, USD por minuto de audio. */
const DEEPGRAM_USD_MIN = 0.0077;

/**
 * Turnos por minuto en una consulta médica real. Un intérprete consecutivo
 * alterna con el hablante cada pocos segundos; 8/min es un ritmo conversacional
 * sostenido y deliberadamente conservador (sobreestima el costo de IA).
 */
const TURNOS_POR_MINUTO = 8;

type Motor = "groq" | "google";

async function medir(motor: Motor) {
  const modelo = motor === "groq" ? groq(GROQ_MODEL) : google(GOOGLE_MODEL);
  const contexto: ContextTurn[] = [];
  let entrada = 0;
  let salida = 0;
  let turnos = 0;

  for (const caso of casos) {
    const prompt = buildPrompt(
      caso.text,
      caso.lang,
      contexto.slice(-CONTEXT_TURNS)
    );
    try {
      const r = await generateText({
        model: modelo,
        system: SYSTEM_PROMPT,
        prompt,
        temperature: 0.1,
      });
      entrada += r.usage?.inputTokens ?? 0;
      salida += r.usage?.outputTokens ?? 0;
      turnos++;
      contexto.push({
        source: caso.text,
        target: r.text.trim(),
        sourceLang: caso.lang,
      });
    } catch (err) {
      console.warn(`  (turno omitido: ${(err as Error).message.split("\n")[0]})`);
    }
    // El free tier de Groq limita tokens por minuto; sin esto la medición
    // se corta a mitad y falsea el promedio.
    await new Promise((r) => setTimeout(r, 1500));
  }

  const p = PRECIOS[motor];
  const usdEntrada = (entrada / 1_000_000) * p.entrada;
  const usdSalida = (salida / 1_000_000) * p.salida;
  const usdTurno = (usdEntrada + usdSalida) / turnos;

  return {
    motor,
    turnos,
    entradaMedia: Math.round(entrada / turnos),
    salidaMedia: Math.round(salida / turnos),
    usdTurno,
    usdMinutoIA: usdTurno * TURNOS_POR_MINUTO,
  };
}

function usd(n: number, dec = 4): string {
  return `$${n.toFixed(dec)}`;
}

async function main() {
  console.log(
    `Midiendo con ${casos.length} turnos reales · contexto de ${CONTEXT_TURNS} turnos\n`
  );

  const resultados = [];
  for (const motor of ["groq", "google"] as const) {
    process.stdout.write(`${motor}…\n`);
    try {
      resultados.push(await medir(motor));
    } catch (err) {
      console.warn(`  ${motor} no disponible: ${(err as Error).message}`);
    }
  }

  console.log("\n─────────── tokens por turno (con contexto) ───────────");
  for (const r of resultados) {
    console.log(
      `${r.motor.padEnd(8)} entrada ${String(r.entradaMedia).padStart(5)} · ` +
        `salida ${String(r.salidaMedia).padStart(4)} · ` +
        `${usd(r.usdTurno, 6)}/turno`
    );
  }

  console.log("\n─────────── costo por minuto de sesión ───────────");
  console.log(`Deepgram STT                    ${usd(DEEPGRAM_USD_MIN)}`);
  for (const r of resultados) {
    console.log(
      `IA ${r.motor.padEnd(7)} (${TURNOS_POR_MINUTO} turnos/min)   ${usd(r.usdMinutoIA)}`
    );
  }

  console.log("\n─────────── costo total por minuto ───────────");
  for (const r of resultados) {
    const total = DEEPGRAM_USD_MIN + r.usdMinutoIA;
    console.log(
      `con ${r.motor.padEnd(7)} ${usd(total)}/min  ·  ${usd(total * 60, 2)}/hora  ·  ` +
        `${usd(total * 1000, 2)} por 1.000 min`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
