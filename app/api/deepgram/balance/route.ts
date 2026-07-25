import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Consulta el saldo restante de Deepgram (suma de balances del primer proyecto).
export async function GET() {
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
