import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { readAccessToken } from '../auth.interceptor';
import type { MeResponse } from '../models/me.model';
import { SessionContextService } from './session-context.service';
import { syncTenantRouteIfNeeded } from './sync-tenant-route.util';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Carga `/me` antes de activar rutas hijas del shell (branding, permisos para el menú).
 */
export const sessionResolver: ResolveFn<MeResponse | null> = () => {
  const http = inject(HttpClient);
  const session = inject(SessionContextService);
  const tenant = inject(TenantContextService);
  const router = inject(Router);

  if (!readAccessToken()) {
    session.clearMe();
    return of(null);
  }

  return http.get<MeResponse>('/api/web/v1/me').pipe(
    tap((m) => {
      session.setMe(m);
      syncTenantRouteIfNeeded(router, tenant, m);
    }),
    catchError((err: HttpErrorResponse) => {
      session.clearMe();
      if (err.status === 401) {
        void router.navigate(['/t', tenant.tenantSlug(), 'login']);
      }
      return of(null);
    }),
  );
};
