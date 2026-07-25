"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveTranscription } from "./hooks/useLiveTranscription";

const STATUS_LABEL: Record<string, string> = {
  idle: "Listo",
  connecting: "Conectando",
  listening: "En vivo",
  error: "Error",
};

// Idiomas para el reconocimiento (Deepgram nova-3). "multi" cambia de idioma solo.
const LANGUAGES: { code: string; label: string }[] = [
  { code: "multi", label: "Multilenguaje" },
  { code: "es", label: "Español" },
  { code: "en", label: "Inglés" },
  { code: "pt", label: "Portugués" },
  { code: "fr", label: "Francés" },
  { code: "de", label: "Alemán" },
  { code: "it", label: "Italiano" },
];

type Translation = { text: string; detected: "es" | "en" };
type Balance = { amount: number; units: string };

// Precio aprox. de Deepgram nova-3 streaming (USD por minuto) para estimar horas.
const PRICE_PER_MIN = 0.0077;

export default function Home() {
  const { status, segments, interim, error, start, stop, reset } =
    useLiveTranscription();
  const [language, setLanguage] = useState("multi");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [translations, setTranslations] = useState<Record<number, Translation>>(
    {}
  );
  const requestedRef = useRef<Set<number>>(new Set());
  const streamEndRef = useRef<HTMLDivElement>(null);

  const isActive = status === "listening" || status === "connecting";
  const hasContent = segments.length > 0 || interim.length > 0;

  // Traduce cada segmento finalizado una sola vez.
  useEffect(() => {
    segments.forEach((seg) => {
      if (requestedRef.current.has(seg.id)) return;
      requestedRef.current.add(seg.id);
      fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: seg.text }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { translation: string; detected: "es" | "en" }) =>
          setTranslations((prev) => ({
            ...prev,
            [seg.id]: { text: d.translation, detected: d.detected },
          }))
        )
        .catch(() =>
          setTranslations((prev) => ({
            ...prev,
            [seg.id]: { text: "No se pudo traducir", detected: "es" },
          }))
        );
    });
  }, [segments]);

  // Auto-scroll al final del hilo.
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments, interim]);

  // Consulta el saldo de Deepgram al cargar y cada vez que se detiene (status idle).
  useEffect(() => {
    if (status !== "idle") return;
    fetch("/api/deepgram/balance")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Balance) => setBalance(d))
      .catch(() => {});
  }, [status]);

  const handleReset = () => {
    reset();
    requestedRef.current = new Set();
    setTranslations({});
  };

  const handleCopy = () => {
    const lines = segments.map((s) => {
      const t = translations[s.id]?.text ?? "";
      return `${s.text}\n${t}`;
    });
    navigator.clipboard.writeText(lines.join("\n\n"));
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 sm:px-8">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-background/85 py-4 backdrop-blur">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight lowercase">
              parla
            </h1>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              intérprete en vivo
            </span>
          </div>
          {balance && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted"
              title="Saldo restante en Deepgram"
            >
              Deepgram · $
              {balance.amount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              · ~{Math.floor(balance.amount / PRICE_PER_MIN / 60)} h
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                status === "listening"
                  ? "animate-pulse bg-live"
                  : status === "connecting"
                    ? "animate-pulse bg-amber-500"
                    : status === "error"
                      ? "bg-live"
                      : "bg-muted/50"
              }`}
            />
            {STATUS_LABEL[status]}
          </span>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isActive}
            aria-label="Idioma de reconocimiento"
            className="rounded-md border border-hairline bg-transparent px-2 py-1.5 font-mono text-xs tracking-wide outline-none transition-colors focus-visible:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          {!isActive ? (
            <button
              onClick={() => start(language)}
              className="flex items-center gap-2 rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-live" />
              Grabar
            </button>
          ) : (
            <button
              onClick={stop}
              className="flex items-center gap-2 rounded-md border border-hairline px-4 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              <span className="inline-block h-2 w-2 rounded-[2px] bg-live" />
              Detener
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-md border border-live/30 bg-live/5 px-3 py-2 font-mono text-xs text-live">
          {error}
        </p>
      )}

      {/* Hilo bilingüe */}
      <div className="flex-1 py-6">
        {!hasContent ? (
          <EmptyState />
        ) : (
          <ol className="flex flex-col gap-6">
            {segments.map((seg) => {
              const tr = translations[seg.id];
              const src = tr?.detected ?? "es";
              const target = src === "es" ? "EN" : "ES";
              return (
                <li
                  key={seg.id}
                  className="border-l-2 border-hairline pl-4 transition-colors"
                >
                  <Line lang={src.toUpperCase()} text={seg.text} />
                  <Line
                    lang={`→ ${target}`}
                    text={tr?.text}
                    muted
                    loading={!tr}
                  />
                </li>
              );
            })}

            {interim && (
              <li className="border-l-2 border-live/60 pl-4">
                <Line lang="···" text={interim} live />
              </li>
            )}
            <div ref={streamEndRef} />
          </ol>
        )}
      </div>

      {/* Pie de acciones */}
      {segments.length > 0 && (
        <footer className="sticky bottom-0 flex items-center justify-end gap-4 border-t border-hairline bg-background/85 py-3 backdrop-blur">
          {!isActive && (
            <button
              onClick={handleReset}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-foreground"
            >
              Limpiar
            </button>
          )}
          <button
            onClick={handleCopy}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-foreground"
          >
            Copiar
          </button>
        </footer>
      )}
    </main>
  );
}

function Line({
  lang,
  text,
  muted,
  live,
  loading,
}: {
  lang: string;
  text?: string;
  muted?: boolean;
  live?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-3 py-0.5">
      <span
        className={`mt-1 w-9 shrink-0 select-none font-mono text-[10px] uppercase tracking-[0.12em] ${
          live ? "text-live" : "text-muted"
        }`}
      >
        {lang}
      </span>
      <p
        className={`text-[15px] leading-relaxed ${
          muted ? "text-muted" : "text-foreground"
        } ${live ? "text-foreground/70" : ""}`}
      >
        {loading ? (
          <span className="inline-flex gap-1 align-middle">
            <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
          </span>
        ) : (
          text
        )}
        {live && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
      </p>
    </div>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted/60"
      style={{ animationDelay: delay }}
    />
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-3 pt-10 text-muted">
      <p className="font-mono text-xs uppercase tracking-[0.16em]">
        Sin transcripción
      </p>
      <p className="max-w-sm text-[15px] leading-relaxed">
        Pulsa <span className="text-foreground">Grabar</span> y habla. Cada frase
        aparece con su traducción español ⇄ inglés en la línea de abajo.
      </p>
    </div>
  );
}
