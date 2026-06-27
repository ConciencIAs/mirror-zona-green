import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';

import { Carrito } from '@src/app/shared/models/interfaces/db/db';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';

type CartState = {
  items: Carrito[];
};

const getInitialState = (): CartState => {
  return {
    items: []
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
        const user = await supabaseAuthService.getSession().session?.user;
        if (!user?.id) return;

        // 1. Normalizamos a null para evitar choques con el índice de BD
        const pGramos = item.paquete_gramos ?? null;

        const payload = {
          usuario_id: user.id,
          producto_id: item.producto_id,
          paquete_gramos: pGramos,
          cantidad: item.cantidad
        };

        // 2. Usamos UPSERT: Crea si no existe, actualiza si ya existe
        const { data, error } = await supabaseDbService
          .from(TableName.CARRITO)
          .upsert(payload, { onConflict: 'usuario_id, producto_id, paquete_gramos' })
          .select('id') // Pedimos que nos devuelva el ID real generado
          .single();

        if (error) {
          toastService.error("error al sincronizar el item del carrito");
          return;
        }

        // 3. Parcheamos el store silenciosamente con el ID real de la BD
        // Esto previene errores de "trackBy" en el HTML
        if (data?.id && !item.id) {
          patchState(store, (state) => ({
            items: state.items.map(i =>
              i.producto_id === item.producto_id && i.paquete_gramos === item.paquete_gramos
                ? { ...i, id: data.id }
                : i
            )
          }));
        }

      } catch (error) {
        console.error('Error sincronizando item del carrito:', error);
        toastService.error('Error al sincronizar el carrito con la base de datos.');
      }
    };

    const removeCartItemDB = async (item: Carrito) => {
      try {
        const user = await supabaseAuthService.getSession().session?.user;
        if (!user?.id) return;

        const pGramos = item.paquete_gramos ?? null;

        const { error } = await supabaseDbService
          .from(TableName.CARRITO)
          .delete()
          .match({
            usuario_id: user.id,
            producto_id: item.producto_id,
            paquete_gramos: pGramos, // Match exacto con null si aplica
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error eliminando item de BD:', error);
      }
    };

    // --- MÉTODOS DEL STORE ---

    return {
      addItem(nuevoItem: Partial<Carrito>) {
        let updatedItem: Carrito | null = null;
        const pGramos = nuevoItem.paquete_gramos ?? null; // Normalizamos desde la entrada
        const initialQuantity = nuevoItem.cantidad ?? 1;

        patchState(store, (state) => {
          // Buscamos por LLAVE LÓGICA (producto + gramos), nunca por ID
          const existing = state.items.find(
            i => i.producto_id === nuevoItem.producto_id && (i.paquete_gramos ?? null) === pGramos
          );

          if (existing) {
            updatedItem = { ...existing, cantidad: existing.cantidad + initialQuantity };
            return {
              items: state.items.map(i =>
                i.producto_id === existing.producto_id && (i.paquete_gramos ?? null) === pGramos
                  ? updatedItem!
                  : i
              )
            };
          }

          updatedItem = {
            ...nuevoItem,
            paquete_gramos: pGramos,
            cantidad: initialQuantity
          } as Carrito;

          return { items: [...state.items, updatedItem] };
        });

        if (updatedItem) {
          persistCartItem(updatedItem);
          toastService.success('Producto agregado al carrito.');
        }
      },

      // ATENCIÓN: Cambiamos a recibir el item completo para no depender del ID
      removeItem(itemTarget: Carrito) {
        const pGramos = itemTarget.paquete_gramos ?? null;

        patchState(store, (state) => ({
          items: state.items.filter(i =>
            !(i.producto_id === itemTarget.producto_id && (i.paquete_gramos ?? null) === pGramos)
          )
        }));

        removeCartItemDB(itemTarget);
      },

      increaseQuantity(itemTarget: Carrito) {
        let updatedItem: Carrito | null = null;
        const pGramos = itemTarget.paquete_gramos ?? null;

        patchState(store, (state) => ({
          items: state.items.map(item => {
            if (item.producto_id === itemTarget.producto_id && (item.paquete_gramos ?? null) === pGramos) {
              updatedItem = { ...item, cantidad: item.cantidad + 1 };
              return updatedItem;
            }
            return item;
          })
        }));

        if (updatedItem) persistCartItem(updatedItem);
      },

      decreaseQuantity(itemTarget: Carrito) {
        let updatedItem: Carrito | null = null;
        let itemToRemove: Carrito | null = null;
        const pGramos = itemTarget.paquete_gramos ?? null;

        patchState(store, (state) => ({
          items: state.items.map(item => {
            if (item.producto_id === itemTarget.producto_id && (item.paquete_gramos ?? null) === pGramos) {
              if (item.cantidad > 1) {
                updatedItem = { ...item, cantidad: item.cantidad - 1 };
                return updatedItem;
              } else {
                itemToRemove = item;
                return null;
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
        const user = supabaseAuthService.getSession().session?.user;
        if (user?.id) {
          supabaseDbService.from(TableName.CARRITO).delete().match({ usuario_id: user.id });
        }
      },

      setCart(cartItems: Carrito[]) {
        // Asegurarnos de normalizar la BD que llega al front
        const normalizados = cartItems.map(i => ({ ...i, paquete_gramos: i.paquete_gramos ?? null }));
        patchState(store, { items: normalizados });
      }
    };
  })
);