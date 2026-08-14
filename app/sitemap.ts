import type { MetadataRoute } from "next";

const SITIO = "https://parla.kgstudio.top";

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  return [
    { url: `${SITIO}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${SITIO}/guia`, lastModified: ahora, changeFrequency: "monthly", priority: 0.6 },
  ];
}
