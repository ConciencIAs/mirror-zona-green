import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { form, validateStandardSchema } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import {
  newPasswordSchema,
  passwordRecoveryEmailSchema,
} from '@src/app/shared/models/schemas/auth.schema';
import { environment } from '@src/environments/environment';

type RecoveryMode = 'checking' | 'request' | 'update';

@Component({
  selector: 'app-recover-password',
  imports: [FormInputComponent, RouterLink],
  templateUrl: './recover-password.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class RecoverPassword implements OnInit {
  private readonly authService = inject(SupabaseAuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly userStore = inject(UserStore);

  protected readonly mode = signal<RecoveryMode>('checking');
  protected readonly loading = signal(false);
  protected readonly generalError = signal<string | null>(null);

  protected readonly emailModel = signal({ email: '' });
  protected readonly emailForm = form(this.emailModel, (schemaPath) => {
    validateStandardSchema(schemaPath, passwordRecoveryEmailSchema);
  });

  protected readonly passwordModel = signal({ password: '', confirmPassword: '' });
  protected readonly passwordForm = form(this.passwordModel, (schemaPath) => {
    validateStandardSchema(schemaPath, newPasswordSchema);
  });

  ngOnInit(): void {
    void this.checkRecoverySession();
  }

  private async checkRecoverySession(): Promise<void> {
    try {
      const { data, error } = await this.authService.auth.getSession();
      if (error) throw error;
      this.mode.set(data.session ? 'update' : 'request');
    } catch (error: unknown) {
      console.error('Error al validar recuperación de contraseña:', error);
      this.generalError.set('No se pudo validar el enlace. Solicita uno nuevo.');
      this.mode.set('request');
    }
  }

  async requestReset(event: Event): Promise<void> {
    event.preventDefault();
    this.generalError.set(null);

    if (this.emailForm().invalid()) {
      this.emailForm().markAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const email = this.emailModel().email.trim().toLowerCase();
      const { error } = await this.authService.auth.resetPasswordForEmail(email, {
        redirectTo: `${environment.urlHost}/auth/recover-password`,
      });
      if (error) throw error;

      this.toastService.success('Si la cuenta existe, recibirás un enlace para recuperar tu contraseña.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo enviar el enlace.';
      this.generalError.set(message);
      this.toastService.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async updatePassword(event: Event): Promise<void> {
    event.preventDefault();
    this.generalError.set(null);

    if (this.passwordForm().invalid()) {
      this.passwordForm().markAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const { error } = await this.authService.auth.updateUser({
        password: this.passwordModel().password,
      });
      if (error) throw error;

      const { error: signOutError } = await this.authService.signOut();
      if (signOutError) throw signOutError;

      this.userStore.clearPerfil();
      this.toastService.success('Contraseña actualizada. Ya puedes iniciar sesión.');
      await this.router.navigate(['/auth/login']);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.';
      this.generalError.set(message);
      this.toastService.error(message);
    } finally {
      this.loading.set(false);
    }
  }
}