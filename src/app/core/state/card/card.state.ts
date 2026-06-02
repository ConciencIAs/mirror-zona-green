import { computed, effect, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  withHooks
} from '@ngrx/signals';

import { Carrito } from '@src/app/core/models/interfaces/db/db';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/core/models/constans/db/tableName.enum';

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
    totalItems: computed(() =>
      store.items().reduce((acc, item) => acc + item.cantidad, 0)
    ),

    // ⚠️ totalPrice fue removido. Deberás calcular el precio total cruzando 
    // producto_id/variante_id con tu store o servicio de Productos.

    isEmpty: computed(() => store.items().length === 0)
  })),

  withMethods((store) => {
    const supabaseDbService = inject(SupabaseDbService);
    const supabaseAuthService = inject(SupabaseAuthService);
    const toastService = inject(ToastService);

    const persistCartItem = async (item: Carrito) => {
      try {
        const user = await supabaseAuthService.getUser();

        if (!user?.id) {
          toastService.warn('Inicia sesión para guardar el carrito en la base de datos.');
          return;
        }

        const payload = {
          cantidad: item.cantidad,
          es_gramos: item.es_gramos,
          producto_id: item.producto_id,
          usuario_id: user.id,
          variante_id: item.variante_id
        };

        const updateResult = await supabaseDbService
          .from(TableName.CARRITO)
          .update({ cantidad: item.cantidad, es_gramos: item.es_gramos })
          .match({
            usuario_id: user.id,
            producto_id: item.producto_id,
            variante_id: item.variante_id
          }).select('cantidad').single();

        const updateData = updateResult.data as unknown;
        if (!updateResult.error && Array.isArray(updateData) && updateData.length > 0) {
          toastService.success('Cantidad actualizada en Supabase correctamente.');
          return;
        }

        const { error } = await supabaseDbService.insert(TableName.CARRITO, payload);
        if (error) {
          throw error;
        }

        toastService.success('Producto guardado en Supabase correctamente.');
      } catch (error) {
        console.error(error);
        toastService.error('No se pudo guardar el carrito en la base de datos. Intenta de nuevo.');
      }
    };

    return {
      // Recibimos los datos básicos para agregar un producto al carrito.
      // El ID puede ser opcional al agregar, por si el frontend genera uno temporal 
      // antes de guardarlo definitivamente en Supabase.
      // La cantidad es opcional y por defecto es 1.
      addItem(nuevoItem: Omit<Carrito, 'id'> & { id?: string; cantidad?: number }) {
        let updatedItem: Carrito | null = null;

        patchState(store, (state) => {
          const existing = state.items.find(
            i => i.producto_id === nuevoItem.producto_id && i.variante_id === nuevoItem.variante_id
          );

          const initialQuantity = nuevoItem.cantidad ?? 1;

          if (existing) {
            updatedItem = { ...existing, cantidad: existing.cantidad + initialQuantity };

            return {
              items: state.items.map(item =>
                item.id === existing.id
                  ? updatedItem!
                  : item
              )
            };
          }

          updatedItem = {
            ...nuevoItem,
            id: nuevoItem.id || crypto.randomUUID(), // Genera un ID temporal si no se provee
            cantidad: initialQuantity
          } as Carrito;

          return {
            items: [
              ...state.items,
              updatedItem
            ]
          };
        });

        if (updatedItem) {
          persistCartItem(updatedItem);
        }
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
    };
  }),

  withHooks({
    onInit(store) {
      effect(() => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store.items()));
      });
    }
  })
);
