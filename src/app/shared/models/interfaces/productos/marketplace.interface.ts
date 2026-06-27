import {
  EstadoProducto,
  Producto,
  PresentacionProducto,
} from '@src/app/shared/models/interfaces/db/db';

export interface ProductFormModel extends Omit<Producto, 'created_at' | 'deleted_at' | 'updated_at' | 'id' | 'presentaciones' | 'tags' | 'urls_imagenes'> {
  nombre: string;
  descripcion: string;
  sku: string;
  precio: number;
  costo: number;
  stock_total: number;
  status: EstadoProducto;
  es_por_gramos: boolean;
  presentaciones: PresentacionProducto[];
  urls_imagenes: string[];
  tags: string[];
}
