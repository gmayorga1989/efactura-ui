import type { TokenResponse } from '../models/me.model';
import { resolveApiUrl } from '../api/api-origin';

export class AuthRefreshError extends Error {
  constructor(readonly status: number) {
    super(`refresh ${status}`);
  }
}

export function isTransientRefreshFailure(err: unknown): boolean {
  return err instanceof AuthRefreshError && err.status >= 500;
}

/** Evita recursión del `HttpClient` con el interceptor: refresh vía fetch. */
export async function fetchAuthRefresh(refreshToken: string, tenantSlug?: string): Promise<TokenResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (tenantSlug) {
    headers['X-Tenant-Slug'] = tenantSlug;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(resolveApiUrl('/api/web/v1/auth/refresh'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken }),
    });
    if (res.ok) {
      return (await res.json()) as TokenResponse;
    }
    if (res.status >= 500 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    throw new AuthRefreshError(res.status);
  }
  throw new AuthRefreshError(503);
}
