-- =====================================================================
-- Rol colaborador (en la base sigue llamándose "agente")
--
-- Pedido del equipo: el colaborador entra a los mismos módulos que el
-- administrador, menos "Métricas de ventas" y "Árbol de referidos" (todo el
-- módulo de referidos). Puede ver y editar el costo de los productos. En
-- Gestión de usuarios solo gestiona CLIENTES y no cambia roles (si pudiera,
-- podría hacerse administrador).
--
-- 1. roles: el agente pasa de la zona "ordenes" (que ninguna pantalla usa:
--    hoy un agente no puede entrar a nada) a admin + marketplace + customer.
--    Las pantallas solo de administrador las cierra el frontend (soloAdmin)
--    y los datos de referidos siguen cerrados en la base (exigir_admin).
-- 2. Políticas: productos, tags, page_config, dynamic_components,
--    base_confianza y la edición de perfiles pasan de admin a admin + agente.
--    Siguen solo para admin: referidos, codigos_invitacion_historial, roles.
-- 3. proteger_campos_perfil: un colaborador que edita a otra persona solo
--    puede tocar clientes y no puede cambiar el rol.
-- 4. admin_costos_productos: también para el colaborador.
-- 5. Menú (page_config navbar): la sección del agente muestra sus módulos.
--
-- Orden de despliegue: primero el frontend (cierra Métricas de ventas y
-- Referidos al colaborador), después esta migración. Al revés, el sitio
-- anterior dejaría al colaborador abrir Métricas de ventas. Al admin no le
-- cambia nada. Hoy no hay ningún perfil con rol agente.
-- Rollback al final (comentado).
-- =====================================================================

-- 1. Zonas del rol --------------------------------------------------------------
update public.roles
set urls_permitidas = array['admin', 'marketplace', 'customer'], updated_at = now()
where nombre = 'agente';

-- 2. Políticas: admin -> admin + agente -----------------------------------------
drop policy if exists "Productos - Gestión Admin" on public.productos;
drop policy if exists "Productos - Gestión Staff" on public.productos;
create policy "Productos - Gestión Staff" on public.productos
  for all using (public.auth_user_role() = any (array['admin', 'agente']::public.rol_usuario[]));

drop policy if exists "Tags - Gestión Admin" on public.tags;
drop policy if exists "Tags - Gestión Staff" on public.tags;
create policy "Tags - Gestión Staff" on public.tags
  for all using (public.auth_user_role() = any (array['admin', 'agente']::public.rol_usuario[]));

drop policy if exists "CMS Config - Escritura Admin" on public.page_config;
drop policy if exists "CMS Config - Escritura Staff" on public.page_config;
create policy "CMS Config - Escritura Staff" on public.page_config
  for all using (public.auth_user_role() = any (array['admin', 'agente']::public.rol_usuario[]));

drop policy if exists "CMS Home - Escritura Admin" on public.dynamic_components;
drop policy if exists "CMS Home - Escritura Staff" on public.dynamic_components;
create policy "CMS Home - Escritura Staff" on public.dynamic_components
  for all using (public.auth_user_role() = any (array['admin', 'agente']::public.rol_usuario[]));

drop policy if exists "Base Confianza - Admin" on public.base_confianza;
drop policy if exists "Base Confianza - Staff" on public.base_confianza;
create policy "Base Confianza - Staff" on public.base_confianza
  for all using (public.auth_user_role() = any (array['admin', 'agente']::public.rol_usuario[]));

drop policy if exists "Perfiles - Propietario o Admin actualizan" on public.perfiles;
drop policy if exists "Perfiles - Propietario o Staff actualizan" on public.perfiles;
create policy "Perfiles - Propietario o Staff actualizan" on public.perfiles
  for update using (
    auth.uid() = id
    or public.auth_user_role() = any (array['admin', 'agente']::public.rol_usuario[])
  );

-- 3. Perfiles: qué puede cambiar cada uno ---------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
DECLARE
    v_rol public.rol_usuario := public.auth_user_role();
BEGIN
    -- Sin cambios respecto a la Fase 3: no se protege nada cuando actualiza un
    -- admin, el service_role o una conexión sin sesión de la app (SQL Editor,
    -- triggers internos), donde auth_user_role() o auth.role() son nulos.
    IF TG_OP <> 'UPDATE'
       OR v_rol IS NULL
       OR v_rol = 'admin'
       OR COALESCE(auth.role(), 'service_role') = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- NUEVO: colaborador (agente) gestionando a otra persona.
    IF v_rol = 'agente' AND OLD.id IS DISTINCT FROM auth.uid() THEN
        IF OLD.rol IS DISTINCT FROM 'customer' THEN
            RAISE EXCEPTION 'Un colaborador solo puede gestionar cuentas de clientes.' USING ERRCODE = '42501';
        END IF;
        IF NEW.rol IS DISTINCT FROM OLD.rol THEN
            RAISE EXCEPTION 'Solo un administrador puede cambiar roles.' USING ERRCODE = '42501';
        END IF;
        -- Puede autorizar, activar o bloquear y gestionar el código de
        -- invitación; no cambia correo, fechas ni datos internos.
        NEW.correo = OLD.correo;
        NEW.created_at = OLD.created_at;
        NEW.deleted_at = OLD.deleted_at;
        NEW.datos_adicionales = OLD.datos_adicionales;
        RETURN NEW;
    END IF;

    -- Cada persona sobre su propio perfil (igual que en la Fase 3).
    NEW.rol = OLD.rol;
    NEW.status = OLD.status;
    NEW.codigo_invitacion = OLD.codigo_invitacion;
    NEW.referido_por = OLD.referido_por;
    NEW.origen_autorizacion = OLD.origen_autorizacion;
    NEW.correo = OLD.correo;
    NEW.created_at = OLD.created_at;
    NEW.deleted_at = OLD.deleted_at;
    NEW.datos_adicionales = OLD.datos_adicionales;
    RETURN NEW;
