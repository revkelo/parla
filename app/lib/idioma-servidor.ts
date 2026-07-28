import { cookies, headers } from "next/headers";
import {
  COOKIE_IDIOMA,
  type Idioma,
  IDIOMA_POR_DEFECTO,
  type Textos,
  esIdioma,
  textosDe,
} from "./i18n";

/**
 * Idioma de la interfaz para esta petición.
 *
 * Manda la cookie, que es lo que el usuario eligió a mano. Si no la hay, se
 * mira `Accept-Language`: alguien que llega desde un hospital de Estados Unidos
 * con el navegador en inglés no debería aterrizar en español y tener que buscar
 * dónde se cambia.
 *
 * No se usan prefijos `/es` y `/en` en la URL a propósito: obligarían a mover
 * todas las rutas bajo `app/[locale]/` y a duplicar los enlaces internos, a
 * cambio de un beneficio —SEO en dos idiomas— que solo aplica a la portada.
 */
export async function getIdioma(): Promise<Idioma> {
  const elegido = (await cookies()).get(COOKIE_IDIOMA)?.value;
  if (esIdioma(elegido)) return elegido;

  const aceptado = (await headers()).get("accept-language") ?? "";
  // "en-US,en;q=0.9,es;q=0.8" → "en"
  const primero = aceptado.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return esIdioma(primero) ? primero : IDIOMA_POR_DEFECTO;
}

/** Los textos ya resueltos, para pasarlos a los componentes. */
export async function getTextos(): Promise<Textos> {
  return textosDe(await getIdioma());
}
