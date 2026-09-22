import type { MetadataRoute } from "next";

const SITIO = "https://parla.kgstudio.top";

/*
 * Las fechas van declaradas a mano y se tocan en el mismo commit que cambia lo
 * que fechan. Antes salían de `new Date()`, o sea de la hora a la que se pedía
 * el sitemap: así las dos URLs decían haber cambiado en ese instante, siempre,
 * y un `lastmod` que siempre es "ahora" el buscador deja de mirarlo.
 */
const PORTADA_ACTUALIZADA = new Date("2026-09-01T00:00:00Z");
const GUIA_ACTUALIZADA = new Date("2026-08-14T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITIO}/`,
      lastModified: PORTADA_ACTUALIZADA,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITIO}/guia`,
      lastModified: GUIA_ACTUALIZADA,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
