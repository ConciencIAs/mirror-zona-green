import {
  EstadoProducto,
  Producto,
  ProductoVariante,
} from '@src/app/shared/models/interfaces/db/db';

export interface ProductFormModel extends Omit<Producto, 'created_at' | 'deleted_at' | 'updated_at' | 'id'> {
  nombre: string;
  descripcion: string;
  sku: string;
  precio: number;
  costo: number;
  stock_total: number;
  categoria_id: string;
  status: EstadoProducto;
  tipo_producto: 'simple' | 'variantes';
  urls_imagenes: string[];
  tags: string[];
}

export interface ProductVariantFormModel extends Omit<ProductoVariante, 'created_at' | 'deleted_at' | 'updated_at' | 'id' | 'producto_id' | 'opciones_venta' | 'fecha_llegada'> {
  id?: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  gramos_disponibles: number;
  cantidad_minima_venta: number;
  precio_minimo_venta: number;
  opciones_venta: number[];
  urls_imagenes: string[];
  fecha_llegada: Date;
}