import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Transcripción "whisper" con Google Gemini (audio → texto).
const MODEL = "gemini-2.5-flash";

const PROMPT =
  "Transcribe este audio literalmente, palabra por palabra, en su idioma " +
  "original (español o inglés). Devuelve SOLO la transcripción, sin comillas, " +
  "sin comentarios ni notas. Si no hay habla clara, responde con una cadena vacía.";

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta GOOGLE_GENERATIVE_AI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  let audio: Blob | null = null;
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (file instanceof Blob) audio = file;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  }

  try {
    const b64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const body = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: audio.type || "audio/wav",
                data: b64,
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Servicio de transcripción no disponible." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim() ?? "";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Error transcribiendo (Gemini):", err);
    return NextResponse.json(
      { error: "No se pudo transcribir el audio." },
      { status: 502 }
    );
  }
}
