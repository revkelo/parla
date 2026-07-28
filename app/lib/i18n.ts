/**
 * Textos de la interfaz en español e inglés.
 *
 * Parla es un producto ES⇄EN: la mitad de sus usuarios trabaja en hospitales de
 * Estados Unidos y piensa en inglés. Obligarles a manejar la aplicación en
 * español es pedirles que traduzcan la herramienta antes de poder traducir a un
 * paciente.
 *
 * El módulo es puro a propósito: lo importan componentes de cliente y de
 * servidor por igual. La lectura de la cookie vive en `idioma-servidor.ts`,
 * que sí depende de `next/headers`.
 *
 * `Textos` se deriva del castellano, así que si se añade una clave allí y se
 * olvida en inglés, el proyecto no compila.
 */

export const IDIOMAS = ["es", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_POR_DEFECTO: Idioma = "es";
export const COOKIE_IDIOMA = "parla-idioma";

export const NOMBRE_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  en: "English",
};

const es = {
  comun: {
    abrirParla: "Abrir parla",
    volver: "Volver",
    guardar: "Guardar",
    guardando: "Guardando…",
    guardado: "Guardado",
    cancelar: "Cancelar",
    cerrarSesion: "Cerrar sesión",
    tuCuenta: "Tu cuenta",
    administracion: "Administración",
    minutos: "minutos",
    min: "min",
    turno: "turno",
    turnos: "turnos",
    sesion: "sesión",
    sesiones: "sesiones",
    aviso:
      "Herramienta de asistencia. No sustituye a un intérprete certificado para decisiones clínicas críticas.",
  },

  app: {
    nuevaConsulta: "Nueva consulta",
    sinConsultas: "Tus consultas aparecerán aquí en cuanto interpretes la primera.",
    hoy: "Hoy",
    ayer: "Ayer",
    ultimos7: "Últimos 7 días",
    antes: "Antes",
    plan: "Plan",
    ampliarPlan: "Ampliar plan →",
    cerrarMenu: "Cerrar el menú",
    enEspera: "En espera",
    pulsaIniciar: "Pulsa",
    yHabla: "y habla con naturalidad.",
    idiomaSolo: "El idioma se detecta solo, en ambos sentidos.",
    atajo: "empieza y termina",
    tecla: "espacio",
    seGuardara: "Esta consulta se guardará en tu historial.",
    noSeGuardara: "El historial está desactivado: esta consulta no se guardará.",
    iniciar: "Iniciar",
    reanudar: "Reanudar",
    continuar: "Continuar consulta",
    finalizar: "Finalizar",
    conectando: "Conectando…",
    listoParaEmpezar: "listo para empezar",
    sigueDondeLoDejaste: "sigue donde lo dejaste",
    sinMinutosDisponibles: "sin minutos disponibles",
    irUltimoTurno: "↓ Ir al último turno",
    escuchando: "Escuchando",
    limpiar: "Limpiar",
    copiar: "Copiar",
    copiado: "copiado",
    descargar: "Descargar",
    borrar: "Borrar",
    respaldo: "Transcripción de respaldo: la precisión puede bajar.",
    avisoMinutos: "Te quedan {n} minutos este período.",
    sinMinutosTitulo: "Agotaste los {n} minutos del plan {plan}.",
    sinMinutosCuerpo:
      "Tus consultas anteriores siguen guardadas. Amplía el plan para volver a interpretar ahora mismo, o espera al próximo período.",
    verPlanes: "Ver planes",
    sinMinutos: "Sin minutos",
    copiarTurno: "Copiar esta interpretación",
  },

  ajustes: {
    titulo: "Ajustes",
    tamano: "Tamaño del texto",
    guardarHistorial: "Guardar en el historial",
    guardarHistorialPie:
      "Las consultas quedan en tu cuenta para consultarlas después.",
    seguir: "Seguir el último turno",
    seguirPie: "Baja sola al llegar texto nuevo.",
    idioma: "Idioma de la interfaz",
    motores: "Motores · cuenta de pruebas",
    motoresPie: "Déjalo en automático salvo que estés comparando calidad.",
    transcripcion: "Transcripción",
    interpretacion: "Interpretación",
    seAplicaAlIniciar: "se aplica al iniciar",
    seAplicaSiguiente: "se aplica al siguiente turno",
    automatico: "Automático",
  },

  cuenta: {
    titulo: "Tu cuenta",
    perfil: "Perfil",
    nombre: "Nombre",
    nombrePie: "Es el nombre que aparece en tu cuenta.",
    correo: "Correo",
    correoPie: "No se puede cambiar desde aquí.",
    miembroDesde: "Miembro desde",
    consumo: "Consumo del período",
    consumoDe: "{usados} de {limite} min",
    restantes: "Te quedan {n} minutos este período.",
    restantesPocos: "Te quedan solo {n} minutos este período.",
    agotados: "Se agotaron tus minutos de este período.",
    seRenueva: "Se renueva el {fecha}",
    seCancela: "Se cancela el {fecha}",
    pagoPendiente: "pago pendiente",
    facturacion: "Facturación",
    gestionar: "Gestionar suscripción",
    gestionarPie:
      "Cambia de plan, actualiza la tarjeta o cancela desde el portal de Stripe.",
    ampliar: "Ampliar plan",
    ampliarPie: "Más minutos al mes, sin permanencia.",
    elegirPlan: "Elegir plan",
    porMes: "/mes",
    minMes: "min/mes",
    ultimasSesiones: "Últimas consultas",
    sinSesiones: "Todavía no tienes consultas.",
    verHistorial: "Ver el historial completo →",
    preferencias: "Preferencias",
    idiomaPie: "Cambia el idioma de toda la aplicación.",
  },

  portada: {
    guia: "Guía",
    precios: "Precios",
    entrar: "Entrar",
    empezarGratis: "Empezar gratis",
    eyebrow: "Interpretación médica en vivo",
    lede: "Para intérpretes médicos, hospitales y clínicas. Terminología clínica precisa, acrónimos expandidos, dosis, cifras y nombres intactos — sin resumir, omitir ni explicar.",
    pruebaSinTarjeta: "{n} minutos de prueba · sin tarjeta",
    pruebaSinTarjetaSimple: "Prueba gratis · sin tarjeta",
    leyendaCursiva: "cursiva",
    leyendaResto: " · lo que se pronunció · consulta de cardiología",
    reglasTitulo: "Las reglas del oficio, respetadas",
    regla1: "Interpreta, no responde",
    regla1d: "Si el paciente pregunta algo, se interpreta la pregunta. Nunca se contesta por nadie.",
    regla2: "Conserva el contexto",
    regla2d: "Cada turno conoce los anteriores: resuelve pronombres, género y respuestas de una palabra.",
    regla3: "Respeta el registro",
    regla3d: "Si el médico habla llano, la salida va llana. No sube el lenguaje a jerga clínica.",
    preciosTitulo: "Precios",
    preciosPie: "Minutos de interpretación en vivo, por mes. Sin permanencia.",
    gratis: "Gratis",
    minAlMes: "{n} min al mes",
    horas: "~{n} h",
    elegirPlan: "Elegir plan",
    pitchFree: "Para oír la calidad antes de decidir.",
    pitchPro: "Para quien interpreta todos los días.",
    pitchScale: "Para jornada completa y turnos largos.",
    docEtiqueta: "Documentación",
    docTitulo: "Cómo usar parla",
    docPie: "Tu primera consulta paso a paso, cómo hablar para que interprete mejor, el historial, los minutos y la privacidad. Sin tecnicismos.",
    docEnlace: "Leer la guía",
    preguntasTitulo: "Preguntas",
    p1: "¿Sustituye a un intérprete certificado?",
    r1: "No. Parla asiste. Para decisiones clínicas críticas, consentimientos y situaciones de riesgo sigue haciendo falta un intérprete certificado.",
    p2: "¿Quién puede leer lo que se dice?",
    r2: "Solo tú. Las transcripciones no son accesibles ni para quien administra la plataforma: la política de acceso no tiene excepción para administradores.",
    p3: "¿Y si se acaban los minutos a mitad de consulta?",
    r3: "El aviso llega cuando quedan pocos, no al agotarlos. Al llegar a cero se detiene la sesión, pero nada de lo transcrito se pierde.",
    p4: "¿Hay que instalar algo?",
    r4: "No. Funciona en el navegador con el micrófono del equipo, también en móvil.",
    pieMarca: "parla · interpretación médica es ⇄ en",
    pieGuia: "Guía de uso",
  },

  historial: {
    titulo: "Historial",
    consulta: "consulta",
    consultas: "consultas",
    vacioTitulo: "Todavía no hay consultas guardadas.",
    vacioCuerpo:
      "Cada consulta que interpretes queda aquí con sus turnos, para releerla o descargarla después.",
    empezar: "Empezar una consulta",
    sinCerrar: "sin cerrar",
    sinTitulo: "Consulta sin título",
    sinTurnos: "Esta consulta no tiene turnos guardados.",
    confirmarBorrado: "Sí, borrar",
    borrando: "Borrando…",
  },
};

