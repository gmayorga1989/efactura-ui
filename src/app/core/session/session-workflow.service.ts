import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  clearWebTokens,
  readAccessToken,
  readRefreshToken,
  writeAccessToken,
  writeRefreshToken,
} from '../auth.interceptor.tokens';
import type { MenuItemDto } from '../models/menu.model';
import type { MeResponse, MiEmpresaResumenDto, TokenResponse } from '../models/me.model';
import { SessionContextService } from './session-context.service';
import { syncTenantRouteIfNeeded } from './sync-tenant-route.util';
import { tenantSlugFromMe } from './tenant-slug.util';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Operaciones de sesión que encadenan varias llamadas API (p. ej. cambio de empresa).
 */
@Injectable({ providedIn: 'root' })
export class SessionWorkflowService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionContextService);
  private readonly tenant = inject(TenantContextService);
  private readonly router = inject(Router);

  /** Lista membresías visibles para el selector de empresa. */
  misEmpresas(): Observable<MiEmpresaResumenDto[]> {
    return this.http.get<MiEmpresaResumenDto[]>('/api/web/v1/mis-empresas');
  }

  /** Ítems de menú filtrados por permisos del JWT (backend). */
  menu(): Observable<MenuItemDto[]> {
    return this.http.get<MenuItemDto[]>('/api/web/v1/menu');
  }

  /**
   * Cierra sesión en servidor (`POST /auth/logout` con refresh si existe) y borra tokens locales.
   */
  logoutServer(): Observable<void> {
    if (!readAccessToken()) {
      clearWebTokens();
      return of(undefined);
    }
    const refresh = readRefreshToken();
    return this.http.post<void>('/api/web/v1/auth/logout', { refreshToken: refresh ?? null }).pipe(
      catchError(() => of(undefined)),
      finalize(() => clearWebTokens()),
      map(() => undefined),
    );
  }

  /**
   * `POST /auth/switch-empresa`: nuevos tokens + recarga `/me` y sincroniza ruta tenant.
   * @param empresaId `null` = contexto plataforma.
   */
  switchEmpresa(empresaId: string | null): Observable<MeResponse> {
    return this.http.post<TokenResponse>('/api/web/v1/auth/switch-empresa', { empresaId }).pipe(
      tap((t) => {
        writeAccessToken(t.accessToken);
        writeRefreshToken(t.refreshToken);
      }),
      switchMap(() => this.http.get<MeResponse>('/api/web/v1/me')),
      tap((me) => {
        this.session.setMe(me);
        const slug = tenantSlugFromMe(me);
        this.tenant.setSlug(slug);
        syncTenantRouteIfNeeded(this.router, this.tenant, me);
      }),
    );
  }
}
