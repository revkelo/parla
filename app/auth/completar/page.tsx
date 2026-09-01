import { Suspense } from "react";
import Completar from "./Completar";

export const metadata = {
  title: "Entrando",
  robots: { index: false, follow: false },
};

/*
 * El último tramo de un enlace de correo que trae la sesión en el fragmento.
 *
 * Es una página y no una ruta de API porque el fragmento (`#access_token=…`)
 * no se manda al servidor: solo lo ve el navegador. Aquí no se decide nada de
 * seguridad; el token ya lo emitió Supabase y se valida al canjearlo.
 */
export default function CompletarPage() {
  return (
    <Suspense>
      <Completar />
    </Suspense>
  );
}
