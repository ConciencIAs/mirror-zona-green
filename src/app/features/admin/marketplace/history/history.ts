import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Orden } from '@src/app/shared/models/interfaces/db/db';
import { MonedaPipe, FechaFormatoPipe } from '@src/app/shared/pipes/';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, MonedaPipe, FechaFormatoPipe],
  templateUrl: './history.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
      const { error, data } = await this.dbService
        .from(TableName.ORDENES)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      this.orders.set((data as Orden[]) || []);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar el historial de órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
