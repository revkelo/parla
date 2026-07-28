/**
 * Lee y cambia la configuración de autenticación del proyecto de Supabase.
 *
 *   npm run supabase:auth                      # ver el estado actual
 *   npm run supabase:auth -- --sin-confirmacion  # desactivar confirmación por correo
 *   npm run supabase:auth -- --con-confirmacion  # volver a activarla
 *
 * Necesita SUPABASE_ACCESS_TOKEN (un personal access token de
 * https://supabase.com/dashboard/account/tokens). No es la service role key:
 * la clave del proyecto no puede tocar ajustes del proyecto.
 */

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    "Falta SUPABASE_ACCESS_TOKEN.\n" +
      "Crea uno en https://supabase.com/dashboard/account/tokens y añádelo a .env.local"
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
const API = `https://api.supabase.com/v1/projects/${ref}/config/auth`;

async function pedir(method: "GET" | "PATCH", body?: unknown) {
  const res = await fetch(API, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} · ${await res.text()}`);
  }
  return res.json();
}

function estado(c: Record<string, unknown>) {
  console.log(`  proyecto:                    ${ref}`);
  console.log(`  confirmación por correo:     ${c.mailer_autoconfirm ? "DESACTIVADA (entran directo)" : "ACTIVADA (necesita correo)"}`);
  console.log(`  registro abierto:            ${c.disable_signup ? "NO" : "sí"}`);
  console.log(`  hook de correo propio:       ${c.hook_send_email_enabled ? c.hook_send_email_uri : "no"}`);
  console.log(`  SMTP propio:                 ${c.smtp_host ? c.smtp_host : "no (usa el de cortesía, ~2 correos/hora)"}`);
  console.log(`  mínimo de contraseña:        ${c.password_min_length ?? "?"}`);
}

/**
 * Configura un SMTP propio y activa la confirmación en el mismo paso: no tiene
 * sentido exigir confirmación sin poder enviar el correo, así que van juntos.
 * Lee las credenciales de variables de entorno para no dejarlas en el historial.
 */
async function configurarSmtp() {
  // Brevo por defecto: es el proveedor elegido. Se puede apuntar a cualquier
  // otro pasando SMTP_HOST.
  const host = process.env.SMTP_HOST ?? "smtp-relay.brevo.com";

  const faltan = ["SMTP_USER", "SMTP_PASS", "SMTP_SENDER"].filter(
    (k) => !process.env[k]
  );
  if (faltan.length) {
    console.error(`Faltan variables: ${faltan.join(", ")}`);
    console.error(
      "\nEjemplo (Brevo):\n" +
        "  SMTP_USER=<login SMTP> SMTP_PASS=<clave SMTP> \\\n" +
        "  SMTP_SENDER=tu@correo.com \\\n" +
        "  npm run supabase:auth -- --smtp"
    );
    process.exit(1);
  }

  console.log(`Configurando SMTP (${host}) y activando la confirmación…\n`);
  const c = await pedir("PATCH", {
    smtp_host: host,
    smtp_port: Number(process.env.SMTP_PORT ?? 587),
    smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS,
    smtp_admin_email: process.env.SMTP_SENDER,
    smtp_sender_name: process.env.SMTP_SENDER_NAME ?? "parla",
    // Sin esto Supabase sigue limitando envíos como si fuera el SMTP prestado.
    smtp_max_frequency: 10,
    mailer_autoconfirm: false,
  });
  estado(c);
  console.log("\nListo: los correos salen por tu SMTP y hay que confirmar la cuenta.");
}

/**
 * Activa el Send Email Hook: Supabase deja de enviar correos y llama a nuestra
 * ruta, que los manda por la API de Brevo. Evita configurar SMTP y el límite
 * de ~2 correos/hora del servidor prestado.
 */
async function configurarHook() {
  const uri = process.env.EMAIL_HOOK_URI;
  const secreto = process.env.SUPABASE_EMAIL_HOOK_SECRET;

  if (!uri || !secreto) {
    console.error("Faltan EMAIL_HOOK_URI y/o SUPABASE_EMAIL_HOOK_SECRET.");
    console.error(
      "\nEjemplo:\n" +
        "  EMAIL_HOOK_URI=https://tu-app.vercel.app/api/auth/email-hook \\\n" +
        "  SUPABASE_EMAIL_HOOK_SECRET=v1,whsec_... \\\n" +
        "  npm run supabase:auth -- --hook"
    );
    process.exit(1);
  }

  console.log(`Activando el hook de correo → ${uri}\n`);
  const c = await pedir("PATCH", {
    hook_send_email_enabled: true,
    hook_send_email_uri: uri,
    hook_send_email_secrets: secreto,
    // Con envío propio ya no hay motivo para saltarse la confirmación.
    mailer_autoconfirm: false,
  });
  estado(c);
  console.log("\nListo: los correos salen por el hook y hay que confirmar la cuenta.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--hook")) {
    await configurarHook();
    return;
  }

  if (args.includes("--smtp")) {
    await configurarSmtp();
    return;
  }

  if (args.includes("--sin-confirmacion") || args.includes("--con-confirmacion")) {
    const autoconfirm = args.includes("--sin-confirmacion");
    console.log(
      autoconfirm
        ? "Desactivando la confirmación por correo…\n"
        : "Activando la confirmación por correo…\n"
    );
    const c = await pedir("PATCH", { mailer_autoconfirm: autoconfirm });
    estado(c);
    console.log(
      autoconfirm
        ? "\nListo: quien se registre entra directo, sin correo de por medio."
        : "\nListo: vuelve a hacer falta confirmar por correo (requiere SMTP propio)."
    );
    return;
  }

  console.log("Configuración actual:\n");
  estado(await pedir("GET"));
  console.log(
    "\nPara desactivar la confirmación:  npm run supabase:auth -- --sin-confirmacion"
  );
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
