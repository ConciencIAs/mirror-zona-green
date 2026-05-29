import {
  Injectable,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class LocalStorageStateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor() { }

  getState<T>(key: string, defaultValue: T): T {
    if (!this.isBrowser) return defaultValue;

    const stored = localStorage.getItem(key);
    return this.parse(stored, defaultValue);
  }

  setState<T>(key: string, value: T): void {
    if (!this.isBrowser) return;
    localStorage.setItem(key, JSON.stringify(value));
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
  }

  clear(): void {
    if (!this.isBrowser) return;

    localStorage.clear();
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
