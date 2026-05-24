import {
  Injectable,
  computed,
  inject
} from '@angular/core';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

import { LocalStorageStateService }
  from './local-storage-state.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private storage = inject(LocalStorageStateService);

  // 🔥 signal persistente
  items = this.storage.createStateSignal<CartItem[]>(
    'cart-items',
    []
  );

  // 🔥 total items
  totalItems = computed(() =>
    this.items().reduce(
      (acc, item) => acc + item.quantity,
      0
    )
  );

  // 🔥 total precio
  totalPrice = computed(() =>
    this.items().reduce(
      (acc, item) =>
        acc + (item.price * item.quantity),
      0
    )
  );

  // 🔥 carrito vacío
  isEmpty = computed(() =>
    this.items().length === 0
  );

  addItem(
    product: Omit<CartItem, 'quantity'>
  ) {

    this.items.update(items => {

      const existing =
        items.find(i => i.id === product.id);

      if (existing) {

        return items.map(item =>
          item.id === product.id
            ? {
              ...item,
              quantity: item.quantity + 1
            }
            : item
        );

      }

      return [
        ...items,
        {
          ...product,
          quantity: 1
        }
      ];

    });

  }

  removeItem(id: string) {

    this.items.update(items =>
      items.filter(i => i.id !== id)
    );

  }

  increaseQuantity(id: string) {

    this.items.update(items =>
      items.map(item =>
        item.id === id
          ? {
            ...item,
            quantity: item.quantity + 1
          }
          : item
      )
    );

  }

  decreaseQuantity(id: string) {

    this.items.update(items =>
      items
        .map(item =>
          item.id === id
            ? {
              ...item,
              quantity: item.quantity - 1
            }
            : item
        )
        .filter(item => item.quantity > 0)
    );

  }

  clearCart() {

    this.items.set([]);

  }

}