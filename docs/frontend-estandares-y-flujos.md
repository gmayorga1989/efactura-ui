# Estandares frontend y flujos

Documento tecnico interno para mantener consistencia en pantallas, flujos, componentes y traducciones del frontend.

## Principios

- Toda pantalla nueva debe usar los componentes compartidos existentes antes de crear estructuras nuevas.
- Todo texto visible nuevo debe agregarse a `UiI18nService` en `es`, `en`, `pt` y `fr`.
- No usar Angular compile-time i18n. El idioma se resuelve en runtime.
- Los grids deben usar Tabulator mediante wrappers compartidos.
- Las acciones de grid deben concentrarse en un unico boton de acciones en la primera columna.
- No usar `alert`, `confirm` o `prompt` nativos en nuevas pantallas. Usar modal de confirmacion propio.
- No agregar DELETE en catalogos que operan por estado, salvo endpoints que ya fueron definidos como eliminacion logica.

## Estructura base

Rutas y paginas principales:

- `src/app/app.routes.ts`: define rutas, guards, lazy loading y metadata de pantalla.
- `src/app/pages/**`: paginas funcionales.
- `src/app/shared/ui/organisms/**`: componentes visuales compartidos.
- `src/app/core/**`: servicios transversales, sesion, modelos, i18n, interceptores.

Componentes base:

- `TsPageLayoutComponent`: layout estandar de pantalla interna.
- `TsAppSidebarComponent`: menu lateral.
- `TsAppNavbarComponent`: cabecera superior y menu de usuario.
- `TsTabulatorLocalGridComponent`: grid local sin paginacion remota.
- `TsTabulatorSpringGridComponent`: grid remoto con paginacion Spring.
- `TsLoginShellComponent`: layout visual para pantallas publicas de autenticacion.

## Layout de pantalla

Toda pantalla interna debe usar:

```html
<ts-page-layout
  [title]="t('module.title')"
  [subtitle]="t('module.subtitle')"
  [eyebrow]="t('module.eyebrow')"
>
  <div page-actions>
    ...
  </div>

  ...
</ts-page-layout>
```

Reglas:

- Los botones principales van en `page-actions`.
- Si la pantalla no usa tabs, los botones no deben ir al pie del formulario.
- Si la pantalla usa tabs, se mantiene la estructura compacta con acciones visibles arriba.
- La cabecera debe ser compacta, con icono automatico de modulo y jerarquia visual uniforme.
- No usar textos hardcodeados para titulos, subtitulos, botones o columnas.

`TsPageLayoutComponent` soporta tambien:

- `titleKey`
- `subtitleKey`
- `eyebrowKey`

Pero el patron preferido actual es pasar `t(...)` desde la pagina para mantener control directo.

## i18n runtime

Servicio:

- Archivo: `src/app/core/i18n/ui-i18n.service.ts`
- Idiomas soportados: `es`, `en`, `pt`, `fr`.

API expuesta:

```ts
i18n.language()
i18n.setLanguage(lang)
i18n.t(key)
i18n.t(key, fallback)
i18n.t(key, { nombre: 'Juan' })
i18n.t(key, { nombre: 'Juan' }, fallback)
```

Inicializacion:

1. Intenta leer `idioma` desde `GET /api/web/v1/me/perfil`.
2. Si no existe, usa `sessionStorage`.
3. Fallback: `es`.

Persistencia:

- `setLanguage()` actualiza el signal reactivo.
- Guarda en `sessionStorage` con la clave interna del servicio.
- Al guardar Perfil, se envia `PATCH /api/web/v1/me/perfil` con el idioma.

Reglas obligatorias:

- Toda pantalla nueva debe agregar claves de traduccion.
- Toda clave debe existir en los cuatro idiomas.
- Si falta una clave, el servicio muestra fallback y emite warning en desarrollo.
- No agregar textos hardcodeados en componentes nuevos o migrados.

Convencion de claves:

- `common.*`: acciones y textos reutilizables.
- `menu.*`: menu lateral y labels de navegacion.
- `navbar.*`: cabecera superior.
- `profile.*`: perfil, avatar, 2FA y preferencias.
- `login.*`: login, MFA, recuperacion y seleccion de empresa.
- `reset.*`: confirmacion de recuperacion de clave.
- `users.*`: mantenimiento de usuarios.
- `roles.*`: mantenimiento de roles.
- `invitations.*`: invitaciones.
- `masters.*`: clientes, proveedores, productos y servicios.

Ejemplo:

```ts
'common.save': 'Guardar',
'common.cancel': 'Cancelar',
'masters.productsTitle': 'Productos',
'masters.productsSubtitle': 'Catalogo de productos para emision.',
```

## Menu dinamico

