import {
  Injectable,
  signal,
  WritableSignal,
  effect,
  inject,
  PLATFORM_ID,
  Injector,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { fromEvent } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface SignalRegistry {
  sig: WritableSignal<any>;
  defaultValue: any;
}

@Injectable({ providedIn: 'root' })
export class LocalStorageStateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Registramos el Signal junto con su valor por defecto para sincronización entre pestañas
  private readonly signals = new Map<string, SignalRegistry>();

  constructor() {
    this.listenToCrossTabChanges();
  }

  getState<T>(key: string, defaultValue: T): T {
    if (!this.isBrowser) return defaultValue;

    const stored = localStorage.getItem(key);
    return this.parse(stored, defaultValue);
  }

  setState<T>(key: string, value: T): void {
    if (!this.isBrowser) return;

    const existing = this.signals.get(key);
    if (existing) {
      // Si el Signal ya existe, lo actualizamos. Su propio 'effect' se encargará de escribir en localStorage
      existing.sig.set(value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  updateState<T>(key: string, updater: (current: T) => T, defaultValue: T): T {
    const current = this.getState(key, defaultValue);
    const next = updater(current);
    this.setState(key, next);
    return next;
  }

  removeState(key: string): void {
    if (!this.isBrowser) return;

    localStorage.removeItem(key);
    this.signals.delete(key);
  }

  clear(): void {
    if (!this.isBrowser) return;

    localStorage.clear();
    this.signals.clear();
  }

  createStateSignal<T>(key: string, defaultValue: T): WritableSignal<T> {
    const existing = this.signals.get(key);
    if (existing) {
      return existing.sig as WritableSignal<T>;
    }

    const initialValue = this.getState(key, defaultValue);
    const stateSignal = signal<T>(initialValue);

    // Guardamos la referencia en nuestro mapa interno
    this.signals.set(key, { sig: stateSignal, defaultValue });

    if (this.isBrowser) {
      effect(
        () => {
          const value = stateSignal();
          localStorage.setItem(key, JSON.stringify(value));
        },
        { injector: this.injector },
      );
    }

    return stateSignal;
  }

  /**
   * Escucha cambios en el localStorage provenientes de otras pestañas/ventanas
   * e inyecta los nuevos datos directamente a las Signals activas.
   */
  private listenToCrossTabChanges(): void {
    if (!this.isBrowser) return;

    // 1. Creamos el observable a partir del evento 'storage' de window
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(
        // 2. Regla de oro de rendimiento: Auto-desuscripción cuando el scope muera
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (event) => {
          // Si el evento no tiene llave asociada, ignoramos
          if (!event.key) return;

          const registry = this.signals.get(event.key);
          if (registry) {
            const rawValue = event.newValue;
            const nextValue =
              rawValue !== null
                ? this.parse(rawValue, registry.defaultValue)
                : registry.defaultValue;

            // Sincronizamos la Signal de forma reactiva
            registry.sig.set(nextValue);
          }
        },
      });
  }

  private parse<T>(value: string | null, defaultValue: T): T {
    if (!value || !JSON.parse(value)) return defaultValue;

    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
}
