import { Component, inject, signal, computed } from '@angular/core';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/toast.service';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';
import { CustomerData } from '@src/app/core/models/customer/customer';
import { PENDING_DATA_KEY } from '@src/app/core/models/constans/localstate/storage';
import { form, FormField, required, email, pattern, minLength } from '@angular/forms/signals';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  imports: [FormField, CommonModule],
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

  // Estado del formulario usando Signals
  readonly formModel = signal<CustomerData>({
    full_name: '',
    correo: '',
    telefono: '',
    documento: '',
    fecha_nacimiento: '',
    tipo_documento: 'CC',
    ubicacion: '',
  });

  // 3. Declaración del FieldTree con sus validadores nativos (Adiós Zod en este componente)
  readonly registerForm = form(this.formModel, (f) => {
    required(f.full_name);
    minLength(f.full_name, 2);

    required(f.correo);
    email(f.correo);

    required(f.telefono);
    pattern(f.telefono, /^\+?\d{7,15}$/);

    required(f.documento);
    minLength(f.documento, 4);

    required(f.fecha_nacimiento);
    required(f.ubicacion);
    minLength(f.ubicacion, 2);
  });

  readonly errorEntries = computed(() => {
    const list: [string, string][] = [];
    const rf = this.registerForm;

    if (rf.full_name().invalid())
      list.push(['Nombre', 'Nombre demasiado corto (mín. 2 caracteres).']);
    if (rf.correo().invalid())
      list.push(['Correo', 'El formato del correo electrónico no es válido.']);
    if (rf.telefono().invalid())
      list.push(['Teléfono', 'Teléfono inválido (ingresa de 7 a 15 dígitos sin espacios).']);
    if (rf.documento().invalid())
      list.push(['Documento', 'Documento de identidad no válido (mín. 4 caracteres).']);
    if (rf.fecha_nacimiento().invalid())
      list.push(['Fecha', 'La fecha de nacimiento es requerida.']);
    if (rf.ubicacion().invalid())
      list.push(['Ubicación', 'La ubicación provista es demasiado corta.']);

    if (this.generalError()) {
      list.push(['Servidor', this.generalError()!]);
    }
    return list;
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

  async submit(): Promise<void> {
    this.loading.set(true);
    this.generalError.set(null);

    // 5. Validación del estado global del árbol del formulario directamente desde su señal estructural
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

      if (exists) this.toastService.info('Ya existe una cuenta con este correo. Se ha enviado un enlace mágico para iniciar sesión.');

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
