import { Component, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { form, validateStandardSchema } from '@angular/forms/signals';

import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import { cambioPasswordSchema } from '@src/app/shared/models/schemas/auth.schema';

/**
 * Cambio de contraseña desde "Mi cuenta". Pide la contraseña actual y la
 * verifica contra Supabase Auth antes de cambiarla, para que una sesión
 * abierta en un equipo ajeno no baste para tomar la cuenta.
 */
@Component({
  selector: 'app-cambiar-contrasena',
  imports: [FormInputComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="rounded-3xl bg-white shadow-lg shadow-slate-200 overflow-hidden">
      <button
        type="button"
        (click)="abierto.set(!abierto())"
        [attr.aria-expanded]="abierto()"
        class="w-full flex items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span class="flex items-center gap-3">
          <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <i class="pi pi-lock"></i>
          </span>
          <span>
            <span class="block text-sm font-bold text-slate-900">Cambiar contraseña</span>
            <span class="block text-xs text-slate-500">Necesitas tu contraseña actual</span>
          </span>
        </span>
        <i class="pi text-slate-400" [class.pi-chevron-down]="!abierto()" [class.pi-chevron-up]="abierto()"></i>
      </button>

      @if (abierto()) {
        <form (submit)="cambiar($event)" class="px-6 pb-6 space-y-1 border-t border-slate-100 pt-5">
          <app-form-input [control]="passwordForm.actual()" label="Contraseña actual" type="password"
            autocomplete="current-password" placeholder="Tu contraseña actual" />
          <app-form-input [control]="passwordForm.password()" label="Nueva contraseña" type="password"
            autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
          <app-form-input [control]="passwordForm.confirmPassword()" label="Confirmar nueva contraseña" type="password"
            autocomplete="new-password" placeholder="Repite la nueva contraseña" />

          @if (error()) {
            <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error() }}</div>
          }

          <div class="pt-2 flex justify-end">
            <button type="submit" [disabled]="loading()"
              class="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60">
              <i class="pi" [class.pi-spin]="loading()" [class.pi-spinner]="loading()" [class.pi-check]="!loading()"></i>
              <span>{{ loading() ? 'Guardando...' : 'Cambiar contraseña' }}</span>
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class CambiarContrasena {
  private readonly authService = inject(SupabaseAuthService);
  private readonly toastService = inject(ToastService);

  readonly correo = input.required<string>();

  readonly abierto = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly passwordModel = signal({ actual: '', password: '', confirmPassword: '' });
  readonly passwordForm = form(this.passwordModel, (schemaPath) => {
    validateStandardSchema(schemaPath, cambioPasswordSchema);
  });

  async cambiar(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);

    if (this.passwordForm().invalid()) {
      this.passwordForm().markAsTouched();
      return;
    }

    const { actual, password } = this.passwordModel();
    this.loading.set(true);
    try {
      // 1. La contraseña actual debe ser correcta.
      const { error: errorActual } = await this.authService.signInWithEmail(this.correo(), actual);
      if (errorActual) {
        this.error.set(
          errorActual.code === 'invalid_credentials'
            ? 'La contraseña actual no es correcta.'
            : 'No se pudo verificar tu contraseña actual. Intenta de nuevo.',
        );
        return;
      }

      // 2. Cambio.
      const { error } = await this.authService.auth.updateUser({ password });
      if (error) {
        if (error.code === 'same_password') {
          this.error.set('La nueva contraseña debe ser distinta de la actual.');
        } else if (error.code === 'weak_password') {
          this.error.set('La contraseña es muy débil. Usa una más larga y difícil de adivinar.');
        } else {
          this.error.set('No se pudo cambiar la contraseña. Intenta de nuevo.');
        }
        return;
      }

      // 3. Se cierran las sesiones abiertas en otros dispositivos.
      await this.authService.auth.signOut({ scope: 'others' });

      this.passwordModel.set({ actual: '', password: '', confirmPassword: '' });
      this.abierto.set(false);
      this.toastService.success('Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.');
    } catch {
      this.error.set('No se pudo cambiar la contraseña. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
