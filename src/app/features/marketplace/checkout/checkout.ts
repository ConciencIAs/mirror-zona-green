import { Component, computed, effect, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { EdgeFunctionsService } from '@src/app/core/services/edge-functions.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Producto } from '@src/app/shared/models/interfaces/db/db';
import { MonedaPipe } from '@src/app/shared/pipes/moneda.pipe';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, MonedaPipe, ButtonModule],
  templateUrl: './checkout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkout implements OnInit {
  private readonly cartStore = inject(CartStore);
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly edgeService = inject(EdgeFunctionsService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly cartDetails = signal<any[]>([]);

  protected checkoutForm!: FormGroup;

  protected readonly cartItems = computed(() => this.cartStore.items());
  protected readonly total = computed(() =>
    this.cartDetails().reduce((acc, item) => acc + item.subtotal, 0)
  );

  constructor() {
    this.initForm();
    effect(() => {
      void this.loadCheckoutDetails();
    });
  }

  ngOnInit(): void {
    if (this.cartItems().length === 0) {
      this.toastService.error('El carrito está vacío.');
      this.router.navigate(['/marketplace/carrito']);
    }
  }

  private initForm(): void {
    this.checkoutForm = this.fb.group({
      tipoEntrega: ['', Validators.required],
      comentarios: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  private async loadCheckoutDetails(): Promise<void> {
    this.loading.set(true);
    try {
      const cart = this.cartItems();
      if (cart.length === 0) return;

      const productIds = Array.from(new Set(cart.map((item) => item.producto_id)));
      const { data, error } = await this.dbService.from(TableName.PRODUCTOS).select('*').in('id', productIds);
      if (error) throw error;

      const products = (data as Producto[]) || [];
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
      this.toastService.error('Error al cargar detalles.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async confirmOrder(): Promise<void> {
    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      this.toastService.error('Por favor, completa los campos requeridos correctamente.');
      return;
    }

    if (this.cartItems().length === 0) return;

    this.submitting.set(true);

    try {
      const formValues = this.checkoutForm.value;

      // Asegúrate de que tu edgeService reciba este payload con los campos extra
      const payload = {
        tipo_entrega: formValues.tipoEntrega,
        comentarios: formValues.comentarios
      };

      const response = await this.edgeService.createOrder(this.cartItems(), payload);
      const orderId = this.extractOrderId(response);

      if (response.error) throw response.error;

      this.toastService.success(`Orden creada. Redirigiendo a WhatsApp...`);
      window.open(this.buildWhatsAppUrl(orderId, formValues), '_blank');

      // Opcional: Redirigir a una página de "Gracias" después de abrir WhatsApp
      this.router.navigate(['/customer/orders']);

    } catch (error) {
      console.error(error);
      this.toastService.error('No se pudo crear la orden. Intenta de nuevo.', String(error));
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
    return data?.ordenId || data?.orderId || data?.id || '';
  }

  private buildWhatsAppUrl(orderId: string, formValues: any): string {
    const lines = [
      'Hola Zona Green, acabo de realizar un pedido:',
      '',
      '*Detalles de la compra:*',
      ...this.cartDetails().map((item) => {
        const name = item.producto?.nombre || 'Producto';
        const formato = item.producto?.es_por_gramos ? ` (${item.cartLine.paquete_gramos}g)` : '';
        return `- ${item.cartLine.cantidad}x ${name}${formato}: ${this.formatPrice(item.subtotal)}`;
      }),
      '',
      `*Total:* ${this.formatPrice(this.total())}`,
      '',
      `*Tipo de Entrega:* ${formValues.tipoEntrega}`,
      `*Comentarios:* ${formValues.comentarios}`,
      '',
      orderId ? `*Número de Orden:* ${orderId}` : '',
      'Quedo atento(a) para coordinar el aporte y la entrega. ¡Gracias!'
    ];

    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/573134312139?text=${text}`;
  }
}