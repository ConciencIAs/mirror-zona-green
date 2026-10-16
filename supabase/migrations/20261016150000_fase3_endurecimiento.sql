-- =====================================================================
-- Fase 3 — Endurecimiento de seguridad — Migración principal
--
-- Compatible con el frontend actual (no exige desplegar nada antes).
--
--   1. carrito: la cantidad debe ser un entero mayor que 0. Hoy se podía
--      poner -1 o 0,5 llamando la API directamente: con -1 el pedido
--      restaba plata y SUMABA stock.
--   2. procesar_checkout: exige perfil activo (un usuario bloqueado ya no
--      puede confirmar lo que tenía en el carrito), valida la cantidad,
--      bloquea los productos siempre en el mismo orden (evita bloqueos
--      mutuos entre pedidos simultáneos), deja de tocar "reservado" y fija
--      search_path. Mismo contrato de entrada y de respuesta.
--   3. "reservado" se deja de usar (decisión del equipo): se respalda el
--      valor actual y se pone en 0 para que la disponibilidad sea el stock
--      real. La columna se conserva.
--   4. perfiles: el usuario ya no puede cambiar en su propio perfil correo,
--      created_at, deleted_at ni datos_adicionales (solo admin o sistema).
--      Y la política de INSERT exige que un perfil creado por el propio
--      usuario sea customer, inactivo y sin código.
--   5. Calificaciones: update_product_rating corre con permisos del sistema
--      (antes fallaba en silencio porque el cliente no puede modificar
--      productos) y se recalculan los promedios.
--   6. search_path fijo en las funciones que no lo tenían, y se quita el
--      permiso de ejecución a visitantes donde no corresponde.
--
-- No borra datos. Rollback al final (comentado).
-- =====================================================================

-- 1. Cantidad del carrito ----------------------------------------------------
alter table public.carrito
  drop constraint if exists carrito_cantidad_valida;
alter table public.carrito
  add constraint carrito_cantidad_valida
  check (cantidad > 0 and cantidad = trunc(cantidad)) not valid;
-- Las filas actuales ya cumplen (al 16 de octubre: 5 ítems, todos enteros
-- positivos); si alguna no cumpliera, esta línea falla sin cambiar nada.
alter table public.carrito validate constraint carrito_cantidad_valida;

