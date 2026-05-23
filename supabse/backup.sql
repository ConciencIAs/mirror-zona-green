-- =============================================================================
-- 1. EXTENSIONES Y TIPOS DE DATOS PERSONALIZADOS (ENUMS)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.rol_usuario AS ENUM ('admin', 'customer', 'agente', 'medico', 'anonymous');
CREATE TYPE public.tipo_doc AS ENUM ('CC', 'CE', 'NIT', 'Pasaporte');
CREATE TYPE public.estado_producto AS ENUM ('activo', 'inactivo');
CREATE TYPE public.estado_orden AS ENUM ('pendiente', 'pagado', 'en_proceso', 'enviado', 'entregado', 'cancelado');

-- =============================================================================
-- 2. CREACIÓN DE TABLAS (DICCIONARIO DE DATOS)
-- =============================================================================

--- 👥 MÓDULO DE USUARIOS Y AUTENTICACIÓN ---

CREATE TABLE public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre public.rol_usuario UNIQUE NOT NULL,
    urls_permitidas text[] NOT NULL DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.perfiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol public.rol_usuario NOT NULL DEFAULT 'customer',
    correo text NOT NULL,
    telefono text,
    documento text,
    tipo_documento public.tipo_doc,
    ubicacion text,
    fecha_nacimiento date,
    datos_adicionales jsonb NOT NULL DEFAULT '{"acepta_politicas": false, "fecha_aceptacion": null}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz DEFAULT null
);

CREATE TABLE public.usuarios_publicos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uid uuid REFERENCES public.perfiles(id) ON DELETE CASCADE,
    correo text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now()
);

--- 🎨 MÓDULO DE CONFIGURACIÓN Y CUSTOM PAGES ---

CREATE TABLE public.page_home (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_uid uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
    banners jsonb[] NOT NULL DEFAULT '{}'
);

CREATE TABLE public.page_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    logo text,
    nombre text NOT NULL,
    telefono text DEFAULT '3134312139',
    franja_promocional text DEFAULT 'Ecosistema para la Reducción de Riesgos y Daños',
    url_politica_datos text,
    url_terminos text,
    url_legislacion text
);

CREATE TABLE public.page_documentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    url_pdf text NOT NULL
);

--- 📦 MÓDULO DE CATÁLOGO E INVENTARIO ---

CREATE TABLE public.categorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text UNIQUE NOT NULL,
    deleted_at timestamptz DEFAULT null
);

CREATE TABLE public.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text UNIQUE NOT NULL
);

CREATE TABLE public.productos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
    nombre text NOT NULL,
    descripcion text,
    urls_imagenes text[] DEFAULT '{}',
    status public.estado_producto NOT NULL DEFAULT 'inactivo',
    tags text[] DEFAULT '{}',
    stock_total int NOT NULL DEFAULT 0,
    sku text UNIQUE NOT NULL,
    costo numeric(12,2) NOT NULL DEFAULT 0.00,
    precio numeric(12,2) NOT NULL DEFAULT 0.00,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz DEFAULT null
);

CREATE TABLE public.producto_variantes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id uuid REFERENCES public.productos(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    descripcion text,
    urls_imagenes text[] DEFAULT '{}',
    precio numeric(12,2) NOT NULL DEFAULT 0.00,
    stock int NOT NULL DEFAULT 0,
    gramos_disponibles numeric(10,2) DEFAULT 0.00,
    cantidad_minima_venta numeric(10,2) DEFAULT 1.00,
    precio_minimo_venta numeric(12,2) DEFAULT 0.00,
    opciones_venta numeric[] DEFAULT '{}', -- Cortes de gramos permitidos, ej: {5, 10, 20}
    fecha_llegada date,
    status public.estado_producto NOT NULL DEFAULT 'inactivo',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz DEFAULT null
);

--- 🛒 MÓDULO DE TRANSACCIONES Y VENTAS ---

CREATE TABLE public.carrito (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    variante_id uuid REFERENCES public.producto_variantes(id) ON DELETE CASCADE,
    cantidad numeric(10,2) NOT NULL DEFAULT 1.00,
    es_gramos boolean NOT NULL DEFAULT false
);

CREATE TABLE public.ordenes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    lista_productos jsonb NOT NULL, -- Snapshot inmutable de la orden
    precio_total numeric(12,2) NOT NULL,
    status public.estado_orden NOT NULL DEFAULT 'pendiente',
    tipo_entrega text NOT NULL DEFAULT 'Envío', -- 'Envío' o 'Recoger en punto'
    comentarios_agente text, -- Notas internas exclusivas del staff
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

