import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { fetchAuthRefresh, isTransientRefreshFailure } from './auth/refresh-access.fetch';
import { isEfacturaWebApiPath } from './api/api-origin';
import type { TokenResponse } from './models/me.model';
import { SessionContextService } from './session/session-context.service';
import { TenantContextService } from './tenant/tenant-context.service';
import {
  clearWebTokens,
  readAccessToken,
  readRefreshToken,
  writeAccessToken,
  writeRefreshToken,
} from './auth.interceptor.tokens';

const AUTH_RETRY = 'X-Efactura-Auth-Retry';
const REFRESH_SKEW_MS = 60_000;

let refreshInFlight: Promise<TokenResponse> | null = null;

function refreshTokensDeduped(tenantSlug?: string): Promise<TokenResponse> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  const rt = readRefreshToken();
  if (!rt) {
    return Promise.reject(new Error('no_refresh'));
  }
  refreshInFlight = fetchAuthRefresh(rt, tenantSlug).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function jwtExpiresAtMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function shouldRefreshBeforeRequest(req: HttpRequest<unknown>, token: string | null): boolean {
  if (!token || !readRefreshToken() || req.headers.has(AUTH_RETRY)) {
    return false;
  }
  if (!shouldTryRefreshOn401(req)) {
    return false;
  }
  const expiresAt = jwtExpiresAtMs(token);
  return expiresAt !== null && expiresAt - Date.now() <= REFRESH_SKEW_MS;
}

function shouldTryRefreshOn401(req: HttpRequest<unknown>): boolean {
  if (req.headers.has(AUTH_RETRY)) {
    return false;
  }
  const url = req.url;
  return (
    !url.includes('/auth/login') &&
    !url.includes('/auth/suite/exchange') &&
    !url.includes('/auth/refresh') &&
    !url.includes('/auth/select-empresa') &&
    !url.includes('/auth/logout') &&
    !url.includes('/auth/accept-invite') &&
    !url.includes('/auth/activate-temporary-password')
  );
}

function navigateToLogin(router: Router, session: SessionContextService): void {
  session.clearMe();
  const parts = router.url.split('/').filter(Boolean);
  const slug = parts[0] === 't' && parts[1] ? parts[1] : 'default';
  void router.navigate(['/t', slug, 'login']);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isEfacturaWebApiPath(req.url)) {
    return next(req);
  }
  const token = readAccessToken();
  const tenant = inject(TenantContextService);
  const router = inject(Router);
  const session = inject(SessionContextService);
  const tenantSlug = tenant.tenantSlug();

  const send = (accessToken: string | null, retry = false) => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (tenantSlug) {
      headers['X-Tenant-Slug'] = tenantSlug;
    }
    if (retry) {
      headers[AUTH_RETRY] = '1';
    }
    const authReq = Object.keys(headers).length > 0 ? req.clone({ setHeaders: headers }) : req;
    return next(authReq);
  };

  const handle401 = (err: unknown) => {
    if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
      return throwError(() => err);
    }
    if (!shouldTryRefreshOn401(req) || !readRefreshToken()) {
      return throwError(() => err);
    }
    return from(refreshTokensDeduped(tenantSlug)).pipe(
      switchMap((tr) => {
        writeAccessToken(tr.accessToken);
        writeRefreshToken(tr.refreshToken);
        return send(tr.accessToken, true);
      }),
      catchError((refreshErr) => {
        if (isTransientRefreshFailure(refreshErr)) {
          return throwError(() => err);
        }
        clearWebTokens();
        navigateToLogin(router, session);
        return throwError(() => refreshErr);
      }),
    );
  };

  if (shouldRefreshBeforeRequest(req, token)) {
    return from(refreshTokensDeduped(tenantSlug)).pipe(
      switchMap((tr) => {
        writeAccessToken(tr.accessToken);
        writeRefreshToken(tr.refreshToken);
        return send(tr.accessToken);
      }),
      catchError(() => {
        return send(token).pipe(catchError((err: unknown) => handle401(err)));
      }),
    );
  }

  return send(token).pipe(
    catchError((err: unknown) => {
      return handle401(err);
    }),
  );
};

export {
  readAccessToken,
  writeAccessToken,
  readRefreshToken,
  writeRefreshToken,
  clearWebTokens,
  persistIdentityHandoff,
  readIdentityHandoffAccess,
  readIdentityHandoffRefresh,
  clearIdentityHandoff,
} from './auth.interceptor.tokens';
