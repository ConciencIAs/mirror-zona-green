# 🗄️ Esquema de Base de Datos y Reglas de Negocio (Supabase / PostgreSQL)

Este documento detalla la estructura relacional, los tipos de datos personalizados y las directivas de seguridad basadas en **Row Level Security (RLS)** para el backend del Marketplace.

---

## 1. Tipos de Datos Personalizados (Enums)

Para garantizar la integridad de los datos y evitar valores inconsistentes en la base de datos, se utilizan los siguientes enums:

*   `rol_usuario`: `('admin', 'customer', 'agente', 'medico', 'anonymous')`
*   `tipo_doc`: `('CC', 'CE', 'NIT', 'Pasaporte')`
*   `estado_producto`: `('activo', 'inactivo')`
*   `estado_orden`: `('pendiente', 'pagado', 'en_proceso', 'enviado', 'entregado', 'cancelado')`

---

## 2. Diccionario de Tablas

### 👥 Módulo de Usuarios y Autenticación

#### Tabla: `roles`
Almacena la matriz de acceso de la aplicación según el rol asignado.
*   `id` (uuid, PK): Identificador único.
*   `nombre` (rol_usuario, Unique): Nombre del rol.
*   `urls_permitidas` (text[]): Array de rutas/URLs del frontend a las que tiene acceso permitido.
*   `created_at` / `updated_at` (timestamptz)

#### Tabla: `perfiles`
Extensión de la tabla nativa `auth.users` de Supabase. Guarda la información comercial y médica real de los usuarios.
*   `id` (uuid, PK): Relación `REFERENCES auth.users(id) ON DELETE CASCADE`.
*   `rol` (rol_usuario, Default: 'customer'): Rol asignado en el sistema.
*   `correo` (text, Not Null)
*   `telefono` (text)
*   `documento` (text)
*   `tipo_documento` (tipo_doc)
*   `ubicacion` (text): Dirección o geolocalización de envío.
*   `fecha_nacimiento` (date)
*   `datos_adicionales` (jsonb): Datos flexibles. Estructura requerida: `{"acepta_politicas": boolean, "fecha_aceptacion": "ISO-TIMESTAMP"}`.
*   `created_at` / `updated_at` (timestamptz)

#### Tabla: `usuarios_publicos`
Tabla optimizada para flujos de pre-validación del cliente antes del login por Magic Link.
*   `id` (uuid, PK)
*   `uid` (uuid): Relación `REFERENCES perfiles(id) ON DELETE CASCADE`.
*   `correo` (text, Unique, Not Null)
*   `created_at` (timestamptz)

---

### 🎨 Módulo de Configuración y Custom Pages
*Todas las tablas de este módulo son públicas para lectura, pero editables únicamente por el rol `admin`.*

#### Tabla: `page_home`
*   `id` (uuid, PK)
*   `admin_uid` (uuid): ID del administrador que realizó el último cambio.
*   `banners` (jsonb[]): Lista de banners estructurados. Esquema: `[{"url": "str", "banner": "str_url_img", "title": "str", "description": "str"}]`.

#### Tabla: `page_config`
*   `id` (uuid, PK)
*   `logo` (text): URL de la imagen del logo de la plataforma.
*   `nombre` (text): Nombre comercial del marketplace.
*   `telefono` (text, Default: '3134312139')
*   `url_politica_datos` (text): Enlace al documento legal.
*   `url_terminos` (text): Enlace a términos y condiciones.
*   `url_legislacion` (text): Enlace a la normativa legal aplicable.

#### Tabla: `page_documentos`
*   `id` (uuid, PK)
*   `nombre` (text): Nombre descriptivo del documento.
*   `url_pdf` (text): Enlace de descarga/visualización del PDF en el Storage.

---

### 📦 Módulo de Catálogo e Inventario

#### Tabla: `categorias`
*   `id` (uuid, PK)
*   `nombre` (text, Unique, Not Null)

