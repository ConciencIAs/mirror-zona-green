


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."estado_orden" AS ENUM (
    'pendiente',
    'pagado',
    'en_proceso',
    'enviado',
    'entregado',
    'cancelado',
    'aporte',
    'seleccion'
);


ALTER TYPE "public"."estado_orden" OWNER TO "postgres";


CREATE TYPE "public"."estado_producto" AS ENUM (
    'activo',
    'inactivo'
);


ALTER TYPE "public"."estado_producto" OWNER TO "postgres";


CREATE TYPE "public"."presentaciones_productos" AS ENUM (
    'und',
    'gr',
    'mg'
);


ALTER TYPE "public"."presentaciones_productos" OWNER TO "postgres";


CREATE TYPE "public"."rol_usuario" AS ENUM (
    'admin',
    'customer',
    'agente',
    'super',
    'medico',
    'anonymous'
);


ALTER TYPE "public"."rol_usuario" OWNER TO "postgres";


CREATE TYPE "public"."status_profile" AS ENUM (
    'activo',
    'eliminado',
    'bloqueado',
    'inactivo'
);


ALTER TYPE "public"."status_profile" OWNER TO "postgres";


CREATE TYPE "public"."tipo_doc" AS ENUM (
    'CC',
    'CE',
    'NIT',
    'Pasaporte'
);


ALTER TYPE "public"."tipo_doc" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."actualizar_timestamp_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_user_role"() RETURNS "public"."rol_usuario"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
    SELECT COALESCE(
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()),
        'anonymous'::public.rol_usuario
    );
$$;


ALTER FUNCTION "public"."auth_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_coherencia_carrito"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
   v_es_por_gramos boolean;
BEGIN
   -- 1. Obtenemos la nueva flag booleana del producto
   SELECT es_por_gramos INTO v_es_por_gramos FROM public.productos WHERE id = NEW.producto_id;
   
   -- 2. Validación A: Si es por UNIDAD (false), NO debe tener paquete_gramos
   IF v_es_por_gramos = false AND NEW.paquete_gramos IS NOT NULL THEN
      RAISE EXCEPTION 'Error de coherencia: Un producto de venta por unidad no puede tener paquete_gramos asignado.';
   END IF;
   
   -- 3. Validación B: Si es por GRAMOS (true), SÍ O SÍ debe tener paquete_gramos
   IF v_es_por_gramos = true AND NEW.paquete_gramos IS NULL THEN
      RAISE EXCEPTION 'Error de coherencia: Debes seleccionar una presentación (gramos) para este producto.';
   END IF;

   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_coherencia_carrito"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_uid"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.uid := LEFT(REPLACE(NEW.id::text, '-', ''), 10);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_order_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_status public.status_profile;
  v_origen text;
  v_referido_por text;
  v_telefono_raw text;
  v_telefono_limpio text;