-- 2. procesar_checkout -------------------------------------------------------
create or replace function public.procesar_checkout(
  p_tipo_entrega text default 'Pendiente',
  p_comentarios text default 'Sin comentarios',
  p_direccion text default ''
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
    v_usuario_id UUID;
    v_perfil RECORD;
    v_item RECORD;
    v_producto RECORD;
    v_nombre_cliente TEXT;
    v_correo_cliente TEXT;
    v_precio_total NUMERIC := 0;
    v_subtotal NUMERIC := 0;
    v_precio_unitario NUMERIC := 0;
    v_total_gramos NUMERIC;
    v_stock_actual NUMERIC;
    v_nuevas_presentaciones JSONB;
    v_lista_productos JSONB := '[]'::jsonb;
    v_snapshot JSONB;
    v_orden_id UUID;
BEGIN
    -- 1. Obtener el ID del usuario
    v_usuario_id := auth.uid();
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Petición sin autorización o sesión expirada.';
    END IF;

    -- 2. Obtener datos del perfil (NUEVO: debe estar activo)
    SELECT full_name, correo, status, deleted_at INTO v_perfil
    FROM perfiles
    WHERE id = v_usuario_id;

    IF v_perfil.status IS DISTINCT FROM 'activo' OR v_perfil.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Tu cuenta no está habilitada para hacer pedidos.';
    END IF;

    v_nombre_cliente := COALESCE(v_perfil.full_name, 'Usuario Desconocido');
    IF v_perfil.correo IS NULL THEN
        SELECT email INTO v_correo_cliente FROM auth.users WHERE id = v_usuario_id;
    ELSE
        v_correo_cliente := v_perfil.correo;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM carrito WHERE usuario_id = v_usuario_id) THEN
        RAISE EXCEPTION 'El carrito está vacío.';
    END IF;

    -- 3. Iterar sobre el carrito bloqueando los productos.
    --    NUEVO: siempre en el mismo orden (por producto), para que dos pedidos
    --    simultáneos no se bloqueen mutuamente.
    FOR v_item IN (SELECT * FROM carrito WHERE usuario_id = v_usuario_id ORDER BY producto_id, paquete_gramos NULLS FIRST)
    LOOP
        -- NUEVO: la cantidad debe ser un entero positivo (también lo exige la tabla).
        IF v_item.cantidad IS NULL OR v_item.cantidad <= 0 OR v_item.cantidad <> trunc(v_item.cantidad) THEN
            RAISE EXCEPTION 'Cantidad no válida en el carrito.';
        END IF;

        SELECT * INTO v_producto
        FROM productos
        WHERE id = v_item.producto_id
        FOR UPDATE;

        IF v_producto.id IS NULL THEN
            RAISE EXCEPTION 'El producto con ID % no existe.', v_item.producto_id;
        END IF;

        v_total_gramos := NULL;

        IF v_producto.es_por_gramos THEN
            SELECT (el->>'precio')::numeric, (el->>'stock')::numeric
            INTO v_precio_unitario, v_stock_actual
            FROM jsonb_array_elements(v_producto.presentaciones::jsonb) AS el
            WHERE (el->>'gramos')::numeric = v_item.paquete_gramos;

            IF v_stock_actual IS NULL THEN
                RAISE EXCEPTION 'El paquete de %g no existe para %.', v_item.paquete_gramos, v_producto.nombre;
            END IF;

            IF v_stock_actual < v_item.cantidad THEN
                RAISE EXCEPTION 'Stock insuficiente. Quedan % paquetes de %g de %.', v_stock_actual, v_item.paquete_gramos, v_producto.nombre;
            END IF;

            v_subtotal := v_precio_unitario * v_item.cantidad;
            v_total_gramos := v_item.paquete_gramos * v_item.cantidad;

            SELECT jsonb_agg(
                CASE
                    WHEN (el->>'gramos')::numeric = v_item.paquete_gramos THEN
                        jsonb_set(el, '{stock}', to_jsonb(v_stock_actual - v_item.cantidad))
                    ELSE el
                END
                ORDER BY ord
            ) INTO v_nuevas_presentaciones
            FROM jsonb_array_elements(v_producto.presentaciones::jsonb) WITH ORDINALITY AS arr(el, ord);

            -- "reservado" ya no se usa (Fase 3).
            UPDATE productos
            SET
                presentaciones = v_nuevas_presentaciones,
                stock_total = stock_total - v_total_gramos
            WHERE id = v_producto.id;

        ELSE
            IF (v_producto.stock_total) < v_item.cantidad THEN
                RAISE EXCEPTION 'Stock insuficiente para %. Quedan % uds.', v_producto.nombre, v_producto.stock_total;
            END IF;

            v_precio_unitario := v_producto.precio;
            v_subtotal := v_precio_unitario * v_item.cantidad;

            UPDATE productos
            SET stock_total = stock_total - v_item.cantidad
            WHERE id = v_producto.id;
        END IF;

        v_precio_total := v_precio_total + v_subtotal;

        -- 4. Construir el Snapshot Analítico
        v_snapshot := jsonb_build_object(
            'sku', v_producto.sku,
            'id', v_producto.id,
            'nombre', v_producto.nombre,
            'es_por_gramos', v_producto.es_por_gramos,
            'cantidad_comprada', v_item.cantidad,
            'paquete_gramos', v_item.paquete_gramos,
            'total_gramos_entregados', v_total_gramos,
            'precio_unitario', v_precio_unitario,
            'subtotal', v_subtotal,
            'comprador_nombre', v_nombre_cliente,
            'comprador_correo', v_correo_cliente
        );

        v_lista_productos := v_lista_productos || v_snapshot;
    END LOOP;

    -- 5. Crear la orden general
    INSERT INTO ordenes (
        usuario_id, nombre_cliente, correo_cliente, lista_productos,
        precio_total, status, tipo_entrega, comentarios_usuario, direccion
    ) VALUES (
        v_usuario_id, v_nombre_cliente, v_correo_cliente, v_lista_productos,
        v_precio_total, 'seleccion', p_tipo_entrega, p_comentarios, p_direccion
    ) RETURNING id INTO v_orden_id;

    -- 6. Limpiar Carrito
    DELETE FROM carrito WHERE usuario_id = v_usuario_id;

    RETURN json_build_object('success', true, 'ordenId', v_orden_id, 'total', v_precio_total);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

revoke all on function public.procesar_checkout(text, text, text) from public, anon;
grant execute on function public.procesar_checkout(text, text, text) to authenticated;

