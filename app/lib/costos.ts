/**
 * Lo que cuesta tener parla en marcha.
 *
 * Las tarifas salen de `npm run medir:costo`, que mide tokens reales sobre los
 * casos de `eval/cases.json` en vez de estimarlos. Si un proveedor cambia
 * precios, este archivo y el del script son los dos únicos sitios que tocar.
 *
 * Todo en USD.
 */

/** Deepgram nova-3 streaming, por minuto de audio. */
export const DEEPGRAM_USD_MIN = 0.0077;

/**
 * Coste medio de una interpretación (una llamada a la IA con su contexto).
 *
 * Medido: $0.0031 por minuto de consulta en IA, a un ritmo conversacional de
 * 8 turnos por minuto. Es el motor principal (Groq); el respaldo de Google sale
 * más caro, así que la cifra real queda algo por encima cuando entra.
 */
export const IA_USD_PETICION = 0.0031 / 8;

/** Coste total por minuto de consulta, transcripción más interpretación. */
export const USD_MIN_TOTAL = DEEPGRAM_USD_MIN + IA_USD_PETICION * 8;

export type Proveedor = {
  nombre: string;
  concepto: string;
  /** Unidades consumidas en el período (minutos o peticiones). */
  cantidad: number;
  unidad: string;
  /** Gasto del período. */
  usd: number;
  /** Saldo restante en la cuenta del proveedor, si el proveedor lo expone. */
  saldoUsd?: number | null;
  /** `true` si la cifra es una estimación y no una lectura del proveedor. */
  estimado: boolean;
};

export function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

/**
 * Saldo restante de la cuenta de Deepgram.
 *
 * Devuelve `null` si no se puede consultar en lugar de romper el panel: el
 * saldo es un dato de apoyo, y quedarse sin panel de administración porque un
 * proveedor no responde sería un mal negocio.
 */
export async function saldoDeepgram(): Promise<number | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;

  const headers = { Authorization: `Token ${apiKey}` };
  try {
    const proyectos = await fetch("https://api.deepgram.com/v1/projects", {
      headers,
      cache: "no-store",
    });
    if (!proyectos.ok) return null;

    const { projects } = (await proyectos.json()) as {
      projects?: Array<{ project_id: string }>;
    };
    const id = projects?.[0]?.project_id;
    if (!id) return null;

    const saldos = await fetch(
      `https://api.deepgram.com/v1/projects/${id}/balances`,
      { headers, cache: "no-store" }
    );
    if (!saldos.ok) return null;

    const { balances } = (await saldos.json()) as {
      balances?: Array<{ amount?: number }>;
    };
    return (balances ?? []).reduce((suma, b) => suma + (b.amount ?? 0), 0);
  } catch {
    return null;
  }
}

/**
 * Cuántos días de servicio quedan al ritmo de gasto actual.
 * `null` cuando no hay saldo conocido o no se ha gastado nada todavía.
 */
export function diasDeMargen(
  saldo: number | null,
  usdEsteMes: number,
  diaDelMes: number
): number | null {
  if (saldo === null || usdEsteMes <= 0 || diaDelMes <= 0) return null;
  const porDia = usdEsteMes / diaDelMes;
  return Math.floor(saldo / porDia);
}
