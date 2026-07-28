"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Aviso tras volver de Stripe.
 *
 * El webhook y el retorno del navegador son carreras independientes: el
 * usuario suele llegar aquí antes de que Stripe nos haya avisado. Por eso, si
 * el plan todavía no cambió, refrescamos unas cuantas veces en vez de mentirle
 * con un "listo" sobre un plan que aún dice Gratis.
 */
export function CheckoutResult({
  status,
  planActivo,
}: {
  status: "ok" | "cancelado";
  planActivo: boolean;
}) {
  const router = useRouter();
  const [esperando, setEsperando] = useState(status === "ok" && !planActivo);

  useEffect(() => {
    if (!esperando) return;

    let intentos = 0;
    const id = setInterval(() => {
      intentos++;
      if (intentos > 6) {
        // ~12 s sin noticias: dejamos de refrescar y lo decimos claro.
        clearInterval(id);
        setEsperando(false);
        return;
      }
      router.refresh();
    }, 2000);

    return () => clearInterval(id);
  }, [esperando, router]);

  if (status === "cancelado") {
    return (
      <Aviso tono="neutro">
        Cancelaste el pago. No se te cobró nada y sigues en tu plan actual.
      </Aviso>
    );
  }

  if (planActivo) {
    return <Aviso tono="ok">Pago confirmado. Tu plan ya está activo.</Aviso>;
  }

  if (esperando) {
    return (
      <Aviso tono="neutro">
        Pago recibido. Estamos activando tu plan…
      </Aviso>
    );
  }

  return (
    <Aviso tono="aviso">
      Recibimos tu pago, pero el plan aún no aparece activo. Suele resolverse
      solo en un minuto; recarga la página. Si sigue igual, escríbenos.
    </Aviso>
  );
}

function Aviso({
  tono,
  children,
}: {
  tono: "ok" | "aviso" | "neutro";
  children: React.ReactNode;
}) {
  const estilo = {
    ok: "border-accent/40 bg-accent-soft text-accent",
    aviso: "border-amber-500/40 bg-amber-500/[0.08] text-amber-600",
    neutro: "border-hairline bg-surface/60 text-muted",
  }[tono];

  return (
    <div
      role="status"
      className={`mt-5 rounded-xl border px-4 py-3 text-sm ${estilo}`}
    >
      {children}
    </div>
  );
}