Modelo:

- Archivo: `src/app/core/models/menu.model.ts`

Campos relevantes:

```ts
etiqueta: string;
labelKey?: string | null;
fallbackLabel?: string | null;
icono?: string | null;
rutaFront?: string | null;
orden?: number | null;
```

Render:

```ts
t(item.labelKey, item.fallbackLabel)
```

Compatibilidad:

Si backend no envia `labelKey`, usar:

```ts
item.fallbackLabel || item.etiqueta || item.label
```

El sidebar tiene un mapeo defensivo por `codigo`, `etiqueta` y `rutaFront` para menus antiguos.

## Grids Tabulator

Wrappers:

- `TsTabulatorLocalGridComponent`
- `TsTabulatorSpringGridComponent`

Reglas:

- Primera columna siempre es acciones.
- La columna de acciones no debe mostrar titulo.
- Ordenamiento por defecto deshabilitado. Solo se activa si se solicita explicitamente con `headerSort: true`.
- Columnas con texto variable deben usar `formatter: 'textarea'` o formatter equivalente con wrap.
- Los menus de acciones deben abrir sobre todos los elementos y posicionarse desde el boton invocador.
- El icono del boton de acciones es de tres puntos verticales y debe girar/animarse al abrir.
- Cada accion del menu debe tener icono y texto.

Patron de columna de acciones:

```ts
{
  title: '',
  field: 'id',
  width: 82,
  headerSort: false,
  hozAlign: 'center',
  formatter: () => `
    <div class="ts-grid-actions dropdown">
      <button type="button" class="ts-grid-actions__toggle" aria-label="${escapeHtml(this.t('common.actions'))}">
        ...
      </button>
      <div class="dropdown-menu ts-grid-actions__menu">
        ...
      </div>
    </div>
  `,
}
```

Eventos:

```html
<ts-tabulator-local-grid
  [data]="rows()"
  [columns]="cols()"
  [reloadNonce]="gridNonce()"
  (rowAction)="onRowAction($event)"
/>
```

```ts
onRowAction(event: { action: string; row: Record<string, unknown> }): void {
  ...
}
```

## Modales y confirmaciones

Reglas:

- No usar alerts nativos.
- Usar backdrop propio.
- Header con icono a la izquierda.
- Boton cerrar visible y con hover estable.
- Footer con botones compactos.
- Validaciones y errores del backend deben mostrarse dentro del modal o sobre el grid.

Confirmacion estandar:

```ts
interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
}
```

Uso:

```ts
confirmState.set({
  title: t('...'),
  message: t('...'),
  confirmText: t('common.inactivate'),
  variant: 'danger',
  onConfirm: () => this.cambiarEstado(row, 'INACTIVO'),
});
```

## Sesion, avatar y presencia

Modelos:

- `MeResponse` incluye `avatarUrl`, `enLinea`, `ultimoPing`.
- `GET /api/web/v1/me/perfil` tambien puede devolver `avatarUrl`, `enLinea`, `ultimoPing`.

Servicios:

- `SessionContextService`: mantiene sesion global.
- `PresenceService`: ejecuta ping de presencia.
- `UiI18nService`: tambien inicializa idioma y fusiona datos de perfil relevantes en sesion.

Avatar:

Endpoints:

- `POST /api/web/v1/me/avatar`
- `DELETE /api/web/v1/me/avatar`

Reglas UI:

- Mostrar avatar circular si existe `avatarUrl`.
- Si no existe avatar, mostrar iniciales.
- Antes de subir imagen se abre cropper modal.
- El cropper genera PNG cuadrado `512x512`.
- Tipos permitidos: PNG, JPG/JPEG, WEBP.
- Maximo: 2MB.
- Al subir o eliminar avatar, refrescar perfil y preservar datos en sesion.

Presencia:

Endpoint:

- `POST /api/web/v1/me/presence/ping`

Reglas:

- Iniciar ping al montar `TenantShellComponent`.
- Frecuencia: 60 segundos.
- No ejecutar ping si no hay token.
- Solo hacer ping si `document.visibilityState === 'visible'`.
- Detener intervalo en logout y al destruir shell.
- Mostrar punto verde si `enLinea = true`.

## Flujo de login

Pantallas publicas:

- Login normal.
- Recuperacion de contrasena.
- Reset por token.
- Activacion por clave temporal.
- Aceptacion de invitacion.

Login:

1. Usuario ingresa email y contrasena.
2. `POST /api/web/v1/auth/login`.
3. Si responde `COMPLETE`, guardar tokens y cargar `/me`.
4. Si responde `SELECT_EMPRESA`, mostrar lista de empresas.
5. Si responde `MFA_REQUIRED`, mostrar codigo 2FA.
6. Al completar, navegar a dashboard del tenant.

