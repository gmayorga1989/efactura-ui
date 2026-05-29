import { Routes } from '@angular/router';
import { adminSectionGuard } from './core/session/admin-section.guard';
import { apiKeysSectionGuard } from './core/session/api-keys-section.guard';
import { permissionGuard } from './core/session/permission.guard';
import { sessionResolver } from './core/session/session.resolver';
import { tenantContextGuard } from './core/tenant/tenant-context.guard';

const configuracionEmpresa = () =>
  import('./pages/configuracion-empresa/configuracion-empresa').then((m) => m.ConfiguracionEmpresaPage);
const rideDiseno = () => import('./pages/ride-diseno/ride-diseno.page').then((m) => m.RideDisenoPage);
const correoDiseno = () => import('./pages/correo-diseno/correo-diseno.page').then((m) => m.CorreoDisenoPage);
const sucursalesEmision = () =>
  import('./pages/sucursales-emision/sucursales-emision.page').then((m) => m.SucursalesEmisionPage);
const documentoBorrador = () =>
  import('./pages/documentos/documento-borrador.page').then((m) => m.DocumentoBorradorPage);
const maestroList = () => import('./pages/maestros/maestro-list.page').then((m) => m.MaestroListPage);
const maestroForm = () => import('./pages/maestros/maestro-form.page').then((m) => m.MaestroFormPage);

