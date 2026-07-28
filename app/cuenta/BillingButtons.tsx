"use client";

import { useState } from "react";

/** Pide la URL a la ruta indicada y manda al usuario a Stripe. */
async function goToStripe(path: string, body?: unknown): Promise<string | null> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    return data?.error ?? "No se pudo continuar con Stripe.";
  }
  window.location.href = data.url;
  return null;
}

export function CheckoutButton({
  planId,
  label,
  variant = "primary",
}: {
  planId: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        onClick={async () => {
          setBusy(true);
          setError(await goToStripe("/api/stripe/checkout", { planId }));
          setBusy(false);
        }}
        disabled={busy}
        className={`w-full rounded-lg px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
          variant === "primary"
            ? "bg-foreground text-background"
            : "border border-hairline"
        }`}
      >
        {busy ? "Abriendo pago…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-live">
          {error}
        </p>
      )}
    </>
  );
}

export function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        onClick={async () => {
          setBusy(true);
          setError(await goToStripe("/api/stripe/portal"));
          setBusy(false);
        }}
        disabled={busy}
        className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.04] disabled:opacity-50"
      >
        {busy ? "Abriendo…" : "Gestionar suscripción"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-live">
          {error}
        </p>
      )}
    </>
  );
}