BEGIN
  v_status := 'inactivo';
  v_origen := 'registro_web';
  v_referido_por := NEW.raw_user_meta_data ->> 'referido_por';
  v_telefono_raw := NEW.raw_user_meta_data ->> 'telefono';

  IF v_telefono_raw IS NOT NULL THEN
    v_telefono_limpio := RIGHT(regexp_replace(v_telefono_raw, '\D', '', 'g'), 10);
  END IF;

  IF v_telefono_limpio IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.base_confianza
    WHERE RIGHT(regexp_replace(telefono, '\D', '', 'g'), 10) = v_telefono_limpio
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
    COALESCE(v_telefono_limpio, v_telefono_raw),
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
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_user"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
    SELECT status = 'activo' FROM public.perfiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."is_active_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."procesar_checkout"("p_tipo_entrega" "text" DEFAULT 'Pendiente'::"text", "p_comentarios" "text" DEFAULT 'Sin comentarios'::"text", "p_direccion" "text" DEFAULT ''::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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

    -- 2. Obtener datos del perfil
    SELECT full_name, correo INTO v_perfil
    FROM perfiles
    WHERE id = v_usuario_id;

    v_nombre_cliente := COALESCE(v_perfil.full_name, 'Usuario Desconocido');
    IF v_perfil.correo IS NULL THEN
        SELECT email INTO v_correo_cliente FROM auth.users WHERE id = v_usuario_id;
    ELSE
        v_correo_cliente := v_perfil.correo;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM carrito WHERE usuario_id = v_usuario_id) THEN
        RAISE EXCEPTION 'El carrito está vacío.';
    END IF;

    -- 3. Iterar sobre el carrito bloqueando los productos
    FOR v_item IN (SELECT * FROM carrito WHERE usuario_id = v_usuario_id)
    LOOP
        SELECT * INTO v_producto
        FROM productos
        WHERE id = v_item.producto_id
        FOR UPDATE; 

        IF v_producto.id IS NULL THEN
            RAISE EXCEPTION 'El producto con ID % no existe.', v_item.producto_id;
        END IF;

        v_total_gramos := NULL;

        IF v_producto.es_por_gramos THEN
            -- ==========================================
            -- LÓGICA POR GRAMOS (Corregida)
            -- ==========================================
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
            
            -- Calculamos los gramos totales vendidos
            v_total_gramos := v_item.paquete_gramos * v_item.cantidad; 

            -- Actualizamos el JSON para restar la "cantidad de paquetes" de esa presentación
            SELECT jsonb_agg(
                CASE
                    WHEN (el->>'gramos')::numeric = v_item.paquete_gramos THEN
                        jsonb_set(el, '{stock}', to_jsonb(v_stock_actual - v_item.cantidad))
                    ELSE el
                END
                ORDER BY ord
            ) INTO v_nuevas_presentaciones
            FROM jsonb_array_elements(v_producto.presentaciones::jsonb) WITH ORDINALITY AS arr(el, ord);

            -- CORRECCIÓN: Actualizamos stock_total a granel y reservado basándonos en los gramos totales
            UPDATE productos
            SET 
                presentaciones = v_nuevas_presentaciones,
                stock_total = stock_total - v_total_gramos,
                reservado = GREATEST(0, COALESCE(reservado, 0) - v_total_gramos)
            WHERE id = v_producto.id;

        ELSE
            -- ==========================================
            -- LÓGICA POR UNIDADES
            -- ==========================================
            IF (v_producto.stock_total) < v_item.cantidad THEN
                RAISE EXCEPTION 'Stock insuficiente para %. Quedan % uds.', v_producto.nombre, v_producto.stock_total;
            END IF;

            v_precio_unitario := v_producto.precio;
            v_subtotal := v_precio_unitario * v_item.cantidad;

            UPDATE productos
            SET 
                stock_total = stock_total - v_item.cantidad,
                reservado = GREATEST(0, COALESCE(reservado, 0) - v_item.cantidad)
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
$$;


