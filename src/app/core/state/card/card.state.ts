import { computed, effect } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  withHooks
} from '@ngrx/signals';

export interface Carrito {
  id: string;
  cantidad: number;
  es_gramos: boolean;
  producto_id: string;
  usuario_id: string;
  variante_id: string | null;
}

type CartState = {
  items: Carrito[];
};

const CART_STORAGE_KEY = 'cart-items';

const getInitialState = (): CartState => {
  const storedCart = localStorage.getItem(CART_STORAGE_KEY);
  return {
    items: storedCart ? JSON.parse(storedCart) : []
  };
};

export const CartStore = signalStore(
  { providedIn: 'root' },

  withState(getInitialState()),

  withComputed((store) => ({
    // 🔥 Total de items sumando la propiedad 'cantidad'
    totalItems: computed(() =>
      store.items().reduce((acc, item) => acc + item.cantidad, 0)
    ),

    // ⚠️ totalPrice fue removido. Deberás calcular el precio total cruzando 
    // producto_id/variante_id con tu store o servicio de Productos.

    isEmpty: computed(() => store.items().length === 0)
  })),

  withMethods((store) => ({
    // Recibimos los datos básicos para agregar un producto al carrito.
    // El ID puede ser opcional al agregar, por si el frontend genera uno temporal 
    // antes de guardarlo definitivamente en Supabase.
    addItem(nuevoItem: Omit<Carrito, 'id' | 'cantidad'> & { id?: string }) {

      patchState(store, (state) => {
        // Buscamos si ya existe el mismo producto (y misma variante) en el carrito
        const existing = state.items.find(
          i => i.producto_id === nuevoItem.producto_id && i.variante_id === nuevoItem.variante_id
        );

        if (existing) {
          return {
            items: state.items.map(item =>
              item.id === existing.id
                ? { ...item, cantidad: item.cantidad + 1 }
                : item
            )
          };
        }

        // Si es nuevo, lo agregamos iniciando con cantidad 1
        return {
          items: [
            ...state.items,
            {
              ...nuevoItem,
              id: nuevoItem.id || crypto.randomUUID(), // Genera un ID temporal si no se provee
              cantidad: 1
            }
          ]
        };
      });
    },

    removeItem(id: string) {
      patchState(store, (state) => ({
        items: state.items.filter(i => i.id !== id)
      }));
    },

    increaseQuantity(id: string) {
      patchState(store, (state) => ({
        items: state.items.map(item =>
          item.id === id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }));
    },

    decreaseQuantity(id: string) {
      patchState(store, (state) => ({
        items: state.items
          .map(item =>
            item.id === id
              ? { ...item, cantidad: item.cantidad - 1 }
              : item
          )
          .filter(item => item.cantidad > 0) // Si llega a 0, se elimina del arreglo
      }));
    },

    clearCart() {
      patchState(store, { items: [] });
    }
  })),

  withHooks({
    onInit(store) {
      effect(() => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store.items()));
      });
    }
  })
);