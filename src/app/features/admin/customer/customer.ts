import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';

// Service y tipos
import { AdminUsersService } from '@src/app/core/services/admin/admin-users.service';
import { Perfil, EstadoUsuario, RolUsuario } from '@src/app/shared/models/interfaces/db/db';
import { SelectOption } from '@src/app/shared/components/form/form-select/form-select';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    TooltipModule,
    DialogModule,
    SelectModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
  ],
  templateUrl: './customer.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Customer {
  readonly adminUsersService = inject(AdminUsersService);

  // Alias para mantener limpia la plantilla
  readonly perfiles = this.adminUsersService.filteredPerfiles;
  readonly loading = this.adminUsersService.loading;
  readonly saving = this.adminUsersService.saving;
  readonly statusFilter = this.adminUsersService.statusFilter;
  readonly searchTerm = this.adminUsersService.searchTerm;
  readonly totalPerfiles = this.adminUsersService.totalPerfiles;

  // ── Modal de autorización ──
  readonly showAuthModal = signal(false);
  readonly selectedProfile = signal<Perfil | null>(null);
  readonly selectedOrigen = signal<string | null>(null);

  readonly origenOptions: SelectOption[] = [
    { label: 'Invitación de Admin', value: 'invitacion_de_admin' },
    { label: 'Por Referido', value: 'por_referido' },
    { label: 'Otros', value: 'otros' },
  ];

  // Mantenemos los status originales que tenía la aplicación
  readonly statusFilterOptions: SelectOption[] = [
    { label: 'Todos los estados', value: 'todos' },
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
    { label: 'Bloqueado', value: 'bloqueado' },
    { label: 'Eliminado', value: 'eliminado' },
  ];

  readonly statusSelectOptions: SelectOption[] = [
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
    { label: 'Bloqueado', value: 'bloqueado' },
    { label: 'Eliminado', value: 'eliminado' },
  ];

  readonly rolOptions: SelectOption[] = [
    { label: 'Admin', value: 'admin' },
    { label: 'Customer', value: 'customer' },
    { label: 'Agente', value: 'agente' },
  ];

  constructor() {
    this.adminUsersService.cargarPerfiles();
  }

  // ── Filtros ──
  onSearchChange(event: Event): void {
    this.adminUsersService.setSearchTerm((event.target as HTMLInputElement).value);
  }

  onStatusFilterChange(value: string): void {
    this.adminUsersService.setStatusFilter(value as any);
  }

  // ── Acciones de cambio directo (Dropdowns) ──
  async updateStatus(profile: Perfil, newStatus: EstadoUsuario): Promise<void> {
    if (newStatus && newStatus !== profile.status) {
      await this.adminUsersService.cambiarEstado(profile.id, newStatus);
    }
  }

  async updateRol(profile: Perfil, newRol: RolUsuario): Promise<void> {
    if (newRol && newRol !== profile.rol) {
      await this.adminUsersService.cambiarRol(profile.id, newRol);
    }
  }

  // ── Modal de Autorización ──
  abrirModalAutorizacion(profile: Perfil): void {
    this.selectedProfile.set(profile);
    this.selectedOrigen.set(null);
    this.showAuthModal.set(true);
  }

  async confirmarAutorizacion(): Promise<void> {
    const profile = this.selectedProfile();
    const origen = this.selectedOrigen();
    if (!profile || !origen) return;

    await this.adminUsersService.autorizarUsuario(profile.id, origen);
    this.showAuthModal.set(false);
    this.selectedProfile.set(null);
    this.selectedOrigen.set(null);
  }

  cancelarAutorizacion(): void {
    this.showAuthModal.set(false);
    this.selectedProfile.set(null);
    this.selectedOrigen.set(null);
  }

  async generarCodigo(profile: Perfil): Promise<void> {
    await this.adminUsersService.generarCodigo(profile.id);
  }

  async revocarCodigo(profile: Perfil): Promise<void> {
    await this.adminUsersService.revocarCodigo(profile.id);
  }

  // ── Helpers visuales ──
  getStatusSeverity(status: EstadoUsuario | undefined): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'activo': return 'success';
      case 'inactivo': return 'warn';
      case 'bloqueado': return 'danger';
      case 'eliminado': return 'danger';
      default: return 'secondary';
    }
  }
}
