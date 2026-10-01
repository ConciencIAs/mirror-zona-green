import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CustomerData } from '@src/app/shared/models/interfaces/customer/customer';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';
import {
  PENDING_DATA_KEY,
} from '@src/app/shared/models/constans/localstate/storage';
import { Router } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { Perfil } from '@src/app/shared/models/interfaces/db/db';
import type { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-magik-link-callback',
  imports: [],
  templateUrl: './magik-link-callback.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class MagikLinkCallback implements OnInit {
  private readonly authService = inject(SupabaseAuthService);
  private readonly dbService = inject(SupabaseDbService);
  private readonly localStorageState = inject(LocalStorageStateService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly userStore = inject(UserStore);

  ngOnInit(): void {
    void this.validarSesion();
  }

  private async validarSesion(): Promise<void> {
    try {
      const { data, error } = await this.authService.auth.getSession();
      if (error) throw error;

      if (!data.session?.user) {
        this.toastService.error('El enlace de acceso es inválido o ya venció. Solicita uno nuevo.');
        await this.router.navigate(['/auth/login']);
        return;
      }

      await this.procesarOnboardingPendiente(data.session.user);
    } catch (error: unknown) {
      console.error('Error al validar la sesión del enlace:', error);
      this.toastService.error('No se pudo validar el enlace. Intenta iniciar sesión nuevamente.');
      await this.router.navigate(['/auth/login']);
    }
  }

  private async procesarOnboardingPendiente(user: User): Promise<void> {
    const userId = user.id;
    let datosPendientes = this.localStorageState.getState<CustomerData | null>(
      PENDING_DATA_KEY,
      null,
    );

    if (!datosPendientes) {
      const { data: profile, error } = await this.dbService
        .from(this.dbService.tableNames.PERFILES)
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!profile?.full_name) datosPendientes = this.getRegistrationDataFromMetadata(user);
    }

    if (!datosPendientes) {
      await this.cargarPerfil(userId);
      return;
    }

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
      const { error: publicUserError } = await this.dbService
        .from(this.dbService.tableNames.USUARIOS_PUBLICOS)
        .upsert(
          {
            uid: userId,
            correo: datosPendientes.correo.trim().toLowerCase(),
          },
          { onConflict: 'correo' },
        );
      if (publicUserError) throw publicUserError;
      this.localStorageState.removeState(PENDING_DATA_KEY);
      await this.cargarPerfil(userId);
    } else {
      throw error;
    }
  }

  private getRegistrationDataFromMetadata(user: User): CustomerData | null {
    const metadata = user.user_metadata;
    const telefono = Number(metadata['telefono']);
    const documento = Number(metadata['documento']);
    const fechaNacimiento = new Date(String(metadata['fecha_nacimiento'] ?? ''));
    const tipoDocumento = metadata['tipo_documento'];
    const tiposDocumento = ['CC', 'CE', 'NIT', 'Pasaporte'];

    if (
      typeof metadata['full_name'] !== 'string' ||
      !metadata['full_name'] ||
      !Number.isFinite(telefono) ||
      !Number.isFinite(documento) ||
      Number.isNaN(fechaNacimiento.getTime()) ||
      typeof tipoDocumento !== 'string' ||
      !tiposDocumento.includes(tipoDocumento) ||
      typeof metadata['ubicacion'] !== 'string' ||
      !user.email
    ) {
      return null;
    }

    return {
      full_name: metadata['full_name'],
      correo: user.email,
      telefono,
      documento,
      fecha_nacimiento: fechaNacimiento,
      tipo_documento: tipoDocumento as CustomerData['tipo_documento'],
      ubicacion: metadata['ubicacion'],
      acepta_terminos: metadata['acepta_terminos'] === true,
      acepta_politica_privacidad: metadata['acepta_politica_privacidad'] === true,
    };
  }

  private async cargarPerfil(userId: string): Promise<void> {
    const { data, error } = await this.dbService
      .from(this.dbService.tableNames.PERFILES)
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error al cargar perfil después de autenticar:', error);
      this.toastService.error('No se pudo cargar tu perfil. Intenta iniciar sesión nuevamente.');
      await this.router.navigate(['/home']);
      return;
    }

    this.userStore.setPerfil(data as Perfil);
    await this.router.navigate(['/home']);
  }
}
