import { type Textos, textosDe } from "@/app/lib/i18n";

export type TurnoLeido = {
  ordinal: number;
  source_text: string;
  target_text: string | null;
  source_lang: "es" | "en";
  created_at: string;
};

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour12: false });
}

const ETIQUETA: Record<string, string> = { es: "ES", en: "EN" };

/**
 * Una consulta guardada, con la misma anatomía que el hilo en vivo: un turno
 * por tarjeta, el original arriba en cursiva y la interpretación debajo, marcada
 * con la regla de acento.
 *
 * Antes se pintaba a doble página con un lomo vertical, como la portada. Se ve
 * bien en una pantalla ancha, pero releer una consulta es la misma tarea que
 * seguirla en directo, y obligaba a leer de otra forma: en móvil las dos planas
 * se apilan y el lomo desaparece, así que el formato ni siquiera sobrevivía
 * donde más se usa. Una sola forma para las dos pantallas.
 */
export function HojaConsulta({
  turnos,
  t = textosDe("es"),
}: {
  turnos: TurnoLeido[];
  t?: Textos;
}) {
  if (turnos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted">
        {t.historial.sinTurnos}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {turnos.map((turno) => {
        const destino = turno.source_lang === "es" ? "en" : "es";
        return (
          <li
            key={turno.ordinal}
            className="overflow-hidden rounded-xl border border-hairline bg-surface"
          >
            <div className="flex items-center gap-2 px-4 pt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              <span className="tabular-nums">{hora(turno.created_at)}</span>
              <span aria-hidden>·</span>
              <span className="text-muted">
                {ETIQUETA[turno.source_lang]}{" "}
                <span className="text-accent">→</span> {ETIQUETA[destino]}
              </span>
            </div>

            <div className="px-4 pb-3 pt-1.5">
              <p className="habla-origen text-[13.5px] leading-relaxed text-muted">
                {turno.source_text}
              </p>
              <div className="mt-2 border-l-2 border-accent/40 pl-3">
                <p className="habla text-[17px] leading-relaxed">
                  {turno.target_text}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