--- 📑 MÓDULO DE AUDITORÍA Y SEGURIDAD INTERNA ---

CREATE TABLE public.historial_inventario (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
    variante_id uuid REFERENCES public.producto_variantes(id) ON DELETE SET NULL,
    admin_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
    tipo_movimiento text NOT NULL, -- 'ingreso', 'venta', 'ajuste_manual'
    cantidad_anterior int NOT NULL,
    cantidad_nueva int NOT NULL,
    motivo text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 3. FUNCIONES DE AYUDA (HELPERS) Y PROCEDIMIENTOS (Ahora que las tablas existen)
-- =============================================================================

-- Función para actualizar automáticamente el campo updated_at
CREATE OR REPLACE FUNCTION public.actualizar_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función segura para obtener el rol del usuario autenticado actual desde RLS
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS public.rol_usuario
LANGUAGE sql SECURITY DEFINER AS $$
    SELECT COALESCE(
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()),
        'anonymous'::public.rol_usuario
    );
$$;

-- =============================================================================
-- 4. ÍNDICES DE RENDIMIENTO (PERFORMANCE)
-- =============================================================================
CREATE INDEX idx_productos_tags ON public.productos USING gin (tags);
CREATE INDEX idx_productos_sku ON public.productos (sku);
CREATE INDEX idx_productos_status_deleted ON public.productos (status, deleted_at);
CREATE INDEX idx_variantes_producto_id ON public.producto_variantes (producto_id);
CREATE INDEX idx_ordenes_usuario_id ON public.ordenes (usuario_id);
CREATE INDEX idx_carrito_usuario_id ON public.carrito (usuario_id);

-- =============================================================================
-- 5. CONFIGURACIÓN DE POLÍTICAS DE ACCESO SEGURAS (ROW LEVEL SECURITY - RLS)
-- =============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_home ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_inventario ENABLE ROW LEVEL SECURITY;

-- 🔐 POLÍTICAS: ROLES
CREATE POLICY "Roles - Lectura Autenticados" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Roles - Modificación Admin" ON public.roles FOR ALL USING (public.auth_user_role() = 'admin');

-- 🔐 POLÍTICAS: PERFILES
CREATE POLICY "Perfiles - Propietario lee su perfil o Staff completo" ON public.perfiles FOR SELECT USING (auth.uid() = id OR public.auth_user_role() IN ('admin', 'agente'));
CREATE POLICY "Perfiles - Auto registro público" ON public.perfiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Perfiles - Propietario o Admin actualizan" ON public.perfiles FOR UPDATE USING (auth.uid() = id OR public.auth_user_role() = 'admin');

-- 🔐 POLÍTICAS: USUARIOS PÚBLICOS (Pre-validación link)
CREATE POLICY "Usuarios Públicos - Acceso Libre" ON public.usuarios_publicos FOR ALL USING (true);

-- 🔐 POLÍTICAS: CONFIGURACIÓN Y CONTENIDOS (CMS)
CREATE POLICY "CMS Home - Lectura Pública" ON public.page_home FOR SELECT USING (true);
CREATE POLICY "CMS Home - Escritura Admin" ON public.page_home FOR ALL USING (public.auth_user_role() = 'admin');

CREATE POLICY "CMS Config - Lectura Pública" ON public.page_config FOR SELECT USING (true);
CREATE POLICY "CMS Config - Escritura Admin" ON public.page_config FOR ALL USING (public.auth_user_role() = 'admin');

CREATE POLICY "CMS Documentos - Lectura Pública" ON public.page_documentos FOR SELECT USING (true);
CREATE POLICY "CMS Documentos - Escritura Admin" ON public.page_documentos FOR ALL USING (public.auth_user_role() = 'admin');

-- 🔐 POLÍTICAS: CATEGORÍAS Y TAGS
CREATE POLICY "Categorías - Lectura Pública" ON public.categorias FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Categorías - Gestión Admin" ON public.categorias FOR ALL USING (public.auth_user_role() = 'admin');

CREATE POLICY "Tags - Lectura Pública" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Tags - Gestión Admin" ON public.tags FOR ALL USING (public.auth_user_role() = 'admin');

-- 🔐 POLÍTICAS: PRODUCTOS Y VARIANTES (Regla: Buscador Limpio)
CREATE POLICY "Productos - Filtro público activo / Staff ve todo" ON public.productos FOR SELECT USING ((status = 'activo' AND deleted_at IS NULL) OR public.auth_user_role() IN ('admin', 'agente'));
CREATE POLICY "Productos - Gestión Admin" ON public.productos FOR ALL USING (public.auth_user_role() = 'admin');

