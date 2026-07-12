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
    | 'seleccion'
    | 'aporte'
    | 'en_proceso'
    | 'enviado'
    | 'entregado'
    | 'cancelado';

export type EstadoProducto = 'activo' | 'inactivo';

export type EstadoUsuario = 'activo' | 'inactivo' | 'bloqueado' | 'eliminado';

export type RolUsuario = 'admin' | 'customer' | 'agente' | 'anonymous';

export type TipoDoc = 'CC' | 'CE' | 'NIT' | 'Pasaporte';

// ==========================================
// INTERFACES (MODELOS DE BASE DE DATOS)
// ==========================================

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

export interface PageConfig {
    id: string;
    config_name: string;
    content: Json;
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
    status?: EstadoUsuario;
}


export interface Presents {
    cantidad: number;
    precio: number
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

export interface PresentacionProducto {
    gramos: number;
    precio: number;
    stock: number;
    sku: string;
}

export interface Producto {
    id: string;
    sku: string;
    nombre: string;
    descripcion: string | null;
    urls_imagenes: string[];
    costo: number;
    precio: number;
    status: 'activo' | 'inactivo';
    stock_total: number;
    tags: string[] | null;
    es_por_gramos: boolean; // <-- Nuestra nueva flag
    presentaciones: PresentacionProducto[]; // Lista de paquetes
    created_at: string | null;
    updated_at: string | null;
    reservado?: number;
}

export interface Carrito {
    id: string;
    usuario_id: string;
    producto_id: string;
    cantidad: number;
    paquete_gramos?: number | null;
}

export interface Orden {
    id: string;
    usuario_id: string;
    nombre_cliente: string | null; // <-- Para analítica
    correo_cliente: string | null; // <-- Para analítica
    comentarios_usuario: string | null;
    created_at: string | null;
    lista_productos: SnapshotAnalitica[]; // Array de SnapshotAnalitica
    precio_total: number;
    status: EstadoOrden;
    tipo_entrega: string;
    updated_at: string | null;
    tracking: Tracking[];
    direccion: string
}

export interface Tracking {
    status: string;
    date: string;
}

export interface SnapshotAnalitica {
    sku: string;
    nombre: string;
    es_por_gramos: boolean;
    cantidad_comprada: number;
    paquete_gramos: number | null;
    total_gramos_entregados: number | null;
    precio_unitario: number;
    subtotal: number;
    // Guardamos el usuario a nivel de ítem también, útil para cruzar datos en Looker/PowerBI
    comprador_nombre: string | null;
    comprador_correo: string;
}