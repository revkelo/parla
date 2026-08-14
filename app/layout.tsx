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
  description:
    "Interpretación médica profesional español ⇄ inglés en tiempo real para intérpretes, hospitales y clínicas (OPI/VRI). Terminología clínica, acrónimos, dosis y cifras precisas.",
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
    card: "summary",
    title: "Parla · Intérprete médico en vivo (ES ⇄ EN)",
    description:
      "Transcribe y traduce la consulta mientras ocurre, con la terminología clínica intacta.",
  },
};

/**
 * El autor se declara con el mismo `@id` que usa kgstudio.top. No es un dato
 * repetido: es la misma entidad citada desde otro sitio, y es lo que hace que
 * Google —y los asistentes que resumen la web— sepan que parla es de Kevin
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
