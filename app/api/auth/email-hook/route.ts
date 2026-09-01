import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { sitioDe, type Sitio } from "./sitios";

export const dynamic = "force-dynamic";
// SMTP necesita sockets: no funciona en el runtime edge.
export const runtime = "nodejs";

/**
 * Send Email Hook de Supabase.
 *
 * Supabase deja de enviar los correos de autenticación y llama aquí. Se hace
 * así y no con las plantillas de Supabase por una razón concreta: el proyecto
 * de Supabase es UNO y lo comparten parla, examia y autoreel, pero sus
 * plantillas también son una sola. Este hook es el único sitio donde el correo
 * puede llevar la marca del producto en el que la persona se está registrando.
 *
 * Sin eso -y así estuvo- quien creaba una cuenta en examia recibía un correo
 * que decía "Confirma tu cuenta de parla". El sitio se deduce del host de
 * `redirect_to` (ver `sitios.ts`).
 *
 * El envío va por el SMTP de Brevo, el mismo que tiene configurado el proyecto
 * de Supabase para cuando este hook no está.
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
  sitio: Sitio,
  t: Sitio["textos"][keyof Sitio["textos"]],
  nombre?: string
): string {
  const saludo = nombre ? `Hola, ${nombre}:` : "Hola:";
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:32px 16px;background:#f7f8f8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#16181d">
  <table role="presentation" style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid rgba(20,22,28,.08)">
    <tr><td style="padding:28px 28px 8px">
      <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:7px;background:${sitio.acentoSuave};color:${sitio.acento};font-weight:600">${sitio.inicial}</span>
      <span style="margin-left:8px;font-weight:600;letter-spacing:-.01em">${sitio.nombre}</span>
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
      <p style="margin:0;font-size:11px;color:#9aa0a8">${sitio.nombre} · ${sitio.pie}</p>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * El transporte SMTP, creado una vez por instancia.
 *
 * Sin tocar la verificación TLS, y esto tiene historia. Al probar las
 * credenciales desde Bogotá, el relay de Brevo sirvió un certificado de
 * `smtp-relay-offshore-southamerica-east-v2.sendinblue.com`, cuyos nombres
 * alternativos NO incluyen `smtp-relay.brevo.com`. La conclusión fácil era que
 * hay que verificar contra el nombre viejo, y así se escribió.
 *
 * En producción reventó: desde us-east, que es donde corre esta función, Brevo
 * sirve `smtp-relay-offshore-us-east1-v2.brevo.com`, y ese SÍ incluye
 * `smtp-relay.brevo.com`. O sea que el certificado depende de la región, y el
 * apaño que arreglaba la prueba local era exactamente lo que rompía el envío
 * real.
 *
 * Lo correcto es no forzar nada: se verifica contra el host al que se conecta,
 * que es lo que hace nodemailer por su cuenta.
 */
let transporte: nodemailer.Transporter | null = null;

function smtp(usuario: string, clave: string) {
  transporte ??= nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST ?? "smtp-relay.brevo.com",
    port: Number(process.env.BREVO_SMTP_PORT ?? 587),
    secure: false,
    auth: { user: usuario, pass: clave },
  });
  return transporte;
}

export async function POST(req: Request) {
  const secreto = process.env.SUPABASE_EMAIL_HOOK_SECRET;
  const smtpUser = process.env.BREVO_SMTP_USER;
  const smtpPass = process.env.BREVO_SMTP_PASS;
  const remitente = process.env.EMAIL_REMITENTE;

  if (!secreto || !smtpUser || !smtpPass || !remitente) {
    console.error(
      "Faltan SUPABASE_EMAIL_HOOK_SECRET, BREVO_SMTP_USER, BREVO_SMTP_PASS o EMAIL_REMITENTE."
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
  // De qué sitio de la zona es este correo. Lo dice a dónde vuelve el enlace.
  const sitio = sitioDe(ed.redirect_to);
  const tipo = ed.email_action_type as keyof Sitio["textos"];
  const plantilla = sitio.textos[tipo] ?? sitio.textos.signup;

  // El enlace apunta al verificador de Supabase, que canjea el token y luego
  // redirige a nuestra app.
  const enlace =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify` +
    `?token=${encodeURIComponent(ed.token_hash)}` +
    `&type=${encodeURIComponent(ed.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(ed.redirect_to)}`;

  try {
    await smtp(smtpUser, smtpPass).sendMail({
      // El nombre visible es el del producto; la dirección es la misma para
      // toda la zona, porque es la que está verificada en Brevo.
      from: `${sitio.nombre} <${remitente}>`,
      to: user.email,
      subject: plantilla.asunto,
      html: plantillaHtml(enlace, sitio, plantilla, user.user_metadata?.full_name),
    });
  } catch (err) {
    console.error("Brevo rechazó el envío:", err);
    // Un 500 hace que Supabase informe del fallo en vez de dar el alta por
    // buena dejando al usuario sin su correo.
    return NextResponse.json({ error: "No se pudo enviar." }, { status: 500 });
  }

  return NextResponse.json({});
}
