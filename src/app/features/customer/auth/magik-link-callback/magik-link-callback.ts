import { Component, OnInit, inject } from '@angular/core';
import { CustomerData } from '@src/app/shared/models/interfaces/customer/customer';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';
import {
  PENDING_DATA_KEY,
  CURRENT_SESSION_KEY,
} from '@src/app/shared/models/constans/localstate/storage';
import { Router } from '@angular/router';

@Component({
  selector: 'app-magik-link-callback',
  imports: [],
  templateUrl: './magik-link-callback.html',
  styles: ``,
})
export class MagikLinkCallback implements OnInit {
  private readonly authService = inject(SupabaseAuthService);
  private readonly dbService = inject(SupabaseDbService);
  private readonly localStorageState = inject(LocalStorageStateService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.escucharCambiosDeSesion();
  }

  private escucharCambiosDeSesion(): void {
    this.authService.auth.onAuthStateChange(async (event, session) => {

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        await this.procesarOnboardingPendiente(session.user.id);
      } else {
        this.router.navigate(['/home']);
      }
    });
  }

  private async procesarOnboardingPendiente(userId: string): Promise<void> {
    const datosPendientes = this.localStorageState.getState<CustomerData | null>(
      PENDING_DATA_KEY,
      null,
    );

    if (!datosPendientes) return;

    const { error } = await this.dbService
      .from(this.dbService.tableNames.PERFILES)
      .update({
        telefono: datosPendientes.telefono,
        documento: datosPendientes.documento,
        tipo_documento: datosPendientes.tipo_documento,
        full_name: datosPendientes.full_name,
        fecha_nacimiento: datosPendientes.fecha_nacimiento,
        ubicacion: datosPendientes.ubicacion,
        updated_at: new Date(),
      })
      .eq('id', userId);

    if (!error) {
      await this.dbService.from(this.dbService.tableNames.USUARIOS_PUBLICOS).insert({
        uid: userId,
        correo: datosPendientes.correo.trim().toLowerCase(),
      });
      this.localStorageState.removeState(PENDING_DATA_KEY);
      this.router.navigate(['/home']);
    } else {
      console.error('Error al guardar datos de onboarding:', error.message);
      this.toastService.error(
        'Error al completar el registro. Por favor, intenta iniciar sesión nuevamente.',
      );
    }
  }
}
