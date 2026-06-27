import * as z from 'zod';

export const presentationSchema = z.object({
  gramos: z.number().min(1, 'Los gramos deben ser mayores a 0.'),
  precio: z.number().min(1, 'El precio debe ser mayor a 0.'),
  stock: z.number().min(0, 'El stock no puede ser negativo.'),
});

export const productSchema = z.object({
  nombre: z.string().min(1, 'El nombre del producto es obligatorio.'),
  descripcion: z.string().min(1, 'La descripción del producto es obligatoria.'),
  sku: z.string().min(1, 'El SKU es obligatorio.'),
  precio: z.number().min(0, 'El precio no puede ser negativo.'),
  costo: z.number().min(0, 'El costo no puede ser negativo.'),
  stock_total: z.number().min(0, 'El stock total no puede ser negativo.'),
  status: z.enum(['activo', 'inactivo']),
  es_por_gramos: z.boolean(),
  presentaciones: z.array(presentationSchema).default([]),
  tags: z.array(z.string()).optional(),
  urls_imagenes: z.array(z.string()).min(1, 'Debes agregar al menos una imagen.'),
}).superRefine((data, ctx) => {
  if (data.es_por_gramos) {
    {
      if (!data.presentaciones || data.presentaciones.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Debes agregar al menos una presentación para venta por gramos.',
          path: ['presentaciones'],
        });
      }
    }
  }
});

