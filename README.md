# Parla · Intérprete médico en vivo

Interpretación médica profesional **español ⇄ inglés en tiempo real** (OPI/VRI) desde el micrófono del navegador. Cada intervención se transcribe al instante y se interpreta al otro idioma con terminología clínica, en primera persona, respetando dosis, números, nombres propios y tono — como un intérprete médico certificado.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) ![License](https://img.shields.io/badge/license-MIT-green)

## Cómo funciona

```
Micrófono ──► MediaRecorder ──WebSocket──► Deepgram (nova-3, streaming)
                                                │
                            interim + final ◄───┘
                                    │
        por cada intervención final ▼
                          /api/interpret ──► Groq (principal)
                                               └─ si falla ─► OpenRouter (respaldo free)
```

- **Transcripción**: [Deepgram](https://deepgram.com) nova-3 vía WebSocket streaming, con detección de idioma (`language=multi`). **Cadena de respaldo automática**: Google Gemini (audio→texto por ventanas WAV) → Web Speech API (nativo del navegador). Ver `app/lib/stt.ts`.
- **Interpretación médica**: modelo `openai/gpt-oss-120b` en [Groq](https://groq.com) (free tier, sin tarjeta), guiado por un system prompt de intérprete profesional (identidad neutral, persona gramatical correcta, terminología por especialidad, acrónimos con formato `HTN (hipertensión)`, medicamentos/dosis/números/nombres intactos, tono preservado, interpreta cualquier frase sin responderla).
- **Respaldos**: si Groq falla, reintenta con [OpenRouter](https://openrouter.ai) (`openai/gpt-oss-20b:free`) → [Google Gemini](https://ai.google.dev) (`gemini-2.5-flash`).
- **Seguridad**: la API key de Deepgram nunca llega al navegador. El cliente pide un **token JWT temporal** (30 s) a `/api/deepgram/token` y abre el WebSocket directo con el esquema `bearer`.

## Stack

| Área | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| Transcripción | Deepgram SDK (`@deepgram/sdk`) |
| Interpretación | AI SDK v7 + Groq (`@ai-sdk/groq`), respaldo OpenRouter |
| Detección de idioma | `franc-min` (etiqueta de la interfaz) |
| Deploy | Vercel |

## Desarrollo local

Requiere Node.js 20+.

```bash
npm install
cp .env.example .env.local   # y rellena las API keys
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), pulsa **Iniciar sesión** y habla en español o inglés.

> El acceso al micrófono requiere `localhost` o HTTPS (en producción funciona automáticamente).

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DEEPGRAM_API_KEY` | Sí | Transcripción. [console.deepgram.com](https://console.deepgram.com/) |
| `GROQ_API_KEY` | Sí | Interpretación (motor principal). [console.groq.com/keys](https://console.groq.com/keys) — gratis, sin tarjeta |
| `OPENROUTER_API_KEY` | No | Respaldo free. [openrouter.ai/keys](https://openrouter.ai/keys) |

## Rutas de API

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/deepgram/token` | GET | Token JWT temporal para el WebSocket. |
| `/api/deepgram/balance` | GET | Saldo restante de Deepgram. |
| `/api/interpret` | POST | Interpreta ES⇄EN (`{ text }` → `{ interpretation, detected, engine }`). |

## Aviso

Herramienta de asistencia a la interpretación. No sustituye a un intérprete médico certificado para decisiones clínicas críticas. Todo el contenido es confidencial.

## Licencia

[MIT](./LICENSE)
