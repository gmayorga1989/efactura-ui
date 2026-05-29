import { environment } from '../../../environments/environment';

/** Prefija rutas /api con apiOrigin en producción. */
export function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const origin = environment.apiOrigin?.trim().replace(/\/+$/, '') ?? '';
  if (!origin) {
    return normalized;
  }
  return `${origin}${normalized}`;
}

export function isEfacturaApiPath(url: string): boolean {
  if (url.startsWith('/api/')) {
    return true;
  }
  try {
    return new URL(url).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function isEfacturaWebApiPath(url: string): boolean {
  if (url.startsWith('/api/web/')) {
    return true;
  }
  try {
    return new URL(url).pathname.startsWith('/api/web/');
  } catch {
    return false;
  }
}
