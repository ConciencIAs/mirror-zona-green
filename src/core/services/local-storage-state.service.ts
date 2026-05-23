import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocalStorageStateService {
  private readonly signals = new Map<string, WritableSignal<unknown>>();

  getState<T>(key: string, defaultValue: T): T {
    const stored = localStorage.getItem(key);
    return this.parse(stored, defaultValue);
  }

  setState<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
    const existingSignal = this.signals.get(key);
    if (existingSignal) {
      (existingSignal as WritableSignal<T>).set(value);
    }
  }

  updateState<T>(key: string, updater: (current: T) => T, defaultValue: T): T {
    const current = this.getState(key, defaultValue);
    const next = updater(current);
    this.setState(key, next);
    return next;
  }

  removeState(key: string): void {
    localStorage.removeItem(key);
    this.signals.delete(key);
  }

  clear(): void {
    localStorage.clear();
    this.signals.clear();
  }

  createStateSignal<T>(key: string, defaultValue: T): WritableSignal<T> {
    const existing = this.signals.get(key) as WritableSignal<T> | undefined;
    if (existing) {
      return existing;
    }

    const initialValue = this.getState(key, defaultValue);
    const stateSignal = signal<T>(initialValue);
    // stateSignal.subscribe((value) => {
      // localStorage.setItem(key, JSON.stringify(value));
    // });

    this.signals.set(key, stateSignal as WritableSignal<unknown>);
    return stateSignal;
  }

  private parse<T>(value: string | null, defaultValue: T): T {
    if (value === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
}
