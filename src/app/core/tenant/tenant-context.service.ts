import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'efactura_tenant_slug';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly _slug = signal<string>(this.readStoredOrDefault());

  /** Slug del tenant activo (p. ej. `acme`, `default`). */
  readonly tenantSlug = this._slug.asReadonly();

  /** Nombre legible derivado del slug hasta tener branding por API. */
  readonly displayName = computed(() => this.slugToDisplay(this._slug()));

  setSlug(slug: string): void {
    const normalized = (slug || 'default').trim().toLowerCase() || 'default';
    this._slug.set(normalized);
    sessionStorage.setItem(STORAGE_KEY, normalized);
  }

  private readStoredOrDefault(): string {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s && s.trim()) {
        return s.trim().toLowerCase();
      }
    } catch {
      /* sessionStorage no disponible */
    }
    return 'default';
  }

  private slugToDisplay(slug: string): string {
    return slug
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
