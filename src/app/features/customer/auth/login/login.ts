import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { form, validateStandardSchema } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ConfirmationModalService } from '@src/app/core/services/ui/confirmation.service';
import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import { userSchemaLogin } from '@src/app/shared/models/schemas/auth.schema';
import { environment } from '@src/environments/environment';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { Perfil } from '@src/app/shared/models/interfaces/db/db';

@Component({
  selector: 'app-login',
  imports: [FormInputComponent, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Login {
  private readonly authService = inject(SupabaseAuthService);
  private readonly toastService = inject(ToastService);
  private readonly dbService = inject(SupabaseDbService);
  private readonly confirmationModalService = inject(ConfirmationModalService);
  private readonly router = inject(Router);
  private readonly userStore = inject(UserStore);

  loading = signal(false);
  generalError = signal<string | null>(null);
  loginMode = signal<'password' | 'magic-link'>('password');

  loginModel = signal({
    email: '',
    password: '',
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
    const password = this.loginModel().password;

    try {
      if (this.loginMode() === 'password' && !password) {
        this.generalError.set('Ingresa tu contraseña para continuar.');
        return;
      }

      const { data: publicUser, error: lookupError } = await this.dbService
        .from(this.dbService.tableNames.USUARIOS_PUBLICOS)
        .select('correo')
        .eq('correo', email)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!publicUser) {
        this.confirmationModalService.confirm({
          message: 'No se encontró una cuenta con este correo. ¿Deseas crear una nueva cuenta?',
          accept: () => this.router.navigate(['/auth/register'], { queryParams: { email } }),
        });
        return;
      }

      if (this.loginMode() === 'password') {
        const { data, error } = await this.authService.signInWithEmail(email, password);
        if (error) throw error;
        if (!data.user) throw new Error('No se pudo obtener el usuario autenticado.');

        const { data: profile, error: profileError } = await this.dbService
          .from(this.dbService.tableNames.PERFILES)
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error('No se encontró el perfil asociado a esta cuenta.');

        this.userStore.setPerfil(profile as Perfil);
        await this.router.navigate(['/home']);
      } else {
        const { error } = await this.authService.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${environment.urlHost}/auth/magik-link-callback`,
          },
        });

        if (error) throw error;
        this.toastService.success('Revisa tu correo para continuar con el inicio de sesión');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      this.generalError.set(message);
      this.toastService.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  setLoginMode(mode: 'password' | 'magic-link'): void {
    this.loginMode.set(mode);
    this.generalError.set(null);
  }
}
