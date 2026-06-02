import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/core/models/constans/db/tableName.enum';
import { Json, Orden } from '@src/app/core/models/interfaces/db/db';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ordenes.html',
  styles: ``,
})
export class Ordenes {
  private readonly dbService = inject(SupabaseDbService);
  private readonly userStore = inject(UserStore);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly orders = signal<Orden[]>([]);

  protected readonly userId = computed(() => this.userStore.perfil().id);
  protected readonly hasOrders = computed(() => this.orders().length > 0);

  protected ngOnInit(): void {
    void this.loadOrders();
  }

  private async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    const userId = this.userId();
    if (!userId) {
      this.error.set('No se encontró el usuario. Inicia sesión de nuevo.');
      this.orders.set([]);
      this.loading.set(false);
      return;
    }

    try {
      const response = await this.dbService
        .from(TableName.ORDENES)
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false });

      if (response.error) {
        throw response.error;
      }

      this.orders.set((response.data as Orden[]) || []);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar tus órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected parseOrderItems(list: Json): Json[] {
    if (!list) {
      return [];
    }

    let parsed: unknown = list;

    if (typeof list === 'string') {
      try {
        parsed = JSON.parse(list);
      } catch {
        return [];
      }
    }

    return Array.isArray(parsed) ? (parsed as Json[]) : [];
  }
}
