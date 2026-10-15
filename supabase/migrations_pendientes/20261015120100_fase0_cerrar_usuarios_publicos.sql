-- =====================================================================
-- Fase 0 — Migración RESTRICTIVA. Aplicar SOLO DESPUÉS de:
--   1. haber aplicado 20261015120000_fase0_existe_correo_y_usuarios_publicos.sql
--   2. haber desplegado el frontend que usa existe_correo() y que ya no
--      escribe usuarios_publicos desde el navegador.
--
-- Problema: la política "Usuarios Públicos - Acceso Libre" (FOR ALL USING
-- true) permitía a cualquier visitante, sin sesión, leer la lista completa
-- de correos registrados, insertar filas y borrarlas (bloqueando el login
-- de cualquier persona). Verificado el 15/10 con la llave pública.
--
-- Después de esta migración:
--   - anon y usuarios normales no pueden leer ni escribir la tabla.
--   - La tabla la escriben handle_new_user (SECURITY DEFINER) y el
--     service role; el login usa existe_correo().
--   - Admin y agente pueden leerla para soporte.
-- No borra datos. Rollback al final.
-- =====================================================================

drop policy if exists "Usuarios Públicos - Acceso Libre" on public.usuarios_publicos;

create policy "Usuarios Públicos - Lectura staff"
  on public.usuarios_publicos
  for select
  using (public.auth_user_role() = any (array['admin'::public.rol_usuario, 'agente'::public.rol_usuario]));

-- =====================================================================
-- ROLLBACK
-- ---------------------------------------------------------------------
-- drop policy if exists "Usuarios Públicos - Lectura staff" on public.usuarios_publicos;
-- create policy "Usuarios Públicos - Acceso Libre"
--   on public.usuarios_publicos for all using (true);
-- =====================================================================
