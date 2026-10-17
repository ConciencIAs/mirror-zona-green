-- =====================================================================
-- Cancelar un pedido devuelve el stock + registro con celular completo
--
-- 1. ordenes_cancelacion (trigger): cuando un pedido pasa a "cancelado",
--    devuelve al inventario lo que descontó procesar_checkout (paquetes por
--    gramos y unidades), una sola vez. Un pedido cancelado ya no puede
--    cambiar de estado (es estado final), para que el stock no se descuente
--    ni se devuelva dos veces. Funciona igual si cancela el admin (Gestión de
--    pedidos) o el cliente (función 2).
-- 2. cancelar_mi_pedido(p_orden_id): el cliente cancela SU pedido, solo
--    mientras está en "Selección realizada" (seleccion).
-- 3. handle_new_user: vuelve a la versión de la Fase 2c. En producción quedó
--    la versión anterior, que comparaba solo los últimos 10 dígitos del
--    celular con la base de confianza (un número de EE. UU. +1 305 123 4567
--    coincidía con el colombiano 305 123 4567 y entraba activo) y guardaba
--    los números extranjeros cortados. Esta compara el número completo en
--    formato internacional (+57…), sin importar cómo se escribió.
--
-- Pedidos cancelados antes de esta migración: no se tocan. El único que hay
-- en producción (2026-09-28) es de productos que ya no existen.
--
-- Orden de despliegue: esta migración es compatible con el frontend actual
-- (el admin sigue cancelando igual; el botón del cliente llega con el PR).
-- Rollback al final (comentado).
-- =====================================================================

-- 1. Devolver el stock al cancelar ---------------------------------------------
create or replace function public.ordenes_cancelacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
    v_item JSONB;
    v_producto RECORD;
    v_cantidad NUMERIC;
    v_paquete NUMERIC;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'cancelado' THEN
        RAISE EXCEPTION 'Un pedido cancelado no se puede reactivar.';
    END IF;

    IF NEW.status <> 'cancelado' THEN
        RETURN NEW;
    END IF;

    -- Mismo orden de bloqueo que procesar_checkout (por producto), para que
    -- una cancelación y una compra simultáneas no se bloqueen mutuamente.
    FOR v_item IN
        SELECT el
        FROM jsonb_array_elements(COALESCE(OLD.lista_productos, '[]'::jsonb)) AS el
        ORDER BY (el->>'id')::uuid, (el->>'paquete_gramos')::numeric NULLS FIRST
    LOOP
        v_cantidad := (v_item->>'cantidad_comprada')::numeric;
        CONTINUE WHEN v_cantidad IS NULL OR v_cantidad <= 0 OR v_item->>'id' IS NULL;

        SELECT id, presentaciones INTO v_producto
        FROM productos
        WHERE id = (v_item->>'id')::uuid
        FOR UPDATE;

        -- El producto pudo haberse borrado después del pedido.
        CONTINUE WHEN v_producto.id IS NULL;

        IF COALESCE((v_item->>'es_por_gramos')::boolean, false) THEN
            v_paquete := (v_item->>'paquete_gramos')::numeric;

            UPDATE productos
            SET
                presentaciones = COALESCE((
                    SELECT jsonb_agg(
                        CASE
                            WHEN (el->>'gramos')::numeric = v_paquete THEN
                                jsonb_set(el, '{stock}', to_jsonb(trunc(COALESCE((el->>'stock')::numeric, 0) + v_cantidad)::bigint))
                            ELSE el
                        END
                        ORDER BY ord
                    )
                    FROM jsonb_array_elements(v_producto.presentaciones::jsonb) WITH ORDINALITY AS arr(el, ord)
                ), v_producto.presentaciones::jsonb),
                stock_total = stock_total + COALESCE((v_item->>'total_gramos_entregados')::numeric, v_paquete * v_cantidad)
            WHERE id = v_producto.id;
        ELSE
            UPDATE productos
            SET stock_total = stock_total + v_cantidad
            WHERE id = v_producto.id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$function$;

revoke all on function public.ordenes_cancelacion() from public, anon, authenticated;

drop trigger if exists tr_ordenes_cancelacion on public.ordenes;
create trigger tr_ordenes_cancelacion
  before update of status on public.ordenes
  for each row execute function public.ordenes_cancelacion();

-- 2. El cliente cancela su pedido ------------------------------------------------
create or replace function public.cancelar_mi_pedido(p_orden_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
    v_orden RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Necesitas iniciar sesión.';
    END IF;

    SELECT id, usuario_id, status INTO v_orden
    FROM ordenes
    WHERE id = p_orden_id
    FOR UPDATE;

    IF v_orden.id IS NULL OR v_orden.usuario_id <> auth.uid() THEN
        RAISE EXCEPTION 'No encontramos ese pedido.';
    END IF;

    IF v_orden.status <> 'seleccion' THEN
        RAISE EXCEPTION 'Este pedido ya no se puede cancelar desde aquí. Escríbenos por WhatsApp.';
    END IF;

    -- El trigger tr_ordenes_cancelacion devuelve el stock.
    UPDATE ordenes
    SET
        status = 'cancelado',
        tracking = COALESCE(tracking, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'status', 'cancelado',
            'date', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'por', 'cliente'
        ))
    WHERE id = p_orden_id;

    RETURN json_build_object('success', true);
END;
$function$;

