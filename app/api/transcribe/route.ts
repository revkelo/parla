import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Respaldo de transcripción: Groq Whisper (free tier, auto-detecta idioma).
const WHISPER_MODEL = "whisper-large-v3-turbo";

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta GROQ_API_KEY en el servidor." },
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
    const gform = new FormData();
    gform.append("file", audio, "audio.webm");
    gform.append("model", WHISPER_MODEL);
    gform.append("response_format", "json");
    gform.append("temperature", "0");

    const res = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: gform,
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
    return NextResponse.json({ text: (data?.text ?? "").trim() });
  } catch (err) {
    console.error("Error transcribiendo (Groq Whisper):", err);
    return NextResponse.json(
      { error: "No se pudo transcribir el audio." },
      { status: 502 }
    );
  }
}