-- 3. "reservado" en desuso: respaldo y puesta en 0 ------------------------------
create table if not exists public.respaldo_fase3_reservado (
  producto_id uuid primary key,
  reservado numeric,
  respaldado_en timestamptz not null default now()
);
alter table public.respaldo_fase3_reservado enable row level security;
revoke all on public.respaldo_fase3_reservado from anon, authenticated;

insert into public.respaldo_fase3_reservado (producto_id, reservado)
select id, reservado from public.productos where coalesce(reservado, 0) <> 0
on conflict (producto_id) do nothing;

update public.productos set reservado = 0 where coalesce(reservado, 0) <> 0;

comment on column public.productos.reservado is
  'En desuso desde la Fase 3: la disponibilidad es stock_total; procesar_checkout valida el stock al confirmar.';

-- 4. Perfiles: campos que el usuario no puede cambiar ---------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Si el que actualiza NO es admin, ni es el sistema interno
        IF (public.auth_user_role() != 'admin' AND auth.role() != 'service_role') THEN
            -- Revertimos cualquier intento de cambiar estos campos críticos
            NEW.rol = OLD.rol;
            NEW.status = OLD.status;
            NEW.codigo_invitacion = OLD.codigo_invitacion;
            NEW.referido_por = OLD.referido_por;
            NEW.origen_autorizacion = OLD.origen_autorizacion;
            -- NUEVO (Fase 3)
            NEW.correo = OLD.correo;
            NEW.created_at = OLD.created_at;
            NEW.deleted_at = OLD.deleted_at;
            NEW.datos_adicionales = OLD.datos_adicionales;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

drop policy if exists "Perfiles - Auto registro público" on public.perfiles;
create policy "Perfiles - Auto registro público" on public.perfiles
  for insert
  with check (
    auth.uid() = id
    and rol = 'customer'::public.rol_usuario
    and status = 'inactivo'::public.status_profile
    and codigo_invitacion is null
    and deleted_at is null
  );

-- 5. Calificaciones -----------------------------------------------------------
alter function public.update_product_rating() security definer;
alter function public.update_product_rating() set search_path = public, pg_temp;

update public.productos p
set rating_average = coalesce((select round(avg(r.rating)::numeric, 2) from public.product_reviews r where r.product_id = p.id), 0),
    rating_count = (select count(*) from public.product_reviews r where r.product_id = p.id)
where coalesce(p.rating_count, 0) <> (select count(*) from public.product_reviews r where r.product_id = p.id);

-- 6. search_path fijo y permisos ------------------------------------------------
alter function public.auth_user_role() set search_path = public, pg_temp;
alter function public.is_active_user() set search_path = public, pg_temp;
alter function public.actualizar_timestamp_updated_at() set search_path = public, pg_temp;
alter function public.check_coherencia_carrito() set search_path = public, pg_temp;
alter function public.generate_order_uid() set search_path = public, pg_temp;
alter function public.proteger_rol_usuario() set search_path = public, pg_temp;
alter function public.set_initial_tracking() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.sincronizar_y_auditar_inventario() set search_path = public, pg_temp;

-- auth_user_role e is_active_user las usan las políticas RLS, que se evalúan
-- con el rol de quien consulta: anon y authenticated deben seguir pudiendo.
revoke all on function public.admin_costos_productos(uuid[]) from public, anon;
grant execute on function public.admin_costos_productos(uuid[]) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- ---------------------------------------------------------------------
-- alter table public.carrito drop constraint if exists carrito_cantidad_valida;
-- -- procesar_checkout: volver a la versión del esquema de producción
-- --   (supabase/pruebas/00_esquema_publico_produccion_2026-10-15.sql, función
-- --   "procesar_checkout"); grant execute ... to anon si se quiere idéntico.
-- update public.productos p set reservado = r.reservado
--   from public.respaldo_fase3_reservado r where r.producto_id = p.id;
-- -- proteger_campos_perfil: quitar las 4 líneas marcadas "NUEVO (Fase 3)".
-- drop policy if exists "Perfiles - Auto registro público" on public.perfiles;
-- create policy "Perfiles - Auto registro público" on public.perfiles
--   for insert with check (auth.uid() = id);
-- alter function public.update_product_rating() security invoker;
-- -- (los search_path fijos no hace falta revertirlos)
-- =====================================================================
