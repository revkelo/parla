import type { Metadata } from "next";
import Link from "next/link";
import { SelectorIdioma } from "@/app/components/SelectorIdioma";
import { GUIA, type Bloque } from "@/app/lib/guia";
import { getIdioma } from "@/app/lib/idioma-servidor";
import { createClient } from "@/app/lib/supabase/server";

export const metadata: Metadata = {
  title: "Cómo usar parla · Guía",
  description:
    "Guía de uso de parla: cómo interpretar una consulta médica en vivo español ⇄ inglés, cómo hablar para obtener la mejor interpretación, historial, minutos y privacidad.",
};
export const dynamic = "force-dynamic";

export default async function GuiaPage() {
  const idioma = await getIdioma();
  const guia = GUIA[idioma];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <Link
          href="/"
          className="habla rounded text-[19px] font-medium lowercase leading-none tracking-tight transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          parla
        </Link>
        <nav className="flex items-center gap-2">
          <SelectorIdioma actual={idioma} />
          <Link
            href={user ? "/app" : "/registro"}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {user
              ? idioma === "es"
                ? "Abrir parla"
                : "Open parla"
              : idioma === "es"
                ? "Empezar gratis"
                : "Start free"}
          </Link>
        </nav>
      </header>

      <div className="pt-8 sm:pt-12">
        <h1 className="habla text-[clamp(1.9rem,4.5vw,2.6rem)] font-normal leading-[1.15] tracking-tight">
          {guia.titulo}
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          {guia.entradilla}
        </p>
      </div>

      {/* Índice. Con nueve secciones, quien viene a resolver una duda concreta
          no debería tener que recorrer la guía entera para encontrarla. */}
      <nav aria-label={guia.indice} className="mt-10">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
          {guia.indice}
        </p>
        <ol className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {guia.secciones.map((s, i) => (
            <li key={s.id} className="flex gap-2.5 text-[14px]">
              <span className="font-mono text-[11px] tabular-nums text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <a
                href={`#${s.id}`}
                className="text-muted transition-colors hover:text-foreground"
              >
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-14 flex flex-col gap-14">
        {guia.secciones.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-accent">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h2 className="habla mt-1.5 text-[26px] font-normal tracking-tight">
              {s.titulo}
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              {s.bloques.map((b, n) => (
                <Contenido key={n} bloque={b} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-20 border-t border-hairline pt-10 text-center">
        <p className="habla text-[22px]">
          {idioma === "es"
            ? "¿Lista para tu primera consulta?"
            : "Ready for your first encounter?"}
        </p>
        <Link
          href={user ? "/app" : "/registro"}
          className="mt-5 inline-block rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {user
            ? idioma === "es"
              ? "Abrir parla"
              : "Open parla"
            : idioma === "es"
              ? "Empezar gratis"
              : "Start free"}
        </Link>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 py-8">
        <Link
          href="/"
          className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-foreground"
        >
          ← parla
        </Link>
        <p className="max-w-sm text-[11px] leading-relaxed text-faint">
          {idioma === "es"
            ? "Herramienta de asistencia a la interpretación. No sustituye a un intérprete médico certificado para decisiones clínicas críticas."
            : "An assistive interpreting tool. It does not replace a certified medical interpreter for critical clinical decisions."}
        </p>
      </footer>
    </main>
  );
}

function Contenido({ bloque }: { bloque: Bloque }) {
  if (bloque.tipo === "parrafo") {
    return (
      <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
        {bloque.texto}
      </p>
    );
  }

  if (bloque.tipo === "pasos") {
    return (
      <ol className="flex max-w-2xl flex-col gap-3">
        {bloque.items.map((it, i) => (
          <li key={i} className="flex gap-3.5">
            <span
              aria-hidden
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[10px] tabular-nums text-accent"
            >
              {i + 1}
            </span>
            <span className="text-[15px] leading-relaxed">{it}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (bloque.tipo === "lista") {
    return (
      <ul className="flex max-w-2xl flex-col gap-2.5">
        {bloque.items.map((it, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span className="text-[15px] leading-relaxed text-muted">{it}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (bloque.tipo === "consejo") {
    return (
      <p className="max-w-2xl border-l-2 border-accent/40 pl-4 text-[15px] leading-relaxed">
        {bloque.texto}
      </p>
    );
  }

  // aviso
  return (
    <p className="max-w-2xl rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-[14px] leading-relaxed text-amber-700 dark:text-amber-500">
      {bloque.texto}
    </p>
  );
}
