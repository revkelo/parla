-- CORRECCIÓN DE SEGURIDAD
--
-- La política de 0001 sobre `segments` comprobaba solo el dueño de la fila:
--
--   using (auth.uid() = user_id) with check (auth.uid() = user_id)
--
-- Nada la ataba a la sesión. Cualquier usuario autenticado podía insertar
-- turnos con SU user_id pero el `session_id` de la consulta de otro:
--
--   insert into segments (session_id, user_id, ordinal, source_text, source_lang)
--   values ('<sesión de la víctima>', auth.uid(), 0, 'lo que sea', 'es');
--
-- El contenido clínico ajeno no se filtraba —la lectura sigue acotada por
-- user_id, así que la víctima no vería esas filas ni el intruso las suyas—,
-- pero el daño era real: `unique (session_id, ordinal)` es común a todos, así
-- que ocupando los ordinales 0..N de una consulta ajena se impedía que la
-- víctima guardara sus propios turnos. Su historial se perdía en silencio.
--
-- Confirmado con una prueba real antes de este arreglo (`npm run test:historial`).

drop policy "cada quien gestiona sus turnos" on public.segments;

create policy "cada quien gestiona sus turnos"
  on public.segments for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- La sesión también tiene que ser suya. La subconsulta va sujeta a las
    -- políticas de `sessions`, que ya acotan a las propias, así que un
    -- session_id ajeno sencillamente no encuentra fila.
    and exists (
      select 1
        from public.sessions s
       where s.id = session_id
         and s.user_id = auth.uid()
    )
  );
