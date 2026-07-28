-- CORRECCIÓN DE SEGURIDAD
--
-- La política "cada quien edita su perfil" de 0001 permitía a cualquier
-- usuario actualizar su fila completa. RLS decide QUÉ FILAS se pueden tocar,
-- no QUÉ COLUMNAS, así que con la política puesta un usuario podía hacer:
--
--   update profiles set role = 'admin'   where id = auth.uid();
--   update profiles set plan_id = 'scale' where id = auth.uid();
--
-- y ascenderse a administrador o regalarse el plan más caro. Confirmado con
-- una prueba real antes de este arreglo.
--
-- La restricción por columna se hace con permisos, no con políticas.

revoke update on public.profiles from authenticated;

-- Lo único que el usuario decide sobre su propio perfil.
grant update (full_name) on public.profiles to authenticated;

-- `plan_id`, `role`, `stripe_customer_id` y `email` quedan fuera del alcance
-- del cliente. Los escriben:
--   - el webhook de Stripe (service role), al cobrar o cancelar
--   - el panel de administración (service role), tras comprobar is_admin()
--   - el trigger handle_new_user (SECURITY DEFINER), al dar de alta
