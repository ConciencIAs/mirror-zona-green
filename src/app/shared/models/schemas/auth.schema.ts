import * as z from 'zod';
import { MENSAJE_EDAD_MINIMA, esMayorDeEdad } from '@src/app/shared/utils/fechas';

/** Contraseña: 8 o más caracteres, con letras y números (Fase 3; igual en Supabase Auth). */
const passwordSegura = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');
import { MENSAJE_CELULAR_INVALIDO, normalizarCelular } from '@src/app/shared/utils/telefono';

export const userSchemaRegister = z.object({
  full_name: z.string().min(2, 'Nombre demasiado corto (mín. 2 caracteres)'),
  correo: z.email('Ingresa un correo válido').min(1, 'El correo es obligatorio'),
  password: passwordSegura,
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  telefono: z
    .string()
    .min(1, 'El celular es obligatorio')
    .refine((v) => normalizarCelular(v) !== null, MENSAJE_CELULAR_INVALIDO),
  documento: z.number().min(4, 'Documento de identidad no válido (mín. 4 caracteres)'),
  fecha_nacimiento: z.date().refine((d) => esMayorDeEdad(d), MENSAJE_EDAD_MINIMA),
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

export const cambioPasswordSchema = z.object({
  actual: z.string().min(1, 'Ingresa tu contraseña actual'),
  password: passwordSegura,
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({ code: 'custom', message: 'Las contraseñas no coinciden', path: ['confirmPassword'] });
  }
  if (data.actual && data.password === data.actual) {
    ctx.addIssue({ code: 'custom', message: 'La nueva contraseña debe ser distinta de la actual', path: ['password'] });
  }
});

export const newPasswordSchema = z.object({
  password: passwordSegura,
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
