import type { MetadataRoute } from "next";

const SITIO = "https://parla.kgstudio.top";

/**
 * Solo la portada y la guía son públicas. Todo lo demás vive detrás de sesión:
 * indexarlo no traería a nadie -el rastreador ve la pantalla de login- y ensucia
 * los resultados con URLs que el visitante no puede abrir.
 */
const PRIVADO = ["/api/", "/app/", "/admin/", "/cuenta/", "/historial/", "/auth/"];

/**
 * Los rastreadores de los buscadores con IA.
 *
 * Se nombran uno a uno, como en el hub y en examia, para que quede escrito que
 * entran a propósito: leen `llms.txt` antes que el HTML, y parla tiene uno
 * desde hoy. Antes solo estaban cubiertos por el comodín, o sea que cumplían
 * de casualidad.
 *
 * Cada grupo repite `PRIVADO`, y eso no es repetirse por gusto: un rastreador
 * elige el grupo más específico que le aplica y **descarta los demás**, así
 * que un `Allow: /` a secas aquí les abriría la parte con sesión entera. Es el
 * fallo del 2026-09-04 en examia, escrito para no repetirlo. La lista se
 * declara una vez arriba y se reparte, que es la otra mitad de la lección.
 */
const CON_IA = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVADO },
      ...CON_IA.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVADO })),
    ],
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO,
  };
}