// Sin `as const`: con él cada texto sería un tipo literal ("Abrir parla" en vez
// de string) y el inglés no encajaría en `Textos`. Sin él, TypeScript sigue
// exigiendo que la traducción tenga exactamente las mismas claves, que es la
// comprobación que interesa.
export type Textos = typeof es;

const en: Textos = {
  comun: {
    abrirParla: "Open parla",
    volver: "Back",
    guardar: "Save",
    guardando: "Saving…",
    guardado: "Saved",
    cancelar: "Cancel",
    cerrarSesion: "Sign out",
    tuCuenta: "Your account",
    administracion: "Admin",
    minutos: "minutes",
    min: "min",
    turno: "turn",
    turnos: "turns",
    sesion: "session",
    sesiones: "sessions",
    aviso:
      "An assistive tool. It does not replace a certified interpreter for critical clinical decisions.",
  },

  app: {
    nuevaConsulta: "New encounter",
    sinConsultas: "Your encounters will show up here after your first one.",
    hoy: "Today",
    ayer: "Yesterday",
    ultimos7: "Last 7 days",
    antes: "Earlier",
    plan: "Plan",
    ampliarPlan: "Upgrade plan →",
    cerrarMenu: "Close menu",
    enEspera: "Standing by",
    pulsaIniciar: "Press",
    yHabla: "and speak naturally.",
    idiomaSolo: "The language is detected automatically, both ways.",
    atajo: "starts and stops",
    tecla: "space",
    seGuardara: "This encounter will be saved to your history.",
    noSeGuardara: "History is off: this encounter won't be saved.",
    iniciar: "Start",
    reanudar: "Resume",
    continuar: "Continue encounter",
    finalizar: "End",
    conectando: "Connecting…",
    listoParaEmpezar: "ready to start",
    sigueDondeLoDejaste: "pick up where you left off",
    sinMinutosDisponibles: "no minutes left",
    irUltimoTurno: "↓ Go to latest turn",
    escuchando: "Listening",
    limpiar: "Clear",
    copiar: "Copy",
    copiado: "copied",
    descargar: "Download",
    borrar: "Delete",
    respaldo: "Backup transcription: accuracy may drop.",
    avisoMinutos: "You have {n} minutes left this period.",
    sinMinutosTitulo: "You've used all {n} minutes on the {plan} plan.",
    sinMinutosCuerpo:
      "Your earlier encounters are still saved. Upgrade to keep interpreting right now, or wait for the next period.",
    verPlanes: "See plans",
    sinMinutos: "No minutes",
    copiarTurno: "Copy this interpretation",
  },

  ajustes: {
    titulo: "Settings",
    tamano: "Text size",
    guardarHistorial: "Save to history",
    guardarHistorialPie: "Encounters stay in your account so you can revisit them.",
    seguir: "Follow the latest turn",
    seguirPie: "Scrolls down as new text arrives.",
    idioma: "Interface language",
    motores: "Engines · test account",
    motoresPie: "Leave on automatic unless you're comparing quality.",
    transcripcion: "Transcription",
    interpretacion: "Interpretation",
    seAplicaAlIniciar: "applies when you start",
    seAplicaSiguiente: "applies to the next turn",
    automatico: "Automatic",
  },

  cuenta: {
    titulo: "Your account",
    perfil: "Profile",
    nombre: "Name",
    nombrePie: "This is the name shown on your account.",
    correo: "Email",
    correoPie: "This can't be changed here.",
    miembroDesde: "Member since",
    consumo: "Usage this period",
    consumoDe: "{usados} of {limite} min",
    restantes: "You have {n} minutes left this period.",
    restantesPocos: "You have only {n} minutes left this period.",
    agotados: "You've used all your minutes for this period.",
    seRenueva: "Renews on {fecha}",
    seCancela: "Cancels on {fecha}",
    pagoPendiente: "payment due",
    facturacion: "Billing",
    gestionar: "Manage subscription",
    gestionarPie:
      "Change plan, update your card or cancel from the Stripe portal.",
    ampliar: "Upgrade plan",
    ampliarPie: "More minutes each month, cancel anytime.",
    elegirPlan: "Choose plan",
    porMes: "/mo",
    minMes: "min/mo",
    ultimasSesiones: "Recent encounters",
    sinSesiones: "You don't have any encounters yet.",
    verHistorial: "See full history →",
    preferencias: "Preferences",
    idiomaPie: "Changes the language across the whole app.",
  },

  portada: {
    guia: "Guide",
    precios: "Pricing",
    entrar: "Sign in",
    empezarGratis: "Start free",
    eyebrow: "Live medical interpreting",
    lede: "For medical interpreters, hospitals and clinics. Precise clinical terminology, expanded acronyms, doses, figures and names untouched — nothing summarized, dropped or explained away.",
    pruebaSinTarjeta: "{n} trial minutes · no card",
    pruebaSinTarjetaSimple: "Free trial · no card",
    leyendaCursiva: "italics",
    leyendaResto: " · what was actually spoken · cardiology visit",
    reglasTitulo: "The rules of the craft, respected",
    regla1: "It interprets, it doesn't answer",
    regla1d: "If the patient asks something, the question gets interpreted. It never answers on anyone's behalf.",
    regla2: "It keeps the context",
    regla2d: "Every turn knows the ones before it: pronouns, gender and one-word answers all resolve.",
    regla3: "It matches the register",
    regla3d: "If the doctor speaks plainly, the output stays plain. It doesn't upgrade language into clinical jargon.",
    preciosTitulo: "Pricing",
    preciosPie: "Live interpreting minutes, per month. Cancel anytime.",
    gratis: "Free",
    minAlMes: "{n} min per month",
    horas: "~{n} h",
    elegirPlan: "Choose plan",
    pitchFree: "To hear the quality before deciding.",
    pitchPro: "For anyone interpreting every day.",
    pitchScale: "For full days and long shifts.",
    docEtiqueta: "Documentation",
    docTitulo: "How to use parla",
    docPie: "Your first encounter step by step, how to speak for better interpretation, history, minutes and privacy. No jargon.",
    docEnlace: "Read the guide",
    preguntasTitulo: "Questions",
    p1: "Does it replace a certified interpreter?",
    r1: "No. Parla assists. For critical clinical decisions, informed consent and high-risk situations you still need a certified interpreter.",
    p2: "Who can read what's said?",
    r2: "Only you. Transcriptions aren't accessible even to the people running the platform: the access policy has no exception for administrators.",
    p3: "What if minutes run out mid-encounter?",
    r3: "The warning comes when few are left, not when they're gone. At zero the session stops, but nothing already transcribed is lost.",
    p4: "Is there anything to install?",
    r4: "No. It runs in the browser with your device's microphone, on mobile too.",
    pieMarca: "parla · medical interpreting es ⇄ en",
    pieGuia: "User guide",
  },

  historial: {
    titulo: "History",
    consulta: "encounter",
    consultas: "encounters",
    vacioTitulo: "No saved encounters yet.",
    vacioCuerpo:
      "Every encounter you interpret is kept here with its turns, so you can revisit or download it later.",
    empezar: "Start an encounter",
    sinCerrar: "still open",
    sinTitulo: "Untitled encounter",
    sinTurnos: "This encounter has no saved turns.",
    confirmarBorrado: "Yes, delete",
    borrando: "Deleting…",
  },
};

export const DICCIONARIO: Record<Idioma, Textos> = { es, en };

export function textosDe(idioma: Idioma): Textos {
  return DICCIONARIO[idioma] ?? DICCIONARIO[IDIOMA_POR_DEFECTO];
}

export function esIdioma(v: unknown): v is Idioma {
  return typeof v === "string" && (IDIOMAS as readonly string[]).includes(v);
}

/** Sustituye `{clave}` por su valor. Sin librería: son cuatro plantillas. */
export function fmt(
  plantilla: string,
  valores: Record<string, string | number>
): string {
  return plantilla.replace(/\{(\w+)\}/g, (_, k) =>
    k in valores ? String(valores[k]) : `{${k}}`
  );
}

/** Locale completo para fechas y números. */
export const LOCALE: Record<Idioma, string> = { es: "es", en: "en-US" };