ALTER FUNCTION "public"."procesar_checkout"("p_tipo_entrega" "text", "p_comentarios" "text", "p_direccion" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_campos_perfil"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."proteger_campos_perfil"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_rol_usuario"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Permitir la edición solo si:
        -- 1. El usuario autenticado en la app NO es admin
        -- 2. Y NO se está usando el service_role (Panel de Supabase / Backend)
        -- 3. Y la petición sí viene de un usuario autenticado de la app (auth.uid() no es nulo)
        IF (
            public.auth_user_role() != 'admin' 
            AND auth.role() != 'service_role' 
            AND auth.uid() IS NOT NULL 
            AND OLD.rol IS DISTINCT FROM NEW.rol
        ) THEN
            NEW.rol = OLD.rol;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."proteger_rol_usuario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_initial_tracking"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Inicializamos el JSONB como un array con un objeto
  NEW.tracking := jsonb_build_array(
    jsonb_build_object(
      'estado', 'pendiente',
      'fecha', now()
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_initial_tracking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_y_auditar_inventario"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_admin_id uuid;
    v_motivo text;
    v_tipo_mov text;
BEGIN
    v_admin_id := auth.uid();
    
    IF (OLD.stock < NEW.stock) THEN
        v_tipo_mov := 'ingreso';
        v_motivo := 'Abastecimiento de stock en almacén.';
    ELSIF (OLD.stock > NEW.stock) THEN
        v_tipo_mov := 'venta_o_ajuste';
        v_motivo := 'Despacho de unidades / Ajuste manual de inventario.';
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO public.historial_inventario (producto_id, variante_id, admin_id, tipo_movimiento, cantidad_anterior, cantidad_nueva, motivo)
    VALUES (NEW.producto_id, NEW.id, v_admin_id, v_tipo_mov, OLD.stock, NEW.stock, v_motivo);

    UPDATE public.productos
    SET stock_total = (SELECT COALESCE(SUM(stock), 0) FROM public.producto_variantes WHERE producto_id = NEW.producto_id AND deleted_at IS NULL)
    WHERE id = NEW.producto_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sincronizar_y_auditar_inventario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    product UUID;
BEGIN

    product := COALESCE(NEW.product_id, OLD.product_id);

    UPDATE public.productos p
    SET

        rating_average = COALESCE((
            SELECT ROUND(AVG(rating)::numeric,2)
            FROM public.product_reviews
            WHERE product_id = product
        ),0),

        rating_count = (
            SELECT COUNT(*)
            FROM public.product_reviews
            WHERE product_id = product
        )

    WHERE p.id = product;

    RETURN NULL;

END;
$$;


ALTER FUNCTION "public"."update_product_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_codigo_referido"("codigo_prueba" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Retorna true si encuentra un perfil ACTIVO con ese código
    RETURN EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE codigo_invitacion = codigo_prueba AND status = 'activo'
    );
END;
$$;


ALTER FUNCTION "public"."validar_codigo_referido"("codigo_prueba" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."base_confianza" (
    "telefono" "text" NOT NULL,
    "agregado_el" timestamp with time zone DEFAULT "now"(),
    "agregado_por" "uuid",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."base_confianza" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrito" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" numeric(10,2) DEFAULT 1.00 NOT NULL,
    "paquete_gramos" numeric(10,2) DEFAULT NULL::numeric
);


ALTER TABLE "public"."carrito" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dynamic_components" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "html_content" "text",
    "css_content" "text",
    "name" "text",
    "slug" "text",
    "project_data" "text",
    "js_content" "text"
);


ALTER TABLE "public"."dynamic_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historial_inventario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "uuid",
    "admin_id" "uuid",
    "tipo_movimiento" "text" NOT NULL,
    "cantidad_anterior" integer NOT NULL,
    "cantidad_nueva" integer NOT NULL,
    "motivo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historial_inventario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordenes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "lista_productos" "jsonb" NOT NULL,
    "precio_total" numeric(12,2) NOT NULL,
    "status" "public"."estado_orden" DEFAULT 'pendiente'::"public"."estado_orden" NOT NULL,
    "tipo_entrega" "text" DEFAULT 'Envío'::"text" NOT NULL,
    "comentarios_usuario" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nombre_cliente" "text",
    "correo_cliente" "text",
    "tracking" "jsonb" DEFAULT '[]'::"jsonb",
    "direccion" "text",
    "uid" character varying(12)
);


ALTER TABLE "public"."ordenes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "config_name" "text" NOT NULL,
    "content" json
);


ALTER TABLE "public"."page_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "rol" "public"."rol_usuario" DEFAULT 'customer'::"public"."rol_usuario" NOT NULL,
    "correo" "text" NOT NULL,
    "telefono" "text",
    "documento" "text",
    "tipo_documento" "public"."tipo_doc",
    "ubicacion" "text",
    "fecha_nacimiento" "date",
    "datos_adicionales" "jsonb" DEFAULT '{"acepta_politicas": false, "fecha_aceptacion": null}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "full_name" "text",
    "status" "public"."status_profile" DEFAULT 'inactivo'::"public"."status_profile",
    "codigo_invitacion" "text",
    "referido_por" "text",
    "origen_autorizacion" "text"
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."product_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "urls_imagenes" "text"[] DEFAULT '{}'::"text"[],
    "status" "public"."estado_producto" DEFAULT 'inactivo'::"public"."estado_producto" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "stock_total" integer DEFAULT 0 NOT NULL,
    "sku" "text" NOT NULL,
    "costo" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "precio" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "has_product_variantes" boolean DEFAULT false,
    "es_por_gramos" boolean DEFAULT false NOT NULL,
    "presentaciones" "jsonb" DEFAULT '[]'::"jsonb",
    "reservado" integer DEFAULT 0,
    "rating_average" numeric(3,2) DEFAULT 0 NOT NULL,
    "rating_count" integer DEFAULT 0 NOT NULL,
    "presentacion_venta" "public"."presentaciones_productos" DEFAULT 'und'::"public"."presentaciones_productos",
    "ofertas" "jsonb"[] DEFAULT '{}'::"jsonb"[]
);


