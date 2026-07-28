import {
  DEEPGRAM_USD_MIN,
  IA_USD_PETICION,
  type Proveedor,
  diasDeMargen,
  usd,
} from "@/app/lib/costos";

/**
 * Qué se está gastando en cada proveedor y cuánto aguanta el saldo.
 *
 * La pregunta que responde es la de invertir: si el margen es bueno y el saldo
 * de Deepgram da para tres días, hay que recargar hoy, no cuando se corte el
 * servicio a mitad de una consulta médica.
 */
export function Costos({
  minutosMes,
  minutosTotales,
  peticionesIa,
  saldoDeepgram,
  ingresosMesUsd,
}: {
  minutosMes: number;
  minutosTotales: number;
  peticionesIa: number;
  saldoDeepgram: number | null;
  ingresosMesUsd: number;
}) {
  const gastoStt = minutosMes * DEEPGRAM_USD_MIN;
  const gastoIa = peticionesIa * IA_USD_PETICION;
  const gastoTotal = gastoStt + gastoIa;

  const hoy = new Date();
  const diaDelMes = hoy.getDate();
  const diasDelMes = new Date(
    hoy.getFullYear(),
    hoy.getMonth() + 1,
    0
  ).getDate();
  // Proyección lineal: lo gastado hasta hoy, extendido a los días que quedan.
  const proyeccion = (gastoTotal / diaDelMes) * diasDelMes;
  const margen =
    ingresosMesUsd > 0
      ? Math.round(((ingresosMesUsd - proyeccion) / ingresosMesUsd) * 100)
      : null;

  const dias = diasDeMargen(saldoDeepgram, gastoStt, diaDelMes);

  const proveedores: Proveedor[] = [
    {
      nombre: "Deepgram",
      concepto: "Transcripción en vivo",
      cantidad: minutosMes,
      unidad: "min este mes",
      usd: gastoStt,
      saldoUsd: saldoDeepgram,
      estimado: false,
    },
    {
      nombre: "Groq · Google",
      concepto: "Interpretación",
      cantidad: peticionesIa,
      unidad: "interpretaciones",
      usd: gastoIa,
      saldoUsd: null,
      estimado: true,
    },
  ];

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium">Costos e inversión</h2>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
          tarifas medidas · npm run medir:costo
        </p>
      </div>

      {/* Aviso primero: si el saldo se acaba, es lo único que importa de esta
          sección y no puede quedar enterrado bajo una tabla. */}
      {dias !== null && dias <= 14 && (
        <p
          className={`mt-3 rounded-lg px-3.5 py-2.5 text-sm ${
            dias <= 5
              ? "border border-live/30 bg-live/[0.07] text-live"
              : "border border-amber-500/30 bg-amber-500/[0.07] text-amber-600"
          }`}
        >
          Al ritmo de este mes, el saldo de Deepgram da para{" "}
          <strong>{dias} días</strong>. Recarga antes de que se corte a mitad de
          una consulta.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
        <Cifra
          etiqueta="Gasto del mes"
          valor={usd(gastoTotal)}
          pie={`proyección a fin de mes ${usd(proyeccion)}`}
        />
        <Cifra
          etiqueta="Ingresos del mes"
          valor={`$${ingresosMesUsd.toFixed(0)}`}
          pie={
            margen === null
              ? "todavía sin ingresos"
              : `margen proyectado ${margen}%`
          }
          tono={margen === null ? "neutro" : margen >= 60 ? "ok" : "aviso"}
        />
        <Cifra
          etiqueta="Saldo Deepgram"
          valor={saldoDeepgram === null ? "—" : usd(saldoDeepgram)}
          pie={
            saldoDeepgram === null
              ? "no se pudo consultar"
              : dias === null
                ? "sin consumo este mes"
                : `~${dias} días al ritmo actual`
          }
          tono={dias !== null && dias <= 14 ? "aviso" : "neutro"}
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              <Th>Proveedor</Th>
              <Th>Consumo</Th>
              <Th derecha>Gasto del mes</Th>
              <Th derecha>Saldo</Th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.nombre} className="border-b border-hairline/60 last:border-0">
                <td className="py-3">
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-[12px] text-muted">{p.concepto}</div>
                </td>
                <td className="py-3 font-mono text-[11px] tabular-nums text-muted">
                  {p.cantidad.toLocaleString("es")}
                  <span className="text-faint"> {p.unidad}</span>
                </td>
                <td className="py-3 text-right font-mono text-[12px] tabular-nums">
                  {usd(p.usd)}
                  {p.estimado && (
                    <span
                      title="Los proveedores de IA no exponen saldo: se calcula con la tarifa medida por interpretación."
                      className="ml-1.5 cursor-help text-faint"
                    >
                      ~
                    </span>
                  )}
                </td>
                <td className="py-3 text-right font-mono text-[12px] tabular-nums text-muted">
                  {p.saldoUsd === null || p.saldoUsd === undefined
                    ? "—"
                    : usd(p.saldoUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-muted">
        El gasto de Deepgram sale de los minutos medidos por el latido a{" "}
        {usd(DEEPGRAM_USD_MIN)}/min, y su saldo se lee de la cuenta real. El de
        interpretación lleva <span className="font-mono">~</span> porque Groq y
        Google no publican saldo: se calcula con la tarifa medida por
        interpretación, así que sube algo cuando entra el respaldo de Google, que
        es más caro. Consumo histórico total:{" "}
        {minutosTotales.toLocaleString("es")} minutos.
      </p>
    </section>
  );
}

function Th({
  children,
  derecha,
}: {
  children: React.ReactNode;
  derecha?: boolean;
}) {
  return (
    <th
      className={`py-2 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint ${
        derecha ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Cifra({
  etiqueta,
  valor,
  pie,
  tono = "neutro",
}: {
  etiqueta: string;
  valor: string;
  pie: string;
  tono?: "ok" | "aviso" | "neutro";
}) {
  const color =
    tono === "ok" ? "text-accent" : tono === "aviso" ? "text-amber-500" : "";
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
        {etiqueta}
      </p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${color}`}>
        {valor}
      </p>
      <p className="mt-1 font-mono text-[9.5px] tabular-nums text-faint">{pie}</p>
    </div>
  );
}
