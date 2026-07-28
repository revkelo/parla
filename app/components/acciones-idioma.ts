"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_IDIOMA, type Idioma, esIdioma } from "@/app/lib/i18n";

/** Un año: la preferencia de idioma no caduca cada sesión. */
const UN_ANO = 60 * 60 * 24 * 365;

export async function cambiarIdioma(idioma: Idioma) {
  // Se valida aunque venga de un botón nuestro: una acción de servidor es un
  // endpoint público y el valor acaba en una cookie.
  if (!esIdioma(idioma)) return;

  (await cookies()).set(COOKIE_IDIOMA, idioma, {
    maxAge: UN_ANO,
    path: "/",
    sameSite: "lax",
  });

  // Toda la interfaz se traduce en el servidor, así que hay que rehacer el
  // árbol entero, no solo la página donde está el selector.
  revalidatePath("/", "layout");
}
