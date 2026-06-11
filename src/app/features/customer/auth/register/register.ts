import { Component, inject, signal, computed } from '@angular/core';
import { form, validateStandardSchema } from '@angular/forms/signals';


import { CustomerData } from '@src/app/shared/models/interfaces/customer/customer';
import { PENDING_DATA_KEY } from '@src/app/shared/models/constans/localstate/storage';

import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';

import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import {
  FormSelectComponent,
  SelectOption,
} from '@src/app/shared/components/form/form-select/form-select';

import { FormInputCheckboxComponent } from '@src/app/shared/components/form/form-input-checkbox/form-input-checkbox';
import { FormDatepickerComponent } from '@src/app/shared/components/form/form-datepicker/form-datapicker';

import { userSchemaRegister } from '@src/app/shared/models/schemas/auth.schema';

@Component({
  selector: 'app-register',
  imports: [FormInputComponent, FormSelectComponent, FormInputCheckboxComponent, FormDatepickerComponent],
  templateUrl: './register.html',
  styles: ``,
})
export class Register {
  private readonly authService = inject(SupabaseAuthService);
  private readonly dbService = inject(SupabaseDbService);
  private readonly localStorageState = inject(LocalStorageStateService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly showErrorsModal = signal(false);
  readonly generalError = signal<string | null>(null);

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CC', label: 'CC' },
    { value: 'CE', label: 'CE' },
    { value: 'NIT', label: 'NIT' },
    { value: 'Pasaporte', label: 'Pasaporte' },
  ];

  readonly formModel = signal<CustomerData>({
    full_name: '',
    correo: '',
    telefono: 0,
    documento: 0,
    fecha_nacimiento: new Date(),
    tipo_documento: 'CC',
    ubicacion: '',
    acepta_terminos: false,
    acepta_politica_privacidad: false,
  });

  readonly registerForm = form(this.formModel, (schemaPath) => {
    validateStandardSchema(schemaPath, userSchemaRegister);
  });

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

  async enviarMagicLink(
    datos: CustomerData,
    esNuevoUsuario: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    if (esNuevoUsuario) {
      // Guardamos temporalmente los datos en LocalStorage usando tu servicio reactivo
      this.localStorageState.setState(PENDING_DATA_KEY, datos);
    }

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

    // Leemos la data consolidada de forma limpia
    const currentData = this.formModel();

    try {
      const exists = await this.verificarSiExisteUsuario(currentData.correo);
      const { success, error } = await this.enviarMagicLink(currentData, !exists);

      if (exists)
        this.toastService.info(
          'Ya existe una cuenta con este correo. Se ha enviado un enlace mágico para iniciar sesión.',
        );

      if (!success) {
        const msgError = error ?? 'Error al enviar enlace mágico';
        this.generalError.set(msgError);
        this.toastService.error(msgError);
      } else {
        this.toastService.success('Revisa tu correo para continuar');
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
