/**
 * Tipos y ayudantes del panel de administración, sin dependencias de servidor.
 *
 * Van aparte de `admin.ts` a propósito: ese módulo importa el cliente de
 * Supabase de servidor, y la tabla de usuarios y la gráfica son componentes de
 * cliente. Si compartieran módulo, el bundler arrastraría la clave de servicio
 * hacia el navegador — de hecho, falla la compilación antes de permitirlo.
 */

export type Metricas = {
  usuarios: number;
  usuarios_pago: number;
  usuarios_nuevos_7d: number;
  ingresos_mes_cent: number;
  minutos_mes: number;
  minutos_hoy: number;
  sesiones_mes: number;
  sesiones_vivas: number;
  ia_peticiones_mes: number;
  minutos_totales: number;
};

export type PuntoSerie = {
  dia: string;
  minutos: number;
  sesiones: number;
};

export type FilaUsuario = {
  id: string;
  email: string;
  full_name: string | null;
  plan_id: string;
  plan_nombre: string;
  plan_minutos: number;
  plan_precio_cent: number;
  role: "user" | "admin";
  ver_tecnico: boolean;
  created_at: string;
  minutos_usados: number;
  sesiones: number;
  ultima_actividad: string | null;
};

export type RepartoPlan = {
  plan_id: string;
  plan_nombre: string;
  precio_cent: number;
  usuarios: number;
};

/** Costo medido por minuto (ver `npm run medir:costo`). */
export const COSTO_MIN = 0.0108;

/** Métricas vacías: el panel debe pintar aunque la RPC no devuelva fila. */
export const METRICAS_CERO: Metricas = {
  usuarios: 0,
  usuarios_pago: 0,
  usuarios_nuevos_7d: 0,
  ingresos_mes_cent: 0,
  minutos_mes: 0,
  minutos_hoy: 0,
  sesiones_mes: 0,
  sesiones_vivas: 0,
  ia_peticiones_mes: 0,
  minutos_totales: 0,
};

export function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("es", { maximumFractionDigits: 0 })}`;
}

/** "hace 3 h", "hace 2 d" — o `null` si nunca hubo actividad. */
export function haceCuanto(iso: string | null): string | null {
  if (!iso) return null;
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (segundos < 90) return "ahora";
  const minutos = segundos / 60;
  if (minutos < 60) return `hace ${Math.round(minutos)} min`;
  const horas = minutos / 60;
  if (horas < 24) return `hace ${Math.round(horas)} h`;
  const dias = Math.round(horas / 24);
  return dias < 30 ? `hace ${dias} d` : `hace ${Math.round(dias / 30)} mes`;
}
