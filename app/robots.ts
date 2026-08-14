import type { MetadataRoute } from "next";

const SITIO = "https://parla.kgstudio.top";

/**
 * Solo la portada y la guía son públicas. Todo lo demás vive detrás de sesión:
 * indexarlo no traería a nadie —el rastreador ve la pantalla de login— y ensucia
 * los resultados con URLs que el visitante no puede abrir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/admin/", "/cuenta/", "/historial/", "/auth/"],
    },
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO,
  };
}
