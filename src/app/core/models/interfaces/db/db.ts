// ==========================================
// TIPOS BASE Y ENUMS
// ==========================================

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type EstadoOrden =
    | 'pendiente'
    | 'pagado'
    | 'en_proceso'
    | 'enviado'
    | 'entregado'
    | 'cancelado';

export type EstadoProducto = 'activo' | 'inactivo';

export type RolUsuario = 'admin' | 'customer' | 'agente' | 'medico' | 'anonymous';

export type TipoDoc = 'CC' | 'CE' | 'NIT' | 'Pasaporte';

// ==========================================
// INTERFACES (MODELOS DE BASE DE DATOS)
// ==========================================

export interface Carrito {
    id: string;
    cantidad: number;
    es_gramos: boolean;
    producto_id: string;
    usuario_id: string;
    variante_id: string | null;
}

export interface Categoria {
    id: string;
    nombre: string;
    deleted_at: string | null;
}

export interface HistorialInventario {
    id: string;
    admin_id: string | null;
    cantidad_anterior: number;
    cantidad_nueva: number;
    created_at: string | null;
    motivo: string;
    producto_id: string | null;
    tipo_movimiento: string;
    variante_id: string | null;
}

export interface Orden {
    id: string;
    comentarios_agente: string | null;
    created_at: string | null;
    lista_productos: Json; // Puede reemplazarse por una interfaz específica si conoces la estructura del JSON
    precio_total: number;
    status: EstadoOrden;
    tipo_entrega: string;
    updated_at: string | null;
    usuario_id: string;
}

export interface PageConfig {
    id: string;
    franja_promocional: string | null;
    logo: string | null;
    nombre: string;
    telefono: string | null;
    url_legislacion: string | null;
    url_politica_datos: string | null;
    url_terminos: string | null;
}

export interface PageDocumentos {
    id: string;
    nombre: string;
    url_pdf: string;
}

export interface PageHome {
    id: string;
    admin_uid: string | null;
    banners: Json[];
    component_type: string | null;
    content: Json | null;
}

export interface Perfil {
    id: string;
    correo: string;
    created_at: string | null;
    datos_adicionales: Json;
    deleted_at: string | null;
    documento: string | null;
    fecha_nacimiento: string | null;
    full_name: string | null;
    rol: RolUsuario;
    telefono: string | null;
    tipo_documento: TipoDoc | null;
    ubicacion: string | null;
    updated_at: string | null;
}

export interface ProductoVariante {
    id: string;
    cantidad_minima_venta: number | null;

    descripcion: string | null;
    fecha_llegada: Date;
    gramos_disponibles: number | null;
    nombre: string;
    opciones_venta: number[] | null;
    precio: number;
    precio_minimo_venta: number | null;
    producto_id: string | null;
    status: EstadoProducto;
    stock: number;
    updated_at: string | null;
    created_at: string | null;
    deleted_at: string | null;
    urls_imagenes: string[] | null;
}

export interface Producto {
    id: string;
    categoria_id: string | null;
    nombre: string;
    descripcion: string | null;
    urls_imagenes: string[] | null;
    costo: number;
    precio: number;
    sku: string;
    status: EstadoProducto;
    stock_total: number;
    tags: string[] | null;
    updated_at: string | null;
    created_at: string | null;
    deleted_at: string | null;
    has_product_variantes: boolean;
}

export interface Rol {
    id: string;
    created_at: string | null;
    nombre: RolUsuario;
    updated_at: string | null;
    urls_permitidas: string[];
}

export interface Tag {
    id: string;
    nombre: string;
}

export interface UsuarioPublico {
    id: string;
    correo: string;
    created_at: string | null;
    uid: string | null;
}