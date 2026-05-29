import { permissionGuard } from './permission.guard';

/** Coherente con `RolController` / `InvitacionesController`: `EMPRESA_ADMIN` o `PLATFORM_ADMIN`. */
export const adminSectionGuard = permissionGuard((session) => session.puedeGestionarUsuariosEmpresa());
