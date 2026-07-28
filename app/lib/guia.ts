import type { Idioma } from "./i18n";

/**
 * La guía de uso de parla.
 *
 * Es documentación de PRODUCTO, no técnica: explica cómo trabajar con la
 * herramienta en una consulta real. A propósito no aparece ni un nombre de
 * proveedor, ni una ruta de API, ni nada de cómo está construida por dentro —
 * eso es interno y además no le sirve de nada a quien está interpretando.
 *
 * El contenido vive aquí y no en `i18n.ts` porque son párrafos largos: mezclarlo
 * con los rótulos de la interfaz haría ilegibles los dos.
 */

export type Bloque =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "pasos"; items: string[] }
  | { tipo: "lista"; items: string[] }
  | { tipo: "consejo"; texto: string }
  | { tipo: "aviso"; texto: string };

export type Seccion = {
  id: string;
  titulo: string;
  bloques: Bloque[];
};

export type Guia = {
  titulo: string;
  entradilla: string;
  indice: string;
  secciones: Seccion[];
};

const es: Guia = {
  titulo: "Cómo usar parla",
  entradilla:
    "Todo lo que necesitas para interpretar tu primera consulta y sacarle partido a la herramienta. No hace falta instalar nada ni saber de tecnología.",
  indice: "En esta guía",
  secciones: [
    {
      id: "que-es",
      titulo: "Qué es parla",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Parla escucha una conversación entre dos personas que no hablan el mismo idioma y la interpreta al vuelo, español ⇄ inglés. Cada intervención aparece en pantalla en el otro idioma en cuanto quien habla termina la frase, lista para leerla en voz alta.",
        },
        {
          tipo: "parrafo",
          texto:
            "Está pensada para consultas médicas: respeta la terminología clínica, mantiene las dosis y las cifras exactas, expande los acrónimos y no resume ni omite nada. Interpreta lo que se dice; nunca contesta por nadie.",
        },
        {
          tipo: "aviso",
          texto:
            "Parla es una herramienta de asistencia. No sustituye a un intérprete médico certificado en decisiones clínicas críticas, consentimientos informados ni situaciones de riesgo.",
        },
      ],
    },
    {
      id: "antes-de-empezar",
      titulo: "Antes de empezar",
      bloques: [
        {
          tipo: "lista",
          items: [
            "Un navegador actual en ordenador, tablet o móvil. No hay nada que instalar.",
            "Permiso de micrófono: la primera vez el navegador te lo pedirá. Hay que aceptarlo para que parla pueda oír.",
            "Un sitio lo más silencioso posible. El ruido de fondo es lo que más estropea la transcripción.",
            "El dispositivo entre las dos personas, o más cerca de quien habla más bajo.",
          ],
        },
        {
          tipo: "consejo",
          texto:
            "Si usas auriculares con micrófono, colócalo de forma que recoja a las dos personas por igual. Un micrófono pegado a la boca de una sola capta mal a la otra.",
        },
      ],
    },
    {
      id: "primera-consulta",
      titulo: "Tu primera consulta",
      bloques: [
        {
          tipo: "pasos",
          items: [
            "Entra en parla y pulsa «Nueva consulta».",
            "Pulsa el botón «Iniciar». También puedes usar la barra espaciadora.",
            "Acepta el permiso de micrófono si el navegador lo pide.",
            "Hablad con naturalidad, por turnos. No hace falta indicar en qué idioma se habla: se detecta solo, en los dos sentidos.",
            "Cada intervención aparece con el original arriba en cursiva y la interpretación debajo. Lee la interpretación en voz alta.",
            "Al terminar, pulsa «Finalizar» (o la barra espaciadora otra vez).",
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "La consulta queda guardada en tu historial con todos sus turnos. Puedes volver a ella cuando quieras.",
        },
      ],
    },
    {
      id: "hablar-bien",
      titulo: "Cómo hablar para que interprete mejor",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "La calidad depende sobre todo de cómo se habla. Estas cuatro costumbres marcan la diferencia:",
        },
        {
          tipo: "lista",
          items: [
            "Frases completas. «Me duele» y «aquí, en el pecho» por separado dan dos interpretaciones sueltas; dicho de corrido, una sola y correcta.",
            "Un turno cada vez. Si las dos personas hablan a la vez, parla oye una mezcla y la transcripción se resiente.",
            "Una pausa corta al terminar. Es la señal de que el turno acabó; sin ella, la frase puede cortarse por la mitad.",
            "Cifras y nombres despacio. Las dosis, las fechas y los apellidos son lo que más importa que salga exacto.",
          ],
        },
        {
          tipo: "consejo",
          texto:
            "Si una interpretación no te convence, dila corregida en voz alta y sigue. Parla tiene en cuenta los turnos anteriores, así que se ajusta al resto de la conversación.",
        },
      ],
    },
    {
      id: "durante",
      titulo: "Durante la consulta",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Abajo verás siempre el tiempo que llevas y cuántos turnos van. En la rueda de ajustes puedes cambiar cosas sin detener la sesión:",
        },
        {
          tipo: "lista",
          items: [
            "Tamaño del texto: agrándalo si lees de reojo o el dispositivo está lejos.",
            "Seguir el último turno: la pantalla baja sola al llegar texto nuevo. Desactívalo si quieres releer algo sin que te arrastre.",
            "Guardar en el historial: apágalo si prefieres que esta consulta no quede registrada.",
            "Idioma de la interfaz: español o inglés, al momento.",
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "Si en algún momento aparece un aviso de «transcripción de respaldo», parla ha cambiado a un segundo sistema de escucha porque el principal no estaba disponible. Sigue funcionando, pero la precisión puede bajar: habla algo más despacio hasta que desaparezca.",
        },
      ],
    },
    {
      id: "historial",
      titulo: "El historial",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Cada consulta queda en la lista de la izquierda, agrupada por fecha. Al abrir una verás todos sus turnos tal como ocurrieron.",
        },
        {
          tipo: "lista",
          items: [
            "Continuar: pulsa «Continuar consulta» y sigues en la misma, con el contexto de lo ya hablado. Útil cuando el paciente vuelve o la visita se interrumpe.",
            "Copiar: se lleva la conversación entera al portapapeles.",
            "Descargar: guarda un archivo de texto con las horas, los turnos y sus interpretaciones. Sirve como registro de la sesión.",
            "Borrar: elimina la consulta y sus turnos para siempre.",
          ],
        },
      ],
    },
    {
      id: "minutos",
      titulo: "Minutos y planes",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Tu plan incluye una cantidad de minutos al mes. Solo se descuentan mientras la sesión está escuchando: leer el historial, preparar la consulta o dejar parla abierto sin iniciar no consume nada.",
        },
        {
          tipo: "lista",
          items: [
            "En la barra lateral tienes siempre los minutos que te quedan.",
            "Cuando queden pocos verás un aviso, antes de agotarlos. Enterarse a mitad de una consulta es lo peor que puede pasar.",
            "Si llegas a cero, la sesión se detiene, pero nada de lo transcrito se pierde.",
            "Puedes ampliar el plan desde «Tu cuenta» y seguir al momento.",
          ],
        },
      ],
    },
    {
      id: "privacidad",
      titulo: "Privacidad",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Lo que se dice en una consulta es contenido clínico. Solo tú puedes leer tus transcripciones e interpretaciones: no son accesibles para el equipo que administra la plataforma, ni siquiera para un administrador.",
        },
        {
          tipo: "parrafo",
          texto:
            "Puedes descargar cualquier consulta para tus registros, o borrarla cuando quieras. Y si prefieres que una consulta no se guarde, apaga «Guardar en el historial» antes de empezar.",
        },
      ],
    },
    {
      id: "problemas",
      titulo: "Si algo no va",
      bloques: [
        {
          tipo: "lista",
          items: [
            "No aparece nada al hablar: revisa que el navegador tenga permiso de micrófono y que no esté silenciado. En el candado de la barra de direcciones puedes volver a darlo.",
            "Se corta a mitad de frase: suele ser una pausa larga dentro de la frase. Habla de corrido y haz la pausa al final.",
            "Se mezclan los idiomas en un mismo turno: dilo otra vez en un solo idioma; las frases mixtas son las más difíciles.",
            "Transcribe mal un nombre o una dosis: deletréalo o dilo más despacio. Son las palabras que menos contexto tienen para adivinarse.",
            "La sesión se detuvo sola: puede que se hayan agotado los minutos del plan. Míralo en la barra lateral.",
          ],
        },
      ],
    },
  ],
};

