const TOKEN_KEY = 'efactura_access_token';
const REFRESH_KEY = 'efactura_refresh_token';

/** Tokens del Identity Gateway tras SSO hacia eFactura (misma pestaña; sessionStorage). */
const SUITE_HANDOFF_ACCESS = 'efactura_suite_identity_handoff_at';
const SUITE_HANDOFF_REFRESH = 'efactura_suite_identity_handoff_rt';

export function readAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function writeAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function readRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function writeRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem(REFRESH_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

/** Limpia tokens de sesión web (login / logout / 401). */
export function clearWebTokens(): void {
  writeAccessToken(null);
  writeRefreshToken(null);
  clearIdentityHandoff();
}

/**
 * Guarda access/refresh del Identity recibidos en el callback Suite (para abrir Cartera sin otra pestaña del shell).
 */
export function persistIdentityHandoff(identityAccess: string, identityRefresh: string | null): void {
  try {
    sessionStorage.setItem(SUITE_HANDOFF_ACCESS, identityAccess);
    if (identityRefresh?.trim()) {
      sessionStorage.setItem(SUITE_HANDOFF_REFRESH, identityRefresh.trim());
    } else {
      sessionStorage.removeItem(SUITE_HANDOFF_REFRESH);
    }
  } catch {
    /* storage lleno o modo privado */
  }
}

export function readIdentityHandoffAccess(): string | null {
  try {
    return sessionStorage.getItem(SUITE_HANDOFF_ACCESS);
  } catch {
    return null;
  }
}

export function readIdentityHandoffRefresh(): string | null {
  try {
    return sessionStorage.getItem(SUITE_HANDOFF_REFRESH);
  } catch {
    return null;
  }
}

export function clearIdentityHandoff(): void {
  try {
    sessionStorage.removeItem(SUITE_HANDOFF_ACCESS);
    sessionStorage.removeItem(SUITE_HANDOFF_REFRESH);
  } catch {
    /* ignore */
  }
}
