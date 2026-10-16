import { Component, computed, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';

import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { EstadoOrden, Orden, ProductReview, SnapshotAnalitica, Tracking } from '@src/app/shared/models/interfaces/db/db';
import { EstadoOrdenPipe, FechaFormatoPipe, MonedaPipe } from '@src/app/shared/pipes/index';
import { RECORRIDO_ORDEN } from '@src/app/shared/utils/estados-orden';
import { TimelineModule } from 'primeng/timeline';
import { ProductReviewModalComponent } from '@src/app/shared/components/product-review-modal/product-review-modal';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FechaFormatoPipe,
    MonedaPipe,
    EstadoOrdenPipe,
    TimelineModule,
    ProductReviewModalComponent,
  ],
  templateUrl: './ordenes.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  // CSS literal (no utilidades de Tailwind): el Tailwind del CDN puede pisarlas.
  styles: `
    :host ::ng-deep p-timeline {
      display: block;
      margin-top: 1rem;
    }
    /* En vertical la columna de fechas tiene ancho fijo para que la línea no se corra. */
    :host ::ng-deep p-timeline.p-timeline-vertical .p-timeline-event-opposite {
      flex: 0 0 5.5rem;
    }
  `,
})
export class Ordenes {
  private readonly dbService = inject(SupabaseDbService);
  private readonly userStore = inject(UserStore);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly orders = signal<Orden[]>([]);

  /** Map: product_id → ProductReview (para saber si el usuario ya opinó) */
  protected readonly myReviews = signal<Map<string, ProductReview>>(new Map());

  /** Map auxiliar: sku → product_id (para órdenes legadas sin product_id en el snapshot) */
  private readonly _skuToProductId = signal<Map<string, string>>(new Map());


  /** Producto actualmente abierto en el modal de reseña */
  protected readonly reviewTarget = signal<{
    productId: string;
    productName: string;
    existing: ProductReview | null;
  } | null>(null);

  protected readonly userId = computed(() => this.userStore.perfil().id);
  protected readonly hasOrders = computed(() => this.orders().length > 0);

  readonly estados: EstadoOrden[] = RECORRIDO_ORDEN;

  /**
   * Los 5 estados solo caben en una fila en pantallas anchas; en celular y
   * tablet la línea de tiempo va vertical (si no, ensancha la página).
   */
  protected readonly timelineHorizontal = signal(false);

  constructor() {
    const consulta = window.matchMedia('(min-width: 1280px)');
    const actualizar = () => this.timelineHorizontal.set(consulta.matches);
    actualizar();
    consulta.addEventListener('change', actualizar);
    inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', actualizar));
  }

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

      if (error) throw error;

      this.orders.set((data as Orden[]) || []);

      // Cargar las reseñas del usuario para todos los productos únicos
      await this.loadMyReviews(data as Orden[]);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar tus órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMyReviews(orders: Orden[]): Promise<void> {
    // Recopilar product_ids de órdenes entregadas (nuevas con product_id)
    // y skus de órdenes legadas que no tienen product_id aún
    const directIds = new Set<string>();
    const skusLegacy = new Set<string>();

    for (const order of orders) {
      if (order.status === 'entregado') {
        for (const item of order.lista_productos) {
          if (item.id) {
            directIds.add(item.id);
          } else if (item.sku) {
            skusLegacy.add(item.sku);
          }
        }
      }
    }

    const allProductIds = new Set<string>(directIds);

    // Resolver skus → ids para órdenes legadas
    if (skusLegacy.size > 0) {
      const { data: prods } = await this.dbService
        .from(TableName.PRODUCTOS)
        .select('id, sku')
        .in('sku', Array.from(skusLegacy));

      if (prods) {
        (prods as { id: string; sku: string }[]).forEach(p => allProductIds.add(p.id));
        // Guardar mapa sku→id para uso en getProductId
        const skuToId = new Map((prods as { id: string; sku: string }[]).map(p => [p.sku, p.id]));
        this._skuToProductId.set(skuToId);
      }
    }

    if (!allProductIds.size) return;

    const { data } = await this.dbService
      .from(TableName.PRODUCT_REVIEWS)
      .select('*')
      .eq('user_id', this.userId())
      .in('product_id', Array.from(allProductIds));

    if (!data) return;

    const map = new Map<string, ProductReview>();
    (data as ProductReview[]).forEach(r => map.set(r.product_id, r));
    this.myReviews.set(map);
  }

  /** Devuelve la reseña existente del usuario para un producto, o null */
  getExistingReview(productId: string): ProductReview | null {
    return this.myReviews().get(productId) ?? null;
  }

  /** Obtener product_id del snapshot (usa product_id directo, luego resuelve por sku) */
  getProductId(item: SnapshotAnalitica): string {
    if (item.id) return item.id;
    return this._skuToProductId().get(item.sku) ?? item.sku;
  }

  /** Abrir modal de reseña */
  openReviewModal(productId: string, productName: string): void {
    const existing = this.getExistingReview(productId);
    this.reviewTarget.set({ productId, productName, existing });
  }

  /** Cerrar modal de reseña */
  closeReviewModal(): void {
    this.reviewTarget.set(null);
  }

  /** Actualizar el map local cuando se guarda una reseña */
  onReviewSaved(review: ProductReview): void {
    const map = new Map(this.myReviews());
    map.set(review.product_id, review);
    this.myReviews.set(map);
  }

  /** Eliminar del map local cuando se borra una reseña */
  onReviewDeleted(productId: string): void {
    const map = new Map(this.myReviews());
    map.delete(productId);
    this.myReviews.set(map);
  }

  buildTimeline(order: Orden) {
    const cancelado = order.status === 'cancelado';
    // El paso actual es el estado del pedido; el historial (tracking) solo da las fechas.
    const currentIndex = this.estados.indexOf(order.status);
    // El checkout guarda el primer registro como { estado: 'pendiente', fecha }
    // y el admin los siguientes como { status, date }.
    const registros = (order.tracking ?? []).map((t) => {
      const r = t as Tracking & { estado?: string; fecha?: string };
      return { status: r.status ?? (r.estado === 'pendiente' ? 'seleccion' : r.estado), date: r.date ?? r.fecha };
    });

    return this.estados.map((estado, index) => {
      // Si el pedido pasó varias veces por un estado, vale la última vez.
      const registro = [...registros].reverse().find((r) => r.status === estado);
      const alcanzado = !cancelado && index <= currentIndex;
      return {
        status: estado,
        date: alcanzado ? (registro?.date ?? (estado === 'seleccion' ? order.created_at : '')) : '',
        completed: !cancelado && index < currentIndex,
        current: !cancelado && index === currentIndex,
        cancelled: cancelado,
      };
    });
  }
}
