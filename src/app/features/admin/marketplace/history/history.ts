import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/core/models/constans/db/tableName.enum';
import { Orden } from '@src/app/core/models/interfaces/db/db';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html',
  styles: ``,
})
export class History {
  private readonly dbService = inject(SupabaseDbService);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly orders = signal<Orden[]>([]);

  protected ngOnInit(): void {
    void this.loadOrders();
  }

  private async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await this.dbService
        .from(TableName.ORDENES)
        .select('*')
        .order('created_at', { ascending: false });

      if (response.error) {
        throw response.error;
      }

      this.orders.set((response.data as Orden[]) || []);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar el historial de órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
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

  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