const en: Guia = {
  titulo: "How to use parla",
  entradilla:
    "Everything you need to interpret your first encounter and get the most out of the tool. Nothing to install, no technical know-how required.",
  indice: "In this guide",
  secciones: [
    {
      id: "que-es",
      titulo: "What parla is",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Parla listens to a conversation between two people who don't share a language and interprets it as it happens, Spanish ⇄ English. Each turn appears on screen in the other language as soon as the speaker finishes, ready to be read aloud.",
        },
        {
          tipo: "parrafo",
          texto:
            "It's built for medical encounters: it keeps clinical terminology, holds doses and figures exactly, expands acronyms, and never summarizes or leaves anything out. It interprets what is said; it never answers on anyone's behalf.",
        },
        {
          tipo: "aviso",
          texto:
            "Parla is an assistive tool. It does not replace a certified medical interpreter for critical clinical decisions, informed consent, or high-risk situations.",
        },
      ],
    },
    {
      id: "antes-de-empezar",
      titulo: "Before you start",
      bloques: [
        {
          tipo: "lista",
          items: [
            "A current browser on a computer, tablet or phone. There's nothing to install.",
            "Microphone permission: your browser will ask the first time. You need to allow it so parla can hear.",
            "As quiet a room as you can manage. Background noise is what hurts transcription most.",
            "The device between both people, or closer to whoever speaks more softly.",
          ],
        },
        {
          tipo: "consejo",
          texto:
            "If you use a headset, position the mic so it picks up both people evenly. A mic right against one person's mouth will barely hear the other.",
        },
      ],
    },
    {
      id: "primera-consulta",
      titulo: "Your first encounter",
      bloques: [
        {
          tipo: "pasos",
          items: [
            "Open parla and press “New encounter”.",
            "Press the “Start” button. The space bar works too.",
            "Allow microphone access if the browser asks.",
            "Speak naturally, taking turns. You don't need to say which language you're using: it's detected automatically, both ways.",
            "Each turn shows the original above in italics and the interpretation below. Read the interpretation aloud.",
            "When you're done, press “End” (or the space bar again).",
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "The encounter is saved to your history with all its turns. You can come back to it whenever you want.",
        },
      ],
    },
    {
      id: "hablar-bien",
      titulo: "How to speak for better interpretation",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Quality depends mostly on how people speak. These four habits make the difference:",
        },
        {
          tipo: "lista",
          items: [
            "Complete sentences. “It hurts” and “here, in my chest” said separately produce two disconnected interpretations; said in one go, a single correct one.",
            "One turn at a time. If both people talk at once, parla hears a blend and the transcription suffers.",
            "A short pause at the end. That's the signal that the turn is over; without it, a sentence can be cut in half.",
            "Numbers and names slowly. Doses, dates and last names are exactly what matters most to get right.",
          ],
        },
        {
          tipo: "consejo",
          texto:
            "If an interpretation doesn't convince you, say the corrected version aloud and carry on. Parla takes previous turns into account, so it adjusts to the rest of the conversation.",
        },
      ],
    },
    {
      id: "durante",
      titulo: "During the encounter",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "At the bottom you always see elapsed time and how many turns have gone by. From the settings gear you can change things without stopping the session:",
        },
        {
          tipo: "lista",
          items: [
            "Text size: make it bigger if you're reading out of the corner of your eye or the device is far away.",
            "Follow the latest turn: the screen scrolls down as new text arrives. Turn it off if you want to re-read something without being pulled away.",
            "Save to history: turn it off if you'd rather this encounter not be recorded.",
            "Interface language: Spanish or English, instantly.",
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "If a “backup transcription” notice appears, parla has switched to a second listening system because the main one wasn't available. It keeps working, but accuracy may drop: speak a little more slowly until it goes away.",
        },
      ],
    },
    {
      id: "historial",
      titulo: "Your history",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Every encounter stays in the list on the left, grouped by date. Opening one shows all its turns exactly as they happened.",
        },
        {
          tipo: "lista",
          items: [
            "Continue: press “Continue encounter” and you pick up in the same one, with the context of what was already said. Useful when a patient returns or a visit gets interrupted.",
            "Copy: puts the whole conversation on your clipboard.",
            "Download: saves a text file with times, turns and their interpretations. Works as a record of the session.",
            "Delete: removes the encounter and its turns for good.",
          ],
        },
      ],
    },
    {
      id: "minutos",
      titulo: "Minutes and plans",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Your plan includes a number of minutes per month. They're only counted while the session is listening: reading your history, getting ready, or leaving parla open without starting costs nothing.",
        },
        {
          tipo: "lista",
          items: [
            "The sidebar always shows the minutes you have left.",
            "When few are left you'll see a warning, before they run out. Finding out mid-encounter is the worst that can happen.",
            "If you hit zero the session stops, but nothing already transcribed is lost.",
            "You can upgrade from “Your account” and carry on right away.",
          ],
        },
      ],
    },
    {
      id: "privacidad",
      titulo: "Privacy",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "What is said in an encounter is clinical content. Only you can read your transcriptions and interpretations: they are not accessible to the team running the platform, not even to an administrator.",
        },
        {
          tipo: "parrafo",
          texto:
            "You can download any encounter for your records, or delete it whenever you like. And if you'd rather an encounter not be saved at all, switch off “Save to history” before you start.",
        },
      ],
    },
    {
      id: "problemas",
      titulo: "If something goes wrong",
      bloques: [
        {
          tipo: "lista",
          items: [
            "Nothing appears when you speak: check that the browser has microphone permission and isn't muted. You can grant it again from the padlock in the address bar.",
            "It cuts off mid-sentence: usually a long pause inside the sentence. Speak through and pause at the end.",
            "Languages get mixed in one turn: say it again in a single language; mixed sentences are the hardest.",
            "A name or a dose comes out wrong: spell it or say it more slowly. Those are the words with the least context to go on.",
            "The session stopped on its own: your plan minutes may have run out. Check the sidebar.",
          ],
        },
      ],
    },
  ],
};

export const GUIA: Record<Idioma, Guia> = { es, en };
