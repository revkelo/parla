# Parla · Intérprete en vivo

Transcripción y traducción **español ⇄ inglés en tiempo real** desde el micrófono del navegador. Cada frase que dices se transcribe al instante y aparece emparejada con su traducción en la línea de abajo — como una cabina de intérprete.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) ![License](https://img.shields.io/badge/license-MIT-green)

## Cómo funciona

```
Micrófono ──► MediaRecorder ──WebSocket──► Deepgram (nova-3, streaming)
                                                │
                            interim + final ◄───┘
                                    │
              por cada frase final  ▼
                          /api/translate ──► franc + MyMemory ──► traducción
```

- **Transcripción**: [Deepgram](https://deepgram.com) nova-3 vía WebSocket streaming, con detección multilenguaje (`language=multi`) y baja latencia.
- **Traducción**: sin IA — [MyMemory](https://mymemory.translated.net) (gratis, sin API key) + [`franc`](https://github.com/wooorm/franc) para detectar el idioma y elegir la dirección (ES→EN / EN→ES).
- **Seguridad**: la API key de Deepgram nunca llega al navegador. El cliente pide un **token JWT temporal** (30 s) a `/api/deepgram/token` y abre el WebSocket directo con el esquema `bearer`.

## Stack

| Área | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| Transcripción | Deepgram SDK (`@deepgram/sdk`) |
| Traducción | MyMemory API + `franc-min` |
| Deploy | Vercel |

## Desarrollo local

Requiere Node.js 20+ y una cuenta de [Deepgram](https://console.deepgram.com/).

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar la API key
cp .env.example .env.local
# edita .env.local y pega tu DEEPGRAM_API_KEY

# 3. Arrancar
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), pulsa **Grabar** y habla.

> El acceso al micrófono requiere `localhost` o HTTPS (en producción funciona automáticamente).

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DEEPGRAM_API_KEY` | Sí | API key de Deepgram. Se usa solo en el servidor. |

## Rutas de API

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/deepgram/token` | GET | Emite un token JWT temporal para el WebSocket. |
| `/api/deepgram/balance` | GET | Devuelve el saldo restante de Deepgram. |
| `/api/translate` | POST | Traduce un texto ES⇄EN (`{ text }` → `{ translation, detected }`). |

## Licencia

[MIT](./LICENSE)
