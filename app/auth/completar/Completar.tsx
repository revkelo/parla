"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

function destinoSeguro(valor: string | null): string {
  if (!valor || !valor.startsWith("/")) return "/app";
  if (valor.startsWith("//") || valor.startsWith("/\\")) return "/app";
  return valor;
}

export default function Completar() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const destino = destinoSeguro(params.get("next"));
    // `substring(1)` quita la almohadilla; lo de dentro se lee como una query.
    const fragmento = new URLSearchParams(window.location.hash.substring(1));
    const access_token = fragmento.get("access_token");
    const refresh_token = fragmento.get("refresh_token");

    if (!access_token || !refresh_token) {
      setError(
        fragmento.get("error_description") ??
          "Ese enlace ya no vale. Pide uno nuevo."
      );
      return;
    }

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setError("Ese enlace ya no vale. Pide uno nuevo.");
          return;
        }
        // `replace` y no `push`: el enlace del correo lleva el token en la URL
        // y no tiene por qué quedarse en el historial del navegador.
        router.replace(destino);
        router.refresh();
      });
  }, [params, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 text-center">
      {error ? (
        <>
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
          <p className="mt-4 text-sm">
            <a href="/recuperar" className="underline">
              Pedir un enlace nuevo
            </a>
          </p>
        </>
      ) : (
        <p className="text-sm opacity-70">Entrando…</p>
      )}
    </main>
  );
}
