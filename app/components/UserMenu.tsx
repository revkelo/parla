"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { type Textos, textosDe } from "@/app/lib/i18n";

/** Iniciales para el avatar; el correo sirve de respaldo si no hay nombre. */
function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function UserMenu({
  email,
  fullName,
  planName,
  esAdmin = false,
  t = textosDe("es"),
}: {
  email: string;
  fullName: string | null;
  planName: string;
  esAdmin?: boolean;
  /** Textos ya resueltos. El panel de administración es interno y va en
      español, así que aquí el idioma por defecto basta. */
  t?: Textos;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera o con Escape: sin esto el menú se queda
  // pegado y tapa los controles de la sesión.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de la cuenta"
        className="grid h-8 w-8 place-items-center rounded-full border border-hairline bg-surface font-mono text-[11px] font-semibold text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        {initials(fullName, email)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-hairline bg-surface shadow-lg"
        >
          <div className="border-b border-hairline px-3.5 py-3">
            {fullName && (
              <p className="truncate text-sm font-medium">{fullName}</p>
            )}
            <p className="truncate text-[13px] text-muted">{email}</p>
            <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
              {t.app.plan} {planName}
            </p>
          </div>

          <Link
            href="/historial"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-sm transition-colors hover:bg-foreground/[0.04]"
          >
            {t.historial.titulo}
          </Link>

          <Link
            href="/cuenta"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-sm transition-colors hover:bg-foreground/[0.04]"
          >
            {t.comun.tuCuenta}
          </Link>

          {esAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 text-sm text-live transition-colors hover:bg-foreground/[0.04]"
            >
              {t.comun.administracion}
            </Link>
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
