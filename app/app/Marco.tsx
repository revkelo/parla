"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { type Idioma, type Textos } from "@/app/lib/i18n";
import { Ajustes } from "./Ajustes";
import { PREF, guardarPref, useInterruptor, usePreferencia } from "./preferencias";

export type SesionListada = {
  id: string;
  titulo: string;
  iniciada: string;
  turnos: number;
};

export type Perfil = {
  email: string;
  fullName: string | null;
  plan: string;
  esAdmin: boolean;
  usedMinutes: number;
  limitMinutes: number;
  remainingMinutes: number;
  exhausted: boolean;
  verTecnico: boolean;
};

const IDS_TAMANO = ["s", "m", "l"] as const;
const MOTORES_STT = ["auto", "deepgram", "webspeech"] as const;
const MOTORES_IA = ["auto", "groq", "google"] as const;

/**
 * Agrupa por antigüedad. Una lista de cuarenta consultas con la fecha en cada
 * línea obliga a leer fechas para orientarse; con encabezados, el ojo salta
 * directo al tramo que le interesa.
 */
function agrupar(sesiones: SesionListada[], t: Textos) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const semana = new Date(hoy);
  semana.setDate(hoy.getDate() - 7);

  const grupos: Array<{ titulo: string; items: SesionListada[] }> = [
    { titulo: t.app.hoy, items: [] },
    { titulo: t.app.ayer, items: [] },
    { titulo: t.app.ultimos7, items: [] },
    { titulo: t.app.antes, items: [] },
  ];

  for (const s of sesiones) {
    const d = new Date(s.iniciada);
    if (d >= hoy) grupos[0].items.push(s);
    else if (d >= ayer) grupos[1].items.push(s);
    else if (d >= semana) grupos[2].items.push(s);
    else grupos[3].items.push(s);
  }

  return grupos.filter((g) => g.items.length > 0);
}

