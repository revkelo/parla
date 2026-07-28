-- Esquema inicial de PARLA SaaS.
-- Modelo de cuenta: intérprete individual (un usuario = una suscripción).
-- Las claves de Deepgram/IA son de la plataforma, así que el consumo se mide
-- por usuario y se corta al agotar la cuota del plan.

-- ─────────────────────────────── Planes ───────────────────────────────

create table public.plans (
  id                text primary key,          -- 'free', 'pro', 'unlimited'
  name              text not null,
  monthly_minutes   integer not null,          -- minutos de STT incluidos al mes
  price_cents       integer not null default 0,
  stripe_price_id   text unique,               -- null en el plan gratuito
  sort_order        integer not null default 0,
  is_public         boolean not null default true,
  created_at        timestamptz not null default now()
);

comment on column public.plans.monthly_minutes is
  'Minutos de transcripción incluidos por período de facturación.';

insert into public.plans (id, name, monthly_minutes, price_cents, sort_order) values
  ('free',  'Gratis',      30,     0, 0),
  ('pro',   'Profesional', 1200, 2900, 1),
  ('scale', 'Alto volumen', 6000, 9900, 2);

-- Los planes son catálogo público: cualquiera puede leerlos para la página de
-- precios, pero solo el service role los modifica.
alter table public.plans enable row level security;

create policy "plans son legibles por todos"
  on public.plans for select
  using (is_public);

-- ─────────────────────────────── Perfiles ──────────────────────────────

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text not null,
  full_name           text,
  plan_id             text not null default 'free' references public.plans (id),
  stripe_customer_id  text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "cada quien ve su perfil"
  on public.profiles for select
  using (auth.uid() = id);

-- Solo nombre editable por el usuario: plan y stripe_customer_id los fija el
-- webhook con service role, nunca el cliente.
create policy "cada quien edita su perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Crea el perfil automáticamente al registrarse.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────── Suscripciones ───────────────────────────

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'
);

create table public.subscriptions (
  id                     text primary key,      -- id de la suscripción en Stripe
  user_id                uuid not null references public.profiles (id) on delete cascade,
  plan_id                text not null references public.plans (id),
  status                 public.subscription_status not null,
  current_period_start   timestamptz not null,
  current_period_end     timestamptz not null,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

create policy "cada quien ve sus suscripciones"
  on public.subscriptions for select
  using (auth.uid() = user_id);
-- Sin políticas de escritura: solo el webhook de Stripe (service role) escribe.

-- ────────────────────────── Sesiones de interpretación ─────────────────

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_secs  integer not null default 0,
  stt_engine     text,
  ai_engine      text,
  title          text,
  created_at     timestamptz not null default now()
);

create index sessions_user_started_idx
  on public.sessions (user_id, started_at desc);

alter table public.sessions enable row level security;

create policy "cada quien gestiona sus sesiones"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────── Turnos interpretados ─────────────────────

create table public.segments (
  id              bigint generated always as identity primary key,
  session_id      uuid not null references public.sessions (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  ordinal         integer not null,
  source_text     text not null,
  target_text     text,
  source_lang     text not null check (source_lang in ('es', 'en')),
  ai_engine       text,
  created_at      timestamptz not null default now(),
  unique (session_id, ordinal)
);

create index segments_session_idx on public.segments (session_id, ordinal);

alter table public.segments enable row level security;

create policy "cada quien gestiona sus turnos"
  on public.segments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ───────────────────────────── Medición de uso ─────────────────────────

create type public.usage_kind as enum ('stt_seconds', 'ai_request');

create table public.usage_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  session_id  uuid references public.sessions (id) on delete set null,
  kind        public.usage_kind not null,
  quantity    integer not null check (quantity >= 0),
  occurred_at timestamptz not null default now()
);

-- El chequeo de cuota agrega por usuario y ventana temporal en cada arranque
-- de sesión, así que este índice es el que sostiene la ruta caliente.
create index usage_events_user_time_idx
  on public.usage_events (user_id, kind, occurred_at desc);

alter table public.usage_events enable row level security;

create policy "cada quien ve su uso"
  on public.usage_events for select
  using (auth.uid() = user_id);
-- Sin insert desde el cliente: el consumo lo escribe el servidor, si no
-- cualquiera podría no reportar sus minutos.

-- ─────────────────────── Consulta de cuota del período ─────────────────

-- Minutos consumidos por el usuario en su período de facturación vigente
-- (o el mes natural, si no tiene suscripción activa).
create function public.current_usage_minutes(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with period as (
    select coalesce(
      (select s.current_period_start
         from public.subscriptions s
        where s.user_id = p_user_id
          and s.status in ('active', 'trialing')
        order by s.current_period_start desc
        limit 1),
      date_trunc('month', now())
    ) as start_at
  )
  select coalesce(ceil(sum(u.quantity) / 60.0), 0)::integer
    from public.usage_events u, period
   where u.user_id = p_user_id
     and u.kind = 'stt_seconds'
     and u.occurred_at >= period.start_at;
$$;
