import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Send Email Hook de Supabase.
 *
 * Supabase deja de enviar los correos de autenticación y llama aquí; nosotros
 * los mandamos por la API HTTP de Resend. Así se evita configurar SMTP y, de
 * paso, el límite de ~2 correos/hora del servidor prestado de Supabase.
 *
 * Esta ruta queda fuera del matcher del proxy: la autentica la firma del
 * webhook, no una sesión de usuario.
 */

type Payload = {
  user: { email: string; user_metadata?: { full_name?: string } };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
};

/** Texto de cada tipo de correo que manda Supabase. */
const PLANTILLAS: Record<
  string,
  { asunto: string; titulo: string; cuerpo: string; boton: string }
> = {
  signup: {
    asunto: "Confirma tu cuenta de parla",
    titulo: "Confirma tu cuenta",
    cuerpo:
      "Ya casi está. Pulsa el botón para confirmar tu correo y empezar a interpretar.",
    boton: "Confirmar cuenta",
  },
  recovery: {
    asunto: "Restablece tu contraseña de parla",
    titulo: "Restablece tu contraseña",
    cuerpo:
      "Pediste cambiar tu contraseña. Este enlace caduca en una hora. Si no fuiste tú, ignora este correo.",
    boton: "Elegir contraseña nueva",
  },
  magiclink: {
    asunto: "Tu enlace de acceso a parla",
    titulo: "Entra a parla",
    cuerpo: "Pulsa el botón para entrar. El enlace caduca en una hora.",
    boton: "Entrar",
  },
  email_change: {
    asunto: "Confirma tu nuevo correo en parla",
    titulo: "Confirma el cambio de correo",
    cuerpo: "Pulsa el botón para confirmar tu nueva dirección.",
    boton: "Confirmar correo",
  },
};

/**
 * Verifica la firma (estándar Standard Webhooks, el mismo que usa Supabase).
 * Sin esto, cualquiera podría llamar a esta ruta y provocar envíos.
 */
function firmaValida(
  secreto: string,
  id: string,
  timestamp: string,
  cuerpo: string,
  cabecera: string
): boolean {
  // El secreto viene como "v1,whsec_XXXX" o "whsec_XXXX"; la parte útil es
  // el base64 posterior al prefijo.
  const base64 = secreto.replace(/^v1,/, "").replace(/^whsec_/, "");
  const clave = Buffer.from(base64, "base64");

  const esperada = createHmac("sha256", clave)
    .update(`${id}.${timestamp}.${cuerpo}`)
    .digest("base64");

  // La cabecera puede traer varias firmas separadas por espacio ("v1,aaa v1,bbb").
  return cabecera.split(" ").some((parte) => {
    const recibida = parte.split(",")[1] ?? "";
    const a = Buffer.from(recibida);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

function plantillaHtml(
  enlace: string,
  t: (typeof PLANTILLAS)[string],
  nombre?: string
): string {
  const saludo = nombre ? `Hola, ${nombre}:` : "Hola:";
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:32px 16px;background:#f7f8f8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#16181d">
  <table role="presentation" style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid rgba(20,22,28,.08)">
    <tr><td style="padding:28px 28px 8px">
      <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:7px;background:rgba(13,125,116,.12);color:#0d7d74;font-weight:600">p</span>
      <span style="margin-left:8px;font-weight:600;letter-spacing:-.01em">parla</span>
    </td></tr>
    <tr><td style="padding:8px 28px 0">
      <h1 style="margin:0 0 6px;font-size:19px;letter-spacing:-.01em">${t.titulo}</h1>
      <p style="margin:0 0 4px;font-size:14px;color:#646a73">${saludo}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#646a73">${t.cuerpo}</p>
    </td></tr>
    <tr><td style="padding:22px 28px">
      <a href="${enlace}" style="display:inline-block;padding:12px 22px;border-radius:9px;background:#16181d;color:#fff;text-decoration:none;font-size:14px;font-weight:600">${t.boton}</a>
    </td></tr>
    <tr><td style="padding:0 28px 26px">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa0a8">
        Si el botón no funciona, copia esta dirección:<br>
        <span style="word-break:break-all;color:#646a73">${enlace}</span>
      </p>
    </td></tr>
    <tr><td style="padding:14px 28px;border-top:1px solid rgba(20,22,28,.08)">
      <p style="margin:0;font-size:11px;color:#9aa0a8">parla · interpretación médica ES ⇄ EN</p>
    </td></tr>
  </table>
</body></html>`;
}

export async function POST(req: Request) {
  const secreto = process.env.SUPABASE_EMAIL_HOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const remitente = process.env.EMAIL_REMITENTE;

  if (!secreto || !resendKey || !remitente) {
    console.error(
      "Faltan SUPABASE_EMAIL_HOOK_SECRET, RESEND_API_KEY o EMAIL_REMITENTE."
    );
    return NextResponse.json({ error: "No configurado." }, { status: 500 });
  }

  // La firma se calcula sobre el cuerpo crudo: parsear antes la invalidaría.
  const cuerpo = await req.text();
  const id = req.headers.get("webhook-id") ?? "";
  const ts = req.headers.get("webhook-timestamp") ?? "";
  const firma = req.headers.get("webhook-signature") ?? "";

  if (!id || !ts || !firma || !firmaValida(secreto, id, ts, cuerpo, firma)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let datos: Payload;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const { user, email_data: ed } = datos;
  const plantilla = PLANTILLAS[ed.email_action_type] ?? PLANTILLAS.signup;

  // El enlace apunta al verificador de Supabase, que canjea el token y luego
  // redirige a nuestra app.
  const enlace =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify` +
    `?token=${encodeURIComponent(ed.token_hash)}` +
    `&type=${encodeURIComponent(ed.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(ed.redirect_to)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `parla <${remitente}>`,
      to: [user.email],
      subject: plantilla.asunto,
      html: plantillaHtml(enlace, plantilla, user.user_metadata?.full_name),
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    console.error("Resend rechazó el envío:", res.status, detalle);
    // Un 500 hace que Supabase informe del fallo en vez de dar el alta por
    // buena dejando al usuario sin su correo.
    return NextResponse.json({ error: "No se pudo enviar." }, { status: 500 });
  }

  return NextResponse.json({});
}
