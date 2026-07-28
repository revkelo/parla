"use client";

import { useEffect, useRef, useState } from "react";
import { SelectorIdioma } from "../components/SelectorIdioma";
import { type Idioma, type Textos } from "../lib/i18n";
import { ENGINE_LABEL, type EngineName } from "../lib/stt";

export type MotorStt = "auto" | EngineName;
export type MotorIa = "auto" | "groq" | "google";

export type AjustesProps = {
  tamano: string;
  onTamano: (id: "s" | "m" | "l") => void;
  guardarHistorial: boolean;
  onGuardarHistorial: () => void;
  seguir: boolean;
  onSeguir: () => void;
  motorStt: MotorStt;
  onMotorStt: (v: MotorStt) => void;
  motorIa: MotorIa;
  onMotorIa: (v: MotorIa) => void;
  /**
   * Muestra la elección de motores. Apagado para un cliente: en mitad de una
   * consulta no puede juzgar si Groq va mejor que Gemini, y pedirle esa
   * decisión solo añade una forma de estropear su sesión.
   */
  verTecnico: boolean;
  idioma: Idioma;
  t: Textos;
};

/**
 * Ajustes de la sesión, en un panel que se abre bajo el botón.
 *
 * Antes esto vivía repartido por la barra superior: el selector de tamaño
 * siempre visible y un botón "Pruebas" que desplegaba dos menús de motores.
 * Son cosas que se tocan una vez y se olvidan, así que ocupaban sitio
 * permanente a cambio de un uso puntual. Aquí están todas juntas y fuera de
 * la vista mientras se interpreta, que es cuando estorban.
 */
export function Ajustes(props: AjustesProps) {
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    // Sin `relative` a propósito: el panel se posiciona contra el pie de la
    // barra lateral, no contra este botón de 36 px. Anclado al botón, con
    // `right-0` y 288 px de ancho, se salía 45 px por la izquierda de la
    // pantalla y parte de los ajustes quedaba fuera.
    <div ref={raizRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        title={props.t.ajustes.titulo}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          abierto
            ? "bg-accent-soft text-accent"
            : "text-muted hover:bg-foreground/[0.05] hover:text-foreground"
        }`}
      >
        <IconoAjustes />
        <span className="sr-only">{props.t.ajustes.titulo}</span>
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={props.t.ajustes.titulo}
          // Ancho acotado por el viewport para que en móvil quepa entero, y
          // altura con tope: con la cuenta de pruebas el panel mide casi 500 px
          // y en una pantalla baja los motores quedaban fuera de alcance.
          className="absolute bottom-full left-3 z-40 mb-2 max-h-[min(28rem,70vh)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl bg-surface p-4 shadow-pliego"
        >
          <Grupo etiqueta={props.t.ajustes.tamano}>
            <div role="group" className="flex items-center gap-1">
              {(["s", "m", "l"] as const).map((id, i) => (
                <button
                  key={id}
                  onClick={() => props.onTamano(id)}
                  aria-pressed={props.tamano === id}
                  className={`flex-1 rounded-md py-1.5 font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    props.tamano === id
                      ? "bg-accent-soft text-accent"
                      : "text-faint hover:text-foreground"
                  } ${["text-[11px]", "text-[13px]", "text-[16px]"][i]}`}
                >
                  A
                </button>
              ))}
            </div>
          </Grupo>

          <Interruptor
            etiqueta={props.t.ajustes.guardarHistorial}
            pie={props.t.ajustes.guardarHistorialPie}
            activo={props.guardarHistorial}
            onCambio={props.onGuardarHistorial}
          />

          <Interruptor
            etiqueta={props.t.ajustes.seguir}
            pie={props.t.ajustes.seguirPie}
            activo={props.seguir}
            onCambio={props.onSeguir}
          />

          <div className="mt-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
              {props.t.ajustes.idioma}
            </p>
            <div className="mt-2">
              <SelectorIdioma actual={props.idioma} />
            </div>
          </div>

          {props.verTecnico && (
            <div className="mt-4 pt-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                {props.t.ajustes.motores}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {props.t.ajustes.motoresPie}
              </p>

              <Selector
                etiqueta={props.t.ajustes.transcripcion}
                valor={props.motorStt}
                onCambio={(v) => props.onMotorStt(v as MotorStt)}
                // No se bloquea con la sesión en marcha: cambiarlo a media
                // consulta no rompe nada, simplemente no surte efecto hasta la
                // siguiente, que es justo lo que dice el pie.
                deshabilitado={false}
                pie={props.t.ajustes.seAplicaAlIniciar}
                opciones={[
                  {
                    valor: "auto",
                    texto: `${props.t.ajustes.automatico} (Deepgram → ${ENGINE_LABEL.webspeech})`,
                  },
                  { valor: "deepgram", texto: ENGINE_LABEL.deepgram },
                  { valor: "webspeech", texto: ENGINE_LABEL.webspeech },
                ]}
              />

              <Selector
                etiqueta={props.t.ajustes.interpretacion}
                valor={props.motorIa}
                onCambio={(v) => props.onMotorIa(v as MotorIa)}
                deshabilitado={false}
                pie={props.t.ajustes.seAplicaSiguiente}
                opciones={[
                  {
                    valor: "auto",
                    texto: `${props.t.ajustes.automatico} (Groq → Google)`,
                  },
                  { valor: "groq", texto: "Groq · gpt-oss-120b" },
                  { valor: "google", texto: "Google · Gemini 2.5" },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Rueda dentada, dibujada para no arrastrar una librería de iconos entera. */
function IconoAjustes() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function Grupo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
        {etiqueta}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Interruptor({
  etiqueta,
  pie,
  activo,
  onCambio,
}: {
  etiqueta: string;
  pie: string;
  activo: boolean;
  onCambio: () => void;
}) {
  return (
    <button
      onClick={onCambio}
      role="switch"
      aria-checked={activo}
      className="mt-4 flex w-full items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          activo ? "bg-accent" : "bg-foreground/15"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-surface transition-transform ${
            activo ? "translate-x-3" : ""
          }`}
        />
      </span>
      <span>
        <span className="block text-[13px] font-medium">{etiqueta}</span>
        <span className="block text-[11px] leading-relaxed text-muted">
          {pie}
        </span>
      </span>
    </button>
  );
}

function Selector({
  etiqueta,
  valor,
  onCambio,
  opciones,
  deshabilitado,
  pie,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  opciones: Array<{ valor: string; texto: string }>;
  deshabilitado: boolean;
  pie: string;
}) {
  return (
    <label className="mt-3 block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium">{etiqueta}</span>
        <span className="font-mono text-[9px] text-faint">{pie}</span>
      </span>
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        disabled={deshabilitado}
        className="mt-1 w-full rounded-md border border-hairline bg-background px-2 py-1.5 text-[12px] outline-none transition-colors focus-visible:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}
