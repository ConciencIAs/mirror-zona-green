import { CommonModule } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { EstadoUsuario, Perfil, RolUsuario } from '@src/app/shared/models/interfaces/db/db';
import { SelectOption } from '@src/app/shared/components/form/form-select/form-select';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule],
  templateUrl: './customer.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Customer {
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal<string | null>(null); // user id being saved
  readonly profiles = signal<Perfil[]>([]);
  readonly searchTerm = signal('');

  readonly statusOptions: SelectOption[] = [
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
    { label: 'Bloqueado', value: 'bloqueado' },
    { label: 'Eliminado', value: 'eliminado' },
  ];

  readonly rolOptions: SelectOption[] = [
    { label: 'Admin', value: 'admin' },
    { label: 'Customer', value: 'customer' },
    { label: 'Agente', value: 'agente' },
    { label: 'Médico', value: 'medico' },
    { label: 'Anónimo', value: 'anonymous' },
  ];

  constructor() {
    this.loadProfiles();
  }

  private async loadProfiles() {
    this.loading.set(true);

    const { error, data } = await this.dbService.select(TableName.PERFILES);

    if (error) {
      console.error('Error al cargar perfiles', error);
      this.toastService.error('No se pudo cargar la lista de usuarios.');
      this.profiles.set([]);
    } else {
      this.profiles.set((data as unknown as Perfil[]) ?? []);
    }

    this.loading.set(false);
  }

  get filteredProfiles(): Perfil[] {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.profiles();
    return this.profiles().filter(
      (p) =>
        p.full_name?.toLowerCase().includes(term) ||
        p.correo.toLowerCase().includes(term) ||
        p.rol.toLowerCase().includes(term),
    );
  }

  async updateStatus(profile: Perfil, newStatus: EstadoUsuario) {
    this.saving.set(profile.id);

    const { error } = await this.dbService.update(
      TableName.PERFILES,
      { status: newStatus },
      { id: profile.id },
    );

    if (error) {
      console.error('Error al actualizar status', error);
      this.toastService.error('No se pudo actualizar el estado del usuario.');
    } else {
      this.profiles.update((list) =>
        list.map((p) => (p.id === profile.id ? { ...p, status: newStatus } : p)),
      );
      this.toastService.success('Estado actualizado correctamente.');
    }

    this.saving.set(null);
  }

  async updateRol(profile: Perfil, newRol: RolUsuario) {
    this.saving.set(profile.id);

    const { error } = await this.dbService.update(
      TableName.PERFILES,
      { rol: newRol },
      { id: profile.id },
    );

    if (error) {
      console.error('Error al actualizar rol', error);
      this.toastService.error('No se pudo actualizar el rol del usuario.');
    } else {
      this.profiles.update((list) =>
        list.map((p) => (p.id === profile.id ? { ...p, rol: newRol } : p)),
      );
      this.toastService.success('Rol actualizado correctamente.');
    }

    this.saving.set(null);
  }

  onSearchChange(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  getStatusClass(status: EstadoUsuario | undefined): string {
    switch (status) {
      case 'activo':
        return 'bg-emerald-100 text-emerald-700';
      case 'inactivo':
        return 'bg-slate-100 text-slate-600';
      case 'bloqueado':
        return 'bg-red-100 text-red-700';
      case 'eliminado':
        return 'bg-rose-200 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  }

  getRolClass(rol: RolUsuario): string {
    switch (rol) {
      case 'admin':
        return 'bg-violet-100 text-violet-700';
      case 'agente':
        return 'bg-blue-100 text-blue-700';
      case 'medico':
        return 'bg-teal-100 text-teal-700';
      case 'customer':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  }
}
