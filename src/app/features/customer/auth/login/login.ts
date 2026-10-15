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

      if (this.loginMode() === 'password') {
        // Se autentica primero: Supabase Auth es la fuente de verdad. La
        // consulta previa a usuarios_publicos rechazaba cuentas válidas que
        // no tenían fila en esa tabla.
        const { data, error } = await this.authService.signInWithEmail(email, password);
        if (error) {
          if (error.code === 'email_not_confirmed') {
            this.generalError.set(
              'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.',
            );
            return;
          }
          if (error.code === 'invalid_credentials') {
            if (!(await this.dbService.existeCorreo(email))) {
              this.ofrecerRegistro(email);
              return;
            }
            this.generalError.set('La contraseña no es correcta. Inténtalo de nuevo o recupérala.');
            return;
          }
          throw error;
        }
        if (!data.user) throw new Error('No se pudo obtener el usuario autenticado.');

        const { data: profile, error: profileError } = await this.dbService
          .from(this.dbService.tableNames.PERFILES)
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error('No se encontró el perfil asociado a esta cuenta.');

        const perfil = profile as Perfil;
        if (perfil.status === 'bloqueado' || perfil.status === 'eliminado') {
          await this.authService.signOut();
          this.userStore.clearPerfil();
          this.generalError.set('Tu cuenta no está habilitada. Escríbenos a cheynverde@gmail.com si crees que es un error.');
          return;
        }

        this.userStore.setPerfil(perfil);
        if (perfil.status !== 'activo') {
          this.toastService.info(
            'Tu cuenta está registrada y pendiente de autorización. Te avisaremos por correo cuando esté activa.',
          );
        }
        await this.router.navigate(['/home']);
      } else {
        if (!(await this.dbService.existeCorreo(email))) {
          this.ofrecerRegistro(email);
          return;
        }

        const { error } = await this.authService.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${environment.urlHost}/auth/magik-link-callback`,
            // El login no debe crear cuentas nuevas por la puerta del magic link.
            shouldCreateUser: false,
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

  private ofrecerRegistro(email: string): void {
    this.confirmationModalService.confirm({
      message: 'No se encontró una cuenta con este correo. ¿Deseas crear una nueva cuenta?',
      accept: () => this.router.navigate(['/auth/register'], { queryParams: { email } }),
    });
  }

  setLoginMode(mode: 'password' | 'magic-link'): void {
    this.loginMode.set(mode);
    this.generalError.set(null);
  }
}
