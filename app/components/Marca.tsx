import Link from "next/link";

/**
 * El logotipo, en las cinco pantallas iguales.
 *
 * Es tipográfico, no un icono dentro de un cuadrado: la marca de un producto
 * de lengua se escribe. Va en Newsreader, la misma voz que el habla
 * interpretada, así que el nombre pertenece al mismo mundo que el contenido.
 *
 * El separador con el nombre de la pantalla es vertical, como el lomo de la
 * portada: en toda la interfaz no hay una sola línea horizontal decorativa.
 */
export function Marca({
  etiqueta,
  sub,
}: {
  /** Nombre de la pantalla, a la derecha del logotipo. */
  etiqueta?: string;
  /** Rótulo pequeño bajo el nombre de la pantalla. */
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/"
        title="Volver al inicio"
        className="habla rounded text-[19px] font-medium lowercase leading-none tracking-tight transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        parla
      </Link>

      {etiqueta && (
        <>
          <span aria-hidden className="h-5 w-px bg-hairline" />
          <span className="leading-tight">
            <span className="block text-[15px] font-medium">{etiqueta}</span>
            {sub && (
              <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                {sub}
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
}
