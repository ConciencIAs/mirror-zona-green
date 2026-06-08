import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { EstadoOrden, Json, Orden } from '@src/app/shared/models/interfaces/db/db';
import { MonedaPipe, FechaFormatoPipe } from '@src/app/shared/pipes/'

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, FechaFormatoPipe, MonedaPipe],
  templateUrl: './ordenes.html',
  styles: ``,
})
export class Ordenes {
  private readonly dbService = inject(SupabaseDbService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly orders = signal<Orden[]>([]);
  protected readonly orderComments = signal<Record<string, string>>({});
  protected readonly orderStatuses = signal<Record<string, EstadoOrden>>({});

  protected readonly statusOptions: EstadoOrden[] = [
    'pendiente',
    'pagado',
    'en_proceso',
    'enviado',
    'entregado',
    'cancelado',
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
      this.orderComments.set(
        Object.fromEntries(orders.map((order) => [order.id, order.comentarios_agente || '']))
      );
      this.orderStatuses.set(
        Object.fromEntries(orders.map((order) => [order.id, order.status])) as Record<string, EstadoOrden>
      );
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar las órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected updateComment(orderId: string, value: string): void {
    this.orderComments.update((comments) => ({
      ...comments,
      [orderId]: value,
    }));
  }

  protected updateStatus(orderId: string, value: string): void {
    this.orderStatuses.update((statuses) => ({
      ...statuses,
      [orderId]: value as EstadoOrden,
    }));
  }

  protected async saveOrder(order: Orden): Promise<void> {
    this.saving.set(true);
    this.error.set('');

    try {
      const updates = {
        status: this.orderStatuses()[order.id],
        comentarios_agente: this.orderComments()[order.id],
      };

      const { error, data } = await this.dbService.update(TableName.ORDENES, updates, { id: order.id });

      if (error) {
        throw error;
      }

      await this.loadOrders();
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo actualizar la orden. Intenta nuevamente.');
    } finally {
      this.saving.set(false);
    }
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
