import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/core/models/constans/db/tableName.enum';
import { Producto, ProductoVariante } from '@src/app/core/models/interfaces/db/db';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-details.html',
  styles: ``,
})
export class ProductDetails {
  private readonly dbService = inject(SupabaseDbService);
  private readonly cartStore = inject(CartStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly product = signal<Producto | null>(null);
  protected readonly variants = signal<ProductoVariante[]>([]);
  protected readonly selectedVariantId = signal('');
  protected readonly selectedGrams = signal(0);
  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);
  protected readonly added = signal(false);

  protected readonly hasVariants = computed(() => this.product()?.has_product_variantes ?? false);
  protected readonly selectedVariant = computed(() => {
    const variantId = this.selectedVariantId();
    return this.variants().find((v) => v.id === variantId) || null;
  });
  protected readonly canAdd = computed(() => {
    if (this.hasVariants()) {
      const variant = this.selectedVariant();
      if (!variant) return false;

      // Si la variante tiene gramos disponibles, debe haber gramos ingresados
      if (variant.gramos_disponibles && variant.gramos_disponibles > 0) {
        return this.selectedGrams() > 0;
      }

      // Si no tiene gramos, debe haber cantidad ingresada
      return this.quantity() > 0;
    }

    // Para productos simples, solo se necesita cantidad > 0
    return this.quantity() > 0;
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
    this.error.set('');

    try {
      const response = await this.dbService
        .from(TableName.PRODUCTOS)
        .select('*')
        .eq('id', productId)
        .single();

      if (response.error) {
        throw response.error;
      }

      const prod = response.data as Producto;
      this.product.set(prod);

      if (prod.has_product_variantes) {
        await this.loadVariants(productId);
      }
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar el producto. Intenta nuevamente.');
      this.product.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadVariants(productId: string): Promise<void> {
    try {
      const response = await this.dbService
        .from(TableName.PRODUCTOS_VARIANTES)
        .select('*')
        .eq('producto_id', productId)
        .eq('status', 'activo');

      if (response.error) {
        throw response.error;
      }

      const vars = (response.data as ProductoVariante[]) || [];
      this.variants.set(vars);

      if (vars.length > 0) {
        this.selectedVariantId.set(vars[0].id);
      }
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar las variantes. Intenta nuevamente.');
      this.variants.set([]);
    }
  }

  protected async addToCart(): Promise<void> {
    if (!this.canAdd()) {
      return;
    }

    this.adding.set(true);

    try {
      const prod = this.product();
      if (!prod) {
        throw new Error('Producto no encontrado');
      }

      const variantId = this.hasVariants() ? this.selectedVariantId() : null;
      const variant = this.selectedVariant();
      
      // Determinar si usar gramos o cantidad
      const useGrams: boolean = Boolean(variant?.gramos_disponibles && variant.gramos_disponibles > 0);
      const cantidad = useGrams ? this.selectedGrams() : this.quantity();

      this.cartStore.addItem({
        producto_id: prod.id,
        variante_id: variantId,
        es_gramos: useGrams,
        usuario_id: '', // Se asigna en persistCartItem del cartStore
        cantidad: cantidad,
      });

      this.added.set(true);
      setTimeout(() => {
        this.added.set(false);
      }, 3000);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo agregar al carrito. Intenta nuevamente.');
    } finally {
      this.adding.set(false);
    }
  }

  protected updateGrams(value: string): void {
    this.selectedGrams.set(parseInt(value, 10) || 0);
  }

  protected updateQuantity(value: string): void {
    this.quantity.set(Math.max(0, parseInt(value, 10) || 0));
  }

  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected get imageUrl(): string {
    const urls = this.product()?.urls_imagenes;
    return urls && urls.length > 0 ? urls[0] : '/assets/images/placeholder.png';
  }

  protected get variantImageUrl(): string {
    const variant = this.selectedVariant();
    if (!variant) {
      return this.imageUrl;
    }
    const urls = variant.urls_imagenes;
    return urls && urls.length > 0 ? urls[0] : this.imageUrl;
  }
}
