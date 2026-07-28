import Link from "next/link";
import { getIdioma } from "@/app/lib/idioma-servidor";
import { createClient } from "@/app/lib/supabase/server";

/**
 * Página no encontrada.
 *
 * La usan tanto las URLs mal escritas como los `notFound()` deliberados: el
 * panel de administración y las consultas ajenas devuelven 404 en vez de 403
 * para no confirmarle a nadie que ese recurso existe. Por eso el texto no
 * insinúa que quizá no tengas permiso — diría justo lo que se pretende callar.
 *
 * La salida depende de si hay sesión: mandar a la portada a alguien que ya
 * entró le obliga a volver a navegar hasta donde estaba.
 */
export default async function NoEncontrada() {
  const idioma = await getIdioma();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t =
    idioma === "en"
      ? {
          codigo: "404",
          titulo: "This page doesn't exist.",
          cuerpo:
            "The link may be broken, or the page may have been moved. Nothing you've saved is affected.",
          volver: user ? "Back to parla" : "Back home",
          guia: "Read the guide",
        }
      : {
          codigo: "404",
          titulo: "Esta página no existe.",
          cuerpo:
            "Puede que el enlace esté roto o que la página se haya movido. Nada de lo que tengas guardado se ve afectado.",
          volver: user ? "Volver a parla" : "Volver al inicio",
          guia: "Leer la guía",
        };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-24 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
        {t.codigo}
      </p>

      <h1 className="habla mt-4 text-[clamp(1.6rem,5vw,2.1rem)] font-normal leading-tight tracking-tight">
        {t.titulo}
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed text-muted">{t.cuerpo}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={user ? "/app" : "/"}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {t.volver}
        </Link>
        <Link
          href="/guia"
          className="rounded-md border border-hairline px-4 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/[0.04]"
        >
          {t.guia}
        </Link>
      </div>
    </main>
  );
}
