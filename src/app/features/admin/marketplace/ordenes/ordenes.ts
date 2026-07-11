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
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, FechaFormatoPipe, MonedaPipe, FormsModule, ButtonModule, SelectModule, TextareaModule, IftaLabelModule, DatePickerModule, InputTextModule, IconFieldModule, InputIconModule, FloatLabelModule],
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

  protected readonly statusOptions: { label: string, value: EstadoOrden | '' }[] = [
    { label: 'Todos', value: '' },
    { label: 'Selección', value: 'seleccion' },
    { label: 'Aporte', value: 'aporte' },
    { label: 'En preparación', value: 'en_proceso' },
    { label: 'En ruta', value: 'enviado' },
    { label: 'Entregado', value: 'entregado' },
    { label: 'Cancelado', value: 'cancelado' },
  ];

  protected readonly updateStatusOptions: { label: string, value: EstadoOrden }[] = [
    { label: 'Selección', value: 'seleccion' },
    { label: 'Aporte', value: 'aporte' },
    { label: 'En preparación', value: 'en_proceso' },
    { label: 'En ruta', value: 'enviado' },
    { label: 'Entregado', value: 'entregado' },
    { label: 'Cancelado', value: 'cancelado' },
  ];

  protected readonly tipoEntregaOptions = [
    { label: 'Todos', value: '' },
    { label: 'Envío', value: 'envío' },
    { label: 'Recoger en punto', value: 'recoger en punto' }
  ];

  protected readonly filterStatus = signal<EstadoOrden | ''>('');
  protected readonly filterTipoEntrega = signal<string>('');
  protected readonly filterCorreoCliente = signal<string>('');
  protected readonly filterFechaRango = signal<Date[] | null>(null);

  protected readonly filteredOrders = computed(() => {
    let currentOrders = this.orders();

    const fStatus = this.filterStatus();
    if (fStatus) {
      currentOrders = currentOrders.filter(o => o.status === fStatus);
    }

    const fTipoEntrega = this.filterTipoEntrega().toLowerCase();
    if (fTipoEntrega) {
      currentOrders = currentOrders.filter(o => o.tipo_entrega?.toLowerCase().includes(fTipoEntrega));
    }

    const fCorreoCliente = this.filterCorreoCliente().toLowerCase();
    if (fCorreoCliente) {
      currentOrders = currentOrders.filter(o => o.correo_cliente?.toLowerCase().includes(fCorreoCliente));
    }

    const fFechaRango = this.filterFechaRango();
    if (fFechaRango && fFechaRango.length > 0) {
      const start = fFechaRango[0];
      const end = fFechaRango[1] || fFechaRango[0];

      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);

      currentOrders = currentOrders.filter(o => {
        if (!o.created_at) return false;
        const orderDate = new Date(o.created_at);
        return orderDate >= startDate && orderDate <= endDate;
      });
    }

    return currentOrders;
  });

  protected getStatusColor(status: EstadoOrden): string {
    switch (status) {
      case 'seleccion': return 'bg-pink-100 text-pink-700';
      case 'aporte': return 'bg-blue-100 text-blue-700';
      case 'en_proceso': return 'bg-yellow-100 text-yellow-700';
      case 'enviado': return 'bg-orange-100 text-orange-700';
      case 'entregado': return 'bg-green-100 text-green-700';
      case 'cancelado': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  protected readonly hasOrders = computed(() => this.filteredOrders().length > 0);

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
