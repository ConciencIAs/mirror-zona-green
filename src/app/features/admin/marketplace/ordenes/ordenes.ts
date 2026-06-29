import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { EstadoOrden, Orden } from '@src/app/shared/models/interfaces/db/db';
import { MonedaPipe, FechaFormatoPipe } from '@src/app/shared/pipes/';
import { FormsModule } from '@angular/forms'

import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, FechaFormatoPipe, MonedaPipe, FormsModule, ButtonModule, SelectModule, TextareaModule, IftaLabelModule],
  templateUrl: './ordenes.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Ordenes {
  private readonly dbService = inject(SupabaseDbService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly orders = signal<Orden[]>([]);

  protected readonly statusOptions: { label: string, value: EstadoOrden }[] = [
    { label: 'Pagado', value: 'pagado' },
    { label: 'En preparación', value: 'en_proceso' },
    { label: 'En ruta', value: 'enviado' },
    { label: 'Entregado', value: 'entregado' },
    { label: 'Cancelado', value: 'cancelado' },
  ];

  protected readonly hasOrders = computed(() => this.orders().length > 0);

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

      const orders = (data as Orden[]) || [];
      this.orders.set(orders);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar las órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected async saveOrder(order: Orden): Promise<void> {
    this.saving.set(true);
    this.error.set('');

    try {
      const newStatus = order.status;
      const newTrackingRecord = { status: newStatus, date: new Date().toISOString() };

      const updates = {
        status: newStatus,
        tracking: [...(order.tracking || []), newTrackingRecord],
      };

      const { error, data } = await this.dbService.update(TableName.ORDENES, updates, {
        id: order.id,
      });

      if (error) {
        throw error;
      }

      await this.loadOrders();
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo actualizar la orden. Intenta nuevamente')
    } finally {
      this.saving.set(false);
    }
  }
}
