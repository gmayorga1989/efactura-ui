import { Router } from '@angular/router';
import { TenantContextService } from '../tenant/tenant-context.service';
import type { MeResponse } from '../models/me.model';
import { tenantSlugFromMe } from './tenant-slug.util';

/**
 * Tras `/me`, alinea `TenantContextService` y la URL si el segmento `/t/{slug}` no coincide con el
 * slug canónico de la sesión.
 *
 * Importante: no llamar a `router.navigate` de forma síncrona desde el `tap` de un `ResolveFn`:
 * puede cancelar la navegación en curso y re-disparar el resolver en bucle (UI “congelada”).
 */
export function syncTenantRouteIfNeeded(router: Router, tenant: TenantContextService, me: MeResponse): void {
  const target = tenantSlugFromMe(me);
  tenant.setSlug(target);

  const currentNavigation = router.getCurrentNavigation();
  const navigationUrl =
    currentNavigation?.finalUrl?.toString() ?? currentNavigation?.extractedUrl.toString() ?? router.url;
  const pathOnly = navigationUrl.split(/[?#]/)[0];
  const parts = pathOnly.split('/').filter(Boolean);
  if (parts[0] !== 't' || parts.length < 2) {
    return;
  }
  const urlSlug = parts[1].trim().toLowerCase();
  if (urlSlug === target) {
    return;
  }
  const rest = parts.slice(2);
  queueMicrotask(() => {
    if (rest.length > 0) {
      void router.navigate(['/t', target, ...rest], { replaceUrl: true });
    } else {
      void router.navigate(['/t', target, 'dashboard'], { replaceUrl: true });
    }
  });
}
