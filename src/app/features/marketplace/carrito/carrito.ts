import {
  Component,
  computed,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Carrito, Producto, ProductoVariante } from '@src/app/shared/models/interfaces/db/db';
import { MonedaPipe } from '@src/app/shared/pipes/moneda.pipe';

type CartProduct = {
  cartLine: Carrito;
  producto?: Producto;
  variante?: ProductoVariante;
  unitPrice: number;
  subtotal: number;
};

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [RouterModule, MonedaPipe],
  templateUrl: './carrito.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class CarritoComponent {
  private readonly cartStore = inject(CartStore);
  private readonly dbService = inject(SupabaseDbService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly cartDetails = signal<CartProduct[]>([]);

  protected readonly cartItems = computed(() => this.cartStore.items());
  protected readonly total = computed(() =>
    this.cartDetails().reduce((acc, item) => acc + item.subtotal, 0),
  );

  constructor() {
    effect(() => {
      void this.loadCartDetails();
    });
  }

  private async loadCartDetails(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const cart = this.cartItems();
      if (cart.length === 0) {
        this.cartDetails.set([]);
        return;
      }

      const productIds = Array.from(new Set(cart.map((item) => item.producto_id)));
      const variantIds = Array.from(
        new Set(cart.filter((item) => item.variante_id).map((item) => item.variante_id as string)),
      );

      const [productsResult, variantsResult] = await Promise.all([
        this.dbService.from(TableName.PRODUCTOS).select('*').in('id', productIds),
        variantIds.length
          ? this.dbService.from(TableName.PRODUCTOS_VARIANTES).select('*').in('id', variantIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (productsResult.error) {
        throw productsResult.error;
      }
      if (variantsResult.error) {
        throw variantsResult.error;
      }

      const products = (productsResult.data as Producto[]) || [];
      const variants = (variantsResult.data as ProductoVariante[]) || [];
      const productMap = new Map(products.map((product) => [product.id, product]));
      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

      const details = cart.map((item) => {
        const product = productMap.get(item.producto_id);
        const variant = item.variante_id ? variantMap.get(item.variante_id) : undefined;
        const unitPrice = variant?.precio ?? product?.precio ?? 0;

        return {
          cartLine: item,
          producto: product,
          variante: variant,
          unitPrice,
          subtotal: unitPrice * item.cantidad,
        };
      });

      this.cartDetails.set(details);
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar el carrito. Intenta nuevamente.');
      this.cartDetails.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected removeItem(id: string): void {
    this.cartStore.removeItem(id);
  }

  protected increaseQuantity(id: string): void {
    this.cartStore.increaseQuantity(id);
  }

  protected decreaseQuantity(id: string): void {
    this.cartStore.decreaseQuantity(id);
  }

  protected goToCheckout(): void {
    this.router.navigate(['/marketplace/checkout']);
  }
}