END;
$function$;

-- 4. Costos: admin y colaborador ------------------------------------------------
create or replace function public.admin_costos_productos(p_ids uuid[] default null)
returns table (id uuid, costo numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.auth_user_role() is null
     or public.auth_user_role() <> all (array['admin', 'agente']::public.rol_usuario[]) then
    raise exception 'Solo un administrador o colaborador puede consultar costos.'
      using errcode = '42501';
  end if;

  return query
    select p.id, p.costo
    from public.productos p
    where p_ids is null or p.id = any (p_ids);
end;
$$;

revoke all on function public.admin_costos_productos(uuid[]) from public, anon;
grant execute on function public.admin_costos_productos(uuid[]) to authenticated;

-- 5. Menú del colaborador (sección con roles ["agente"]) -------------------------
update public.page_config pc
set content = (
  select jsonb_set(
    pc.content::jsonb,
    '{sections}',
    jsonb_agg(
      case
        when s->'roles' = '["agente"]'::jsonb then jsonb_build_object(
          'title', 'Colaboración',
          'roles', '["agente"]'::jsonb,
          'items', jsonb_build_array(
            jsonb_build_object('path', '/admin/marketplace/orders', 'label', 'Gestión Pedidos'),
            jsonb_build_object('path', '/admin/marketplace/products', 'label', 'Gestión Inventario'),
            jsonb_build_object('path', '/admin/dynamic-content', 'label', 'Gestión Contenido'),
            jsonb_build_object('path', '/admin/marketplace', 'label', 'Histórico de Pedidos'),
            jsonb_build_object('path', '/admin', 'label', 'Gestión Usuarios'),
            jsonb_build_object('path', '/admin/customer/bulk-upload', 'label', 'Carga de datos')
          )
        )
        else s
      end
      order by ord
    )
  )::json
  from jsonb_array_elements(pc.content::jsonb->'sections') with ordinality as arr(s, ord)
)
where pc.config_name = 'navbar'
  and exists (
    select 1 from jsonb_array_elements(pc.content::jsonb->'sections') s
    where s->'roles' = '["agente"]'::jsonb
  );

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- =====================================================================
-- update public.roles set urls_permitidas = array['ordenes'], updated_at = now() where nombre = 'agente';
--
-- drop policy if exists "Productos - Gestión Staff" on public.productos;
-- create policy "Productos - Gestión Admin" on public.productos for all using (public.auth_user_role() = 'admin'::public.rol_usuario);
-- drop policy if exists "Tags - Gestión Staff" on public.tags;
-- create policy "Tags - Gestión Admin" on public.tags for all using (public.auth_user_role() = 'admin'::public.rol_usuario);
-- drop policy if exists "CMS Config - Escritura Staff" on public.page_config;
-- create policy "CMS Config - Escritura Admin" on public.page_config for all using (public.auth_user_role() = 'admin'::public.rol_usuario);
-- drop policy if exists "CMS Home - Escritura Staff" on public.dynamic_components;
-- create policy "CMS Home - Escritura Admin" on public.dynamic_components for all using (public.auth_user_role() = 'admin'::public.rol_usuario);
-- drop policy if exists "Base Confianza - Staff" on public.base_confianza;
-- create policy "Base Confianza - Admin" on public.base_confianza for all using (public.auth_user_role() = 'admin'::public.rol_usuario);
-- drop policy if exists "Perfiles - Propietario o Staff actualizan" on public.perfiles;
-- create policy "Perfiles - Propietario o Admin actualizan" on public.perfiles for update
--   using ((auth.uid() = id) or (public.auth_user_role() = 'admin'::public.rol_usuario));
--
-- proteger_campos_perfil y admin_costos_productos: volver a ejecutar sus
-- bloques de 20261016150000_fase3_endurecimiento.sql (sección 4) y de
-- 20261015120000_fase0_existe_correo_y_usuarios_publicos.sql (sección 2).
--
-- Menú: Admin → Gestión Contenido → Configuraciones → Navbar, sección del
-- agente: dejar solo "Gestión pedidos" (/admin/marketplace/orders), título "Agente".
