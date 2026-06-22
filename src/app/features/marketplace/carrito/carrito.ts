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
import { CartButtonComponent } from '@src/app/shared/components/marketplace/button-card/button-card';
import { EdgeFunctionsService } from '@src/app/core/services/edge-functions.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

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
  imports: [RouterModule, MonedaPipe, CartButtonComponent],
  templateUrl: './carrito.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class CarritoComponent {
  private readonly cartStore = inject(CartStore);
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly edgeService = inject(EdgeFunctionsService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
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
        const product = productMap.get(item?.producto_id as string);
        const variant = item.variante_id ? variantMap.get(item.variante_id) : undefined;
        const unitPrice = variant?.precio_minimo_venta ?? product?.precio ?? 0;

        return {
          cartLine: item,
          producto: product,
          variante: variant,
          unitPrice,
          subtotal: variant && variant?.precio_minimo_venta ? variant?.precio_minimo_venta * item.cantidad : (unitPrice * item.cantidad),
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

  protected removeItem(id: string): void {
    this.cartStore.removeItem(id);
  }

  protected goToCheckout(): void {
    this.router.navigate(['/marketplace/checkout']);
  }


  protected async confirmOrder(): Promise<void> {
    if (this.cartItems().length === 0) {
      this.toastService.error('El carrito está vacío. Agrega productos antes de confirmar.');
      return;
    }

    this.submitting.set(true);

    try {
      const response = await this.edgeService.createOrder(this.cartItems());
      const orderId = this.extractOrderId(response);

      if (response.error) {
        throw response.error;
      }

      this.toastService.success(
        `Orden${orderId ? ` ${orderId}` : ''} creada correctamente. Abriendo WhatsApp para continuar con el pedido.`,
      );
      window.open(this.buildWhatsAppUrl(orderId), '_blank');
    } catch (error) {
      console.error(error);
      this.toastService.error('No se pudo crear la orden. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private extractOrderId(response: any): string {
    const data = response?.data ?? response;
    return (
      data?.ordenId ||
      data?.orderId ||
      data?.id ||
      data?.uid ||
      response?.ordenId ||
      response?.orderId ||
      response?.id ||
      ''
    );
  }

  private buildWhatsAppUrl(orderId: string): string {
    const lines = [
      'Hola Zona Green, quiero continuar con mi pedido:',
      ...this.cartDetails().map((item) => {
        const name = item.producto?.nombre || 'Producto';
        const variantLabel = item.variante ? ` (${item.variante.nombre})` : '';
        return `- ${item.cartLine.cantidad} x ${name}${variantLabel}: ${this.formatPrice(item.subtotal)}`;
      }),
      `Total: ${this.formatPrice(this.total())}`,
    ];

    if (orderId) {
      lines.push(`OrdenId: ${orderId}`);
    }

    lines.push(
      '',
      'Por favor, indíquenme los siguientes pasos para completar el pago y la entrega.',
    );

    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/573134312139?text=${text}`;
  }
}
