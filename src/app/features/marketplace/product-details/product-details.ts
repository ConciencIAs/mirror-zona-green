import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Producto, PresentacionProducto } from '@src/app/shared/models/interfaces/db/db';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { MonedaPipe } from '@src/app/shared/pipes';
import { CarouselModule } from 'primeng/carousel';
import { ImageModule } from 'primeng/image';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [RouterModule, MonedaPipe, CarouselModule, ImageModule, ButtonModule],
  templateUrl: './product-details.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProductDetails {
  private readonly dbService = inject(SupabaseDbService);
  private readonly cartStore = inject(CartStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly product = signal<Producto | null>(null);
  protected readonly selectedGrams = signal<number | null>(null);
  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);
  protected readonly added = signal(false);

  /** La presentación seleccionada actualmente (solo para productos por gramos) */
  protected readonly selectedPresentation = computed<PresentacionProducto | null>(() => {
    const prod = this.product();
    const grams = this.selectedGrams();
    if (!prod?.es_por_gramos || grams === null) return null;
    return prod.presentaciones?.find(p => p.gramos === grams) ?? null;
  });

  /** Precio a mostrar: el de la presentación seleccionada o el precio base del producto */
  protected readonly displayedPrice = computed(() => {
    const prod = this.product();
    if (!prod) return 0;
    if (prod.es_por_gramos) {
      return this.selectedPresentation()?.precio ?? 0;
    }
    return prod.precio;
  });

  /** Stock a mostrar: el de la presentación seleccionada o el stock_total */
  protected readonly displayedStock = computed(() => {
    const prod = this.product();
    if (!prod) return 0;
    if (prod.es_por_gramos) {
      return this.selectedPresentation()?.stock ?? 0;
    }
    return prod.stock_total;
  });

  protected readonly canAdd = computed(() => {
    const prod = this.product();
    if (!prod) return false;
    const qty = this.quantity();
    if (qty <= 0) return false;
    if (qty > this.displayedStock()) return false;
    if (prod.es_por_gramos && this.selectedGrams() === null) return false;
    return true;
  });

  protected ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const productId = params['id'];
      if (productId) {
        void this.loadProduct(productId);
      }
    });
  }

  private async loadProduct(productId: string): Promise<void> {
    this.loading.set(true);

    try {
      const { error, data } = await this.dbService
        .from(TableName.PRODUCTOS)
        .select('*')
        .eq('id', productId)
        .single();

      if (error || !data) {
        this.toastService.error('No se pudo cargar el producto.');
        return;
      }

      const prod = data as Producto;
      this.product.set(prod);

      // Si es por gramos y tiene presentaciones, seleccionar la primera por defecto
      if (prod.es_por_gramos && prod.presentaciones?.length > 0) {
        this.selectedGrams.set(prod.presentaciones[0].gramos);
      }

    } catch (error) {
      console.error(error);
      this.toastService.error('No se pudo cargar el producto. Intenta nuevamente.');
      this.product.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected selectGrams(gramos: number): void {
    this.selectedGrams.set(gramos);
    this.quantity.set(1); // Reset cantidad al cambiar de presentación
  }

  protected async addToCart(): Promise<void> {
    if (!this.canAdd()) {
      return;
    }

    this.adding.set(true);

    console.log(this.quantity())

    try {
      const prod = this.product();
      if (!prod) {
        throw new Error('Producto no encontrado');
      }

      this.cartStore.addItem({
        producto_id: prod.id,
        paquete_gramos: prod.es_por_gramos ? this.selectedGrams() : null,
        usuario_id: '', // Se asigna en persistCartItem del cartStore
        cantidad: this.quantity(),
      });

      this.added.set(true);
      setTimeout(() => {
        this.added.set(false);
      }, 3000);
    } catch (error) {
      console.error(error);
      this.toastService.error('No se pudo agregar al carrito. Intenta nuevamente.');
    } finally {
      this.adding.set(false);
    }
  }

  protected updateQuantity(value: string): void {
    this.quantity.set(Math.max(1, parseInt(value, 10) || 1));
  }

  protected get productImages(): string[] {
    return this.product()?.urls_imagenes ?? [];
  }
}
