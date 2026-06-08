import * as z from 'zod';

export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .min(2, 'El nombre es demasiado corto (mín. 2 caracteres)')
    .max(100, 'El nombre es demasiado largo (máx. 100 caracteres)'),
  telefono: z
    .string()
    .regex(/^\+?\d{7,15}$/, 'Teléfono inválido (ingresa de 7 a 15 dígitos sin espacios)'),
  documento: z
    .string()
    .min(4, 'Documento de identidad no válido (mín. 4 caracteres)')
    .max(20, 'Documento demasiado largo (máx. 20 caracteres)'),
  tipo_documento: z.enum(['CC', 'CE', 'NIT', 'Pasaporte'] as const, {
    error: 'Selecciona un tipo de documento válido',
  }),
  fecha_nacimiento: z
    .date({ message: 'La fecha de nacimiento es obligatoria' })
    .refine(
      (d) => d <= new Date(),
      'La fecha de nacimiento no puede ser futura'
    ),
  ubicacion: z
    .string()
    .min(2, 'La ubicación es demasiado corta (mín. 2 caracteres)')
    .max(200, 'La ubicación es demasiado larga (máx. 200 caracteres)'),
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
