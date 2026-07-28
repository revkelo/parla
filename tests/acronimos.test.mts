/**
 * Los acrónimos, que son media promesa del producto.
 *
 *   npm run test:acronimos            # cadena por defecto (Groq → Google)
 *   npm run test:acronimos -- google  # fuerza un motor concreto
 *
 * Llama a la interpretación REAL y comprueba la política de acrónimos del
 * prompt, cuyo criterio es siempre qué entiende quien escucha:
 *
 *   1. Hay sigla establecida en la salida  → se usa la de la salida (EPOC→COPD).
 *   2. No hay sigla en la salida           → se conservan las letras + significado (NPO, CBC).
 *   3. Hay sigla pero nadie la usa         → término completo, sin siglas (CHF → insuficiencia
 *                                            cardíaca congestiva; ni "CHF" ni "ICC").
 *
 * Por eso cada caso declara siglas que DEBEN sobrevivir y siglas que NO deben
 * aparecer: cambiar "CHF" por "ICC" deja al paciente igual de perdido.
 */
import { interpret } from "../app/lib/interpret.js";

type Caso = {
  nombre: string;
  texto: string;
  origen: "es" | "en";
  /** Siglas que deben aparecer literalmente (comparación sensible a mayúsculas). */
  siglas?: string[];
  /** Siglas que NO deben aparecer: las del origen sin equivalente útil, o inventadas. */
  siglasProhibidas?: string[];
  /** De cada grupo, al menos una variante debe aparecer en la salida. */
  significado?: string[][];
  /** Si es true, el significado debe ir entre paréntesis (casos 1 y 2). */
  exigeParentesis?: boolean;
};

const CASOS: Caso[] = [
  {
    // Caso 3: "HTN"/"CHF"/"BP" no se entienden en español, y "HTA"/"ICC"/"TA"
    // tampoco: el paciente necesita el término completo.
    nombre: "sin sigla útil en la salida → término completo",
    texto: "He has HTN and CHF, and his BP today is 160 over 95.",
    origen: "en",
    siglasProhibidas: ["HTN", "CHF", "HTA", "ICC", "BP"],
    significado: [
      ["hipertension", "presion alta"],
      // "congestiva" no es opcional: es parte del diagnóstico.
      ["insuficiencia cardiaca congestiva"],
      ["presion arterial", "presion sanguinea", "tension arterial"],
      ["160"],
      ["95"],
    ],
  },
  {
    // Caso 2: no existe sigla española establecida; se conservan las letras
    // (son las que el paciente verá en la orden de laboratorio) + significado.
    nombre: "sin equivalente → se conservan las letras",
    texto: "The patient is NPO after midnight and needs a CBC before surgery.",
    origen: "en",
    siglas: ["NPO", "CBC"],
    significado: [
      ["nada por via oral", "en ayunas", "nada por boca"],
      ["hemograma completo", "biometria hematica completa", "recuento sanguineo completo", "conteo sanguineo completo"],
    ],
    exigeParentesis: true,
  },
  {
    // Caso 2 en obstetricia: LMP y EDD tampoco tienen sigla en español.
    nombre: "obstetricia: LMP y EDD conservan letras",
    texto: "When was your LMP, and what is your EDD?",
    origen: "en",
    siglas: ["LMP", "EDD"],
    siglasProhibidas: ["FUM", "FPP"],
    significado: [
      ["ultima regla", "ultima menstruacion", "ultimo periodo"],
      ["fecha probable de parto", "fecha estimada de parto"],
    ],
    exigeParentesis: true,
  },
  {
    // Caso 2, dirección ES→EN: A1C es igual en los dos idiomas; EKG/ECG ambas
    // valen en inglés estadounidense.
    nombre: "ES→EN: A1C se conserva, EKG/ECG ambas valen",
    texto: "Su A1C salió en 8.2 y le vamos a pedir un EKG antes de la consulta.",
    origen: "es",
    siglas: ["A1C"],
    significado: [
      ["EKG", "ECG", "electrocardiogram"],
      ["8.2"],
    ],
  },
  {
    // Caso 1: el médico anglófono no entiende "EPOC" ni "UCI".
    nombre: "ES→EN: sigla establecida en la salida",
    texto: "Tiene EPOC y lo mandamos a la UCI anoche.",
    origen: "es",
    siglas: ["COPD", "ICU"],
    siglasProhibidas: ["EPOC", "UCI"],
    significado: [["chronic obstructive"], ["intensive care"]],
    exigeParentesis: true,
  },
  {
    // Caso 1 a la inversa: siglas españolas con equivalente inglés claro.
    nombre: "ES→EN: RCP→CPR y VIH→HIV",
    texto: "Le hicimos RCP en la ambulancia y la prueba de VIH salió negativa.",
    origen: "es",
    siglas: ["CPR", "HIV"],
    siglasProhibidas: ["RCP", "VIH"],
    significado: [["negative"]],
  },
];

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Sigla suelta, no la misma secuencia dentro de otra palabra. */
function contieneSigla(salida: string, sigla: string) {
  const re = new RegExp(`(^|[^A-Za-z])${sigla}([^A-Za-z]|$)`);
  return re.test(salida);
}

const MOTOR = (process.argv[2] as "groq" | "google" | undefined) || undefined;

let ok = 0;
const fallos: string[] = [];

for (const c of CASOS) {
  const r = await interpret({
    text: c.texto,
    reportedLang: c.origen,
    context: [],
    force: MOTOR,
  });
  const salida = r.interpretation;
  const plano = normalizar(salida);

  const problemas: string[] = [];

  for (const sig of c.siglas ?? []) {
    if (!contieneSigla(salida, sig)) problemas.push(`perdió la sigla "${sig}"`);
  }

  for (const sig of c.siglasProhibidas ?? []) {
    if (contieneSigla(salida, sig)) problemas.push(`usó la sigla "${sig}"`);
  }

  for (const grupo of c.significado ?? []) {
    if (!grupo.some((s) => plano.includes(normalizar(s)))) {
      problemas.push(`sin significado de {${grupo.join(" | ")}}`);
    }
  }

  // Cuando se conserva una sigla, su significado tiene que ir entre paréntesis,
  // no suelto por la frase.
  if (c.exigeParentesis) {
    const entreParentesis = normalizar((salida.match(/\(([^)]+)\)/g) ?? []).join(" "));
    for (const grupo of c.significado ?? []) {
      if (!grupo.some((s) => entreParentesis.includes(normalizar(s)))) {
        problemas.push(`{${grupo.join(" | ")}} fuera de paréntesis`);
      }
    }
  }

  console.log(`\n${c.origen.toUpperCase()} → ${c.origen === "es" ? "EN" : "ES"}  [${r.engine}]  ${c.nombre}`);
  console.log(`  entrada : ${c.texto}`);
  console.log(`  salida  : ${salida}`);
  if (problemas.length === 0) {
    console.log("  PASA");
    ok++;
  } else {
    console.log(`  FALLA   : ${problemas.join("; ")}`);
    fallos.push(c.nombre);
  }
}

console.log(`\n${ok}/${CASOS.length}`);
if (fallos.length) {
  console.log(`Fallan: ${fallos.join(", ")}`);
  process.exit(1);
}
