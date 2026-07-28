import Link from "next/link";
import { type Textos, textosDe } from "@/app/lib/i18n";

/**
 * Pie común a las pantallas con sesión iniciada.
 *
 * Existe por una razón concreta: desde /app, /cuenta o /historial no había
 * forma de llegar a las demás salvo por el menú de la cuenta, que es un
 * desplegable que hay que descubrir. Un pie con los tres destinos siempre
 * visibles resuelve la navegación sin ocupar la parte de arriba, que en la app
 * está reservada a la sesión en curso.
 *
 * La portada tiene el suyo propio: allí el visitante no tiene cuenta y los
 * enlaces serían a sitios donde no puede entrar.
 */
export function PieDePagina({ t = textosDe("es") }: { t?: Textos }) {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-8">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Enlace href="/app">parla</Enlace>
        <Enlace href="/historial">{t.historial.titulo}</Enlace>
        <Enlace href="/cuenta">{t.comun.tuCuenta}</Enlace>
      </nav>

      <p className="max-w-xs text-[10.5px] leading-relaxed text-faint">
        {t.comun.aviso}
      </p>
    </footer>
  );
}

function Enlace({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {children}
    </Link>
  );
}
