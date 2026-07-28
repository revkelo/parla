import { NextResponse } from "next/server";
import { esAdmin } from "@/app/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Saldo restante de la cuenta de Deepgram (suma de balances del primer
 * proyecto). **Solo administradores.**
 *
 * Esta ruta estaba abierta a internet: sin sesión siquiera, cualquiera podía
 * consultar cuánto crédito le queda a la plataforma y, de paso, hacer que el
 * servidor llamara dos veces a la API de Deepgram por petición. El saldo es
 * información de costos del negocio, igual que el margen del panel, así que va
 * detrás del mismo rol.
 */
export async function GET() {
  if (!(await esAdmin())) {
    // 404 y no 403, igual que /admin: quien no tiene permiso no necesita
    // enterarse de que esta ruta existe.
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta DEEPGRAM_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  const headers = { Authorization: `Token ${apiKey}` };

  try {
    const projRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers,
      cache: "no-store",
    });
    if (!projRes.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar el proyecto." },
        { status: 502 }
      );
    }

    const { projects } = (await projRes.json()) as {
      projects: { project_id: string }[];
    };
    const projectId = projects?.[0]?.project_id;
    if (!projectId) {
      return NextResponse.json({ error: "Sin proyectos." }, { status: 404 });
    }

    const balRes = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/balances`,
      { headers, cache: "no-store" }
    );
    if (!balRes.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar el saldo." },
        { status: 502 }
      );
    }

    const { balances } = (await balRes.json()) as {
      balances: { amount: number; units: string }[];
    };

    // Sumar todos los balances en USD.
    const amount = (balances ?? []).reduce((sum, b) => sum + (b.amount ?? 0), 0);
    const units = balances?.[0]?.units ?? "usd";

    return NextResponse.json({ amount, units });
  } catch (err) {
    console.error("Error consultando saldo de Deepgram:", err);
    return NextResponse.json(
      { error: "Error interno al consultar el saldo." },
      { status: 500 }
    );
  }
}
