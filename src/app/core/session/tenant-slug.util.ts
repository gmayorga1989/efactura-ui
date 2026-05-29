import type { MeResponse } from '../models/me.model';

const PLATFORM_SLUG = 'platform';

/**
 * Slug de ruta `/t/{slug}/...` coherente con `GET /me`.
 * Sesión plataforma → `platform`. Empresa sin slug en BD → segmento derivado del RUC.
 */
export function tenantSlugFromMe(me: MeResponse): string {
  if (me.empresaId == null) {
    return PLATFORM_SLUG;
  }
  const e = me.empresa;
  const slug = e?.slug?.trim().toLowerCase();
  if (slug) {
    return slug;
  }
  const rucDigits = e?.ruc?.replace(/\D/g, '') ?? '';
  return rucDigits.length > 0 ? rucDigits : 'default';
}

export { PLATFORM_SLUG };
