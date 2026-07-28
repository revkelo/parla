"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HojaConsulta, type TurnoLeido } from "../components/HojaConsulta";
import { type Textos, fmt, textosDe } from "../lib/i18n";
import { useLiveTranscription } from "../hooks/useLiveTranscription";
import { CONTEXT_TURNS, type ContextTurn } from "../lib/interpreter-prompt";
import { ENGINE_LABEL } from "../lib/stt";
import { useRouter } from "next/navigation";
import { PREF, useInterruptor, usePreferencia } from "./preferencias";

type AiEngine = "groq" | "google";
type Interpretation = {
  text: string;
  detected: "es" | "en";
  engine?: AiEngine;
};
export type Usage = {
  email: string;
  fullName: string | null;
  esAdmin: boolean;
  verTecnico: boolean;
  plan: string;
  planId: string;
  usedMinutes: number;
  limitMinutes: number;
  remainingMinutes: number;
  exhausted: boolean;
};
const LANG_TAG: Record<string, string> = { es: "ES", en: "EN" };

/** Margen para considerar que el usuario "está siguiendo" el final del hilo. */
const PEGADO_ABAJO_PX = 120;

/** Texto que ocupa el hueco de un turno que no se pudo interpretar. */
const FALLO_INTERPRETACION = "No se pudo interpretar";

/**
 * Tamaños del texto interpretado. Esto se lee de reojo mientras se habla, y a
 * menudo en un portátil lejos de los ojos: poder agrandarlo no es un adorno.
 */
const TAMANOS = [
  { id: "s", etiqueta: "A", origen: "text-[13px]", destino: "text-[15px]" },
  { id: "m", etiqueta: "A", origen: "text-[13.5px]", destino: "text-[17px]" },
  { id: "l", etiqueta: "A", origen: "text-[15px]", destino: "text-[21px]" },
] as const;

const IDS_TAMANO = ["s", "m", "l"] as const;
const MOTORES_STT = ["auto", "deepgram", "webspeech"] as const;
const MOTORES_IA = ["auto", "groq", "google"] as const;

/** Consumo del usuario contra su plan. `null` si la consulta falla. */
async function getUsage(): Promise<Usage | null> {
  try {
    const res = await fetch("/api/usage");
    return res.ok ? ((await res.json()) as Usage) : null;
  } catch {
    return null;
  }
}

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * `usoInicial` llega ya resuelto desde el servidor. Sin él, el plan solo se
 * conocía tras el primer fetch y quien no tenía minutos veía por un instante
 * un botón Iniciar operativo antes de que apareciera el muro de cuota.
 */
export type ConsultaPrevia = {
  id: string;
  turnos: TurnoLeido[];
};

