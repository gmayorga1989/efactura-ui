import { permissionGuard } from './permission.guard';

/** Coherente con `ApiKeyController`: solo `EMPRESA_ADMIN` o `PLATFORM_ADMIN`. */
export const apiKeysSectionGuard = permissionGuard((session) => session.puedeApiKeys());
