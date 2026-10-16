import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { EdgeFunctionsService } from '@src/app/core/services/edge-functions.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Perfil, EstadoUsuario, RolUsuario } from '@src/app/shared/models/interfaces/db/db';
import { environment } from '@src/environments/environment';
import { normalizarCelular } from '@src/app/shared/utils/telefono';

export type StatusFilter = 'todos' | EstadoUsuario;

export interface RelacionReferido {
  referido_id: string;
  referente_id: string | null;
  estado: 'resuelto' | 'no_resuelto' | 'asignado_manual';
}

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
  private readonly edgeFunctionsService = inject(EdgeFunctionsService);
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

  readonly perfilesByCodigo = computed(() => {
    const map = new Map<string, Perfil>();
    for (const p of this.perfiles()) {
      if (p.codigo_invitacion) {
        map.set(p.codigo_invitacion.trim().toUpperCase(), p);
      }
    }
    return map;
  });

  /** Cuántos perfiles comparten cada celular (normalizado). */
  private readonly perfilesPorCelular = computed(() => {
    const conteo = new Map<string, number>();
    for (const p of this.perfiles()) {
      const celular = p.telefono_normalizado ?? normalizarCelular(p.telefono);
      if (celular) conteo.set(celular, (conteo.get(celular) ?? 0) + 1);
    }
    return conteo;
  });

  /** Alerta del celular para el panel (Fase 2c), o null si está bien. */
  alertaCelular(perfil: Perfil): 'repetido' | 'invalido' | 'falta' | null {
    if (!perfil.telefono) return 'falta';
    const celular = perfil.telefono_normalizado ?? normalizarCelular(perfil.telefono);
    if (!celular) return 'invalido';
    return (this.perfilesPorCelular().get(celular) ?? 0) > 1 ? 'repetido' : null;
  }

  /**
   * Relaciones de la tabla `referidos` (Fase 2b), por id del referido. Vacío si
   * la migración aún no está aplicada: entonces se resuelve por código.
   */
  readonly relacionesReferido = signal(new Map<string, RelacionReferido>());

  getReferente(codigoReferido: string | null | undefined): Perfil | null {
    if (!codigoReferido) return null;
    return this.perfilesByCodigo().get(codigoReferido.trim().toUpperCase()) ?? null;
  }

  /** Referente de un perfil: primero la relación guardada, si no, el código. */
  referenteDe(perfil: Perfil): Perfil | null {
    const relacion = this.relacionesReferido().get(perfil.id);
    if (relacion) {
      return relacion.referente_id ? (this.perfiles().find((p) => p.id === relacion.referente_id) ?? null) : null;
    }
    return this.getReferente(perfil.referido_por);
  }

  /** true si el perfil usó un código que no se pudo atribuir a nadie. */
  referidoNoResuelto(perfil: Perfil): boolean {
    return this.relacionesReferido().get(perfil.id)?.estado === 'no_resuelto';
  }

  private async cargarRelacionesReferido(): Promise<void> {
    const { data, error } = await this.dbService
      .from(TableName.REFERIDOS)
      .select('referido_id, referente_id, estado');
    if (error) return; // Migración 20261016140000 sin aplicar: se usa el código.
    this.relacionesReferido.set(
      new Map(((data ?? []) as RelacionReferido[]).map((r) => [r.referido_id, r])),
    );
  }

  readonly totalPerfiles = computed(() => this.perfiles().length);

  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
  }

  async cargarPerfiles(): Promise<void> {
    this.loading.set(true);
    // Los registros más recientes primero (los que suelen esperar autorización).
    const { data, error } = await this.dbService
      .select(TableName.PERFILES)
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('AdminUsersService: Error al cargar perfiles', error);
      this.toastService.error('No se pudo cargar la lista de usuarios.');
      this.perfiles.set([]);
    } else {
      this.perfiles.set((data as unknown as Perfil[]) ?? []);
      await this.cargarRelacionesReferido();
    }

    this.loading.set(false);
  }

  async autorizarUsuario(perfilId: string, origenAutorizacion: string): Promise<void> {
    this.saving.set(perfilId);
    const codigoInvitacion = generarCodigoInvitacion();
    const perfil = this.perfiles().find((item) => item.id === perfilId);

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
      if (perfil?.correo) {
        await this.enviarCorreoActivacion(perfil.correo);
      }
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
    const perfil = this.perfiles().find((item) => item.id === perfilId);
    const debeNotificarActivacion = nuevoEstado === 'activo' && perfil?.status !== 'activo';

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
      if (debeNotificarActivacion && perfil?.correo) {
        await this.enviarCorreoActivacion(perfil.correo);
      }
      this.toastService.success('Estado actualizado.');
    }

    this.saving.set(null);
  }

  private async enviarCorreoActivacion(correo: string): Promise<void> {
    try {
      const { error } = await this.edgeFunctionsService.sendAccountActivation({
        correo,
        confirmation_url: `${environment.urlHost}/auth/login`,
      });

      if (error) {
        console.error('AdminUsersService: Error al enviar correo de activación', error);
        this.toastService.warn('El usuario se activó, pero no se pudo enviar el correo de notificación.');
      }
    } catch (error) {
      console.error('AdminUsersService: Error al invocar correo de activación', error);
      this.toastService.warn('El usuario se activó, pero no se pudo enviar el correo de notificación.');
    }
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

  async cargarBaseConfianza(telefonos: string[]): Promise<{ success: boolean }> {
    if (!telefonos.length) {
      this.toastService.warn('No se encontraron teléfonos para cargar.');
      return { success: false };
    }

    this.loading.set(true);

    const registros = telefonos.map((telefono) => ({
      telefono: telefono.trim(),
    }));

    const { error } = await this.dbService.insert(TableName.BASE_CONFIANZA, registros);
    this.loading.set(false);

    if (error) {
      console.error('AdminUsersService: Error al cargar base de confianza', error);
      this.toastService.error(`Error al cargar teléfonos: ${error.message}`);
      return { success: false };
    }

    this.toastService.success(`${telefonos.length} teléfonos cargados a la base de confianza.`);
    return { success: true };
  }
}