ALTER TABLE "public"."productos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "public"."rol_usuario" NOT NULL,
    "urls_permitidas" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "orden" smallint DEFAULT '0'::smallint
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_publicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uid" "uuid",
    "correo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usuarios_publicos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."base_confianza"
    ADD CONSTRAINT "base_confianza_pkey" PRIMARY KEY ("telefono", "id");



ALTER TABLE ONLY "public"."carrito"
    ADD CONSTRAINT "carrito_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrito"
    ADD CONSTRAINT "carrito_unique_item" UNIQUE NULLS NOT DISTINCT ("usuario_id", "producto_id", "paquete_gramos");



ALTER TABLE ONLY "public"."dynamic_components"
    ADD CONSTRAINT "dynamic_home_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_inventario"
    ADD CONSTRAINT "historial_inventario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_config"
    ADD CONSTRAINT "page_config_config_name_key" UNIQUE ("config_name");



ALTER TABLE ONLY "public"."page_config"
    ADD CONSTRAINT "page_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_codigo_invitacion_key" UNIQUE ("codigo_invitacion");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_correo_key" UNIQUE ("correo");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "uq_product_review" UNIQUE ("product_id", "user_id");



ALTER TABLE ONLY "public"."usuarios_publicos"
    ADD CONSTRAINT "usuarios_publicos_correo_key" UNIQUE ("correo");



ALTER TABLE ONLY "public"."usuarios_publicos"
    ADD CONSTRAINT "usuarios_publicos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_carrito_usuario_id" ON "public"."carrito" USING "btree" ("usuario_id");



CREATE INDEX "idx_ordenes_usuario_id" ON "public"."ordenes" USING "btree" ("usuario_id");



CREATE INDEX "idx_productos_sku" ON "public"."productos" USING "btree" ("sku");



CREATE INDEX "idx_productos_status_deleted" ON "public"."productos" USING "btree" ("status", "deleted_at");



CREATE INDEX "idx_productos_tags" ON "public"."productos" USING "gin" ("tags");



CREATE INDEX "idx_review_created" ON "public"."product_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_review_product" ON "public"."product_reviews" USING "btree" ("product_id");



CREATE INDEX "idx_review_user" ON "public"."product_reviews" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "orders_generate_uid" BEFORE INSERT ON "public"."ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."generate_order_uid"();



CREATE OR REPLACE TRIGGER "tr_check_coherencia_carrito" BEFORE INSERT OR UPDATE ON "public"."carrito" FOR EACH ROW EXECUTE FUNCTION "public"."check_coherencia_carrito"();



CREATE OR REPLACE TRIGGER "tr_proteger_campos_perfil" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_campos_perfil"();



