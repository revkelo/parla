-- parla sale de `public` y pasa a su propio esquema `parla`.
--
-- Era el unico proyecto de la base compartida sin esquema propio. No por
-- descuido: parla habla por PostgREST, y PostgREST solo expone `public` salvo
-- que se le diga otra cosa, asi que empezar ahi era el camino corto.
--
-- Lo que hace viable moverlo es que el esquema se declara en el CLIENTE
-- (`db: { schema: 'parla' }`), no en cada consulta: los mas de cuarenta
-- `.from(...)` repartidos por la app no se tocan.
--
-- Aplicada en produccion el 2026-09-01. Requiere ademas, fuera del SQL:
--   1. exponer `parla` en la API (db_schema de PostgREST)
--   2. desplegar el codigo con el esquema puesto en el cliente
--
-- Lo que NO se mueve: la extension btree_gist, que vive en public y no es de
-- parla. Por eso las tablas y funciones van enumeradas y no se barre el
-- esquema entero.

create schema if not exists parla;

do $$
declare
  r record;
  tablas text[] := array['_migrations','plans','profiles','segments','sessions','subscriptions','usage_events'];
  tipos  text[] := array['subscription_status','usage_kind','user_role'];
  fns    text[] := array['handle_new_user','current_usage_minutes','is_admin',
                         'admin_serie_diaria','admin_reparto_planes','admin_metricas','admin_usuarios'];
begin
  -- Los tipos antes que las tablas: las columnas dependen de ellos.
  foreach r.relname in array tipos loop
    if exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
               where n.nspname='public' and t.typname=r.relname) then
      execute format('alter type public.%I set schema parla', r.relname);
    end if;
  end loop;

  foreach r.relname in array tablas loop
    if to_regclass('public.'||quote_ident(r.relname)) is not null then
      execute format('alter table public.%I set schema parla', r.relname);
    end if;
  end loop;

  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(fns)
  loop
    execute format('alter function public.%I(%s) set schema parla', r.proname, r.args);
  end loop;
end $$;

/*
 * Las siete funciones hay que recrearlas, no basta con moverlas: todas fijaban
 * `search_path TO 'public'` y escribian `public.tabla` en el cuerpo, y eso es
 * texto que se reinterpreta al ejecutarse. Entre ellas esta `handle_new_user`,
 * que cuelga de un trigger en auth.users: si se rompe, cada registro nuevo se
 * queda sin perfil y nadie se entera hasta que alguien no puede entrar.
 *
 * El cuerpo exacto de cada una se conserva; lo unico que cambia es `public.`
 * por `parla.` y el search_path.
 *
 * OJO al recrearlas a mano: hay que poner `set search_path = parla, public` en
 * la SESION que ejecuta el CREATE. Los tipos de la firma se resuelven contra el
 * search_path de quien crea la funcion, no contra el que la funcion declara
 * dentro, y sin eso falla con "type user_role does not exist".
 */

grant usage on schema parla to anon, authenticated, service_role;
grant all on all tables in schema parla to anon, authenticated, service_role;
grant all on all sequences in schema parla to anon, authenticated, service_role;
grant all on all functions in schema parla to anon, authenticated, service_role;

-- `public` NO se borra: ahi sigue la extension btree_gist.
