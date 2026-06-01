import { Injectable, signal } from '@angular/core';

export type LuxTheme = 'light' | 'dark';

const STORAGE_KEY = 'lux_ui_theme';
const LEGACY_POS_KEY = 'pos_ui_theme';

@Injectable({ providedIn: 'root' })
export class LuxThemeService {
  readonly theme = signal<LuxTheme>('dark');

  constructor() {
    this.hydrateFromStorage();
    this.apply();
  }

  private hydrateFromStorage(): void {
    let stored = localStorage.getItem(STORAGE_KEY) as LuxTheme | null;
    if (stored !== 'light' && stored !== 'dark') {
      const legacy = localStorage.getItem(LEGACY_POS_KEY) as LuxTheme | null;
      if (legacy === 'light' || legacy === 'dark') {
        stored = legacy;
      }
    }
    if (stored === 'light' || stored === 'dark') {
      this.theme.set(stored);
    }
  }

  setTheme(value: LuxTheme): void {
    this.theme.set(value);
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(LEGACY_POS_KEY, value);
    this.apply();
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  apply(): void {
    const root = document.documentElement;
    const theme = this.theme();
    root.setAttribute('data-lux-theme', theme);
    root.setAttribute('data-bs-theme', theme);
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }
}
