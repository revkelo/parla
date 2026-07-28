/**
 * Reglas de contraseña. No necesita servidor ni base de datos.
 *
 *   npm run test:validacion
 */

import assert from "node:assert/strict";
import {
  MINIMO_CARACTERES,
  validarClaveNueva,
} from "../app/(auth)/validacion.js";

let pasadas = 0;
const fallos: string[] = [];

function prueba(nombre: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASA  ${nombre}`);
    pasadas++;
  } catch (err) {
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${(err as Error).message.split("\n")[0]}`);
    fallos.push(nombre);
  }
}

console.log("Reglas de contraseña\n");

prueba("acepta dos contraseñas iguales y largas", () => {
  assert.deepEqual(validarClaveNueva("unaClaveLarga1", "unaClaveLarga1"), {
    ok: true,
  });
});

prueba("rechaza si no coinciden", () => {
  const r = validarClaveNueva("unaClaveLarga1", "otraClaveLarga1");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "no-coincide");
});

prueba("rechaza si falta la confirmación", () => {
  const r = validarClaveNueva("unaClaveLarga1", "");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "no-coincide");
});

prueba(`rechaza por debajo de ${MINIMO_CARACTERES} caracteres`, () => {
  const corta = "a".repeat(MINIMO_CARACTERES - 1);
  const r = validarClaveNueva(corta, corta);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "corta");
});

prueba(`acepta justo ${MINIMO_CARACTERES} caracteres`, () => {
  const justa = "a".repeat(MINIMO_CARACTERES);
  assert.deepEqual(validarClaveNueva(justa, justa), { ok: true });
});

prueba("rechaza la contraseña vacía", () => {
  const r = validarClaveNueva("", "");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "vacia");
});

prueba("distingue mayúsculas de minúsculas", () => {
  const r = validarClaveNueva("ClaveLarga1", "clavelarga1");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "no-coincide");
});

prueba("no recorta espacios: forman parte de la contraseña", () => {
  // Recortarlos aquí dejaría al usuario fuera al entrar, porque al iniciar
  // sesión el espacio sí cuenta.
  const r = validarClaveNueva("claveLarga1 ", "claveLarga1");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "no-coincide");
});

const total = pasadas + fallos.length;
console.log(`\n${pasadas}/${total}`);
if (fallos.length) {
  console.log(`Fallan: ${fallos.join(", ")}`);
  process.exit(1);
}
