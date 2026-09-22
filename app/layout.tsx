import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

/**
 * Tres voces, una por trabajo (ver la nota de `globals.css`):
 * Newsreader habla, Plex Sans rotula y Plex Mono cuenta.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITIO = "https://parla.kgstudio.top";

export const metadata: Metadata = {
  // Sin `metadataBase` Next resuelve las imágenes de Open Graph contra
  // localhost y el enlace compartido sale sin miniatura en producción.
  metadataBase: new URL(SITIO),
  title: {
    default: "Parla · Intérprete médico en vivo (ES ⇄ EN)",
    template: "%s · Parla",
  },
  // 174 caracteres se cortaban a 160 en el resultado de busqueda. Esta cabe.
  description:
    "Interpretación médica en vivo español ⇄ inglés para intérpretes, hospitales y clínicas (OPI/VRI). Terminología clínica, dosis y cifras exactas.",
  applicationName: "Parla",
  keywords: [
    "intérprete médico",
    "interpretación médica español inglés",
    "traducción médica en tiempo real",
    "OPI",
    "VRI",
    "transcripción médica",
  ],
  authors: [{ name: "Kevin Gonzalez", url: "https://kgstudio.top/" }],
  creator: "Kevin Gonzalez",
  publisher: "kgstudio",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    url: SITIO,
    siteName: "Parla",
    locale: "es_CO",
    title: "Parla · Intérprete médico en vivo (ES ⇄ EN)",
    description:
      "Transcribe y traduce la consulta mientras ocurre, con la terminología clínica intacta.",
  },
  twitter: {
    // `summary_large_image` ahora que hay una imagen 1200x630 propia. Con
    // `summary` la tarjeta salia en miniatura y desaprovechaba el dibujo.
    card: "summary_large_image",
    title: "Parla · Intérprete médico en vivo (ES ⇄ EN)",
    description:
      "Transcribe y traduce la consulta mientras ocurre, con la terminología clínica intacta.",
  },
};

/**
 * El autor se declara con el mismo `@id` que usa kgstudio.top. No es un dato
 * repetido: es la misma entidad citada desde otro sitio, y es lo que hace que
 * Google -y los asistentes que resumen la web- sepan que parla es de Kevin
 * Gonzalez y no de un tercero con el mismo producto.
 */
const DATOS_ESTRUCTURADOS = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITIO}/#parla`,
      name: "Parla",
      url: `${SITIO}/`,
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      inLanguage: ["es", "en"],
      description:
        "Intérprete médico en vivo español ⇄ inglés: transcribe y traduce la consulta mientras ocurre, cuidando terminología clínica, acrónimos y dosis.",
      /*
       * El plan de prueba, que es gratis. Google pide `offers` para entender
       * qué cuesta una aplicación, y sin él parla era la única de la zona que
       * no decía nada de su precio. No se escriben aquí los planes de pago: sus
       * importes viven en la base y se pintan en la portada desde ahí, y un
       * precio copiado a mano es un precio que se desfasa el día que suba.
       *
       * Falta `aggregateRating`, y falta a propósito: no hay valoraciones que
       * declarar. Eso deja la ficha fuera de la tarjeta de aplicación de Google
       * -Search Console lo avisa-, y es la respuesta correcta mientras no haya
       * valoraciones de verdad. Cuando las haya, se añaden y la tarjeta se
       * desbloquea sola.
       */
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Plan de prueba con minutos de interpretación al mes, sin tarjeta.",
      },
      author: { "@id": "https://kgstudio.top/#kevin" },
      publisher: { "@id": "https://kgstudio.top/#kgstudio" },
    },
    {
      "@type": "Person",
      "@id": "https://kgstudio.top/#kevin",
      name: "Kevin Gonzalez",
      alternateName: "kagonzalezdev",
      url: "https://kgstudio.top/",
      jobTitle: "Cloud & DevOps Engineer",
      sameAs: [
        "https://github.com/revkelo",
        "https://www.linkedin.com/in/kagonzalezdev",
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://kgstudio.top/#kgstudio",
      name: "kgstudio",
      url: "https://kgstudio.top/",
      founder: { "@id": "https://kgstudio.top/#kevin" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ESTRUCTURADOS) }}
        />
        {children}
      </body>
    </html>
  );
}
