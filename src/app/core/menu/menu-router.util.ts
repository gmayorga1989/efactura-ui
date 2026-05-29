/**
 * Convierte `ruta_front` de BD (`/t/:slug/...`) en comandos para `[routerLink]`.
 * `inicio` se mapea a `dashboard` (rutas actuales de la app).
 */
export function routerLinkFromMenuPath(rutaFront: string | null | undefined, tenantSlug: string): string[] | null {
  if (!rutaFront?.trim()) {
    return null;
  }
  const parts = rutaFront.trim().split('/').filter(Boolean);
  const resolved = parts.map((p) => (p.toLowerCase() === ':slug' ? tenantSlug : p));
  if (resolved.length < 2 || resolved[0] !== 't') {
    return null;
  }
  const leaf = resolved[2] === 'inicio' ? 'dashboard' : resolved[2];
  return ['/t', resolved[1], leaf, ...resolved.slice(3)];
}
