import { Component, inject, signal } from '@angular/core';
import { form, validateStandardSchema } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ConfirmationModalService } from '@src/app/core/services/ui/confirmation.service';
import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import { userSchemaLogin } from '@src/app/core/models/schemas/auth.schema';

@Component({
  selector: 'app-login',
  imports: [FormInputComponent, RouterLink],
  templateUrl: './login.html',
  styles: ``,
})
export class Login {
  private readonly authService = inject(SupabaseAuthService);
  private readonly toastService = inject(ToastService);
  private readonly dbService = inject(SupabaseDbService);
  private readonly confirmationModalService = inject(ConfirmationModalService);
  private readonly router = inject(Router);

  loading = signal(false);
  generalError = signal<string | null>(null);

  loginModel = signal({
    email: '',
  });

  loginForm = form(this.loginModel, (schemaPath) => {
    validateStandardSchema(schemaPath, userSchemaLogin);
  });

  async submit(event: Event) {
    event.preventDefault();
    this.loading.set(true);
    this.generalError.set(null);

    if (this.loginForm().invalid()) {
      this.loginForm().markAsTouched();
      this.loading.set(false);
      return;
    }
    const email = this.loginModel().email.trim().toLowerCase();

    const { data, error } = await this.dbService
      .from(this.dbService.tableNames.USUARIOS_PUBLICOS)
      .select('correo')
      .eq('correo', email)
      .maybeSingle();

    if (error) {
      console.error('Error al validar correo:', error.message);
      this.toastService.error('Error al validar el correo. Intenta de nuevo.');
      return;
    }
    if (!data) {
      this.confirmationModalService.confirm({
        message: 'No se encontró una cuenta con este correo. ¿Deseas crear una nueva cuenta?',
        accept: () => this.router.navigate(['/auth/register'], { queryParams: { email } }),
      });
      return;
    }

    try {
      const { error } = await this.authService.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/magik-link-callback`,
        },
      });

      if (error) {
        const message = error.message;
        this.generalError.set(message);
        this.toastService.error(message);
      } else {
        this.toastService.success('Revisa tu correo para continuar con el inicio de sesión');
      }
    } catch (err: any) {
      const message = err?.message ?? 'Error inesperado. Intenta de nuevo.';
      this.generalError.set(message);
      this.toastService.error(message);
    } finally {
      this.loading.set(false);
    }
  }
}