export default function Transcriptor({
  usoInicial,
  previa,
  t = textosDe("es"),
}: {
  usoInicial: Usage;
  /** Consulta guardada que se está continuando, si la hay. */
  previa?: ConsultaPrevia;
  t?: Textos;
}) {
  const {
    status,
    activeEngine,
    sessionId,
    segments,
    interim,
    error,
    start,
    stop,
    reset,
  } = useLiveTranscription();
  const [usage, setUsage] = useState<Usage>(usoInicial);
  const router = useRouter();
  const [interpretations, setInterpretations] = useState<
    Record<number, Interpretation>
  >({});
  const [times, setTimes] = useState<Record<number, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const requestedRef = useRef<Set<number>>(new Set());
  // Turnos ya interpretados, en orden, que se mandan como contexto del
  // siguiente. Al continuar una consulta arranca con los turnos guardados, para
  // que la IA no pierda de qué se venía hablando.
  const contextRef = useRef<ContextTurn[]>(
    (previa?.turnos ?? []).map((t) => ({
      source: t.source_text,
      target: t.target_text ?? "",
      sourceLang: t.source_lang,
    }))
  );
  /**
   * Los turnos nuevos se numeran a continuación de los guardados. Sin este
   * desplazamiento, el primer turno de una consulta reanudada tendría el
   * ordinal 0 y el `upsert` de /api/segments PISARÍA el primer turno original.
   */
  const ordinalBase = previa?.turnos.length ?? 0;
  // Turnos ya escritos en el historial, para no reenviarlos en cada render.
  const guardadosRef = useRef<Set<number>>(new Set());
  const streamEndRef = useRef<HTMLDivElement>(null);
  const [alFinal, setAlFinal] = useState(true);
  const startTsRef = useRef<number | null>(null);

  // Ajustes persistentes.
  const tamano = usePreferencia(PREF.tamano, IDS_TAMANO, "m");
  const historial = useInterruptor(PREF.historial, "si");
  const autoSeguir = useInterruptor(PREF.seguir, "si");
  const sttChoice = usePreferencia(PREF.motorStt, MOTORES_STT, "auto");
  const aiChoice = usePreferencia(PREF.motorIa, MOTORES_IA, "auto");

  const isActive = status === "listening" || status === "connecting";
  const hasContent = segments.length > 0 || interim.length > 0;
  const escala = TAMANOS.find((t) => t.id === tamano) ?? TAMANOS[1];
  // Seguir el hilo exige las dos cosas: que el ajuste esté puesto y que el
  // usuario no se haya ido a releer un turno anterior.
  const siguiendo = autoSeguir.activo && alFinal;

  // Cronómetro de sesión (para registros/facturación del intérprete).
  useEffect(() => {
    if (status !== "listening") return;
    if (startTsRef.current == null) startTsRef.current = Date.now();
    const id = setInterval(() => {
      if (startTsRef.current != null) {
        setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Interpreta cada intervención finalizada una sola vez (ES⇄EN, modo médico).
  useEffect(() => {
    segments.forEach((seg) => {
      if (requestedRef.current.has(seg.id)) return;
      requestedRef.current.add(seg.id);
      setTimes((prev) => ({
        ...prev,
        [seg.id]: new Date().toLocaleTimeString("es", { hour12: false }),
      }));
      fetch("/api/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: seg.text,
          sourceLang: seg.lang,
          // Los últimos turnos ya interpretados: resuelven pronombres,
          // género y respuestas cortas, y mantienen la terminología estable.
          context: contextRef.current.slice(-CONTEXT_TURNS),
          engine: aiChoice === "auto" ? undefined : aiChoice,
        }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(
          (d: {
            interpretation: string;
            detected: "es" | "en";
            engine?: AiEngine;
          }) => {
            setInterpretations((prev) => ({
              ...prev,
              [seg.id]: {
                text: d.interpretation,
                detected: d.detected,
                engine: d.engine,
              },
            }));
            contextRef.current.push({
              source: seg.text,
              target: d.interpretation,
              sourceLang: d.detected,
            });
          }
        )
        .catch(() =>
          setInterpretations((prev) => ({
            ...prev,
            [seg.id]: { text: FALLO_INTERPRETACION, detected: "es" },
          }))
        );
    });
  }, [segments, aiChoice]);

  /**
   * Guarda en el historial cada turno ya interpretado.
   *
   * Se escribe cuando la interpretación existe, no al transcribirse: un turno a
   * medias en el historial se leería como una consulta que falló. El `ordinal`
   * es el índice del turno en la sesión, que es lo que la tabla exige para
   * poder reconstruir el orden.
   */
  useEffect(() => {
    if (!sessionId || !historial.activo) return;

    segments.forEach((seg, i) => {
      if (guardadosRef.current.has(seg.id)) return;
      const it = interpretations[seg.id];
      if (!it || it.text === FALLO_INTERPRETACION) return;

      guardadosRef.current.add(seg.id);
      void fetch("/api/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ordinal: ordinalBase + i,
          sourceText: seg.text,
          targetText: it.text,
          sourceLang: it.detected,
          aiEngine: it.engine,
        }),
      }).catch(() => {
        // Que el historial pierda un turno no puede cortar la consulta; se
        // reintenta en el siguiente cambio de estado.
        guardadosRef.current.delete(seg.id);
      });
    });
  }, [segments, interpretations, sessionId, historial.activo, ordinalBase]);

  /**
   * Auto-scroll, pero solo si el usuario ya estaba abajo. Si subió a releer un
   * turno anterior —algo normal en mitad de una consulta— arrastrarlo al final
   * cada vez que llega texto nuevo le hace perder el sitio.
   */
  useEffect(() => {
    const cerca = () =>
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - PEGADO_ABAJO_PX;

    const onScroll = () => setAlFinal(cerca());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!siguiendo) return;
    streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments, interim, siguiendo]);

  // Al cargar y cada vez que termina una sesión, que es cuando cambian los
  // minutos consumidos. `router.refresh()` rehace la barra lateral: la consulta
  // que se acaba de cerrar tiene que aparecer en la lista sin recargar a mano.
  useEffect(() => {
    if (status === "listening") return;
    let cancelled = false;
    void (async () => {
      const next = await getUsage();
      if (cancelled) return;
      if (next) setUsage(next);
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  const handleStart = useCallback(() => {
    startTsRef.current = null;
    setElapsed(0);
    setAlFinal(true);
    void start(
      "multi",
      sttChoice === "auto" ? undefined : sttChoice,
      previa?.id
    );
  }, [start, sttChoice, previa?.id]);

  /**
   * Barra espaciadora para empezar y terminar.
   *
   * El intérprete tiene las manos en el teclado y los ojos en el paciente:
   * buscar el botón con el ratón al arrancar una consulta es justo el momento
   * en el que no se puede mirar la pantalla. Se ignora si el foco está en un
   * campo o en un control, donde el espacio ya significa otra cosa.
   */
  useEffect(() => {
    const enCampo = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      return (
        n.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(n.tagName)
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (enCampo(e.target)) return;
      e.preventDefault();
      if (isActive) stop();
      else if (!usage.exhausted) handleStart();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, stop, handleStart, usage.exhausted]);

  const handleReset = () => {
    reset();
    requestedRef.current = new Set();
    guardadosRef.current = new Set();
    contextRef.current = [];
    setInterpretations({});
    setTimes({});
    startTsRef.current = null;
    setElapsed(0);
  };

  const sessionLines = () =>
    segments.map((s) => {
      const it = interpretations[s.id];
      const src = it?.detected ?? "es";
      const tgt = src === "es" ? "EN" : "ES";
      return `[${times[s.id] ?? ""}] (${LANG_TAG[src]}) ${s.text}\n(${tgt}) ${
        it?.text ?? ""
      }`;
    });

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionLines().join("\n\n"));
  };

  const handleDownload = () => {
    const header =
      `PARLA — Registro de interpretación médica (ES ⇄ EN)\n` +
      `Fecha: ${new Date().toLocaleString("es")}\n` +
      `Duración: ${fmtDuration(elapsed)} · Turnos: ${segments.length}\n` +
      `${"—".repeat(48)}\n\n`;
    const blob = new Blob([header + sessionLines().join("\n\n") + "\n"], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parla-sesion-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    // `flex-1` y no `min-h-full`: main es un hijo flex del body, y un
    // min-height en porcentaje se resuelve contra una altura automática, así
    // que no estiraba. El resultado era la barra de control a media pantalla
    // con un vacío debajo cuando la consulta aún no tenía turnos.
    // `main` ocupa todo el ancho y la columna de lectura se centra dentro. Así
    // la barra de control de abajo abarca el área entera —se lee como la barra
    // de una aplicación, no como un botón suelto— mientras el texto conserva
    // una medida cómoda.
    <main className="flex w-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      {/* Cabecera mínima: la marca, la cuenta, el saldo y los ajustes viven en
          la barra lateral. Aquí solo queda lo que pertenece a ESTA consulta, y
          únicamente cuando hay algo que decir. */}
      {/* Que entró un respaldo sí le importa al intérprete, porque la calidad
          baja; QUÉ respaldo, no: es un nombre de proveedor que no le dice nada
          y sobre el que no puede actuar. El nombre queda para la cuenta de
          pruebas, que es la que compara motores. */}
      {isActive && activeEngine && activeEngine !== "deepgram" && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-sm text-amber-600">
          {t.app.respaldo}
          {usage.verTecnico && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em]">
              {ENGINE_LABEL[activeEngine]}
            </span>
          )}
        </p>
      )}

      {usage.exhausted ? (
        <QuotaWall
          planName={usage.plan}
          limitMinutes={usage.limitMinutes}
          t={t}
        />
      ) : (
        error && (
          <p className="mt-4 rounded-lg border border-live/25 bg-live/[0.06] px-3.5 py-2.5 font-mono text-xs text-live">
            {error}
          </p>
        )
      )}

      {/* Aviso temprano: enterarse al quedarse sin minutos a mitad de una
          consulta es mucho peor que verlo venir. */}
      {porAgotarse(usage) && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-sm text-amber-600">
          {fmt(t.app.avisoMinutos, { n: usage.remainingMinutes })}{" "}
          <a href="/cuenta" className="font-medium underline">
            {t.cuenta.ampliar}
          </a>
        </p>
      )}

      {/* ── Hilo de interpretación ── */}
      {/* `flex flex-col` y no solo `flex-1`: el estado de espera se centra a sí
          mismo con `flex-1`, y sin un contenedor flex ese `flex-1` no hacía
          nada y el mensaje quedaba pegado arriba. */}
      </div>

      <div
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-5 sm:px-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {previa && previa.turnos.length > 0 && (
          <div className="mb-3">
            <HojaConsulta turnos={previa.turnos} />
          </div>
        )}

        {!hasContent && !previa ? (
          <EmptyState guardando={historial.activo} t={t} />
        ) : (
          <ol className="flex flex-col gap-3">
            {segments.map((seg) => {
              const it = interpretations[seg.id];
              const src = it?.detected ?? "es";
              const target = src === "es" ? "en" : "es";
              return (
                <li
                  key={seg.id}
                  className="animate-rise overflow-hidden rounded-xl border border-hairline bg-surface"
                >
                  <div className="flex items-center justify-between gap-3 px-4 pt-2.5">
                    <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                      <span className="tabular-nums">{times[seg.id]}</span>
                      <span aria-hidden>·</span>
                      <span className="text-muted">
                        {LANG_TAG[src]}{" "}
                        <span className="text-accent">→</span> {LANG_TAG[target]}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      {usage.verTecnico && it?.engine && (
                        <EngineTag engine={it.engine} />
                      )}
                      {it && <CopiarTurno texto={it.text} t={t} />}
                    </div>
                  </div>

                  <div className="px-4 pb-3 pt-1.5">
                    {/* Original (referencia). Va en cursiva: es lo que se
                        pronunció, y así se distingue de lo interpretado sin
                        depender del color. */}
                    <p
                      className={`habla-origen ${escala.origen} leading-relaxed text-muted`}
                    >
                      {seg.text}
                    </p>
                    {/* Interpretación (principal) */}
                    <div className="mt-2 border-l-2 border-accent/40 pl-3">
                      {it ? (
                        <p
                          className={`habla ${escala.destino} leading-relaxed text-foreground`}
                        >
                          {it.text}
                        </p>
                      ) : (
                        <span className="inline-flex gap-1 py-1 align-middle">
                          <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}

            {interim && (
              <li className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
                <span className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
                  {t.app.escuchando}
                </span>
                <p
                  className={`habla-origen ${escala.destino} leading-relaxed text-foreground/70`}
                >
                  {interim}
                  <span className="ml-0.5 inline-block animate-pulse">▍</span>
                </p>
              </li>
            )}
            <div ref={streamEndRef} />
          </ol>
        )}
      </div>

      {/* ── Barra de control ──
          Iniciar y Finalizar viven aquí, no arriba: es el gesto que más se
          repite y el que se hace con prisa, así que va grande, siempre en el
          mismo sitio y al alcance del pulgar en móvil. */}
      <footer className="sticky bottom-0 border-t border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-2xl px-4 py-3 sm:px-6">
          {/* Al desactivarse el auto-scroll hay que avisar de que la
              conversación sigue avanzando, o el intérprete cree que se paró. */}
          {!alFinal && hasContent && (
            <button
              onClick={() => {
                setAlFinal(true);
                streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent-soft py-2 text-sm font-medium text-accent transition-opacity hover:opacity-80"
            >
              {t.app.irUltimoTurno}
            </button>
          )}

          {/* Contexto ENCIMA del botón, no al lado: en móvil, compartir la fila
              dejaba al botón media pantalla y al cronómetro apretado contra el
              borde. Arriba caben los dos y el botón se queda con todo el ancho
              en la franja donde llega el pulgar. La altura mínima evita que la
              barra pegue un salto al aparecer el cronómetro. */}
          <div className="mb-2.5 flex min-h-7 items-center justify-center gap-2">
            {isActive ? (
              <span className="font-mono text-[13px] tabular-nums">
                <span className="text-foreground">{fmtDuration(elapsed)}</span>
                <span className="ml-2 text-faint">
                  {segments.length}{" "}
                {segments.length === 1 ? t.comun.turno : t.comun.turnos}
                </span>
              </span>
            ) : segments.length > 0 ? (
              <div className="flex items-center gap-1">
                <FooterButton onClick={handleReset}>
                  {t.app.limpiar}
                </FooterButton>
                <FooterButton onClick={handleCopy}>{t.app.copiar}</FooterButton>
                <FooterButton onClick={handleDownload} primary>
                  {t.app.descargar}
                </FooterButton>
              </div>
            ) : (
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                {usage.exhausted
                  ? t.app.sinMinutosDisponibles
                  : previa
                    ? t.app.sigueDondeLoDejaste
                    : t.app.listoParaEmpezar}
              </span>
            )}
          </div>

          {/* El botón ES el estado: conectando, en vivo o listo para empezar.
              Ancho completo en móvil; en escritorio, centrado y con un ancho
              mínimo para que no baile entre "Iniciar" y "Conectando…". */}
          {!isActive ? (
            <button
              onClick={handleStart}
              disabled={usage.exhausted}
              title={
                usage.exhausted
                  ? t.app.sinMinutos
                  : `${t.app.iniciar} · ${t.app.tecla}`
              }
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-foreground px-6 py-4 text-base font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40 sm:mx-auto sm:w-auto sm:min-w-[16rem] sm:py-3.5"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-live" />
              {segments.length > 0
                ? t.app.reanudar
                : previa
                  ? t.app.continuar
                  : t.app.iniciar}
            </button>
          ) : (
            <button
              onClick={stop}
              disabled={status === "connecting"}
              title={`${t.app.finalizar} · ${t.app.tecla}`}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-live/40 bg-live/[0.08] px-6 py-4 text-base font-semibold text-live transition-colors hover:bg-live/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live/40 disabled:opacity-60 sm:mx-auto sm:w-auto sm:min-w-[16rem] sm:py-3.5"
            >
              {status === "connecting" ? (
                <>
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
                  {t.app.conectando}
                </>
              ) : (
                <>
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-[3px] bg-live" />
                  {t.app.finalizar}
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}

function EngineTag({ engine }: { engine: AiEngine }) {
  const isBackup = engine === "google";
  return (
    <span
      title={
        isBackup
          ? "Resuelto por el respaldo Google (Gemini)"
          : "Motor de interpretación: Groq"
      }
      className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] ${
        isBackup ? "text-amber-500" : "text-faint"
      }`}
    >
      {engine}
    </span>
  );
}

function FooterButton({
  onClick,
  children,
  primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.13em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        primary
          ? "bg-accent/10 text-accent hover:bg-accent/15"
          : "text-muted hover:bg-foreground/[0.05] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}


/**
 * Pantalla de cuota agotada. Sustituye al error genérico: el usuario necesita
 * saber qué pasó, que no perdió nada, y poder resolverlo desde aquí.
 */
function QuotaWall({
  planName,
  limitMinutes,
  t,
}: {
  planName: string;
  limitMinutes: number;
  t: Textos;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-hairline bg-surface/60 px-6 py-7">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-live">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-live" />
        {t.app.sinMinutos}
      </span>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">
        {fmt(t.app.sinMinutosTitulo, { n: limitMinutes, plan: planName })}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {t.app.sinMinutosCuerpo}
      </p>
      <a
        href="/cuenta"
        className="mt-5 inline-block rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        {t.app.verPlanes}
      </a>
    </div>
  );
}

/**
 * Umbral de aviso: 10 % de la cuota o 5 minutos, lo que sea mayor. Con un
 * porcentaje solo, el plan de prueba avisaría medio minuto antes del final; con
 * minutos solos, al plan Intensivo le quedarían horas de trabajo tras el aviso.
 */
function porAgotarse(usage: Usage): boolean {
  return (
    !usage.exhausted &&
    usage.remainingMinutes <= Math.max(5, usage.limitMinutes * 0.1)
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-faint"
      style={{ animationDelay: delay }}
    />
  );
}

/** Copia un solo turno interpretado. */
function CopiarTurno({ texto, t }: { texto: string; t: Textos }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1400);
      }}
      title={t.app.copiarTurno}
      aria-label={t.app.copiarTurno}
      className="rounded-md px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {copiado ? t.app.copiado : t.app.copiar.toLowerCase()}
    </button>
  );
}

/**
 * Pantalla de espera. El intérprete abre esto entre llamadas, no es una
 * portada: nada de explicar el producto ni de enseñarle a usarlo cada vez.
 * Solo lo que necesita saber antes de pulsar Iniciar.
 */
function EmptyState({
  guardando,
  t,
}: {
  guardando: boolean;
  t: Textos;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-faint" />
        {t.app.enEspera}
      </span>
      <p className="mt-4 text-[15px] text-muted">
        {t.app.pulsaIniciar}{" "}
        <span className="font-medium text-foreground">{t.app.iniciar}</span>{" "}
        {t.app.yHabla}
      </p>
      <p className="mt-1 text-sm text-faint">
        {t.app.idiomaSolo}
      </p>

      <p className="mt-6 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
        <Tecla>{t.app.tecla}</Tecla> {t.app.atajo}
      </p>
      <p className="mt-2 text-[12px] text-faint">
        {guardando ? t.app.seGuardara : t.app.noSeGuardara}
      </p>
    </div>
  );
}

/** Una tecla, dibujada como tal para que se lea como atajo y no como texto. */
function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
      {children}
    </kbd>
  );
}
