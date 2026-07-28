-- Rol de administrador: acceso de lectura a todo y capacidad de cambiar planes.

create type public.user_role as enum ('user', 'admin');

alter table public.profiles
  add column role public.user_role not null default 'user';

comment on column public.profiles.role is
  'Solo se cambia con service role o por otro admin; nunca desde el cliente.';

-- ─────────────────────────────────────────────────────────────────────────
-- Una política sobre `profiles` que consulte `profiles` para saber si quien
-- pregunta es admin provoca recursión infinita. La salida estándar es una
-- función SECURITY DEFINER: se salta RLS al leer la tabla, así que la política
-- puede llamarla sin morderse la cola.
-- ─────────────────────────────────────────────────────────────────────────

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ───────────────────────────── perfiles ─────────────────────────────

create policy "el admin ve todos los perfiles"
  on public.profiles for select
  using (public.is_admin());

create policy "el admin puede cambiar planes"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ───────────────────────────── resto de tablas ──────────────────────

create policy "el admin ve todas las suscripciones"
  on public.subscriptions for select
  using (public.is_admin());

create policy "el admin ve todas las sesiones"
  on public.sessions for select
  using (public.is_admin());

create policy "el admin ve todo el consumo"
  on public.usage_events for select
  using (public.is_admin());

-- Los turnos interpretados NO llevan política de admin a propósito: son
-- contenido clínico confidencial de una consulta médica. Que alguien
-- administre la plataforma no le da derecho a leer lo que dijo un paciente.

-- ───────────────────────────── métricas ─────────────────────────────

-- Resumen del negocio en una sola consulta, para el panel de administración.
create function public.admin_metricas()
returns table (
  usuarios          integer,
  usuarios_pago     integer,
  ingresos_mes_cent integer,
  minutos_mes       integer,
  sesiones_mes      integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profiles where plan_id <> 'free'),
    (select coalesce(sum(pl.price_cents), 0)::integer
       from public.profiles pr
       join public.plans pl on pl.id = pr.plan_id),
    (select coalesce(ceil(sum(quantity) / 60.0), 0)::integer
       from public.usage_events
      where kind = 'stt_seconds'
        and occurred_at >= date_trunc('month', now())),
    (select count(*)::integer
       from public.sessions
      where started_at >= date_trunc('month', now()))
  where public.is_admin();
$$;

revoke all on function public.admin_metricas() from public;
grant execute on function public.admin_metricas() to authenticated;
