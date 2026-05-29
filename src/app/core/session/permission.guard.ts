import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';
import { readAccessToken } from '../auth.interceptor';
import type { MeResponse } from '../models/me.model';
import { TenantContextService } from '../tenant/tenant-context.service';
import { SessionContextService } from './session-context.service';
import { syncTenantRouteIfNeeded } from './sync-tenant-route.util';

export function permissionGuard(check: (session: SessionContextService) => boolean): CanActivateFn {
  return () => {
    const session = inject(SessionContextService);
    const router = inject(Router);
    const tenant = inject(TenantContextService);
    const http = inject(HttpClient);

    const loginTree = () => router.createUrlTree(['/t', tenant.tenantSlug(), 'login']);
    const dashboardTree = () => router.createUrlTree(['/t', tenant.tenantSlug(), 'dashboard']);
    const decide = () => (check(session) ? true : dashboardTree());

    if (!readAccessToken()) {
      return loginTree();
    }
    if (session.profile()) {
      return decide();
    }

    return http.get<MeResponse>('/api/web/v1/me').pipe(
      tap((me) => {
        session.setMe(me);
        syncTenantRouteIfNeeded(router, tenant, me);
      }),
      map(() => decide()),
      catchError((err: HttpErrorResponse) => {
        session.clearMe();
        if (err.status === 401) {
          return of(loginTree());
        }
        return of(dashboardTree());
      }),
    );
  };
}
