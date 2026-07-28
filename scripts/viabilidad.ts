/**
 * Modelo de viabilidad del negocio, alimentado con el costo medido por
 * `npm run medir:costo`. Se re-corre cuando cambien precios o proveedores.
 *
 *   npm run viabilidad
 */

/* ───────────────────────── costos medidos (USD) ───────────────────────── */

const STT_MIN = 0.0077; // Deepgram nova-3 streaming, por minuto
const IA_GROQ_MIN = 0.0027; // medido: 8 turnos/min con contexto de 6
const IA_GOOGLE_MIN = 0.0103; // respaldo, notablemente más caro

/** Cuota de tráfico que acaba en el respaldo (fallos de Groq, límites TPM). */
const CUOTA_RESPALDO = 0.05;

const COSTO_MIN =
  STT_MIN + (1 - CUOTA_RESPALDO) * IA_GROQ_MIN + CUOTA_RESPALDO * IA_GOOGLE_MIN;

/* ─────────────────────────── costos fijos (USD/mes) ─────────────────────── */

const FIJOS = {
  Vercel: 20, // plan Pro
  Supabase: 25, // plan Pro (necesario para backups y sin pausa)
  Deepgram: 0, // pago por uso
  Resend: 0, // capa gratuita: 3.000 correos/mes, de sobra al arrancar
  Dominio: 2,
};
const FIJOS_TOTAL = Object.values(FIJOS).reduce((a, b) => a + b, 0);

/* ─────────────────────────── comisiones de Stripe ───────────────────────── */

const STRIPE_PCT = 0.029;
const STRIPE_FIJO = 0.3;

function neto(precio: number): number {
  return precio - (precio * STRIPE_PCT + STRIPE_FIJO);
}

/* ────────────────────────────── planes ────────────────────────────────── */

type Plan = { id: string; nombre: string; precio: number; minutos: number };

const PLANES: Plan[] = [
  { id: "free", nombre: "Prueba", precio: 0, minutos: 5 },
  { id: "pro", nombre: "Profesional", precio: 39, minutos: 900 },
  { id: "scale", nombre: "Intensivo", precio: 129, minutos: 4000 },
];

function usd(n: number, d = 2): string {
  return `$${n.toFixed(d)}`;
}
function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

/* ──────────────────────────── informe ─────────────────────────────────── */

console.log("═══ COSTO UNITARIO (medido) ═══\n");
console.log(`  Deepgram STT        ${usd(STT_MIN, 4)}/min   ${pct(STT_MIN / COSTO_MIN)} del total`);
console.log(`  IA (95% Groq)       ${usd(COSTO_MIN - STT_MIN, 4)}/min   ${pct((COSTO_MIN - STT_MIN) / COSTO_MIN)} del total`);
console.log(`  ─────────────────────────────`);
console.log(`  Total               ${usd(COSTO_MIN, 4)}/min  =  ${usd(COSTO_MIN * 60)}/hora\n`);

console.log("═══ MARGEN POR PLAN (si el cliente agota su cuota) ═══\n");
console.log("  plan          precio   minutos    costo    neto    margen");
for (const p of PLANES) {
  if (p.precio === 0) {
    console.log(
      `  ${p.nombre.padEnd(12)} ${"gratis".padStart(6)}   ${String(p.minutos).padStart(5)}    ` +
        `${usd(p.minutos * COSTO_MIN).padStart(6)}       —        — (captación)`
    );
    continue;
  }
  const costo = p.minutos * COSTO_MIN;
  const n = neto(p.precio);
  const margen = (n - costo) / n;
  console.log(
    `  ${p.nombre.padEnd(12)} ${usd(p.precio).padStart(6)}   ${String(p.minutos).padStart(5)}    ` +
      `${usd(costo).padStart(6)}  ${usd(n).padStart(6)}    ${pct(margen).padStart(4)}`
  );
}

console.log("\n  Nota: es el peor caso. El uso real medio en SaaS por consumo");
console.log("  ronda el 50-70% de la cuota, así que el margen efectivo sube.\n");

console.log("═══ PUNTO DE EQUILIBRIO ═══\n");
console.log(`  Costos fijos: ${usd(FIJOS_TOTAL)}/mes (${Object.entries(FIJOS).map(([k, v]) => `${k} ${usd(v, 0)}`).join(", ")})\n`);
for (const p of PLANES.filter((x) => x.precio > 0)) {
  for (const uso of [1, 0.6]) {
    const contribucion = neto(p.precio) - p.minutos * uso * COSTO_MIN;
    const clientes = Math.ceil(FIJOS_TOTAL / contribucion);
    console.log(
      `  ${p.nombre.padEnd(12)} uso ${pct(uso).padStart(4)} → aporta ${usd(contribucion).padStart(7)}/cliente ` +
        `→ equilibrio con ${clientes} cliente(s)`
    );
  }
}

console.log("\n═══ ESCENARIOS ═══\n");
const ESCENARIOS = [
  { nombre: "10 Profesional", pro: 10, scale: 0 },
  { nombre: "50 Profesional", pro: 50, scale: 0 },
  { nombre: "100 Prof + 10 Int", pro: 100, scale: 10 },
  { nombre: "300 Prof + 40 Int", pro: 300, scale: 40 },
];
const pro = PLANES.find((p) => p.id === "pro")!;
const scale = PLANES.find((p) => p.id === "scale")!;

console.log("  escenario            ingresos    costos   beneficio   margen");
for (const e of ESCENARIOS) {
  const ingresos = e.pro * pro.precio + e.scale * scale.precio;
  const netoTotal = e.pro * neto(pro.precio) + e.scale * neto(scale.precio);
  // Uso medio del 60% de la cuota contratada.
  const variables =
    (e.pro * pro.minutos + e.scale * scale.minutos) * 0.6 * COSTO_MIN;
  const beneficio = netoTotal - variables - FIJOS_TOTAL;
  console.log(
    `  ${e.nombre.padEnd(20)} ${usd(ingresos).padStart(8)}  ${usd(variables + FIJOS_TOTAL).padStart(8)}  ` +
      `${usd(beneficio).padStart(9)}   ${pct(beneficio / ingresos).padStart(5)}`
  );
}

console.log("\n═══ PALANCAS (ordenadas por impacto) ═══\n");
const palancas = [
  {
    q: "Deepgram con compromiso de volumen (~25% menos)",
    nuevo: STT_MIN * 0.75 + (COSTO_MIN - STT_MIN),
  },
  {
    q: "Caché del prompt de sistema (~60% menos de entrada de IA)",
    nuevo: STT_MIN + (COSTO_MIN - STT_MIN) * 0.45,
  },
  {
    q: "Ambas",
    nuevo: STT_MIN * 0.75 + (COSTO_MIN - STT_MIN) * 0.45,
  },
];
for (const p of palancas) {
  const ahorro = (COSTO_MIN - p.nuevo) / COSTO_MIN;
  const margenPro = (neto(pro.precio) - pro.minutos * p.nuevo) / neto(pro.precio);
  console.log(
    `  ${p.q.padEnd(52)} ${usd(p.nuevo, 4)}/min (−${pct(ahorro)}) · margen Profesional ${pct(margenPro)}`
  );
}
console.log();