CREATE OR REPLACE TRIGGER "tr_update_ordenes_timestamp" BEFORE UPDATE ON "public"."ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "tr_update_perfiles_timestamp" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "tr_update_productos_timestamp" BEFORE UPDATE ON "public"."productos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "tr_update_roles_timestamp" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_review_delete" AFTER DELETE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_rating"();



CREATE OR REPLACE TRIGGER "trg_review_insert" AFTER INSERT ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_rating"();



CREATE OR REPLACE TRIGGER "trg_review_update" AFTER UPDATE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_rating"();



CREATE OR REPLACE TRIGGER "trg_review_updated_at" BEFORE UPDATE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_initial_tracking" BEFORE INSERT ON "public"."ordenes" FOR EACH ROW EXECUTE FUNCTION "public"."set_initial_tracking"();



ALTER TABLE ONLY "public"."base_confianza"
    ADD CONSTRAINT "base_confianza_agregado_por_fkey" FOREIGN KEY ("agregado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carrito"
    ADD CONSTRAINT "carrito_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrito"
    ADD CONSTRAINT "carrito_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_inventario"
    ADD CONSTRAINT "historial_inventario_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historial_inventario"
    ADD CONSTRAINT "historial_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes"
    ADD CONSTRAINT "ordenes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_publicos"
    ADD CONSTRAINT "usuarios_publicos_uid_fkey" FOREIGN KEY ("uid") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;



CREATE POLICY "Base Confianza - Admin" ON "public"."base_confianza" USING (("public"."auth_user_role"() = 'admin'::"public"."rol_usuario"));



CREATE POLICY "CMS Config - Escritura Admin" ON "public"."page_config" USING (("public"."auth_user_role"() = 'admin'::"public"."rol_usuario"));



CREATE POLICY "CMS Config - Lectura Pública" ON "public"."page_config" FOR SELECT USING (true);



CREATE POLICY "CMS Home - Escritura Admin" ON "public"."dynamic_components" USING (("public"."auth_user_role"() = 'admin'::"public"."rol_usuario"));



CREATE POLICY "CMS Home - Lectura Pública" ON "public"."dynamic_components" FOR SELECT USING (true);



CREATE POLICY "Carrito - Actualización" ON "public"."carrito" FOR UPDATE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Carrito - Eliminación" ON "public"."carrito" FOR DELETE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Carrito - Inserción" ON "public"."carrito" FOR INSERT WITH CHECK ((("auth"."uid"() = "usuario_id") AND ("public"."is_active_user"() = true)));



CREATE POLICY "Carrito - Selección" ON "public"."carrito" FOR SELECT USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Historial Inventario - Consulta exclusiva Staff" ON "public"."historial_inventario" FOR SELECT USING (("public"."auth_user_role"() = ANY (ARRAY['admin'::"public"."rol_usuario", 'agente'::"public"."rol_usuario"])));



CREATE POLICY "Perfiles - Auto registro público" ON "public"."perfiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Perfiles - Propietario lee su perfil o Staff completo" ON "public"."perfiles" FOR SELECT USING ((("auth"."uid"() = "id") OR ("public"."auth_user_role"() = ANY (ARRAY['admin'::"public"."rol_usuario", 'agente'::"public"."rol_usuario"]))));



CREATE POLICY "Perfiles - Propietario o Admin actualizan" ON "public"."perfiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR ("public"."auth_user_role"() = 'admin'::"public"."rol_usuario")));



CREATE POLICY "Productos - Filtro público activo / Staff ve todo" ON "public"."productos" FOR SELECT USING (((("status" = 'activo'::"public"."estado_producto") AND ("deleted_at" IS NULL)) OR ("public"."auth_user_role"() = ANY (ARRAY['admin'::"public"."rol_usuario", 'agente'::"public"."rol_usuario"]))));



CREATE POLICY "Productos - Gestión Admin" ON "public"."productos" USING (("public"."auth_user_role"() = 'admin'::"public"."rol_usuario"));



CREATE POLICY "Roles - Lectura Autenticados" ON "public"."roles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Roles - Modificación Admin" ON "public"."roles" USING (("public"."auth_user_role"() = 'admin'::"public"."rol_usuario"));



CREATE POLICY "Tags - Gestión Admin" ON "public"."tags" USING (("public"."auth_user_role"() = 'admin'::"public"."rol_usuario"));



CREATE POLICY "Tags - Lectura Pública" ON "public"."tags" FOR SELECT USING (true);



CREATE POLICY "Usuarios Públicos - Acceso Libre" ON "public"."usuarios_publicos" USING (true);



ALTER TABLE "public"."base_confianza" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carrito" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dynamic_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historial_inventario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordenes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_delete" ON "public"."product_reviews" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "reviews_insert" ON "public"."product_reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "reviews_select" ON "public"."product_reviews" FOR SELECT USING (true);



CREATE POLICY "reviews_update" ON "public"."product_reviews" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuarios_publicos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Órdenes - Actualización exclusiva de Staff" ON "public"."ordenes" FOR UPDATE USING (("public"."auth_user_role"() = ANY (ARRAY['admin'::"public"."rol_usuario", 'agente'::"public"."rol_usuario"])));



CREATE POLICY "Órdenes - Dueño o Staff consultan" ON "public"."ordenes" FOR SELECT USING ((("auth"."uid"() = "usuario_id") OR ("public"."auth_user_role"() = ANY (ARRAY['admin'::"public"."rol_usuario", 'agente'::"public"."rol_usuario"]))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_timestamp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_timestamp_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_coherencia_carrito"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_coherencia_carrito"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_coherencia_carrito"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."procesar_checkout"("p_tipo_entrega" "text", "p_comentarios" "text", "p_direccion" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."procesar_checkout"("p_tipo_entrega" "text", "p_comentarios" "text", "p_direccion" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."procesar_checkout"("p_tipo_entrega" "text", "p_comentarios" "text", "p_direccion" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_campos_perfil"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_campos_perfil"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_campos_perfil"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_rol_usuario"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_rol_usuario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_rol_usuario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_initial_tracking"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_initial_tracking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_initial_tracking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sincronizar_y_auditar_inventario"() TO "anon";
GRANT ALL ON FUNCTION "public"."sincronizar_y_auditar_inventario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sincronizar_y_auditar_inventario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_codigo_referido"("codigo_prueba" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validar_codigo_referido"("codigo_prueba" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_codigo_referido"("codigo_prueba" "text") TO "service_role";



GRANT ALL ON TABLE "public"."base_confianza" TO "anon";
GRANT ALL ON TABLE "public"."base_confianza" TO "authenticated";
GRANT ALL ON TABLE "public"."base_confianza" TO "service_role";



GRANT ALL ON TABLE "public"."carrito" TO "anon";
GRANT ALL ON TABLE "public"."carrito" TO "authenticated";
GRANT ALL ON TABLE "public"."carrito" TO "service_role";



GRANT ALL ON TABLE "public"."dynamic_components" TO "anon";
GRANT ALL ON TABLE "public"."dynamic_components" TO "authenticated";
GRANT ALL ON TABLE "public"."dynamic_components" TO "service_role";



GRANT ALL ON TABLE "public"."historial_inventario" TO "anon";
GRANT ALL ON TABLE "public"."historial_inventario" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_inventario" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes" TO "anon";
GRANT ALL ON TABLE "public"."ordenes" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes" TO "service_role";



GRANT ALL ON TABLE "public"."page_config" TO "anon";
GRANT ALL ON TABLE "public"."page_config" TO "authenticated";
GRANT ALL ON TABLE "public"."page_config" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."product_reviews" TO "anon";
GRANT ALL ON TABLE "public"."product_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."product_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."productos" TO "anon";
GRANT ALL ON TABLE "public"."productos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_publicos" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_publicos" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_publicos" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