const empresaAdminGuard = permissionGuard((session) => session.puedeConfiguracionTributaria());
const ventasGuard = permissionGuard((session) => session.puedeGestionarVentas());
const proveedoresGuard = permissionGuard((session) => session.puedeGestionarProveedores());
const reportesGuard = permissionGuard((session) => session.puedeVerReportes());
const monitorGuard = permissionGuard((session) => session.puedeListarComprobantes());

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 't/default/login' },
  { path: 'login', redirectTo: 't/default/login', pathMatch: 'full' },
  {
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/auth/pages/accept-invite-page/accept-invite-page.component').then(
        (m) => m.AcceptInvitePageComponent,
      ),
  },
  {
    path: 'activate-temporary-password',
    loadComponent: () =>
      import('./features/auth/pages/activate-temporary-password-page/activate-temporary-password-page.component').then(
        (m) => m.ActivateTemporaryPasswordPageComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password-page/reset-password-page.component').then(
        (m) => m.ResetPasswordPageComponent,
      ),
  },
  {
    path: 'auth/suite-callback',
    loadComponent: () =>
      import('./features/auth/pages/suite-identity-callback-page/suite-identity-callback-page.component').then(
        (m) => m.SuiteIdentityCallbackPageComponent,
      ),
  },
  {
    path: 't/:tenantSlug',
    canActivate: [tenantContextGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
      },
      {
        path: 'accept-invite',
        loadComponent: () =>
          import('./features/auth/pages/accept-invite-page/accept-invite-page.component').then(
            (m) => m.AcceptInvitePageComponent,
          ),
      },
      {
        path: 'activate-temporary-password',
        loadComponent: () =>
          import('./features/auth/pages/activate-temporary-password-page/activate-temporary-password-page.component').then(
            (m) => m.ActivateTemporaryPasswordPageComponent,
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/pages/reset-password-page/reset-password-page.component').then(
            (m) => m.ResetPasswordPageComponent,
          ),
      },
      {
        path: '',
        loadComponent: () =>
          import('./features/shell/tenant-shell.component').then((m) => m.TenantShellComponent),
        resolve: { me: sessionResolver },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'home', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'inicio', pathMatch: 'full', redirectTo: 'dashboard' },
          {
            path: 'dashboard',
            loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage),
          },
          {
            path: 'facturas',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.title', title: 'Facturas electronicas' },
            loadComponent: () => import('./pages/facturas/facturas').then((m) => m.FacturasPage),
          },
          {
            path: 'facturas/nueva',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.formTitle', title: 'Nueva factura' },
            loadComponent: () => import('./pages/facturas/factura-nueva.page').then((m) => m.FacturaNuevaPage),
          },
          {
            path: 'facturas/editar/:id',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.editDraftTitle', title: 'Editar borrador' },
            loadComponent: () => import('./pages/facturas/factura-nueva.page').then((m) => m.FacturaNuevaPage),
          },
          {
            path: 'facturas/:id/nota-credito',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.creditNoteTitle', title: 'Nota de credito' },
            loadComponent: () =>
              import('./pages/facturas/factura-nota-credito.page').then((m) => m.FacturaNotaCreditoPage),
          },
          {
            path: 'facturas/:id/nota-debito',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.debitNoteTitle', title: 'Nota de debito' },
            loadComponent: () =>
              import('./pages/facturas/factura-nota-debito.page').then((m) => m.FacturaNotaDebitoPage),
          },
          {
            path: 'facturas/:id/guia',
            canActivate: [ventasGuard],
            data: { titleKey: 'documents.guideFormTitle', title: 'Guia de remision', mode: 'desdeFactura' },
            loadComponent: () =>
              import('./pages/documentos/documento-guia-nueva.page').then((m) => m.DocumentoGuiaNuevaPage),
          },
          {
            path: 'facturas/:id',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.detailTitle', title: 'Detalle factura' },
            loadComponent: () =>
              import('./pages/comprobantes/comprobante-detalle.page').then((m) => m.ComprobanteDetallePage),
          },
          {
            path: 'ventas/cotizaciones',
            canActivate: [ventasGuard],
            data: { titleKey: 'quotation.title', title: 'Cotizaciones' },
            loadComponent: () => import('./pages/cotizaciones/cotizaciones.page').then((m) => m.CotizacionesPage),
          },
          {
            path: 'ventas/cotizaciones/nueva',
            canActivate: [ventasGuard],
            data: { titleKey: 'quotation.newTitle', title: 'Nueva cotización' },
            loadComponent: () =>
              import('./pages/cotizaciones/cotizacion-form.page').then((m) => m.CotizacionFormPage),
          },
          {
            path: 'ventas/cotizaciones/editar/:id',
            canActivate: [ventasGuard],
            data: { titleKey: 'quotation.editTitle', title: 'Editar cotización' },
            loadComponent: () =>
              import('./pages/cotizaciones/cotizacion-form.page').then((m) => m.CotizacionFormPage),
          },
          {
            path: 'ventas/cotizaciones/diseno',
            canActivate: [ventasGuard],
            data: { titleKey: 'quotation.designPageTitle', title: 'Diseño cotización' },
            loadComponent: () =>
              import('./pages/cotizaciones/cotizacion-diseno.page').then((m) => m.CotizacionDisenoPage),
          },
          {
            path: 'ventas/vendedores',
            canActivate: [ventasGuard],
            data: { titleKey: 'salespeople.title', title: 'Vendedores' },
            loadComponent: () => import('./pages/vendedores/vendedores.page').then((m) => m.VendedoresPage),
          },
          {
            path: 'ventas/notas-credito/nueva',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.creditNoteManualTitle', title: 'Nueva nota de credito' },
            loadComponent: () =>
              import('./pages/documentos/nota-credito-nueva.page').then((m) => m.NotaCreditoNuevaPage),
          },
          {
            path: 'ventas/notas-credito',
            canActivate: [ventasGuard],
            data: {
              titleKey: 'documents.routes.creditNotesTitle',
              subtitleKey: 'documents.routes.creditNotesSubtitle',
              eyebrowKey: 'menu.sales',
              endpoint: '/api/web/v1/ventas/notas-credito',
              permiso: 'ventas',
              guidedRoute: ['ventas', 'notas-credito', 'nueva'],
            },
            loadComponent: documentoBorrador,
          },
          {
            path: 'ventas/notas-debito/nueva',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.debitNoteManualTitle', title: 'Nueva nota de debito' },
            loadComponent: () =>
              import('./pages/documentos/nota-debito-nueva.page').then((m) => m.NotaDebitoNuevaPage),
          },
          {
            path: 'ventas/notas-debito/editar/:id',
            canActivate: [ventasGuard],
            data: { titleKey: 'invoice.debitNoteEditTitle', title: 'Editar nota de debito' },
            loadComponent: () =>
              import('./pages/documentos/nota-debito-editar.page').then((m) => m.NotaDebitoEditarPage),
          },
          {
            path: 'ventas/notas-debito',
            canActivate: [ventasGuard],
            data: {
              titleKey: 'documents.routes.debitNotesTitle',
              subtitleKey: 'documents.routes.debitNotesSubtitle',
              eyebrowKey: 'menu.sales',
              endpoint: '/api/web/v1/ventas/notas-debito',
              permiso: 'ventas',
              guidedRoute: ['ventas', 'notas-debito', 'nueva'],
            },
            loadComponent: documentoBorrador,
          },
          {
            path: 'ventas/guias/nueva',
            canActivate: [ventasGuard],
            data: { titleKey: 'documents.guideFormTitle', title: 'Nueva guia de remision', mode: 'nueva' },
            loadComponent: () =>
              import('./pages/documentos/documento-guia-nueva.page').then((m) => m.DocumentoGuiaNuevaPage),
          },
          {
            path: 'ventas/guias/editar/:id',
            canActivate: [ventasGuard],
            data: { titleKey: 'documents.guideEditTitle', title: 'Editar guia de remision', mode: 'editar' },
            loadComponent: () =>
              import('./pages/documentos/documento-guia-nueva.page').then((m) => m.DocumentoGuiaNuevaPage),
          },
          {
            path: 'ventas/guias',
            canActivate: [ventasGuard],
            data: {
              titleKey: 'documents.routes.guidesTitle',
              subtitleKey: 'documents.routes.guidesSubtitle',
              eyebrowKey: 'menu.sales',
              endpoint: '/api/web/v1/ventas/guias',
              permiso: 'ventas',
              guidedRoute: ['ventas', 'guias', 'nueva'],
            },
            loadComponent: documentoBorrador,
          },
          {
            path: 'proveedores/retenciones/nueva',
            canActivate: [proveedoresGuard],
            data: { titleKey: 'documents.withholdingFormTitle', title: 'Nueva retencion', mode: 'nueva' },
            loadComponent: () =>
              import('./pages/documentos/documento-retencion-nueva.page').then((m) => m.DocumentoRetencionNuevaPage),
          },
          {
            path: 'proveedores/retenciones/editar/:id',
            canActivate: [proveedoresGuard],
            data: { titleKey: 'documents.withholdingEditTitle', title: 'Editar retencion', mode: 'editar' },
            loadComponent: () =>
              import('./pages/documentos/documento-retencion-nueva.page').then((m) => m.DocumentoRetencionNuevaPage),
          },
          {
            path: 'proveedores/descarga-sri',
            canActivate: [empresaAdminGuard],
            data: { titleKey: 'sriDownload.title', title: 'Descarga SRI recibidos' },
            loadComponent: () =>
              import('./pages/sri-descarga/sri-descarga.page').then((m) => m.SriDescargaPage),
          },
          {
            path: 'proveedores/retenciones',
            canActivate: [proveedoresGuard],
            data: {
              titleKey: 'documents.routes.withholdingsTitle',
              subtitleKey: 'documents.routes.withholdingsSubtitle',
              eyebrowKey: 'menu.suppliers',
              endpoint: '/api/web/v1/proveedores/retenciones',
              permiso: 'proveedores',
              guidedRoute: ['proveedores', 'retenciones', 'nueva'],
            },
            loadComponent: documentoBorrador,
          },
          {
            path: 'proveedores/liquidaciones/nueva',
            canActivate: [proveedoresGuard],
            data: { titleKey: 'documents.settlementFormTitle', title: 'Nueva liquidacion de compra', mode: 'nueva' },
            loadComponent: () =>
              import('./pages/documentos/documento-liquidacion-nueva.page').then((m) => m.DocumentoLiquidacionNuevaPage),
          },
          {
            path: 'proveedores/liquidaciones/editar/:id',
            canActivate: [proveedoresGuard],
            data: { titleKey: 'documents.settlementEditTitle', title: 'Editar liquidacion', mode: 'editar' },
            loadComponent: () =>
              import('./pages/documentos/documento-liquidacion-nueva.page').then((m) => m.DocumentoLiquidacionNuevaPage),
          },
          {
            path: 'proveedores/liquidaciones',
            canActivate: [proveedoresGuard],
            data: {
              titleKey: 'documents.routes.settlementsTitle',
              subtitleKey: 'documents.routes.settlementsSubtitle',
              eyebrowKey: 'menu.suppliers',
              endpoint: '/api/web/v1/proveedores/liquidaciones',
              permiso: 'proveedores',
              guidedRoute: ['proveedores', 'liquidaciones', 'nueva'],
            },
            loadComponent: documentoBorrador,
          },
          {
            path: 'comprobantes-electronicos',
            canActivate: [monitorGuard],
            data: { titleKey: 'monitor.title', title: 'Monitor de comprobantes electronicos' },
            loadComponent: () =>
              import('./pages/comprobantes-electronicos/comprobantes-electronicos.page').then(
                (m) => m.ComprobantesElectronicosPage,
              ),
          },
          {
            path: 'comprobantes/:id',
            canActivate: [monitorGuard],
            data: { titleKey: 'documents.voucherDetailTitle', title: 'Detalle comprobante' },
            loadComponent: () =>
              import('./pages/comprobantes/comprobante-detalle.page').then((m) => m.ComprobanteDetallePage),
          },
          {
            path: 'reportes',
            canActivate: [reportesGuard],
            data: { titleKey: 'reports.title', title: 'Reportes' },
            loadComponent: () => import('./pages/reportes/reportes').then((m) => m.ReportesPage),
          },
          {
            path: 'clientes',
            canActivate: [ventasGuard],
            data: {
              title: 'Clientes',
              subtitle: 'Registro de clientes para emision y consultas.',
              eyebrow: 'Maestros',
              tipo: 'clientes',
              clase: 'cliente',
            },
            loadComponent: maestroList,
          },
          {
            path: 'clientes/nuevo',
            canActivate: [ventasGuard],
            data: {
              title: 'cliente',
              subtitle: 'Registro de clientes para emision y consultas.',
              eyebrow: 'Maestros',
              tipo: 'clientes',
              clase: 'cliente',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'clientes/:id/editar',
            canActivate: [ventasGuard],
            data: {
              title: 'cliente',
              subtitle: 'Registro de clientes para emision y consultas.',
              eyebrow: 'Maestros',
              tipo: 'clientes',
              clase: 'cliente',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'admin/clientes',
            canActivate: [ventasGuard],
            data: {
              title: 'Clientes',
              subtitle: 'Registro de clientes para emision y consultas.',
              eyebrow: 'Maestros',
              tipo: 'clientes',
              clase: 'cliente',
            },
            loadComponent: maestroList,
          },
          {
            path: 'proveedores',
            canActivate: [proveedoresGuard],
            data: {
              title: 'Proveedores',
              subtitle: 'Registro de proveedores para retenciones y liquidaciones.',
              eyebrow: 'Maestros',
              tipo: 'proveedores',
              clase: 'cliente',
            },
            loadComponent: maestroList,
          },
          {
            path: 'proveedores/nuevo',
            canActivate: [proveedoresGuard],
            data: {
              title: 'proveedor',
              subtitle: 'Registro de proveedores para retenciones y liquidaciones.',
              eyebrow: 'Maestros',
              tipo: 'proveedores',
              clase: 'cliente',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'proveedores/:id/editar',
            canActivate: [proveedoresGuard],
            data: {
              title: 'proveedor',
              subtitle: 'Registro de proveedores para retenciones y liquidaciones.',
              eyebrow: 'Maestros',
              tipo: 'proveedores',
              clase: 'cliente',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'admin/proveedores',
            canActivate: [proveedoresGuard],
            data: {
              title: 'Proveedores',
              subtitle: 'Registro de proveedores para retenciones y liquidaciones.',
              eyebrow: 'Maestros',
              tipo: 'proveedores',
              clase: 'cliente',
            },
            loadComponent: maestroList,
          },
          {
            path: 'productos',
            canActivate: [ventasGuard],
            data: {
              title: 'Productos',
              subtitle: 'Catalogo de productos para emision.',
              eyebrow: 'Maestros',
              tipo: 'productos',
              clase: 'producto',
            },
            loadComponent: maestroList,
          },
          {
            path: 'productos/nuevo',
            canActivate: [ventasGuard],
            data: {
              title: 'producto',
              subtitle: 'Catalogo de productos para emision.',
              eyebrow: 'Maestros',
              tipo: 'productos',
              clase: 'producto',
              defaultTipoProducto: 'PRODUCTO',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'productos/:id/editar',
            canActivate: [ventasGuard],
            data: {
              title: 'producto',
              subtitle: 'Catalogo de productos para emision.',
              eyebrow: 'Maestros',
              tipo: 'productos',
              clase: 'producto',
              defaultTipoProducto: 'PRODUCTO',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'admin/productos',
            canActivate: [ventasGuard],
            data: {
              title: 'Productos',
              subtitle: 'Catalogo de productos para emision.',
              eyebrow: 'Maestros',
              tipo: 'productos',
              clase: 'producto',
            },
            loadComponent: maestroList,
          },
          {
            path: 'servicios',
            canActivate: [ventasGuard],
            data: {
              title: 'Servicios',
              subtitle: 'Catalogo de servicios para emision.',
              eyebrow: 'Maestros',
              tipo: 'servicios',
              clase: 'producto',
            },
            loadComponent: maestroList,
          },
          {
            path: 'servicios/nuevo',
            canActivate: [ventasGuard],
            data: {
              title: 'servicio',
              subtitle: 'Catalogo de servicios para emision.',
              eyebrow: 'Maestros',
              tipo: 'servicios',
              clase: 'producto',
              defaultTipoProducto: 'SERVICIO',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'servicios/:id/editar',
            canActivate: [ventasGuard],
            data: {
              title: 'servicio',
              subtitle: 'Catalogo de servicios para emision.',
              eyebrow: 'Maestros',
              tipo: 'servicios',
              clase: 'producto',
              defaultTipoProducto: 'SERVICIO',
            },
            loadComponent: maestroForm,
          },
          {
            path: 'admin/servicios',
            canActivate: [ventasGuard],
            data: {
              title: 'Servicios',
              subtitle: 'Catalogo de servicios para emision.',
              eyebrow: 'Maestros',
              tipo: 'servicios',
              clase: 'producto',
            },
            loadComponent: maestroList,
          },
          {
            path: 'mi-plan',
            data: { title: 'Mi plan' },
            loadComponent: () => import('./pages/mi-plan/mi-plan').then((m) => m.MiPlanPage),
          },
          {
            path: 'perfil',
            data: { title: 'Perfil' },
            loadComponent: () => import('./pages/perfil/perfil.page').then((m) => m.PerfilPage),
          },
          {
            path: 'admin/usuarios',
            canActivate: [adminSectionGuard],
            data: { title: 'Usuarios' },
            loadComponent: () => import('./pages/admin-usuarios/admin-usuarios').then((m) => m.AdminUsuariosPage),
          },
          {
            path: 'admin/invitaciones',
            canActivate: [adminSectionGuard],
            data: { title: 'Invitaciones' },
            loadComponent: () =>
              import('./pages/admin-invitaciones/admin-invitaciones').then((m) => m.AdminInvitacionesPage),
          },
          {
            path: 'admin/roles',
            canActivate: [adminSectionGuard],
            data: { title: 'Roles' },
            loadComponent: () => import('./pages/admin-roles/admin-roles').then((m) => m.AdminRolesPage),
          },
          {
            path: 'admin/empresa',
            canActivate: [empresaAdminGuard],
            data: { title: 'Empresa' },
            loadComponent: configuracionEmpresa,
          },
          {
            path: 'admin/ride-diseno',
            canActivate: [empresaAdminGuard],
            data: { titleKey: 'rideDesign.title' },
            loadComponent: rideDiseno,
          },
          {
            path: 'admin/correo-diseno',
            canActivate: [empresaAdminGuard],
            data: { titleKey: 'emailDesign.title' },
            loadComponent: correoDiseno,
          },
          {
            path: 'admin/sucursales',
            canActivate: [empresaAdminGuard],
            data: { title: 'Sucursal y emision', defaultTab: 'sucursales' },
            loadComponent: sucursalesEmision,
          },
          {
            path: 'admin/emision',
            canActivate: [empresaAdminGuard],
            data: { title: 'Emision', defaultTab: 'emision' },
            loadComponent: sucursalesEmision,
          },
          {
            path: 'configuracion',
            canActivate: [empresaAdminGuard],
            data: { title: 'Configuracion de empresa' },
            loadComponent: configuracionEmpresa,
          },
          {
            path: 'integraciones/api-keys',
            canActivate: [apiKeysSectionGuard],
            loadComponent: () => import('./pages/api-keys/api-keys').then((m) => m.ApiKeysPage),
          },
        ],
      },
    ],
  },
  { path: 'integraciones/api-keys', redirectTo: 't/default/integraciones/api-keys', pathMatch: 'full' },
  { path: '**', redirectTo: 't/default/login' },
];
