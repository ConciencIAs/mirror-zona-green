import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, signal } from '@angular/core';

const DARK_MODE_STORAGE_KEY = 'zg-dark';

@Injectable({ providedIn: 'root' })
export class DarkModeState {
  private readonly darkModeState = signal(false);
  readonly isDark = this.darkModeState.asReadonly();

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    let isDark = false;
    try {
      isDark = this.document.defaultView?.localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true';
    } catch {
      isDark = false;
    }

    this.darkModeState.set(isDark);
    this.applyToDocument(isDark);
  }

  toggle(): void {
    this.setDark(!this.isDark());
  }

  private setDark(isDark: boolean): void {
    this.darkModeState.set(isDark);
    this.applyToDocument(isDark);

    try {
      this.document.defaultView?.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDark));
    } catch {
      // The theme still works when browser storage is unavailable.
    }
  }

  private applyToDocument(isDark: boolean): void {
    this.document.documentElement.classList.toggle('dark', isDark);
    this.document.documentElement.classList.toggle('p-dark', isDark);
  }
}