#### Tabla: `tags`
*   `id` (uuid, PK)
*   `nombre` (text, Unique, Not Null)

#### Tabla: `productos`
*   `id` (uuid, PK)
*   `categoria_id` (uuid): Relación `REFERENCES categorias(id)`.
*   `nombre` (text, Not Null)
*   `descripcion` (text)
*   `urls_imagenes` (text[]): Listado de URLs del Storage. *Regla de negocio: El frontend debe validar dimensiones idénticas.*
*   `status` (estado_producto, Default: 'inactivo')
*   `tags` (text[]): Array de texto plano mapeando los nombres de la tabla `tags`.
*   `stock_total` (int, Default: 0): Sumatoria calculada del stock de sus variantes.
*   `sku` (text, Unique)
*   `costo` (numeric): Costo interno de adquisición.
*   `precio` (numeric): Precio base de venta al público.
*   `created_at` / `updated_at` (timestamptz)

#### Tabla: `producto_variantes`
*   `id` (uuid, PK)
*   `producto_id` (uuid): Relación `REFERENCES productos(id) ON DELETE CASCADE`.
*   `nombre` (text)
*   `descripcion` (text)
*   `urls_imagenes` (text[])
*   `precio` (numeric)
*   `stock` (int)
*   `gramos_disponibles` (numeric)
*   `cantidad_minima_venta` (numeric, Default: 1)
*   `precio_minimo_venta` (numeric)
*   `opciones_venta` (numeric[]): Array de cortes de venta permitidos en gramos. Ejemplo: `[10, 20, 0]` (donde 0 representa venta libre).
*   `fecha_llegada` (date)
*   `status` (estado_producto, Default: 'inactivo')
*   `created_at` / `updated_at` (timestamptz)

---

### 🛒 Módulo de Transacciones y Ventas

#### Tabla: `carrito`
*   `id` (uuid, PK)
*   `usuario_id` (uuid, Not Null): Relación `REFERENCES perfiles(id) ON DELETE CASCADE`.
*   `producto_id` (uuid): Relación `REFERENCES productos(id)`.
*   `variante_id` (uuid, Nullable): Relación `REFERENCES producto_variantes(id)`.
*   `cantidad` (numeric, Not Null)
*   `es_gramos` (boolean, Default: false): Flag para distinguir ventas basadas en peso de las basadas en unidades físicas.

#### Tabla: `ordenes`
*   `id` (uuid, PK)
*   `usuario_id` (uuid, Not Null): Relación `REFERENCES perfiles(id)`.
*   `lista_productos` (jsonb, Not Null): **Snapshot inmutable** del estado, SKU, nombre, variante y precio unitario del producto al momento exacto de la compra. Evita desajustes históricos si el precio del catálogo cambia en el futuro.
*   `precio_total` (numeric, Not Null): Suma total pagada.
*   `status` (estado_orden, Default: 'pendiente')
*   `created_at` (timestamptz, Default: now())
*   `updated_at` (timestamptz, Default: now())

---

-- Agregar al módulo de Catálogo e Inventario
CREATE TABLE historial_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid REFERENCES productos(id) ON DELETE SET NULL,
  variante_id uuid REFERENCES producto_variantes(id) ON DELETE SET NULL,
  admin_id uuid REFERENCES perfiles(id),
  tipo_movimiento text NOT NULL, -- 'ingreso', 'venta', 'ajuste_manual', 'devolucion'
  cantidad_anterior int NOT NULL,
  cantidad_nueva int NOT NULL,
  motivo text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS: Solo lectura para staff, inserciones automáticas o por admin
ALTER TABLE historial_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff lee historial" ON historial_inventario FOR SELECT USING (auth_user_role() IN ('admin', 'agente'));

## 3. Matriz de Reglas de Negocio y Permisos (RLS)