Reglas:

- Si el usuario tiene una sola empresa, no debe pedir RUC.
- Si tiene varias empresas, listar opciones.
- La seleccion de empresa debe entrar en un solo clic.
- Mostrar loaders claros durante login, seleccion de empresa y carga de `/me`.

## Perfil de usuario

Endpoint principal:

- `GET /api/web/v1/me/perfil`
- `PATCH /api/web/v1/me/perfil`

Secciones:

- Informacion personal.
- Localizacion.
- Preferencias regionales.
- Seguridad.

Seguridad:

- Cambio de contrasena.
- Activacion 2FA.
- Confirmacion 2FA.
- Desactivacion 2FA.

Reglas:

- El idioma seleccionado en Perfil afecta toda la UI inmediatamente.
- No mostrar secreto 2FA despues de confirmar.
- Validar codigos 2FA con 6 digitos.

## Usuarios

Pantalla:

- `src/app/pages/admin-usuarios/admin-usuarios.ts`

Reglas:

- No mostrar `membresiaId` al usuario final como columna principal.
- Email no se edita.
- Mostrar usuario con avatar/iniciales, nombre, correo y presencia.
- Estado puede ser `ACTIVO`, `INACTIVO`, `PENDIENTE_CONFIRMACION`.
- No usar DELETE. Inactivar con estado.
- Para `PENDIENTE_CONFIRMACION`, permitir reenvio de correo temporal si backend lo expone.

## Invitaciones

Pantalla:

- `src/app/pages/admin-invitaciones/admin-invitaciones.ts`

Estados:

- `PENDIENTE`
- `ACEPTADA`
- `CANCELADA`
- `EXPIRADA`

Reglas:

- Usar endpoint historico cuando exista: `GET /api/web/v1/invitaciones`.
- No depender solo de `/pendientes` para pantalla principal.
- Cancelar y reenviar solo para invitaciones pendientes.
- Si `emailEnviado = false`, mostrar aviso y `acceptUrl` solo como soporte/admin.

## Roles

Pantalla:

- `src/app/pages/admin-roles/admin-roles.ts`

Reglas:

- Roles de sistema no editables.
- Un rol con usuarios asignados no debe eliminarse; debe inactivarse.
- Acciones desde menu desplegable del grid.
- Permisos en selector multiple visual.

## Sucursales y puntos de emision

Pantalla:

- `src/app/pages/sucursales-emision/sucursales-emision.page.ts`

Reglas:

- Usar tabs para sucursales y puntos de emision.
- Crear/editar mediante modal.
- No mostrar eliminar.
- Manejar estado `ACTIVO` / `INACTIVO`.
- Si backend indica comprobantes asociados, bloquear campos no editables.
- Acciones de grid con menu desplegable unico.

## Clientes, proveedores, productos y servicios

Pantallas:

- `src/app/pages/maestros/maestro-list.page.ts`
- `src/app/pages/maestros/maestro-form.page.ts`

Reglas de listados:

- Titulo y subtitulo dependen de `tipo`:
  - `clientes`
  - `proveedores`
  - `productos`
  - `servicios`
- Clientes/proveedores usan filtros por busqueda, estado y tipo tercero.
- Productos/servicios usan catalogo de productos para emision.
- Acciones siempre en primera columna sin titulo.

Reglas de cliente/proveedor:

- Una sola entidad para cliente/proveedor.
- `tipoTercero`: `CLIENTE`, `PROVEEDOR`, `AMBOS`.
- No duplicar por `empresaId + tipoIdentificacion + identificacion`.
- En edicion, identificacion no editable.
- Direcciones se manejan en grid y modal.
- Si el RUC esta completo, consultar existencia local y luego SRI si aplica.

## Checklist para nueva pantalla

Antes de cerrar una nueva pantalla o cambio funcional:

- Usa `TsPageLayoutComponent`.
- Acciones estan en `page-actions`.
- Todos los textos visibles usan `t(...)`.
- Se agregaron claves en `es`, `en`, `pt`, `fr`.
- Si hay grid, usa wrapper Tabulator.
- Primera columna del grid es menu de acciones sin titulo.
- Columnas largas usan `formatter: 'textarea'` o wrap equivalente.
- No hay `alert`, `confirm` o `prompt` nativos.
- Errores backend se muestran claramente.
- Hay estados de loading.
- Se valida `npm.cmd run build`.

## Build

Comando estandar:

```powershell
npm.cmd run build
```

Warnings conocidos actuales:

- Selectores CSS del vendor/template relacionados con `.form-floating>~label` y `.btn-group>+.btn`.
- No bloquean la compilacion.
