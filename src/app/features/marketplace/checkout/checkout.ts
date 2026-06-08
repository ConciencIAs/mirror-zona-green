import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { EdgeFunctionsService } from '@src/app/core/services/edge-functions.service';
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
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, MonedaPipe],
  templateUrl: './checkout.html',
  styles: ``,
})
export class Checkout {
  private readonly cartStore = inject(CartStore);
  private readonly dbService = inject(SupabaseDbService);
  private readonly edgeService = inject(EdgeFunctionsService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly cartDetails = signal<CartProduct[]>([]);

  protected readonly cartItems = computed(() => this.cartStore.items());
  protected readonly total = computed(() => this.cartDetails().reduce((acc, item) => acc + item.subtotal, 0));

  constructor() {
    effect(() => {
      void this.loadCartDetails();
    });
  }

  private async loadCartDetails(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const cart = this.cartItems();
      if (cart.length === 0) {
        this.cartDetails.set([]);
        return;
      }

      const productIds = Array.from(new Set(cart.map((item) => item.producto_id)));
      const variantIds = Array.from(new Set(cart.filter((item) => item.variante_id).map((item) => item.variante_id as string)));

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
      this.error.set('No se pudo cargar el checkout. Intenta nuevamente.');
      this.cartDetails.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected async confirmOrder(): Promise<void> {
    if (this.cartItems().length === 0) {
      this.error.set('El carrito está vacío. Agrega productos antes de confirmar.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const response = await this.edgeService.createOrder(this.cartItems());
      const orderId = this.extractOrderId(response);

      if (response.error) {
        throw response.error;
      }

      this.success.set(
        `Orden${orderId ? ` ${orderId}` : ''} creada correctamente. Abriendo WhatsApp para continuar con el pedido.`
      );
      window.open(this.buildWhatsAppUrl(orderId), '_blank');
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo crear la orden. Intenta de nuevo.');
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

    lines.push('', 'Por favor, indíquenme los siguientes pasos para completar el pago y la entrega.');

    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/573134312139?text=${text}`;
  }
}
