-- El panel de administración pedía cinco números y una lista de correos. Para
-- operar de verdad hace falta saber quién consume, cuándo fue la última vez que
-- alguien habló por la plataforma y cómo evoluciona el uso día a día.
--
-- Todo se resuelve en tres funciones SECURITY DEFINER que comprueban is_admin()
-- por dentro: así el panel hace tres consultas y no N+1 por usuario, y el
-- cliente no puede sacar nada aunque llame a la RPC a mano.

-- ─────────────────────────── métricas ampliadas ───────────────────────────

-- El tipo de retorno cambia, así que hay que tirar la versión de 0004.
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
  sesiones_vivas     integer
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
    -- Ingresos recurrentes implícitos: lo que factura el parque de planes
    -- vigentes si nadie se da de baja este mes.
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
    -- Sesión viva = sin cerrar y con latido reciente. El margen de 2 min cubre
    -- un latido perdido sin dejar colgada para siempre una pestaña cerrada
    -- de golpe.
    (select count(*)::integer
       from public.sessions
      where ended_at is null
        and last_heartbeat_at >= now() - interval '2 minutes')
  where public.is_admin();
$$;

revoke all on function public.admin_metricas() from public;
grant execute on function public.admin_metricas() to authenticated;

-- ───────────────────────── serie diaria de consumo ────────────────────────

-- Un punto por día aunque no haya consumo: si la serie se saltara los días
-- vacíos, la gráfica mentiría uniendo dos picos separados por una semana muerta.
create function public.admin_serie_diaria(p_dias integer default 30)
returns table (
  dia      date,
  minutos  integer,
  sesiones integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.dia::date,
    coalesce((
      select ceil(sum(u.quantity) / 60.0)
        from public.usage_events u
       where u.kind = 'stt_seconds'
         and u.occurred_at >= d.dia
         and u.occurred_at < d.dia + interval '1 day'
    ), 0)::integer,
    coalesce((
      select count(*)
        from public.sessions s
       where s.started_at >= d.dia
         and s.started_at < d.dia + interval '1 day'
    ), 0)::integer
  from generate_series(
    date_trunc('day', now()) - make_interval(days => greatest(p_dias, 1) - 1),
    date_trunc('day', now()),
    interval '1 day'
  ) as d(dia)
  where public.is_admin()
  order by d.dia;
$$;

revoke all on function public.admin_serie_diaria(integer) from public;
grant execute on function public.admin_serie_diaria(integer) to authenticated;

-- ──────────────────────── usuarios con su consumo ─────────────────────────

-- El panel antes listaba `profiles` en crudo y no sabía cuánto gastaba nadie.
-- Esto agrega el consumo del período, las sesiones y la última actividad en una
-- sola pasada: lo mínimo para decidir a quién subirle el plan o a quién llamar.
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

-- ───────────────────────────── reparto por plan ───────────────────────────

create function public.admin_reparto_planes()
returns table (
  plan_id     text,
  plan_nombre text,
  precio_cent integer,
  usuarios    integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pl.id,
    pl.name,
    pl.price_cents,
    (select count(*)::integer from public.profiles p where p.plan_id = pl.id)
  from public.plans pl
  where public.is_admin()
  order by pl.sort_order;
$$;

revoke all on function public.admin_reparto_planes() from public;
grant execute on function public.admin_reparto_planes() to authenticated;
