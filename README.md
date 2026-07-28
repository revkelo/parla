# Parla · Intérprete médico en vivo

Interpretación médica profesional **español ⇄ inglés en tiempo real** (OPI/VRI) desde el micrófono del navegador. Cada intervención se transcribe al instante y se interpreta al otro idioma con terminología clínica, en primera persona, respetando dosis, números, nombres propios y tono — como un intérprete médico certificado.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) ![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20datos-3FCF8E?logo=supabase) ![Stripe](https://img.shields.io/badge/Stripe-suscripciones-635BFF?logo=stripe) ![License](https://img.shields.io/badge/license-MIT-green)

> **¿Solo quieres entrar y probarlo?** `npm run sembrar` crea las cuentas de
> prueba y **imprime sus credenciales por consola**. No se publican aquí: este
> repositorio es público y esas cuentas son reales.

## Qué hace

- **Interpreta, no responde.** Si el paciente pregunta algo, se interpreta la pregunta; nunca se contesta por nadie.
- **Conserva el contexto.** Cada turno conoce los anteriores, así que resuelve pronombres, género y respuestas de una palabra.
- **Respeta el registro.** Si el médico habla llano, la salida va llana: no sube el lenguaje a jerga clínica ni lo baja a coloquial.
- **No toca los datos duros.** Medicamentos, dosis, cifras y nombres propios pasan intactos; los acrónimos se expanden como `HTN (hipertensión)`.

## Cómo funciona

```
Micrófono ──► MediaRecorder ──WebSocket──► Deepgram (nova-3, streaming)
                                                │
                            interim + final ◄───┘
                                    │
        por cada intervención final ▼
                          /api/interpret ──► Groq (principal)
                                               └─ si falla ─► OpenRouter / Gemini
```

- **Transcripción**: [Deepgram](https://deepgram.com) nova-3 vía WebSocket streaming, con detección de idioma (`language=multi`). **Cadena de respaldo automática**: Google Gemini (audio→texto por ventanas WAV) → Web Speech API (nativo del navegador). Ver `app/lib/stt.ts`.
- **Interpretación médica**: modelo `openai/gpt-oss-120b` en [Groq](https://groq.com), guiado por un system prompt de intérprete profesional. Si Groq falla, reintenta con [OpenRouter](https://openrouter.ai) (`openai/gpt-oss-20b:free`) → [Google Gemini](https://ai.google.dev) (`gemini-2.5-flash`).
- **Cuentas y planes**: [Supabase](https://supabase.com) para autenticación y datos, [Stripe](https://stripe.com) para las suscripciones. El consumo se mide en el servidor con un latido periódico y se corta al agotar la cuota del plan.
- **Seguridad**: la API key de Deepgram nunca llega al navegador. El cliente pide un **token JWT temporal** (30 s) a `/api/deepgram/token` y abre el WebSocket directo con el esquema `bearer`.

## Stack

| Área | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| Transcripción | Deepgram SDK (`@deepgram/sdk`) |
| Interpretación | AI SDK v7 + Groq (`@ai-sdk/groq`), respaldo OpenRouter y Gemini |
| Cuentas y datos | Supabase (Postgres + Auth + RLS) |
| Cobros | Stripe (suscripciones + portal de cliente) |
| Detección de idioma | `franc-min` (etiqueta de la interfaz) |
| Deploy | Vercel |

## Desarrollo local

Requiere Node.js 20+.

```bash
npm install
cp .env.example .env.local   # y rellena las API keys
npm run migrate              # aplica el esquema en Supabase
npm run sembrar              # crea las cuentas de prueba e imprime sus claves
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y entra con la cuenta de
administración que imprimió `npm run sembrar` para verlo todo, incluido el panel
de administración.

> El acceso al micrófono requiere `localhost` o HTTPS (en producción funciona automáticamente).

## Mapa de la aplicación

| Ruta | Quién entra | Qué es |
|------|-------------|--------|
| `/` | cualquiera | Portada: propuesta, diferenciadores y precios. |
| `/registro`, `/login`, `/recuperar` | anónimos | Alta, acceso y recuperación de contraseña. |
| `/app` | con sesión | El intérprete en vivo, con la barra lateral de consultas. |
| `/app/c/[id]` | con sesión | Una consulta anterior, en el mismo marco. |
| `/historial` | con sesión | Listado completo de consultas guardadas. |
| `/cuenta` | con sesión | Consumo del período, plan, facturación e historial. |
| `/admin` | solo `role = 'admin'` | Panel interno: métricas, uso diario y gestión de usuarios. |

`/admin` devuelve **404** a quien no sea administrador: quien no tiene permiso ni
siquiera se entera de que la página existe.

## Panel de administración

Entrando con una cuenta de administración:

- **Cifras del negocio**: usuarios, altas de la semana, ingresos recurrentes, conversión a pago, minutos del mes y de hoy, costo real, margen y sesiones en vivo.
- **Serie diaria** de minutos transcritos de los últimos 30 días, con su tabla equivalente para lectura no visual.
- **Reparto por plan** y aprovechamiento de la cuota vendida.
- **Tabla de usuarios** con buscador, filtro de solo-pago y orden por consumo, con el gasto de cada uno frente a su cuota.
- **Acciones**: cambiar de plan, reiniciar el consumo del período y dar o quitar administración.

Lo que el panel **no** ve, a propósito: las transcripciones y las
interpretaciones. Son contenido clínico de una consulta médica, y administrar la
plataforma no da derecho a leer lo que dijo un paciente. La política de acceso
de `segments` no tiene excepción para administradores.

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DEEPGRAM_API_KEY` | Sí | Transcripción. [console.deepgram.com](https://console.deepgram.com/) |
| `GROQ_API_KEY` | Sí | Interpretación (motor principal). [console.groq.com/keys](https://console.groq.com/keys) — gratis, sin tarjeta |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | Proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Escrituras del servidor (consumo, planes, sembrado). **Nunca en el cliente.** |
| `POSTGRES_URL_NON_POOLING` | Sí | Conexión directa para `npm run migrate`. |
| `STRIPE_SECRET_KEY` | Sí | Suscripciones. |
| `STRIPE_WEBHOOK_SECRET` | Sí | Verificación del webhook de Stripe. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Respaldo de transcripción e interpretación. |
| `OPENROUTER_API_KEY` | No | Respaldo free de interpretación. |
| `RESEND_API_KEY` | No | Correos de confirmación y recuperación. |

## Rutas de API

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/deepgram/token` | GET | Token JWT temporal para el WebSocket. |
| `/api/deepgram/balance` | GET | Saldo restante de Deepgram. |
| `/api/interpret` | POST | Interpreta ES⇄EN (`{ text }` → `{ interpretation, detected, engine }`). |
| `/api/usage` | GET | Consumo del usuario contra su plan. |
| `/api/segments` | POST | Guarda un turno interpretado en el historial. |
| `/api/sessions/cerrar` | POST | Marca una sesión como terminada. |
| `/api/usage/heartbeat` | POST | Latido que contabiliza los minutos consumidos. |
| `/api/stripe/checkout` | POST | Inicia la suscripción a un plan. |
| `/api/stripe/portal` | POST | Portal de cliente de Stripe. |
| `/api/stripe/webhook` | POST | Sincroniza suscripciones y planes. |

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo. |
| `npm run migrate` | Aplica las migraciones SQL pendientes (idempotente). |
| `npm run sembrar` | Crea o restablece las cuentas de prueba. |
| `npm run stripe:setup` | Crea en Stripe los precios de los planes. |
| `npm run eval` | Evalúa la calidad de la interpretación sobre `eval/cases.json`. |
| `npm run medir:costo` | Mide el costo real por minuto. |
| `npm run viabilidad` | Modelo de márgenes y punto de equilibrio. |
| `npm run test:stripe`, `test:admin`, `test:historial`, `test:hook` | Pruebas de integración. |

## Aviso

Herramienta de asistencia a la interpretación. No sustituye a un intérprete médico certificado para decisiones clínicas críticas. Todo el contenido es confidencial.

## Licencia

[MIT](./LICENSE)
