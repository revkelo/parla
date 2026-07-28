"use client";

import { useSyncExternalStore } from "react";

/**
 * Preferencias del intérprete, guardadas en el navegador.
 *
 * Van por `useSyncExternalStore` y no por `useState` + efecto porque el
 * servidor no puede leer `localStorage`: leerlo en un efecto obliga a pintar
 * primero el valor por defecto y corregirlo después, y eso se ve como un
 * parpadeo en cada carga. Este hook da un valor distinto en servidor y cliente
 * sin romper la hidratación.
 *
 * Un único conjunto de oyentes para todas las claves: son cuatro ajustes que
 * cambian a mano, y notificar de más cuesta menos que mantener un registro de
 * suscriptores por clave.
 */

const oyentes = new Set<() => void>();

function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export const PREF = {
  tamano: "parla:tamano",
  historial: "parla:historial",
  seguir: "parla:seguir",
  motorStt: "parla:motor-stt",
  motorIa: "parla:motor-ia",
} as const;

/**
 * Lee una preferencia validándola contra los valores admitidos: si alguien
 * edita el almacenamiento a mano, o cambia el catálogo entre versiones, se cae
 * al valor por defecto en vez de dejar la interfaz en un estado imposible.
 */
function leer<T extends string>(
  clave: string,
  permitidos: readonly T[],
  porDefecto: T
): T {
  try {
    const v = localStorage.getItem(clave);
    return permitidos.includes(v as T) ? (v as T) : porDefecto;
  } catch {
    // Almacenamiento bloqueado (modo privado, políticas del navegador): la app
    // funciona igual, solo que sin recordar los ajustes.
    return porDefecto;
  }
}

export function usePreferencia<T extends string>(
  clave: string,
  permitidos: readonly T[],
  porDefecto: T
): T {
  return useSyncExternalStore(
    suscribir,
    () => leer(clave, permitidos, porDefecto),
    () => porDefecto
  );
}

export function guardarPref(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Ver arriba: no poder recordar el ajuste no debe romper el cambio.
  }
  for (const cb of oyentes) cb();
}

/** Los booleanos se guardan como texto para que el catálogo sea uniforme. */
export const SI_NO = ["si", "no"] as const;
export type SiNo = (typeof SI_NO)[number];

export function useInterruptor(clave: string, porDefecto: SiNo = "si") {
  const valor = usePreferencia(clave, SI_NO, porDefecto);
  return {
    activo: valor === "si",
    alternar: () => guardarPref(clave, valor === "si" ? "no" : "si"),
  };
}
