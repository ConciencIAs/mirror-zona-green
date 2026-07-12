import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CartStore } from '@src/app/core/state/card/card.state';

//primeng
import { ButtonModule } from 'primeng/button';
import { Producto } from '@src/app/shared/models/interfaces/db/db';
import { ToastService } from '@src/app/core/services/ui/toast.service';

@Component({
  selector: 'app-cart-button',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="flex items-center justify-center">
      @if (displayQuantity() === 0) {
        <p-button
          (click)="updateQuantity(1)"
          rounded="true"
          icon="pi pi-shopping-cart"
          styleClass="bg-primary"
          label="Reservar"
          size="small"
        />
      } @else {
        <div class="flex items-center bg-white border-2 border-[#6B8E23] rounded-full shadow-sm overflow-hidden w-32 p-2">
          <p-button
            (click)="updateQuantity(-1)"
            rounded="true"
            icon="pi pi-minus"
            size="small"
          >
          </p-button>

          <span class="flex-1 text-center font-bold text-slate-800 select-none">
            {{ displayQuantity() }}
          </span>

          <p-button
            (click)="updateQuantity(1)"
            rounded="true"
            icon="pi pi-plus"
            size="small"
            [disabled]="!canIncrease()"
          >
          </p-button>
        </div>
      }
    </div>
  `
})
export class CartButtonComponent implements OnInit, OnDestroy {
  // 1. Inyectamos el Store
  cartStore = inject(CartStore);
  toastService = inject(ToastService);

  // 2. Entradas del componente
  product = input.required<Producto>();
  paquete_gramos = input<number | null | undefined>(undefined);

  // 3. Selectores computados desde el Store
  cartItem = computed(() =>
    this.paquete_gramos() !== null && this.paquete_gramos() !== undefined ?
      this.cartStore.items().find(
        i => i.producto_id === this.product().id && i.paquete_gramos === this.paquete_gramos()
      ) : this.cartStore.items().find(
        i => i.producto_id === this.product().id
      )
  );
  storeQuantity = computed(() => this.cartItem()?.cantidad || 0);

  // 4. Estado local para "Actualización Optimista" (La UI cambia al instante sin esperar la BD)
  localQuantity = signal<number | null>(null);

  displayQuantity = computed(() => {
    const lq = this.localQuantity();
    return lq !== null ? lq : this.storeQuantity();
  });

  getMaxTotalQuantity(): number {
    const p = this.product();
    const pGramos = this.paquete_gramos();
    const reservado = p.reservado ?? 0;
    
    const cartItem = this.cartItem();
    const existingQty = cartItem ? cartItem.cantidad : 0;

    if (p.es_por_gramos && pGramos != null) {
      const pres = p.presentaciones?.find(x => x.gramos === pGramos);
      const presStock = pres ? pres.stock : 0;
      
      const remainingPresStock = Math.max(0, presStock - existingQty);
      const availableGrams = Math.max(0, p.stock_total - reservado);
      const maxBagsFromGrams = Math.floor(availableGrams / pGramos);
      
      return existingQty + Math.min(remainingPresStock, maxBagsFromGrams);
    } else {
      return existingQty + Math.max(0, p.stock_total - reservado);
    }
  }

  canIncrease = computed(() => {
    const q = this.displayQuantity();
    return q < this.getMaxTotalQuantity();
  });

  // 5. Configuración de RxJS para el Debounce
  private quantitySubject = new Subject<number>();
  private sub?: Subscription;

  ngOnInit() {
    // Espera 500ms desde el último clic antes de sincronizar con el store/BD
    this.sub = this.quantitySubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(targetQty => {
      this.syncWithStore(targetQty);
      // Una vez sincronizado, soltamos el control local para que mande el Store
      this.localQuantity.set(null);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // --- LÓGICA DE INTERACCIÓN ---

  updateQuantity(delta: number) {
    const current = this.displayQuantity();
    const newQty = Math.max(0, current + delta); // Evita números negativos

    if (delta > 0) {
      const available = this.getMaxTotalQuantity();
      if (newQty > available) {
        this.toastService.error(`No hay suficiente stock. Máximo permitido: ${available}`);
        return;
      }
    }

    // 1. Cambiamos el número en pantalla instantáneamente
    this.localQuantity.set(newQty);

    // 2. Avisamos al debouncer que el usuario hizo clic
    this.quantitySubject.next(newQty);
  }

  private syncWithStore(targetQty: number) {
    const currentStoreQty = this.storeQuantity();
    const item = this.cartItem();

    if (targetQty === currentStoreQty) return;

    const diff = targetQty - currentStoreQty;

    if (targetQty === 0 && item?.id) {
      // ⚠️ Recuerda agregar la eliminación en Supabase dentro de este método en tu Store
      this.cartStore.removeItem(item);
    } else if (diff !== 0) {
      // Utilizamos addItem para forzar la ejecución de tu función persistCartItem()
      // Si el usuario bajó de 5 a 2, diff será -3, y el Store lo restará exitosamente.
      this.cartStore.addItem({
        producto_id: this.product().id,
        paquete_gramos: this.paquete_gramos(),
        cantidad: diff,
        usuario_id: '' // Tu store ya lo reemplaza por el usuario real
      });
    }
  }
}