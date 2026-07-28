/**
 * Reglas de las credenciales.
 *
 * Vive fuera de `actions.ts` para poder probarla sin levantar el servidor ni
 * invocar una acción de servidor: son reglas puras y merecen una prueba rápida
 * que no dependa de la red.
 *
 * El formulario repite estas comprobaciones para avisar mientras se escribe,
 * pero la que manda es esta: una acción de servidor es un endpoint público y
 * la validación del navegador es una cortesía, no una garantía.
 */

export const MINIMO_CARACTERES = 8;

export type FalloClave =
  | { ok: true }
  | { ok: false; motivo: "corta" | "no-coincide" | "vacia" };

export function validarClaveNueva(
  password: string,
  confirmacion: string
): FalloClave {
  if (!password) return { ok: false, motivo: "vacia" };
  if (password.length < MINIMO_CARACTERES) return { ok: false, motivo: "corta" };
  // Comparación exacta, sin recortar espacios: un espacio al final forma parte
  // de la contraseña, y "arreglarlo" aquí dejaría al usuario fuera al entrar.
  if (password !== confirmacion) return { ok: false, motivo: "no-coincide" };
  return { ok: true };
}

export const MENSAJE_CLAVE: Record<
  Exclude<FalloClave, { ok: true }>["motivo"],
  string
> = {
  vacia: "Escribe tu correo y tu contraseña.",
  corta: `La contraseña debe tener al menos ${MINIMO_CARACTERES} caracteres.`,
  "no-coincide": "Las dos contraseñas no coinciden.",
};
