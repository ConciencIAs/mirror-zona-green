import * as z from 'zod';

export const userSchemaRegister = z.object({
  full_name: z.string().min(2, 'Nombre demasiado corto (mín. 2 caracteres)'),
  correo: z.email('Ingresa un correo válido').min(1, 'El correo es obligatorio'),
  telefono: z
    .string()
    .regex(/^\+?\d{7,15}$/, 'Teléfono inválido (ingresa de 7 a 15 dígitos sin espacios)'),
  documento: z.string().min(4, 'Documento de identidad no válido (mín. 4 caracteres)'),
  fecha_nacimiento: z.string().refine((v) => !!v, 'La fecha de nacimiento es requerida'),
  tipo_documento: z.string().default('CC'),
  ubicacion: z.string().min(2, 'La ubicación provista es demasiado corta'),
});

export const userSchemaLogin = z.object({
  email: z.email('Ingresa un correo válido').min(1, 'El correo es obligatorio'),
});
