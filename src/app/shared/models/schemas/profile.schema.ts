import * as z from 'zod';
import { MENSAJE_EDAD_MINIMA, esMayorDeEdad } from '@src/app/shared/utils/fechas';
import { MENSAJE_CELULAR_INVALIDO, normalizarCelular } from '@src/app/shared/utils/telefono';

export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .min(2, 'El nombre es demasiado corto (mín. 2 caracteres)')
    .max(100, 'El nombre es demasiado largo (máx. 100 caracteres)'),
  telefono: z
    .string()
    .min(1, 'El celular es obligatorio')
    .refine((v) => normalizarCelular(v) !== null, MENSAJE_CELULAR_INVALIDO),
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
    )
    .refine((d) => esMayorDeEdad(d), MENSAJE_EDAD_MINIMA),
  ubicacion: z
    .string()
    .min(2, 'La ubicación es demasiado corta (mín. 2 caracteres)')
    .max(200, 'La ubicación es demasiado larga (máx. 200 caracteres)'),
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
