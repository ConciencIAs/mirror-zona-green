import { Component, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/toast.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ConfirmationModalService } from '@src/app/core/services/confirmation.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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
  showErrorsModal = signal(false);
  generalError = signal<string | null>(null);

  loginForm = new FormGroup<{ email: FormControl<string> }>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  get emailControl() {
    return this.loginForm.controls.email;
  }

  get emailError() {
    const control = this.emailControl;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'El correo es obligatorio';
    if (control.hasError('email')) return 'Ingresa un correo válido';
    return null;
  }

  errorEntries() {
    const entries: string[] = [];
    if (this.emailError) entries.push(this.emailError);
    if (this.generalError()) entries.push(this.generalError()!);
    return entries;
  }

  closeErrorsModal() {
    this.showErrorsModal.set(false);
  }

  async submit() {
    this.loading.set(true);
    this.generalError.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.showErrorsModal.set(true);
      this.loading.set(false);
      return;
    }
    const email = this.emailControl.value.trim().toLowerCase();

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
        this.showErrorsModal.set(true);
        this.toastService.error(message);
      } else {
        this.toastService.success('Revisa tu correo para continuar con el inicio de sesión');
      }
    } catch (err: any) {
      const message = err?.message ?? 'Error inesperado. Intenta de nuevo.';
      this.generalError.set(message);
      this.showErrorsModal.set(true);
      this.toastService.error(message);
    } finally {
      this.loading.set(false);
    }
  }
}