revoke all on function public.cancelar_mi_pedido(uuid) from public, anon, authenticated;
grant execute on function public.cancelar_mi_pedido(uuid) to authenticated;

-- 3. handle_new_user (igual a la de la Fase 2c) --------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
DECLARE
  v_status public.status_profile;
  v_origen text;
  v_referido_por text;
  v_telefono_raw text;
  v_telefono_norm text;
BEGIN
  v_status := 'inactivo';
  v_origen := 'registro_web';
  v_referido_por := NEW.raw_user_meta_data ->> 'referido_por';
  v_telefono_raw := NULLIF(btrim(NEW.raw_user_meta_data ->> 'telefono'), '');
  -- NUEVO (2c): número completo en formato internacional.
  v_telefono_norm := public.normalizar_telefono(v_telefono_raw);

  IF v_telefono_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.base_confianza
    WHERE public.normalizar_telefono(telefono) = v_telefono_norm
  ) THEN
    v_status := 'activo';
    v_origen := 'base_confianza';
  END IF;

  INSERT INTO public.perfiles (
    id,
    rol,
    correo,
    full_name,
    telefono,
    documento,
    tipo_documento,
    fecha_nacimiento,
    ubicacion,
    status,
    referido_por,
    origen_autorizacion,
    datos_adicionales
  )
  VALUES (
    NEW.id,
    'customer'::public.rol_usuario,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(v_telefono_norm, v_telefono_raw),
    NEW.raw_user_meta_data ->> 'documento',
    NULLIF(NEW.raw_user_meta_data ->> 'tipo_documento', '')::public.tipo_doc,
    NULLIF(NEW.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
    NEW.raw_user_meta_data ->> 'ubicacion',
    v_status,
    v_referido_por,
    v_origen,
    jsonb_build_object(
      'acepta_politicas', COALESCE((NEW.raw_user_meta_data ->> 'acepta_politica_privacidad')::boolean, false),
      'acepta_terminos', COALESCE((NEW.raw_user_meta_data ->> 'acepta_terminos')::boolean, false),
      'fecha_aceptacion', NOW(),
      'fecha_registro', NOW()
    )
  );

  -- Fase 0/1: el login reconoce el correo desde el primer momento.
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.usuarios_publicos (uid, correo)
    VALUES (NEW.id, lower(NEW.email))
    ON CONFLICT (correo) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- =====================================================================
-- drop trigger if exists tr_ordenes_cancelacion on public.ordenes;
-- drop function if exists public.ordenes_cancelacion();
-- drop function if exists public.cancelar_mi_pedido(uuid);
--
-- handle_new_user: volver a la versión que hoy está en producción (la de la
-- Fase 0/1, que compara los últimos 10 dígitos):
-- create or replace function public.handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path to 'public', 'auth'
-- as $function$
-- DECLARE
--   v_status public.status_profile;
--   v_origen text;
--   v_referido_por text;
--   v_telefono_raw text;
--   v_telefono_limpio text;
-- BEGIN
--   v_status := 'inactivo';
--   v_origen := 'registro_web';
--   v_referido_por := NEW.raw_user_meta_data ->> 'referido_por';
--   v_telefono_raw := NEW.raw_user_meta_data ->> 'telefono';
-- 
--   IF v_telefono_raw IS NOT NULL THEN
--     v_telefono_limpio := RIGHT(regexp_replace(v_telefono_raw, '\D', '', 'g'), 10);
--   END IF;
-- 
--   IF v_telefono_limpio IS NOT NULL AND EXISTS (
--     SELECT 1
--     FROM public.base_confianza
--     WHERE RIGHT(regexp_replace(telefono, '\D', '', 'g'), 10) = v_telefono_limpio
--   ) THEN
--     v_status := 'activo';
--     v_origen := 'base_confianza';
--   END IF;
-- 
--   INSERT INTO public.perfiles (
--     id,
--     rol,
--     correo,
--     full_name,
--     telefono,
--     documento,
--     tipo_documento,
--     fecha_nacimiento,
--     ubicacion,
--     status,
--     referido_por,
--     origen_autorizacion,
--     datos_adicionales
--   )
--   VALUES (
--     NEW.id,
--     'customer'::public.rol_usuario,
--     NEW.email,
--     NEW.raw_user_meta_data ->> 'full_name',
--     COALESCE(v_telefono_limpio, v_telefono_raw),
--     NEW.raw_user_meta_data ->> 'documento',
--     NULLIF(NEW.raw_user_meta_data ->> 'tipo_documento', '')::public.tipo_doc,
--     NULLIF(NEW.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
--     NEW.raw_user_meta_data ->> 'ubicacion',
--     v_status,
--     v_referido_por,
--     v_origen,
--     jsonb_build_object(
--       'acepta_politicas', COALESCE((NEW.raw_user_meta_data ->> 'acepta_politica_privacidad')::boolean, false),
--       'acepta_terminos', COALESCE((NEW.raw_user_meta_data ->> 'acepta_terminos')::boolean, false),
--       'fecha_aceptacion', NOW(),
--       'fecha_registro', NOW()
--     )
--   );
-- 
--   -- NUEVO: el login reconoce el correo desde el primer momento.
--   IF NEW.email IS NOT NULL THEN
--     INSERT INTO public.usuarios_publicos (uid, correo)
--     VALUES (NEW.id, lower(NEW.email))
--     ON CONFLICT (correo) DO NOTHING;
--   END IF;
-- 
--   RETURN NEW;
-- END;
-- $function$;
