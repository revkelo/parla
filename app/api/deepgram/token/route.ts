import { DeepgramClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

// Evita cachear la respuesta: cada petición debe emitir un token nuevo.
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta DEEPGRAM_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  try {
    const deepgram = new DeepgramClient({ apiKey });

    // Token temporal de corta duración. El navegador lo usa para abrir el
    // WebSocket directo con Deepgram sin exponer la API key real.
    const result = await deepgram.auth.v1.tokens.grant({ ttl_seconds: 30 });

    if (!result?.access_token) {
      return NextResponse.json(
        { error: "No se pudo generar el token de Deepgram." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      access_token: result.access_token,
      expires_in: result.expires_in,
    });
  } catch (err) {
    console.error("Error generando token de Deepgram:", err);
    return NextResponse.json(
      { error: "Error interno al generar el token." },
      { status: 500 }
    );
  }
}
