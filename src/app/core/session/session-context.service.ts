import { computed, Injectable, signal } from '@angular/core';
import type { MeResponse } from '../models/me.model';

@Injectable({ providedIn: 'root' })
export class SessionContextService {
  private readonly user = signal<MeResponse | null>(null);

  readonly profile = this.user.asReadonly();

  readonly logoUrl = computed(() => this.user()?.empresa?.logoUrl?.trim() || null);

  readonly brandingTitle = computed(() => {
    const m = this.user();
    if (!m) {
      return '';
    }
    const e = m.empresa;
    if (e?.nombreComercial?.trim()) {
      return e.nombreComercial.trim();
    }
    if (e?.razonSocial?.trim()) {
      return e.razonSocial.trim();
    }
    if (m.empresaId == null) {
      return 'Plataforma';
    }
    return '';
  });

  readonly displayName = computed(() => {
    const name = this.user()?.nombre?.trim();
    if (name) {
      return name;
    }
    return this.user()?.email ?? 'Usuario';
  });

  setMe(value: MeResponse | null): void {
    if (!value) {
      this.user.set(null);
      return;
    }
    const current = this.user();
    this.user.set({
      ...value,
      avatarUrl: value.avatarUrl ?? current?.avatarUrl ?? null,
      enLinea: value.enLinea ?? current?.enLinea ?? null,
      ultimoPing: value.ultimoPing ?? current?.ultimoPing ?? null,
    });
  }

  clearMe(): void {
    this.user.set(null);
  }

  hasAnyAuthority(...codes: string[]): boolean {
    const set = new Set(this.user()?.permisos ?? []);
    return codes.some((c) => set.has(c));
  }

  /** Listado y gestión de API keys (alineado con backend `ApiKeyController`). */
  puedeApiKeys(): boolean {
    const f = this.user()?.features;
    if (f) {
      return f.puedeApiKeys;
    }
    return this.hasAnyAuthority('EMPRESA_ADMIN', 'PLATFORM_ADMIN');
  }

  /** Alta de usuarios en la propia empresa. */
  puedeGestionarUsuariosEmpresa(): boolean {
    const f = this.user()?.features;
    if (f) {
      return f.puedeGestionarUsuarios;
    }
    return this.hasAnyAuthority('EMPRESA_ADMIN');
  }

  puedeEmitirFacturas(): boolean {
    const f = this.user()?.features;
    if (f) {
      return f.puedeEmitir;
    }
    return this.hasAnyAuthority('FACTURA_EMITIR', 'EMPRESA_ADMIN', 'PLATFORM_ADMIN');
  }

  /** Configuración tributaria (`/api/web/v1/tributario/...`). */
  puedeConfiguracionTributaria(): boolean {
    const f = this.user()?.features;
    if (f) {
      return f.puedeAdministrarEmpresa;
    }
    return this.hasAnyAuthority('EMPRESA_ADMIN', 'PLATFORM_ADMIN');
  }

  puedeVerReportes(): boolean {
    return this.hasAnyAuthority('REPORTE_VER', 'EMPRESA_ADMIN', 'PLATFORM_ADMIN');
  }

  /** Listado / descarga de comprobantes (emisión o reportes). */
  puedeListarComprobantes(): boolean {
    return this.puedeEmitirFacturas() || this.puedeVerReportes() || this.puedeMonitorComprobantes();
  }

  puedeMonitorComprobantes(): boolean {
    return this.hasAnyAuthority('COMPROBANTE_MONITOR', 'EMPRESA_ADMIN', 'PLATFORM_ADMIN');
  }

  puedeGestionarProveedores(): boolean {
    return this.hasAnyAuthority('PROVEEDOR_GESTIONAR', 'EMPRESA_ADMIN', 'PLATFORM_ADMIN');
  }

  puedeGestionarVentas(): boolean {
    return this.hasAnyAuthority('VENTAS_GESTIONAR', 'FACTURA_EMITIR', 'EMPRESA_ADMIN', 'PLATFORM_ADMIN');
  }

  /** Abrir Cartera vía hub Suite (permiso SUITE_APP_CARTERA o plataforma). */
  puedeAbrirCarteraSuite(): boolean {
    const v = this.user()?.features?.puedeAbrirCarteraSuite;
    if (v === true || v === false) {
      return v;
    }
    return this.hasAnyAuthority('SUITE_APP_CARTERA', 'PLATFORM_ADMIN');
  }

  /** Abrir POS vía hub Suite (permiso SUITE_APP_POS o plataforma). */
  puedeAbrirPosSuite(): boolean {
    const v = this.user()?.features?.puedeAbrirPosSuite;
    if (v === true || v === false) {
      return v;
    }
    return this.hasAnyAuthority('SUITE_APP_POS', 'PLATFORM_ADMIN');
  }
}

