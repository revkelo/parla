-- Dos cosas que van juntas: quién puede ver las tripas del producto, y cuánto
-- cuesta tenerlo en marcha.

-- ─────────────────────── Ver información técnica ───────────────────────
--
-- El intérprete que usa parla en una consulta no necesita saber si el turno lo
-- resolvió Groq o Gemini, ni poder forzar un motor: es ruido en mitad de su
-- trabajo y le pide una decisión que no tiene forma de tomar bien. Pero para
-- probar y comparar calidad hace falta verlo todo, así que se separa en una
-- marca por usuario en vez de enseñárselo a todos.

alter table public.profiles
  add column ver_tecnico boolean not null default false;

comment on column public.profiles.ver_tecnico is
  'Muestra motores, respaldos y diagnóstico. Cuenta de pruebas, no de cliente.';

-- No hace falta tocar permisos: 0005 revocó el UPDATE de `profiles` para
-- `authenticated` y solo concedió la columna `full_name`, así que esta columna
-- nace fuera del alcance del cliente. La escribe el panel con service role.

-- ──────────────────────── Métricas con coste de IA ─────────────────────
--
-- Faltaba el número de interpretaciones: sin él, el gasto de IA del mes solo se
-- podía adivinar. Se cuenta de `usage_events`, que ya lo registra por petición.

drop function if exists public.admin_metricas();

create function public.admin_metricas()
returns table (
  usuarios           integer,
  usuarios_pago      integer,
  usuarios_nuevos_7d integer,
  ingresos_mes_cent  integer,
  minutos_mes        integer,
  minutos_hoy        integer,
  sesiones_mes       integer,
  sesiones_vivas     integer,
  ia_peticiones_mes  integer,
  minutos_totales    integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profiles where plan_id <> 'free'),
    (select count(*)::integer from public.profiles
      where created_at >= now() - interval '7 days'),
    (select coalesce(sum(pl.price_cents), 0)::integer
       from public.profiles pr
       join public.plans pl on pl.id = pr.plan_id),
    (select coalesce(ceil(sum(quantity) / 60.0), 0)::integer
       from public.usage_events
      where kind = 'stt_seconds'
        and occurred_at >= date_trunc('month', now())),
    (select coalesce(ceil(sum(quantity) / 60.0), 0)::integer
       from public.usage_events
      where kind = 'stt_seconds'
        and occurred_at >= date_trunc('day', now())),
    (select count(*)::integer
       from public.sessions
      where started_at >= date_trunc('month', now())),
    (select count(*)::integer
       from public.sessions
      where ended_at is null
        and last_heartbeat_at >= now() - interval '2 minutes'),
    -- Interpretaciones del mes: cada una es una llamada facturable a la IA.
    (select coalesce(sum(quantity), 0)::integer
       from public.usage_events
      where kind = 'ai_request'
        and occurred_at >= date_trunc('month', now())),
    -- Minutos desde el principio, para contrastar el saldo de Deepgram con lo
    -- realmente consumido.
    (select coalesce(ceil(sum(quantity) / 60.0), 0)::integer
       from public.usage_events
      where kind = 'stt_seconds')
  where public.is_admin();
$$;

revoke all on function public.admin_metricas() from public;
grant execute on function public.admin_metricas() to authenticated;

-- ──────────────────── Usuarios, ahora con la marca técnica ─────────────

drop function if exists public.admin_usuarios(integer);

create function public.admin_usuarios(p_limite integer default 200)
returns table (
  id               uuid,
  email            text,
  full_name        text,
  plan_id          text,
  plan_nombre      text,
  plan_minutos     integer,
  plan_precio_cent integer,
  role             public.user_role,
  ver_tecnico      boolean,
  created_at       timestamptz,
  minutos_usados   integer,
  sesiones         integer,
  ultima_actividad timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.full_name,
    p.plan_id,
    pl.name,
    pl.monthly_minutes,
    pl.price_cents,
    p.role,
    p.ver_tecnico,
    p.created_at,
    public.current_usage_minutes(p.id),
    (select count(*)::integer from public.sessions s where s.user_id = p.id),
    (select max(s.started_at) from public.sessions s where s.user_id = p.id)
  from public.profiles p
  join public.plans pl on pl.id = p.plan_id
  where public.is_admin()
  order by p.created_at desc
  limit greatest(p_limite, 1);
$$;

revoke all on function public.admin_usuarios(integer) from public;
grant execute on function public.admin_usuarios(integer) to authenticated;
