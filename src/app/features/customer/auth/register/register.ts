import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { form, validateStandardSchema } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { CustomerData } from '@src/app/shared/models/interfaces/customer/customer';

import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';

import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import {
  FormSelectComponent,
  SelectOption,
} from '@src/app/shared/components/form/form-select/form-select';

import { FormInputCheckboxComponent } from '@src/app/shared/components/form/form-input-checkbox/form-input-checkbox';
import { FormDatepickerComponent } from '@src/app/shared/components/form/form-datepicker/form-datapicker';

import { userSchemaRegister } from '@src/app/shared/models/schemas/auth.schema';
import { environment } from '@src/environments/environment';

type RegistrationFormModel = CustomerData & {
  password: string;
  confirmPassword: string;
};

@Component({
  selector: 'app-register',
  imports: [
    FormInputComponent,
    FormSelectComponent,
    FormInputCheckboxComponent,
    FormDatepickerComponent,
  ],
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Register {
  private readonly authService = inject(SupabaseAuthService);
  private readonly dbService = inject(SupabaseDbService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly showErrorsModal = signal(false);
  readonly generalError = signal<string | null>(null);

  // ── Validación async del código de referido ──
  readonly referidoValidando = signal(false);
  readonly referidoValido = signal<boolean | null>(null);
  readonly referidoError = signal<string | null>(null);
  private referidoDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CC', label: 'CC' },
    { value: 'CE', label: 'CE' },
    { value: 'NIT', label: 'NIT' },
    { value: 'Pasaporte', label: 'Pasaporte' },
  ];

  readonly formModel = signal<RegistrationFormModel>({
    full_name: '',
    correo: '',
    password: '',
    confirmPassword: '',
    telefono: 0,
    documento: 0,
    fecha_nacimiento: new Date(),
    tipo_documento: 'CC',
    ubicacion: '',
    acepta_terminos: false,
    acepta_politica_privacidad: false,
    codigo_referido: '',
  });

  readonly registerForm = form(this.formModel, (schemaPath) => {
    validateStandardSchema(schemaPath, userSchemaRegister);
  });

  /**
   * Validación asíncrona con debounce para el código de referido.
   * Llama al RPC `validar_codigo_referido` en Supabase.
   */
  onReferidoInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value.trim();
    this.formModel.update((m) => ({ ...m, codigo_referido: valor }));

    this.referidoValido.set(null);
    this.referidoError.set(null);
    if (this.referidoDebounceTimer) clearTimeout(this.referidoDebounceTimer);

    if (!valor) {
      this.referidoValidando.set(false);
      return;
    }

    this.referidoValidando.set(true);

    this.referidoDebounceTimer = setTimeout(async () => {
      try {
        const { data, error } = await this.dbService.rpc('validar_codigo_referido', {
          codigo_prueba: valor,
        });


        if (error) {
          this.referidoError.set('Error al validar el código de referido');
          this.referidoValido.set(false);
          return;
        }

        if (data === true) {
          this.referidoValido.set(true);
          this.referidoError.set(null);
        } else {
          this.referidoValido.set(false);
          this.referidoError.set('El código de referido no es válido o no está activo');
        }
      } catch {
        this.referidoError.set('Error de conexión al validar el código');
        this.referidoValido.set(false);
      } finally {
        this.referidoValidando.set(false);
      }
    }, 600);
  }

  async verificarSiExisteUsuario(correo: string): Promise<boolean> {
    const { data, error } = await this.dbService
      .from(this.dbService.tableNames.USUARIOS_PUBLICOS)
      .select('correo')
      .eq('correo', correo.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Error al validar correo:', error.message);
      return false;
    }
    return !!data;
  }


  async enviarMagicLink(datos: CustomerData): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.authService.auth.signInWithOtp({
      email: datos.correo.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/magik-link-callback`,
      },
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  closeErrorsModal(): void {
    this.showErrorsModal.set(false);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.loading.set(true);
    this.generalError.set(null);

    if (this.registerForm().invalid()) {
      this.showErrorsModal.set(true);
      this.loading.set(false);
      return;
    }

    const formData = this.formModel();
    const currentData: CustomerData = {
      full_name: formData.full_name,
      correo: formData.correo,
      telefono: formData.telefono,
      documento: formData.documento,
      fecha_nacimiento: formData.fecha_nacimiento,
      tipo_documento: formData.tipo_documento,
      ubicacion: formData.ubicacion,
      acepta_terminos: formData.acepta_terminos,
      acepta_politica_privacidad: formData.acepta_politica_privacidad,
    };

    // Bloquea si el usuario escribió un código de referido inválido
    if (currentData.codigo_referido?.trim() && this.referidoValido() === false) {
      this.generalError.set('El código de referido ingresado no es válido.');
      this.loading.set(false);
      return;
    }

    try {
      const exists = await this.verificarSiExisteUsuario(currentData.correo);
      if (exists) {
        const { success, error } = await this.enviarMagicLink(currentData);
        if (!success) throw new Error(error ?? 'Error al enviar enlace mágico.');
        this.toastService.info(
          'Ya existe una cuenta con este correo. Se envió un enlace mágico para iniciar sesión.',
        );
      } else {
        const { data, error } = await this.authService.signUpWithEmail(
          currentData.correo.trim().toLowerCase(),
          formData.password,
          `${window.location.origin}/auth/magik-link-callback`,
          {
            full_name: currentData.full_name,
            telefono: currentData.telefono,
            documento: currentData.documento,
            tipo_documento: currentData.tipo_documento,
            fecha_nacimiento: currentData.fecha_nacimiento.toISOString().slice(0, 10),
            ubicacion: currentData.ubicacion,
            acepta_terminos: currentData.acepta_terminos,
            acepta_politica_privacidad: currentData.acepta_politica_privacidad,
          },
        );

        if (error) throw error;

        if (data.session) {
          await this.router.navigate(['/auth/magik-link-callback']);
        } else {
          this.toastService.success('Cuenta creada. Revisa tu correo para confirmar el registro.');
        }
      }
    } catch (err: unknown) {
      console.error(err);
      const msgUnexpected = err instanceof Error ? err.message : 'Error inesperado';
      this.generalError.set(msgUnexpected);
      this.toastService.error(msgUnexpected);
    } finally {
      this.loading.set(false);
    }
  }
}