| Tabla | SELECT (Lectura) | INSERT (Escritura) | UPDATE (Modificación) | DELETE (Eliminación) |
| :--- | :--- | :--- | :--- | :--- |
| `roles` | 🔓 Autenticados | 🚫 Nadie | 👑 Solo Admin | 🚫 Nadie |
| `perfiles` | 👤 Propietario / 👑 Admin | 👤 Propietario (Al registrarse) | 👤 Propietario (Menos rol) / 👑 Admin | 👑 Solo Admin |
| `usuarios_publicos` | 🌍 Público | 🌍 Público | 🚫 Nadie | 🚫 Nadie |
| `custom_pages` | 🌍 Público | 👑 Solo Admin | 👑 Solo Admin | 👑 Solo Admin |
| `categorias` / `tags` | 🌍 Público | 👑 Solo Admin | 👑 Solo Admin | 👑 Solo Admin |
| `productos` | 🌍 Público (Solo `status = 'activo'`) | 👑 Solo Admin | 👑 Solo Admin | 👑 Solo Admin |
| `producto_variantes`| 🌍 Público (Solo `status = 'activo'`) | 👑 Solo Admin | 👑 Solo Admin | 👑 Solo Admin |
| `carrito` | 👤 Solo el Creador | 👤 Solo el Creador | 👤 Solo el Creador | 👤 Solo el Creador |
| `ordenes` | 👤 Propietario / 🎧 Agente / 👑 Admin | ⚙️ **Edge Function Únicamente** | 🎧 Agente / 👑 Admin (Solo `status` y `updated_at`) | 🚫 **Nadie (Inmutable)** |

### Reglas Críticas implementadas mediante PostgreSQL (DPA):
1.  **Buscador Limpio:** Ningún usuario (excepto `admin` o `agente`) puede realizar `SELECT` sobre la tabla `productos` o `producto_variantes` si el estado se encuentra configurado como `'inactivo'`.
2.  **Inmutabilidad de Órdenes:** No existe política de `DELETE` para la tabla `ordenes`. Las actualizaciones (`UPDATE`) están restringidas por código SQL exclusivamente a los campos `status` y `updated_at`. El cuerpo de la orden no puede ser alterado bajo ninguna circunstancia.

---

## 4. Arquitectura de Flujo para Creación de Órdenes
[ Frontend ] ──(1. Llama con token de usuario)──> [ Supabase Edge Function ]
│
(2. Valida Stock e Inmutabilidad)
│
[ Base de Datos ] <──(3. Inserta Orden con Service Role)
hace carculo y cre la orden

1.  **Llamada Segura:** El frontend nunca realiza un `INSERT` directo en la tabla `ordenes` debido a que carece de políticas de inserción por RLS en el cliente público.
2.  **Aislamiento de Lógica:** El cliente realiza una invocación HTTP post a una **Supabase Edge Function**.
3.  **Bypassing Controlado (Service Role):** La Edge Function utiliza internamente la clave secreta `SUPABASE_SERVICE_ROLE_KEY`. Al ejecutarse con este rol de sistema, el motor de Supabase omite las restricciones de RLS.
4.  **Procesamiento Atómico:**
    *   La función recupera los artículos guardados en la tabla `carrito` del usuario.
    *   Cruza los IDs contra la tabla de `productos` y `variantes` reales para verificar existencias físicas reales (`stock`) y precios vigentes.
    *   Construye un objeto estructurado inmutable para guardarlo en `lista_productos`.
    *   Consolida el precio total e inserta el registro en `ordenes`.
    *   Vacíará de forma segura las filas del usuario actual en la tabla `carrito`.
    *   Actualiza stock de los productos que se han usado en esta orden
    *   antes de realizar la orden validar stock
*

index para mejor busquedas
-- Índice GIN para búsquedas ultra rápidas dentro de arreglos de tags
CREATE INDEX idx_productos_tags ON productos USING gin (tags);

-- Índices B-Tree comunes para búsquedas exactas y llaves foráneas
CREATE INDEX idx_productos_sku ON productos (sku);
CREATE INDEX idx_productos_status ON productos (status);
CREATE INDEX idx_variantes_producto_id ON producto_variantes (producto_id);