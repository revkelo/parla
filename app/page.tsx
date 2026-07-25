"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveTranscription } from "./hooks/useLiveTranscription";

const STATUS_LABEL: Record<string, string> = {
  idle: "Listo",
  connecting: "Conectando",
  listening: "En vivo",
  error: "Error",
};

type Interpretation = {
  text: string;
  detected: "es" | "en";
  engine?: "groq" | "openrouter";
};
type Usage = {
  deepgram: { amount: number; units: string } | null;
  groq: {
    remainingRequests: number;
    limitRequests: number;
    resetRequests: string;
  } | null;
  openrouter: {
    isFreeTier: boolean;
    usageDaily: number;
    limitRemaining: number | null;
  } | null;
};

// Precio aprox. de Deepgram nova-3 streaming (USD por minuto) para estimar horas.
const PRICE_PER_MIN = 0.0077;
const LANG_TAG: Record<string, string> = { es: "ES", en: "EN" };

export default function Home() {
  const { status, segments, interim, error, start, stop, reset } =
    useLiveTranscription();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [interpretations, setInterpretations] = useState<
    Record<number, Interpretation>
  >({});
  const [times, setTimes] = useState<Record<number, string>>({});
  const requestedRef = useRef<Set<number>>(new Set());
  const streamEndRef = useRef<HTMLDivElement>(null);

  const isActive = status === "listening" || status === "connecting";
  const hasContent = segments.length > 0 || interim.length > 0;

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
        body: JSON.stringify({ text: seg.text }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(
          (d: {
            interpretation: string;
            detected: "es" | "en";
            engine?: "groq" | "openrouter";
            groqUsage?: Usage["groq"];
          }) => {
            setInterpretations((prev) => ({
              ...prev,
              [seg.id]: {
                text: d.interpretation,
                detected: d.detected,
                engine: d.engine,
              },
            }));
            // Uso de Groq leído de la interpretación (sin request extra).
            if (d.groqUsage) {
              setUsage((prev) => ({
                deepgram: prev?.deepgram ?? null,
                openrouter: prev?.openrouter ?? null,
                groq: d.groqUsage!,
              }));
            }
          }
        )
        .catch(() =>
          setInterpretations((prev) => ({
            ...prev,
            [seg.id]: { text: "No se pudo interpretar", detected: "es" },
          }))
        );
    });
  }, [segments]);

  // Auto-scroll al final del hilo.
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments, interim]);

  // Consulta el uso de los servicios (Deepgram, Groq, OpenRouter).
  const loadUsage = useCallback(() => {
    setRefreshing(true);
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Usage) => setUsage(d))
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  // Consulta inicial al cargar la página (una sola vez). Durante la sesión el
  // uso de Groq se actualiza solo desde cada interpretación; el saldo de
  // Deepgram se refresca con el botón "Actualizar".
  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const handleReset = () => {
    reset();
    requestedRef.current = new Set();
    setInterpretations({});
    setTimes({});
  };

  const handleCopy = () => {
    const lines = segments.map((s) => {
      const t = interpretations[s.id]?.text ?? "";
      return `[${times[s.id] ?? ""}] ${s.text}\n${t}`;
    });
    navigator.clipboard.writeText(lines.join("\n\n"));
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 sm:px-6">
      {/* ── Barra superior ── */}
      <header className="sticky top-0 z-10 border-b border-hairline bg-background/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-6 w-6 place-items-center rounded-md bg-accent/15 font-mono text-[13px] font-semibold text-accent"
            >
              p
            </span>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-tight lowercase">
                parla
              </h1>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                intérprete médico · es ⇄ en
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            {!isActive ? (
              <button
                onClick={() => start("multi")}
                className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-live" />
                Iniciar
              </button>
            ) : (
              <button
                onClick={stop}
                className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <span className="inline-block h-2 w-2 rounded-[2px] bg-live" />
                Finalizar
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-hairline/60 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
              Uso de servicios
            </span>
            <button
              onClick={loadUsage}
              disabled={refreshing}
              aria-label="Actualizar uso"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
            >
              <RefreshIcon spinning={refreshing} />
              Actualizar
            </button>
          </div>
          {usage ? (
            <UsageBar usage={usage} />
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {refreshing ? "Consultando…" : "—"}
            </p>
          )}
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg border border-live/25 bg-live/[0.06] px-3.5 py-2.5 font-mono text-xs text-live">
          {error}
        </p>
      )}

      {/* ── Hilo de interpretación ── */}
      <div className="flex-1 py-5" aria-live="polite" aria-atomic="false">
        {!hasContent ? (
          <EmptyState />
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
                    {it?.engine && <EngineTag engine={it.engine} />}
                  </div>

                  <div className="px-4 pb-3 pt-1.5">
                    {/* Original (referencia) */}
                    <p className="text-[13.5px] leading-relaxed text-muted">
                      {seg.text}
                    </p>
                    {/* Interpretación (principal) */}
                    <div className="mt-2 border-l-2 border-accent/40 pl-3">
                      {it ? (
                        <p className="text-[15.5px] leading-relaxed text-foreground">
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
                  Escuchando
                </span>
                <p className="text-[15px] leading-relaxed text-foreground/70">
                  {interim}
                  <span className="ml-0.5 inline-block animate-pulse">▍</span>
                </p>
              </li>
            )}
            <div ref={streamEndRef} />
          </ol>
        )}
      </div>

      {/* ── Pie ── */}
      {segments.length > 0 && (
        <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-hairline bg-background/80 py-3 backdrop-blur-md">
          <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
            Confidencial · uso profesional
          </span>
          <div className="flex items-center gap-1">
            {!isActive && (
              <FooterButton onClick={handleReset}>Limpiar</FooterButton>
            )}
            <FooterButton onClick={handleCopy}>Copiar</FooterButton>
          </div>
        </footer>
      )}
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const dot =
    status === "listening"
      ? "animate-pulse bg-live"
      : status === "connecting"
        ? "animate-pulse bg-amber-500"
        : status === "error"
          ? "bg-live"
          : "bg-emerald-500";
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted sm:flex">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function EngineTag({ engine }: { engine: "groq" | "openrouter" }) {
  const isBackup = engine === "openrouter";
  return (
    <span
      title={isBackup ? "Resuelto por el respaldo OpenRouter" : "Motor: Groq"}
      className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] ${
        isBackup ? "text-amber-500" : "text-faint"
      }`}
    >
      {isBackup ? "respaldo" : "groq"}
    </span>
  );
}

function FooterButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-muted transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {children}
    </button>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function UsageBar({ usage }: { usage: Usage }) {
  const { deepgram: dg, groq: gq, openrouter: or } = usage;
  const groqLow = gq !== null && gq.remainingRequests / gq.limitRequests <= 0.15;
  const groqOut = gq !== null && gq.remainingRequests <= 0;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {dg && (
        <Stat
          dot="ok"
          label="Deepgram"
          value={`$${dg.amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          sub={`~${Math.floor(dg.amount / PRICE_PER_MIN / 60)} h de transcripción`}
        />
      )}
      {gq && (
        <Stat
          dot={groqOut ? "out" : groqLow ? "low" : "ok"}
          label="Groq · principal"
          value={`${gq.remainingRequests}/${gq.limitRequests} req`}
          sub={`reinicia en ${shortReset(gq.resetRequests)}`}
        />
      )}
      {or && (
        <Stat
          dot="backup"
          label="OpenRouter · respaldo"
          value={or.usageDaily > 0 ? `${or.usageDaily} hoy` : "en espera"}
          sub={or.isFreeTier ? "modo free" : "modo pago"}
        />
      )}
    </div>
  );
}

