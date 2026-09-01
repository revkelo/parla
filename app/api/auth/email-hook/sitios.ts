/**
 * Quién manda cada correo de la zona.
 *
 * Los sitios con cuenta comparten `auth.users`, así que comparten también el
 * Send Email Hook: un solo endpoint recibe los correos de todos. Sin esta
 * tabla, ese endpoint mandaba el correo de parla a todo el mundo, y quien se
 * registraba en examia recibía "Confirma tu cuenta de parla".
 *
 * El sitio se deduce del host de `redirect_to`, que Supabase incluye en el
 * payload y que apunta siempre al sitio donde la persona está registrándose.
 */

export interface Sitio {
  nombre: string;
  /** La letra del cuadrito de la cabecera */
  inicial: string;
  /** Color de marca, en hex */
  acento: string;
  /** Fondo del cuadrito de la inicial, en rgba */
  acentoSuave: string;
  /** Lo que va en el pie, después del nombre */
  pie: string;
  /** Textos por tipo de correo */
  textos: Record<
    "signup" | "recovery" | "magiclink" | "email_change",
    { asunto: string; titulo: string; cuerpo: string; boton: string }
  >;
}

function textos(producto: string, promesa: string): Sitio["textos"] {
  return {
    signup: {
      asunto: `Confirma tu cuenta de ${producto}`,
      titulo: "Confirma tu cuenta",
      cuerpo: `Ya casi está. Pulsa el botón para confirmar tu correo y ${promesa}.`,
      boton: "Confirmar cuenta",
    },
    recovery: {
      asunto: `Restablece tu contraseña de ${producto}`,
      titulo: "Restablece tu contraseña",
      cuerpo:
        "Pediste cambiar tu contraseña. Este enlace caduca en una hora. Si no fuiste tú, ignora este correo.",
      boton: "Elegir contraseña nueva",
    },
    magiclink: {
      asunto: `Tu enlace de acceso a ${producto}`,
      titulo: `Entra a ${producto}`,
      cuerpo: "Pulsa el botón para entrar. El enlace caduca en una hora.",
      boton: "Entrar",
    },
    email_change: {
      asunto: `Confirma tu nuevo correo en ${producto}`,
      titulo: "Confirma el cambio de correo",
      cuerpo: "Pulsa el botón para confirmar tu nueva dirección.",
      boton: "Confirmar correo",
    },
  };
}

const SITIOS: Record<string, Sitio> = {
  "parla.kgstudio.top": {
    nombre: "parla",
    inicial: "p",
    acento: "#0d7d74",
    acentoSuave: "rgba(13,125,116,.12)",
    pie: "interpretación médica ES ⇄ EN",
    textos: textos("parla", "empezar a interpretar"),
  },
  "examia.kgstudio.top": {
    nombre: "examia",
    inicial: "e",
    acento: "#2563eb",
    acentoSuave: "rgba(37,99,235,.12)",
    pie: "simulacros de certificación",
    textos: textos("examia", "empezar a practicar"),
  },
  "autoreel.kgstudio.top": {
    nombre: "Autoreel",
    inicial: "A",
    acento: "#8b5cf6",
    acentoSuave: "rgba(139,92,246,.14)",
    pie: "video vertical para TikTok, Reels y Shorts",
    textos: textos("Autoreel", "empezar a crear videos"),
  },
};

/**
 * El sitio al que pertenece este correo.
 *
 * Si el host no está en la tabla -una preview de Vercel, un dominio nuevo- se
 * usa parla, que es el remitente histórico. Devolver algo genérico sería peor:
 * un correo sin marca parece phishing.
 */
export function sitioDe(redirectTo: string): Sitio {
  try {
    const host = new URL(redirectTo).host;
    if (SITIOS[host]) return SITIOS[host];
    // Las previews llevan el nombre del proyecto delante: autoreel-xxx.vercel.app
    for (const [dominio, sitio] of Object.entries(SITIOS)) {
      const producto = dominio.split(".")[0];
      if (host.startsWith(`${producto}-`) || host === producto) return sitio;
    }
  } catch {
    // redirect_to vacío o mal formado: se cae al remitente por defecto
  }
  return SITIOS["parla.kgstudio.top"];
}
