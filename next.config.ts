import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las respuestas.
 *
 * No hay CSP todavía: una política estricta sobre una aplicación con scripts en
 * línea de Next exige probarla ruta por ruta, y una mal puesta rompe el producto
 * en producción sin avisar en desarrollo. Va aparte, con su propia prueba.
 */
const CABECERAS = [
  // Sin esto, un archivo servido con el tipo equivocado puede acabar
  // ejecutándose como script si el navegador "adivina" mal.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Nadie debe poder incrustar parla en un iframe: en una herramienta con
  // micrófono, un marco invisible encima es un secuestro de clics.
  { key: "X-Frame-Options", value: "DENY" },

  // La URL de una consulta guardada no debe viajar entera a terceros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  /**
   * El micrófono es el permiso que sostiene el producto: se concede solo al
   * propio origen. Cámara y ubicación no se usan, así que se niegan del todo en
   * lugar de dejarlas disponibles por si acaso.
   */
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=()",
  },

  // Solo tiene efecto sobre HTTPS; en localhost el navegador la ignora.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Anunciar el framework y su versión solo le ahorra trabajo a quien busca
  // vulnerabilidades conocidas.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: CABECERAS }];
  },
};

export default nextConfig;