export function Marco({
  perfil,
  sesiones,
  idioma,
  t,
  children,
}: {
  perfil: Perfil;
  sesiones: SesionListada[];
  idioma: Idioma;
  t: Textos;
  children: React.ReactNode;
}) {
  const [cajonAbierto, setCajonAbierto] = useState(false);
  const ruta = usePathname();
  const cerrar = () => setCajonAbierto(false);

  // El cajón se cierra en el propio enlace (ver `cerrar`), no en un efecto que
  // observe la ruta: cerrar por efecto encadena un render extra en cada
  // navegación, también en escritorio, donde el cajón ni siquiera existe.
  useEffect(() => {
    if (!cajonAbierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCajonAbierto(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cajonAbierto]);

  return (
    <div className="flex min-h-full flex-1">
      {/* Velo del cajón en móvil. */}
      {cajonAbierto && (
        <button
          aria-label={t.app.cerrarMenu}
          onClick={() => setCajonAbierto(false)}
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-hairline bg-surface transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0 ${
          cajonAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-5">
          <Link
            href="/"
            title="Volver al inicio"
            className="habla rounded text-[19px] font-medium lowercase leading-none tracking-tight transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            parla
          </Link>
          <button
            onClick={() => setCajonAbierto(false)}
            aria-label={t.app.cerrarMenu}
            className="rounded p-1 text-muted hover:text-foreground md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="px-3 pt-4">
          <Link
            href="/app"
            onClick={cerrar}
            className="flex items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <span aria-hidden className="text-[15px] leading-none">
              +
            </span>
            {t.app.nuevaConsulta}
          </Link>
        </div>

        {/* Lista de consultas. Es lo único que crece, así que es lo único que
            desplaza; la marca arriba y el perfil abajo quedan siempre fijos. */}
        <nav className="mt-5 flex-1 overflow-y-auto px-2 pb-2">
          {sesiones.length === 0 ? (
            <p className="px-2 text-[12px] leading-relaxed text-faint">
              {t.app.sinConsultas}
            </p>
          ) : (
            agrupar(sesiones, t).map((g) => (
              <div key={g.titulo} className="mb-4">
                <p className="px-2 pb-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-faint">
                  {g.titulo}
                </p>
                <ul>
                  {g.items.map((s) => {
                    const activa = ruta === `/app/c/${s.id}`;
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/app/c/${s.id}`}
                          onClick={cerrar}
                          title={s.titulo}
                          className={`block truncate rounded-md px-2 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                            activa
                              ? "bg-accent-soft text-accent"
                              : "text-muted hover:bg-foreground/[0.05] hover:text-foreground"
                          }`}
                        >
                          {s.titulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        <PieBarra perfil={perfil} idioma={idioma} t={t} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Única cosa que la barra no puede dar en móvil: cómo abrirla. */}
        <button
          onClick={() => setCajonAbierto(true)}
          className="sticky top-0 z-20 flex items-center gap-2 border-b border-hairline bg-background/85 px-4 py-3 text-left backdrop-blur-md md:hidden"
        >
          <span aria-hidden className="font-mono text-[15px] leading-none">
            ☰
          </span>
          <span className="habla text-[17px] lowercase">parla</span>
        </button>

        {children}
      </div>
    </div>
  );
}

/** Consumo, ajustes y cuenta: el pie fijo de la barra lateral. */
function PieBarra({
  perfil,
  idioma,
  t,
}: {
  perfil: Perfil;
  idioma: Idioma;
  t: Textos;
}) {
  const [menu, setMenu] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  const tamano = usePreferencia(PREF.tamano, IDS_TAMANO, "m");
  const historial = useInterruptor(PREF.historial, "si");
  const seguir = useInterruptor(PREF.seguir, "si");
  const motorStt = usePreferencia(PREF.motorStt, MOTORES_STT, "auto");
  const motorIa = usePreferencia(PREF.motorIa, MOTORES_IA, "auto");

  useEffect(() => {
    if (!menu) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setMenu(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);

  const pct =
    perfil.limitMinutes > 0
      ? Math.min(
          100,
          Math.round((perfil.usedMinutes / perfil.limitMinutes) * 100)
        )
      : 0;
  const porAgotarse =
    !perfil.exhausted &&
    perfil.remainingMinutes <= Math.max(5, perfil.limitMinutes * 0.1);

  const iniciales = (perfil.fullName?.trim() || perfil.email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div ref={raiz} className="relative border-t border-hairline p-3">
      {/* El saldo va aquí y no en la cabecera: es contexto permanente, no una
          alerta, y en la parte de arriba competía con la consulta en curso. */}
      <div className="px-1 pb-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-faint">
            {t.app.plan} {perfil.plan}
          </span>
          <span
            className={`font-mono text-[10px] tabular-nums ${
              perfil.exhausted
                ? "text-live"
                : porAgotarse
                  ? "text-amber-500"
                  : "text-muted"
            }`}
          >
            {perfil.remainingMinutes} min
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className={`h-full rounded-full ${
              perfil.exhausted
                ? "bg-live"
                : porAgotarse
                  ? "bg-amber-500"
                  : "bg-accent"
            }`}
            style={{
              width: `${Math.max(pct, perfil.usedMinutes > 0 ? 1.5 : 0)}%`,
            }}
          />
        </div>
        {perfil.exhausted && (
          <Link
            href="/cuenta"
            className="mt-1.5 inline-block font-mono text-[9px] uppercase tracking-[0.12em] text-accent hover:underline"
          >
            {t.app.ampliarPlan}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setMenu((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menu}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground/[0.07] font-mono text-[10px] font-semibold text-muted"
          >
            {iniciales}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">
              {perfil.fullName ?? perfil.email}
            </span>
          </span>
          <span aria-hidden className="text-[10px] text-faint">
            ▾
          </span>
        </button>

        <Ajustes
          tamano={tamano}
          onTamano={(id) => guardarPref(PREF.tamano, id)}
          guardarHistorial={historial.activo}
          onGuardarHistorial={historial.alternar}
          seguir={seguir.activo}
          onSeguir={seguir.alternar}
          motorStt={motorStt}
          onMotorStt={(v) => guardarPref(PREF.motorStt, v)}
          motorIa={motorIa}
          onMotorIa={(v) => guardarPref(PREF.motorIa, v)}
          verTecnico={perfil.verTecnico}
          idioma={idioma}
          t={t}
        />
      </div>

      {menu && (
        <div
          role="menu"
          className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-xl bg-surface shadow-pliego"
        >
          <p className="truncate border-b border-hairline px-3.5 py-2.5 text-[12px] text-muted">
            {perfil.email}
          </p>
          {/* Sin "todas las consultas": la barra lateral ya las lista, y el
              menú repetía un destino que está a la vista. */}
          <Opcion href="/cuenta">{t.comun.tuCuenta}</Opcion>
          {perfil.esAdmin && (
            <Opcion href="/admin" acento>
              {t.comun.administracion}
            </Opcion>
          )}
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full px-3.5 py-2.5 text-left text-sm text-muted transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              {t.comun.cerrarSesion}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Opcion({
  href,
  children,
  acento,
}: {
  href: string;
  children: React.ReactNode;
  acento?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`block px-3.5 py-2.5 text-sm transition-colors hover:bg-foreground/[0.04] ${
        acento ? "text-live" : ""
      }`}
    >
      {children}
    </Link>
  );
}
