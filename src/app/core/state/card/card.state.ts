import { computed, effect, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  withHooks
} from '@ngrx/signals';

import { Carrito } from '@src/app/shared/models/interfaces/db/db';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';

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
    isEmpty: computed(() => store.items().length === 0)
  })),

  withMethods((store) => {
    const supabaseDbService = inject(SupabaseDbService);
    const supabaseAuthService = inject(SupabaseAuthService);
    const toastService = inject(ToastService);

    // --- FUNCIONES AUXILIARES DE BASE DE DATOS ---

    const persistCartItem = async (item: Carrito) => {
      try {
        const user = await supabaseAuthService.getUser();
        if (!user?.id) return; // Si no hay usuario, el estado local ya hizo su trabajo

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
          })
          .select('cantidad')
          .maybeSingle();

        const updateData = updateResult.data as unknown;

        // Si actualizó correctamente, terminamos.
        if (!updateResult.error && Array.isArray(updateData) && updateData.length > 0) {
          return;
        }

        // Si no existía, lo insertamos.
        const { error } = await supabaseDbService.insert(TableName.CARRITO, payload);
        if (error) throw error;

      } catch (error) {
        console.error('Error sincronizando item del carrito:', error);
        toastService.error('Error al sincronizar el carrito con la base de datos.');
      }
    };

    const removeCartItemDB = async (item: Carrito) => {
      try {
        const user = await supabaseAuthService.getUser();
        if (!user?.id) return;

        const { error } = await supabaseDbService
          .from(TableName.CARRITO)
          .delete()
          .match({
            usuario_id: user.id,
            producto_id: item.producto_id,
            variante_id: item.variante_id
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error eliminando item de BD:', error);
      }
    };

    const clearCartDB = async () => {
      try {
        const user = await supabaseAuthService.getUser();
        if (!user?.id) return;

        const { error } = await supabaseDbService
          .from(TableName.CARRITO)
          .delete()
          .match({ usuario_id: user.id });

        if (error) throw error;
      } catch (error) {
        console.error('Error limpiando carrito en BD:', error);
      }
    };

    // --- MÉTODOS DEL STORE ---

    return {
      addItem(nuevoItem: Omit<Carrito, 'id'> & { id?: string; cantidad?: number }) {
        let updatedItem: Carrito | null = null;

        patchState(store, (state) => {
          const existing = state.items.find(
            i => i.producto_id === nuevoItem.producto_id && i.variante_id === nuevoItem.variante_id
          );

          const initialQuantity = nuevoItem.cantidad ?? 1;

          if (existing) {
            updatedItem = { ...existing, cantidad: existing.cantidad + initialQuantity };
            return { items: state.items.map(item => item.id === existing.id ? updatedItem! : item) };
          }

          updatedItem = {
            ...nuevoItem,
            id: nuevoItem.id || crypto.randomUUID(),
            cantidad: initialQuantity
          } as Carrito;

          return { items: [...state.items, updatedItem] };
        });

        if (updatedItem) {
          persistCartItem(updatedItem);
          toastService.success('Producto agregado al carrito.');
        }
      },

      removeItem(id: string) {
        const itemToDelete = store.items().find(i => i.id === id);

        patchState(store, (state) => ({
          items: state.items.filter(i => i.id !== id)
        }));

        if (itemToDelete) {
          removeCartItemDB(itemToDelete);
        }
      },

      increaseQuantity(id: string) {
        let updatedItem: Carrito | null = null;

        patchState(store, (state) => ({
          items: state.items.map(item => {
            if (item.id === id) {
              updatedItem = { ...item, cantidad: item.cantidad + 1 };
              return updatedItem;
            }
            return item;
          })
        }));

        if (updatedItem) {
          persistCartItem(updatedItem);
        }
      },

      decreaseQuantity(id: string) {
        let updatedItem: Carrito | null = null;
        let itemToRemove: Carrito | null = null;

        patchState(store, (state) => ({
          items: state.items.map(item => {
            if (item.id === id) {
              if (item.cantidad > 1) {
                updatedItem = { ...item, cantidad: item.cantidad - 1 };
                return updatedItem;
              } else {
                itemToRemove = item;
                return null; // Marcado para eliminar
              }
            }
            return item;
          }).filter(item => item !== null) as Carrito[]
        }));

        if (updatedItem) {
          persistCartItem(updatedItem);
        } else if (itemToRemove) {
          removeCartItemDB(itemToRemove);
        }
      },

      clearCart() {
        patchState(store, { items: [] });
        clearCartDB();
      },

      setCart(cartItems: Carrito[]) {
        patchState(store, { items: cartItems });
      }
    };
  }),

  withHooks({
    onInit(store) {
      effect(() => {
        // Mantiene localStorage sincronizado con cualquier cambio del estado en tiempo real
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store.items()));
      });
    }
  })
);