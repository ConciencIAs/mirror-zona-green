import * as z from 'zod';

export const productSchema = z.object({
  nombre: z.string().min(1, 'El nombre del producto es obligatorio.'),
  descripcion: z.string().min(1, 'La descripción del producto es obligatoria.'),
  sku: z.string().min(1, 'El SKU es obligatorio.'),
  precio: z.number().min(1, 'El precio debe ser mayor a 0.'),
  costo: z.number().min(1, 'El costo debe ser mayor a 0.'),
  stock_total: z.number().min(1, 'El stock total debe ser mayor a 0.'),
  categoria_id: z.string().min(1, 'Selecciona una categoría.'),
  status: z.enum(['activo', 'inactivo']),
  tipo_producto: z.enum(['simple', 'variantes']),
  tags: z.array(z.string()).optional(),
  urls_imagenes: z.array(z.string()).optional(),
});

export const productVariantSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la variante es obligatorio.'),
  descripcion: z.string().min(1, 'La descripción de la variante es obligatoria.'),
  precio: z.number().min(0.01, 'El precio de la variante debe ser mayor que 0.'),
  stock: z.number().min(1, 'El stock de la variante debe ser mayor a 0.'),
  gramos_disponibles: z.number().min(1, 'Los gramos disponibles debe ser mayor a 0.'),
  cantidad_minima_venta: z.number().min(1, 'La cantidad mínima de venta debe ser al menos 1.'),
  precio_minimo_venta: z.number().min(1, 'El precio mínimo de venta debe ser mayor a 0.'),
  opciones_venta: z.array(z.number()).refine((items) => items.length > 0, 'Agrega al menos una opción de venta.'),
  urls_imagenes: z.array(z.string()).optional(),
  fecha_llegada: z.date().refine((value) => value > new Date(), 'La fecha de llegada debe ser mayor a la fecha actual.'),
  status: z.enum(['activo', 'inactivo']),
});
