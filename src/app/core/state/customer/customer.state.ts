import { computed, effect } from '@angular/core';
import {
    signalStore,
    withState,
    withComputed,
    withMethods,
    patchState,
    withHooks
} from '@ngrx/signals';

// Asegúrate de importar tus tipos desde tu archivo de modelos
import { Perfil } from '@src/app/shared/models/interfaces/db/db';

type UserState = {
    perfil: Perfil;
};

const USER_STORAGE_KEY = 'user-profile';

// 🔥 Perfil por defecto con rol 'anonymous'
const DEFAULT_PROFILE: Perfil = {
    id: '',
    correo: '',
    created_at: null,
    datos_adicionales: {},
    deleted_at: null,
    documento: null,
    fecha_nacimiento: null,
    full_name: null,
    rol: 'anonymous', // Requerimiento aplicado
    telefono: null,
    tipo_documento: null,
    ubicacion: null,
    updated_at: null,
};

const getInitialState = (): UserState => {
    const storedProfile = localStorage.getItem(USER_STORAGE_KEY);
    return {
        perfil: storedProfile ? JSON.parse(storedProfile) : DEFAULT_PROFILE
    };
};

export const UserStore = signalStore(
    { providedIn: 'root' },

    withState(getInitialState()),

    // ==========================================
    // VALORES COMPUTADOS (SELECTORES)
    // ==========================================
    withComputed((store) => ({
        // Verifica si hay un usuario real logueado
        isAuthenticated: computed(() =>
            store.perfil().rol !== 'anonymous' && store.perfil().id !== ''
        ),

        // Selectores útiles para proteger rutas o mostrar/ocultar UI
        isAdmin: computed(() => store.perfil().rol === 'admin'),
        isCustomer: computed(() => store.perfil().rol === 'customer'),
        isAgent: computed(() => store.perfil().rol === 'agente'),

        // Obtener información rápida
        fullName: computed(() => store.perfil().full_name || 'Usuario'),
        currentRole: computed(() => store.perfil().rol)
    })),

    // ==========================================
    // MÉTODOS PARA MODIFICAR EL ESTADO
    // ==========================================
    withMethods((store) => ({

        // Se llama después de un login exitoso con Supabase Auth
        setPerfil(perfil: Perfil) {
            patchState(store, { perfil });
        },

        // Útil para cuando el usuario edita su cuenta (ej: cambia su teléfono)
        updatePerfil(updates: Partial<Perfil>) {
            patchState(store, (state) => ({
                perfil: { ...state.perfil, ...updates }
            }));
        },

        // Se llama al hacer logout para limpiar el estado y volver a 'anonymous'
        clearPerfil() {
            patchState(store, { perfil: DEFAULT_PROFILE });
        }
    })),

    // ==========================================
    // CICLO DE VIDA (PERSISTENCIA)
    // ==========================================
    withHooks({
        onInit(store) {
            // Sincroniza automáticamente cualquier cambio del perfil con el LocalStorage
            effect(() => {
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(store.perfil()));
            });
        }
    })
);