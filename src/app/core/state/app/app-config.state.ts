import { inject, computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState, withHooks } from '@ngrx/signals';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';
import {
  NavbarConfig,
  FooterConfig,
  SettingsConfig,
  AdvertisingBannerConfig,
  AppConfig,
  DEFAULT_APP_CONFIG
} from '@src/app/shared/models/interfaces/page-config.interface';

export interface AppConfigState {
  navbar: NavbarConfig | null;
  navbarLoading: boolean;
  navbarExpiresAt: number;

  footer: FooterConfig | null;
  footerLoading: boolean;
  footerExpiresAt: number;

  settings: SettingsConfig | null;
  settingsLoading: boolean;
  settingsExpiresAt: number;

  advertising: AdvertisingBannerConfig | null;
  advertisingLoading: boolean;
  advertisingExpiresAt: number;
}

const TTL_HOURS = 2;
const PREFIX = 'app_config_';

// Helper para leer el caché de sessionStorage al instanciar el Store
function getCache<T>(key: string): { data: T | null; expiresAt: number } {
  if (typeof window === 'undefined' || !window.sessionStorage) return { data: null, expiresAt: 0 };
  const cached = sessionStorage.getItem(`${PREFIX}${key}`);
  if (!cached) return { data: null, expiresAt: 0 };
  try {
    const cache = JSON.parse(cached);
    if (Date.now() > cache.expiresAt) {
      sessionStorage.removeItem(`${PREFIX}${key}`);
      return { data: null, expiresAt: 0 };
    }
    return { data: cache.data, expiresAt: cache.expiresAt };
  } catch {
    return { data: null, expiresAt: 0 };
  }
}

const initialState: AppConfigState = {
  navbar: getCache<NavbarConfig>('navbar').data,
  navbarLoading: false,
  navbarExpiresAt: getCache<NavbarConfig>('navbar').expiresAt,

  footer: getCache<FooterConfig>('footer').data,
  footerLoading: false,
  footerExpiresAt: getCache<FooterConfig>('footer').expiresAt,

  settings: getCache<SettingsConfig>('settings').data,
  settingsLoading: false,
  settingsExpiresAt: getCache<SettingsConfig>('settings').expiresAt,

  advertising: getCache<AdvertisingBannerConfig>('advertising_banner').data,
  advertisingLoading: false,
  advertisingExpiresAt: getCache<AdvertisingBannerConfig>('advertising_banner').expiresAt,
};

export const AppConfigStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // 🚀 SEÑALES COMPUTADAS (Selectores reactivos con Fallbacks seguros)
  withComputed((store) => ({
    navbarConfig: computed(() => store.navbar() || DEFAULT_APP_CONFIG.navbar),
    footerConfig: computed(() => store.footer() || DEFAULT_APP_CONFIG.footer),
    settingsConfig: computed(() => store.settings() || {
      nombre: DEFAULT_APP_CONFIG.nombre,
      logo_url: DEFAULT_APP_CONFIG.logo_url,
      telefono: DEFAULT_APP_CONFIG.telefono
    }),
    advertisingConfig: computed(() => store.advertising() || { items: DEFAULT_APP_CONFIG.advertising_banner }),

  })),

  // 🚀 MÉTODOS DE CARGA (Libres de lógica de guardado/mutación)
  withMethods((store, dbService = inject(PageConfigDbService)) => {
    
    const saveCache = (key: string, data: any) => {
      const expiresAt = Date.now() + TTL_HOURS * 60 * 60 * 1000;
      sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ data, expiresAt }));
      return expiresAt;
    };

    return {
      async ensureNavbar(force = false): Promise<void> {
        if (store.navbar() && Date.now() <= store.navbarExpiresAt() && !force) return;
        patchState(store, { navbarLoading: true });
        try {
          const res = await dbService.getConfigByName('navbar');
          const data = res.data?.content || DEFAULT_APP_CONFIG.navbar;
          const expiresAt = saveCache('navbar', data);
          patchState(store, { navbar: data, navbarExpiresAt: expiresAt, navbarLoading: false });
        } catch { patchState(store, { navbarLoading: false }); }
      },

      async ensureFooter(force = false): Promise<void> {
        if (store.footer() && Date.now() <= store.footerExpiresAt() && !force) return;
        patchState(store, { footerLoading: true });
        try {
          const res = await dbService.getConfigByName('footer');
          const data = res.data?.content || DEFAULT_APP_CONFIG.footer;
          const expiresAt = saveCache('footer', data);
          patchState(store, { footer: data, footerExpiresAt: expiresAt, footerLoading: false });
        } catch { patchState(store, { footerLoading: false }); }
      },

      async ensureSettings(force = false): Promise<void> {
        if (store.settings() && Date.now() <= store.settingsExpiresAt() && !force) return;
        patchState(store, { settingsLoading: true });
        try {
          const res = await dbService.getConfigByName('settings');
          const data = res.data?.content || {
            nombre: DEFAULT_APP_CONFIG.nombre,
            logo_url: DEFAULT_APP_CONFIG.logo_url,
            telefono: DEFAULT_APP_CONFIG.telefono
          };
          const expiresAt = saveCache('settings', data);
          patchState(store, { settings: data, settingsExpiresAt: expiresAt, settingsLoading: false });
        } catch { patchState(store, { settingsLoading: false }); }
      },

      async ensureAdvertising(force = false): Promise<void> {
        if (store.advertising() && Date.now() <= store.advertisingExpiresAt() && !force) return;
        patchState(store, { advertisingLoading: true });
        try {
          const res = await dbService.getConfigByName('advertising_banner');
          const data = res.data?.content || { items: DEFAULT_APP_CONFIG.advertising_banner };
          const expiresAt = saveCache('advertising_banner', data);
          patchState(store, { advertising: data, advertisingExpiresAt: expiresAt, advertisingLoading: false });
        } catch { patchState(store, { advertisingLoading: false }); }
      },

      /**
       * Permite forzar la recarga de todas las configuraciones al tiempo en segundo plano
       */
      refreshAll(): void {
        this.ensureNavbar(true);
        this.ensureFooter(true);
        this.ensureSettings(true);
        this.ensureAdvertising(true);
      }
    };
  }),

  // 🚀 DISPARO AUTOMÁTICO AL INICIALIZAR LA APLICACIÓN
  withHooks({
    onInit(store) {
      store.ensureNavbar();
      store.ensureFooter();
      store.ensureSettings();
      store.ensureAdvertising();
    }
  })
);