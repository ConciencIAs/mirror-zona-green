import * as z from 'zod';

export const productSchema = z.object({
  nombre: z.string().min(1, 'El nombre del producto es obligatorio.'),
  descripcion: z.string().optional(),
  sku: z.string().min(1, 'El SKU es obligatorio.'),
  precio: z.preprocess((value) => Number(value), z.number().min(0, 'El precio no puede ser negativo.')),
  costo: z.preprocess((value) => Number(value), z.number().min(0, 'El costo no puede ser negativo.')),
  stock_total: z.preprocess((value) => Number(value), z.number().min(0, 'El stock total no puede ser negativo.')),
  categoria_id: z.string().min(1, 'Selecciona una categoría.'),
  status: z.enum(['activo', 'inactivo']),
  tipo_producto: z.enum(['simple', 'variantes']),
  tags: z.array(z.string()).optional(),
  urls_imagenes: z.array(z.string()).optional(),
});

export const productVariantSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la variante es obligatorio.'),
  descripcion: z.string().optional(),
  precio: z.preprocess((value) => Number(value), z.number().min(0.01, 'El precio de la variante debe ser mayor que 0.')),
  stock: z.preprocess((value) => Number(value), z.number().min(0, 'El stock de la variante no puede ser negativo.')),
  gramos_disponibles: z.preprocess((value) => Number(value), z.number().min(0, 'Los gramos disponibles no pueden ser negativos.')),
  cantidad_minima_venta: z.preprocess((value) => Number(value), z.number().min(1, 'La cantidad mínima de venta debe ser al menos 1.')),
  precio_minimo_venta: z.preprocess((value) => Number(value), z.number().min(0, 'El precio mínimo no puede ser negativo.')),
  opciones_venta: z.array(z.union([z.string(), z.number()])).refine((items) => items.length > 0, 'Agrega al menos una opción de venta.'),
  urls_imagenes: z.array(z.string()).optional(),
  fecha_llegada: z.string().optional(),
  status: z.enum(['activo', 'inactivo']),
});
