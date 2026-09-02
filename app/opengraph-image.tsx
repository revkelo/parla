import { ImageResponse } from "next/og";

/**
 * La imagen que sale al compartir el enlace.
 *
 * No había ninguna: cada enlace de parla en WhatsApp, LinkedIn o Slack salía
 * como texto plano. En un sitio que se comparte entre compañeros de hospital
 * y entre intérpretes, esa tarjeta es la primera impresión.
 *
 * Dibuja lo que hace la app: la misma frase, dos veces, una en cada idioma.
 * Es más honesto que un logo grande, y a 300 px de ancho -que es como se ve
 * en un chat- se entiende sin leer la letra pequeña.
 *
 * Fuentes del sistema a propósito: cargar una tipografía aquí obligaría a
 * traerse el binario en cada render y la imagen se cachea igual.
 */
/*
 * Sin el signo ⇄ dentro de la imagen: el generador usa fuentes del sistema y
 * ese glifo no está, así que salía como un cuadro vacío. En el HTML sí se usa,
 * porque ahí lo pinta la fuente del navegador.
 */
export const alt = "Parla, intérprete médico en vivo español e inglés";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TINTA = "#0b1211";
const VERDE = "#2bb3a3";
const HUESO = "#eef4f3";
const BRUMA = "#93a8a5";

export default function Imagen() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: TINTA,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: VERDE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: TINTA,
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            p
          </div>
          <div style={{ fontSize: 46, fontWeight: 800, color: HUESO, letterSpacing: -1.5 }}>
            parla
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: HUESO, letterSpacing: -2.5, lineHeight: 1.05, maxWidth: 980 }}>
            Cada palabra, en el otro idioma.
          </div>
          <div style={{ fontSize: 30, color: BRUMA, maxWidth: 820, lineHeight: 1.35 }}>
            Interpretación médica en vivo, español e inglés, mientras ocurre la consulta.
          </div>
        </div>

        {/* Las dos líneas: lo que se dice y lo que llega al otro lado */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 46, fontSize: 20, color: BRUMA, display: "flex" }}>ES</div>
            <div
              style={{
                flex: 1,
                borderLeft: `3px solid ${VERDE}`,
                paddingLeft: 18,
                fontSize: 26,
                color: HUESO,
                display: "flex",
              }}
            >
              ¿Desde cuándo tiene el dolor en el pecho?
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 46, fontSize: 20, color: BRUMA, display: "flex" }}>EN</div>
            <div
              style={{
                flex: 1,
                borderLeft: `3px solid ${BRUMA}`,
                paddingLeft: 18,
                fontSize: 26,
                color: BRUMA,
                display: "flex",
              }}
            >
              How long have you had the chest pain?
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
