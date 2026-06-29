import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { EstadoOrden, Orden } from '@src/app/shared/models/interfaces/db/db';
import { FechaFormatoPipe, MonedaPipe } from '@src/app/shared/pipes/index';
import { TimelineModule } from 'primeng/timeline';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, RouterModule, FechaFormatoPipe, MonedaPipe, TimelineModule],
  templateUrl: './ordenes.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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

  readonly estados: EstadoOrden[] = [
    'pendiente',
    'pagado',
    'en_proceso',
    'enviado',
    'entregado'
  ];

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
      const { error, data } = await this.dbService
        .from(TableName.ORDENES)
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      this.orders.set((data as Orden[]) || []);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar tus órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  buildTimeline(order: Orden) {
    const cancelado = order.status === 'cancelado';

    return this.estados.map((estado, index) => {

      const tracking = order.tracking.find(x => x.status === estado);

      const ultimoEstado = order.tracking.at(-1)?.status;

      const currentIndex = this.estados.indexOf(ultimoEstado as EstadoOrden);

      return {
        status: estado,
        date: tracking?.date ?? '',
        completed: cancelado
          ? false
          : index < currentIndex,
        current: cancelado
          ? false
          : index === currentIndex,
        cancelled: cancelado
      };
    });
  }

}