CREATE POLICY "Variantes - Filtro público activo / Staff ve todo" ON public.producto_variantes FOR SELECT USING ((status = 'activo' AND deleted_at IS NULL) OR public.auth_user_role() IN ('admin', 'agente'));
CREATE POLICY "Variantes - Gestión Admin" ON public.producto_variantes FOR ALL USING (public.auth_user_role() = 'admin');

-- 🔐 POLÍTICAS: CARRITO (Aislamiento de Clientes)
CREATE POLICY "Carrito - Operación exclusiva del dueño" ON public.carrito FOR ALL USING (auth.uid() = usuario_id);

-- 🔐 POLÍTICAS: ÓRDENES (Inmutabilidad Financiera)
CREATE POLICY "Órdenes - Dueño o Staff consultan" ON public.ordenes FOR SELECT USING (auth.uid() = usuario_id OR public.auth_user_role() IN ('admin', 'agente'));
CREATE POLICY "Órdenes - Actualización exclusiva de Staff" ON public.ordenes FOR UPDATE USING (public.auth_user_role() IN ('admin', 'agente'));

-- 🔐 POLÍTICAS: HISTORIAL DE AUDITORÍA DE INVENTARIO
CREATE POLICY "Historial Inventario - Consulta exclusiva Staff" ON public.historial_inventario FOR SELECT USING (public.auth_user_role() IN ('admin', 'agente'));

-- =============================================================================
-- 6. TRIGGERS AUTOMATIZADOS (SISTEMA DE CONTROL Y AUDITORÍA)
-- =============================================================================

--- AUTOMATIZACIÓN DE TIMESTAMPS DE MODIFICACIÓN ---
CREATE TRIGGER tr_update_roles_timestamp BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();
CREATE TRIGGER tr_update_perfiles_timestamp BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();
CREATE TRIGGER tr_update_productos_timestamp BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();
CREATE TRIGGER tr_update_variantes_timestamp BEFORE UPDATE ON public.producto_variantes FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();
CREATE TRIGGER tr_update_ordenes_timestamp BEFORE UPDATE ON public.ordenes FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();

--- TRIGGER PARA PROTEGER ROLES EN PERFILES ---
CREATE OR REPLACE FUNCTION public.proteger_rol_usuario()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (public.auth_user_role() != 'admin' AND OLD.rol IS DISTINCT FROM NEW.rol) THEN
            NEW.rol = OLD.rol;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_proteger_rol_perfil BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public.proteger_rol_usuario();


--- TRIGGER PARA AUDITAR CAMBIOS DE INVENTARIO AUTOMÁTICAMENTE ---
CREATE OR REPLACE FUNCTION public.sincronizar_y_auditar_inventario()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_auditar_inventario AFTER UPDATE OF stock ON public.producto_variantes FOR EACH ROW EXECUTE FUNCTION public.sincronizar_y_auditar_inventario();

-- 1. POLÍTICA DE LECTURA: Cualquier usuario puede ver las imágenes del catálogo
CREATE POLICY "Productos Bucket - Lectura Pública"
ON storage.objects FOR SELECT
USING (bucket_id = 'productos');

-- 2. POLÍTICA DE INSERCIÓN: Solo Admin y Agente pueden subir nuevos archivos
CREATE POLICY "Productos Bucket - Inserción exclusiva Staff"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'productos'
    AND public.auth_user_role() IN ('admin', 'agente')
);

-- 3. POLÍTICA DE ACTUALIZACIÓN: Solo Admin y Agente pueden reemplazar archivos existentes
CREATE POLICY "Productos Bucket - Actualización exclusiva Staff"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'productos'
    AND public.auth_user_role() IN ('admin', 'agente')
);

-- 4. POLÍTICA DE ELIMINACIÓN: Solo Admin y Agente pueden borrar archivos del servidor
CREATE POLICY "Productos Bucket - Eliminación exclusiva Staff"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'productos'
    AND public.auth_user_role() IN ('admin', 'agente')
);

-- Función que intercepta el registro nativo de Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol, correo, datos_adicionales)
  VALUES (
    NEW.id,
    'customer'::public.rol_usuario,
    NEW.email,
    '{"acepta_politicas": false, "fecha_aceptacion": null}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador asociado a la tabla interna de autenticación
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();