import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Perfil, EstadoUsuario, RolUsuario } from '@src/app/shared/models/interfaces/db/db';

export type StatusFilter = 'todos' | EstadoUsuario;

function generarCodigoInvitacion(longitud = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  const array = new Uint8Array(longitud);
  crypto.getRandomValues(array);
  for (const byte of array) {
    codigo += chars[byte % chars.length];
  }
  return codigo;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);

  readonly perfiles = signal<Perfil[]>([]);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<string | null>(null);
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly searchTerm = signal<string>('');

  readonly filteredPerfiles = computed(() => {
    let list = this.perfiles();

    const statusF = this.statusFilter();
    if (statusF !== 'todos') {
      list = list.filter((p) => p.status === statusF);
    }

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      list = list.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(term) ||
          p.correo.toLowerCase().includes(term) ||
          p.codigo_invitacion?.toLowerCase().includes(term) ||
          p.referido_por?.toLowerCase().includes(term),
      );
    }

    return list;
  });

  readonly totalPerfiles = computed(() => this.perfiles().length);

  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
  }

  async cargarPerfiles(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.dbService.select(TableName.PERFILES);

    if (error) {
      console.error('AdminUsersService: Error al cargar perfiles', error);
      this.toastService.error('No se pudo cargar la lista de usuarios.');
      this.perfiles.set([]);
    } else {
      this.perfiles.set((data as unknown as Perfil[]) ?? []);
    }

    this.loading.set(false);
  }

  async autorizarUsuario(perfilId: string, origenAutorizacion: string): Promise<void> {
    this.saving.set(perfilId);
    const codigoInvitacion = generarCodigoInvitacion();

    const { error } = await this.dbService.update(
      TableName.PERFILES,
      {
        status: 'activo' as EstadoUsuario,
        origen_autorizacion: origenAutorizacion,
        codigo_invitacion: codigoInvitacion,
      },
      { id: perfilId },
    );

    if (error) {
      console.error('AdminUsersService: Error al autorizar usuario', error);
      this.toastService.error('No se pudo autorizar al usuario.');
    } else {
      this.perfiles.update((list) =>
        list.map((p) =>
          p.id === perfilId
            ? {
                ...p,
                status: 'activo' as EstadoUsuario,
                origen_autorizacion: origenAutorizacion,
                codigo_invitacion: codigoInvitacion,
              }
            : p,
        ),
      );
      this.toastService.success('Usuario autorizado y código de invitación asignado.');
    }

    this.saving.set(null);
  }

  async generarCodigo(perfilId: string): Promise<void> {
    this.saving.set(perfilId);
    const codigoInvitacion = generarCodigoInvitacion();

    const { error } = await this.dbService.update(
      TableName.PERFILES,
      { codigo_invitacion: codigoInvitacion },
      { id: perfilId },
    );

    if (error) {
      console.error('AdminUsersService: Error al generar código', error);
      this.toastService.error('No se pudo generar el código de invitación.');
    } else {
      this.perfiles.update((list) =>
        list.map((p) => (p.id === perfilId ? { ...p, codigo_invitacion: codigoInvitacion } : p)),
      );
      this.toastService.success(`Código generado: ${codigoInvitacion}`);
    }

    this.saving.set(null);
  }

  async revocarCodigo(perfilId: string): Promise<void> {
    this.saving.set(perfilId);

    const { error } = await this.dbService.update(
      TableName.PERFILES,
      { codigo_invitacion: null },
      { id: perfilId },
    );

    if (error) {
      console.error('AdminUsersService: Error al revocar código', error);
      this.toastService.error('No se pudo revocar el código de invitación.');
    } else {
      this.perfiles.update((list) =>
        list.map((p) => (p.id === perfilId ? { ...p, codigo_invitacion: null } : p)),
      );
      this.toastService.success('Código de invitación revocado.');
    }

    this.saving.set(null);
  }

  async cambiarEstado(perfilId: string, nuevoEstado: EstadoUsuario): Promise<void> {
    this.saving.set(perfilId);

    const { error } = await this.dbService.update(
      TableName.PERFILES,
      { status: nuevoEstado },
      { id: perfilId },
    );

    if (error) {
      console.error('AdminUsersService: Error al cambiar estado', error);
      this.toastService.error('No se pudo cambiar el estado del usuario.');
    } else {
      this.perfiles.update((list) =>
        list.map((p) => (p.id === perfilId ? { ...p, status: nuevoEstado } : p)),
      );
      this.toastService.success('Estado actualizado.');
    }

    this.saving.set(null);
  }

  async cambiarRol(perfilId: string, nuevoRol: RolUsuario): Promise<void> {
    this.saving.set(perfilId);

    const { error } = await this.dbService.update(
      TableName.PERFILES,
      { rol: nuevoRol },
      { id: perfilId },
    );

    if (error) {
      console.error('AdminUsersService: Error al cambiar rol', error);
      this.toastService.error('No se pudo cambiar el rol del usuario.');
    } else {
      this.perfiles.update((list) =>
        list.map((p) => (p.id === perfilId ? { ...p, rol: nuevoRol } : p)),
      );
      this.toastService.success('Rol actualizado.');
    }

    this.saving.set(null);
  }

  async cargarBaseConfianza(correos: string[]): Promise<{ success: boolean }> {
    if (!correos.length) {
      this.toastService.warn('No se encontraron correos para cargar.');
      return { success: false };
    }

    this.loading.set(true);

    const registros = correos.map((correo) => ({
      correo: correo.trim().toLowerCase(),
    }));

    const { error } = await this.dbService.insert(TableName.BASE_CONFIANZA, registros);
    this.loading.set(false);

    if (error) {
      console.error('AdminUsersService: Error al cargar base de confianza', error);
      this.toastService.error(`Error al cargar correos: ${error.message}`);
      return { success: false };
    }

    this.toastService.success(`${correos.length} correos cargados a la base de confianza.`);
    return { success: true };
  }
}