function Stat({
  dot,
  label,
  value,
  sub,
}: {
  dot: "ok" | "low" | "out" | "backup";
  label: string;
  value: string;
  sub: string;
}) {
  const color =
    dot === "ok"
      ? "bg-emerald-500"
      : dot === "low"
        ? "bg-amber-500"
        : dot === "out"
          ? "bg-live"
          : "bg-faint";
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-hairline/70 bg-surface/60 px-3 py-2"
      title={`${label}: ${value} · ${sub}`}
    >
      <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />
      <div className="min-w-0 leading-tight">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
          {label}
        </div>
        <div className="mt-0.5 truncate font-mono text-[13px] font-medium tabular-nums text-foreground/85">
          {value}
        </div>
        <div className="truncate font-mono text-[10px] tracking-[0.04em] text-faint">
          {sub}
        </div>
      </div>
    </div>
  );
}

function shortReset(s: string): string {
  if (!s) return "—";
  return s.replace(/\.\d+/, "").replace(/(\d+)(ms)/, "0s");
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-faint"
      style={{ animationDelay: delay }}
    />
  );
}

function EmptyState() {
  return (
    <div className="clinical-grid mt-4 rounded-xl border border-dashed border-hairline px-6 py-12">
      <div className="flex flex-col items-start gap-3">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          Intérprete en espera
        </span>
        <p className="max-w-md text-[15px] leading-relaxed text-muted">
          Pulsa <span className="font-medium text-foreground">Iniciar</span> y
          habla en español o inglés. Cada intervención se interpreta al otro
          idioma con terminología clínica, en primera persona y con los
          acrónimos expandidos.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
          Confidencial · OPI / VRI
        </p>
      </div>
    </div>
  );
}
