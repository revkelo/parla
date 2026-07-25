import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROQ_MODEL = "openai/gpt-oss-120b";

type DeepgramUsage = { amount: number; units: string } | null;
type GroqUsage = {
  remainingRequests: number;
  limitRequests: number;
  resetRequests: string;
} | null;
type GoogleUsage = { configured: boolean } | null;

async function getDeepgram(): Promise<DeepgramUsage> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;
  const headers = { Authorization: `Token ${apiKey}` };
  try {
    const projRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers,
      cache: "no-store",
    });
    if (!projRes.ok) return null;
    const { projects } = await projRes.json();
    const projectId = projects?.[0]?.project_id;
    if (!projectId) return null;
    const balRes = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/balances`,
      { headers, cache: "no-store" }
    );
    if (!balRes.ok) return null;
    const { balances } = await balRes.json();
    const amount = (balances ?? []).reduce(
      (s: number, b: { amount?: number }) => s + (b.amount ?? 0),
      0
    );
    return { amount, units: balances?.[0]?.units ?? "usd" };
  } catch {
    return null;
  }
}

async function getGroq(): Promise<GroqUsage> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    // Ping mínimo para leer los headers de rate-limit del día.
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: "." }],
        max_tokens: 1,
      }),
      cache: "no-store",
    });
    const limit = res.headers.get("x-ratelimit-limit-requests");
    const remaining = res.headers.get("x-ratelimit-remaining-requests");
    const reset = res.headers.get("x-ratelimit-reset-requests");
    if (!limit || !remaining) return null;
    return {
      remainingRequests: Number(remaining),
      limitRequests: Number(limit),
      resetRequests: reset ?? "",
    };
  } catch {
    return null;
  }
}

function getGoogle(): GoogleUsage {
  return { configured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY };
}

export async function GET() {
  const [deepgram, groq] = await Promise.all([getDeepgram(), getGroq()]);
  return NextResponse.json({ deepgram, groq, google: getGoogle() });
}
