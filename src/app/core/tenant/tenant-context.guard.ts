import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { TenantContextService } from './tenant-context.service';

/** Sincroniza el tenant con el parámetro de ruta `tenantSlug`. */
export const tenantContextGuard: CanActivateFn = (route) => {
  const raw = route.paramMap.get('tenantSlug');
  inject(TenantContextService).setSlug(raw ?? 'default');
  return true;
};
