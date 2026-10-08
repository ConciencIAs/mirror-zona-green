import * as z from 'zod';

export const userSchemaRegister = z.object({
  full_name: z.string().min(2, 'Nombre demasiado corto (mín. 2 caracteres)'),
  correo: z.email('Ingresa un correo válido').min(1, 'El correo es obligatorio'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  telefono: z
    .number()
    .min(7, 'Teléfono inválido (ingresa de 7 a 15 dígitos sin espacios)'),
  documento: z.number().min(4, 'Documento de identidad no válido (mín. 4 caracteres)'),
  fecha_nacimiento: z.date(),
  tipo_documento: z.string().default('CC'),
  ubicacion: z.string().min(2, 'La ubicación provista es demasiado corta'),
  codigo_referido: z
    .string()
    .trim()
    .optional()
    .default(''),
  acepta_terminos: z.boolean().refine((v) => v === true, 'Debes aceptar los términos y condiciones'),
  acepta_politica_privacidad: z
    .boolean()
    .refine((v) => v === true, 'Debes aceptar la política de privacidad'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      message: 'Las contraseñas no coinciden',
      path: ['confirmPassword'],
    });
  }

});

export const userSchemaLogin = z.object({
  email: z.email('Ingresa un correo válido').min(1, 'El correo es obligatorio'),
  password: z.string().optional(),
});

export const passwordRecoveryEmailSchema = z.object({
  email: z.email('Ingresa un correo válido').min(1, 'El correo es obligatorio'),
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      message: 'Las contraseñas no coinciden',
      path: ['confirmPassword'],
    });
  }
});
