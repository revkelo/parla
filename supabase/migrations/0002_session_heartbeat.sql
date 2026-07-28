-- El consumo de STT se contabiliza con un latido periódico durante la sesión.
-- Guardamos aquí el instante del último latido para que el servidor calcule el
-- tiempo transcurrido por su cuenta: si lo reportara el cliente, bastaría con
-- mentir en el número para no pagar los minutos.

alter table public.sessions
  add column last_heartbeat_at timestamptz not null default now();

comment on column public.sessions.last_heartbeat_at is
  'Último latido recibido. El delta contra now() es lo que se factura.';
