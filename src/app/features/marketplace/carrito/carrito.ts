import { Component, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Carrito, Producto } from '@src/app/shared/models/interfaces/db/db';
import { MonedaPipe } from '@src/app/shared/pipes/moneda.pipe';
import { CartButtonComponent } from '@src/app/shared/components/marketplace/button-card/button-card';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { ButtonModule } from 'primeng/button';

type CartProduct = {
  producto: Producto;
  unitPrice: number;
  subtotal: number;
  cartLine: Carrito;
};

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [RouterModule, MonedaPipe, CartButtonComponent, ButtonModule],
  templateUrl: './carrito.html',
  changeDetection: ChangeDetectionStrategy.OnPush, // Optimizado
})
export class CarritoComponent {
  private readonly cartStore = inject(CartStore);
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly cartDetails = signal<CartProduct[]>([]);

  protected readonly cartItems = computed(() => this.cartStore.items());
  protected readonly total = computed(() =>
    this.cartDetails().reduce((acc, item) => {
      const isGramos = item.producto.es_por_gramos;
      if (isGramos) {
        const presentacion = item.producto.presentaciones.find(p => p.gramos == item.cartLine.paquete_gramos);
        if (!presentacion) return acc;
        return acc + (presentacion.precio * item.cartLine.cantidad);
      } else {
        return acc + item.subtotal;
      }
    }, 0),
  );

  constructor() {
    effect(() => {
      void this.loadCartDetails();
    });
  }

  private async loadCartDetails(): Promise<void> {
    this.loading.set(true);

    try {
      const cart = this.cartItems();
      if (cart.length === 0) {
        this.cartDetails.set([]);
        return;
      }

      const productIds = Array.from(new Set(cart.map((item) => item.producto_id)));
      const [productsResult] = await Promise.all([
        this.dbService.from(TableName.PRODUCTOS).select('*').in('id', productIds),
      ]);

      if (productsResult.error) throw productsResult.error;

      const products = (productsResult.data as Producto[]) || [];
      const details = cart.map((cartLine) => {
        const product = products.find((p) => p.id === cartLine.producto_id) as Producto;
        const isGramos = product?.es_por_gramos;
        const unitPrice = isGramos
          ? (product.presentaciones.find(p => p.gramos == cartLine.paquete_gramos)?.precio || product.precio)
          : product.precio;

        return {
          producto: product,
          cartLine,
          unitPrice,
          subtotal: cartLine.cantidad * unitPrice
        };
      });

      this.cartDetails.set(details);
    } catch (error) {
      console.error(error);
      this.toastService.error('No se pudo cargar el carrito. Intenta nuevamente.');
      this.cartDetails.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected removeItem(item: Carrito): void {
    this.cartStore.removeItem(item);
  }

  protected goToCheckout(): void {
    if (this.cartItems().length > 0) {
      this.router.navigate(['/marketplace/checkout']);
    } else {
      this.toastService.error('Tu carrito está vacío.');
    }
  }
}