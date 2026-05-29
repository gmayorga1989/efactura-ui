import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import type { MenuItemDto } from '../../../../core/models/menu.model';
import { routerLinkFromMenuPath } from '../../../../core/menu/menu-router.util';
import { ShellLayoutService } from '../../../../core/shell/shell-layout.service';
import { SessionContextService } from '../../../../core/session/session-context.service';
import { SessionWorkflowService } from '../../../../core/session/session-workflow.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';

const ROUTER_ACTIVE_EXACT: { exact: boolean } = { exact: true };
const ROUTER_ACTIVE_PREFIX: { exact: boolean } = { exact: false };

interface SidebarChild {
  label: string;
  labelKey?: string;
  link: string[];
  exact?: boolean;
  visible?: boolean;
}

interface SidebarGroup {
  id: string;
  label: string;
  labelKey?: string;
  icon: SidebarIcon;
  children: SidebarChild[];
  visible?: boolean;
}

interface SidebarDirectItem {
  label: string;
  labelKey?: string;
  icon: SidebarIcon;
  link: string[];
  exact?: boolean;
  visible?: boolean;
}

type SidebarIcon =
  | 'admin'
  | 'home'
  | 'sales'
  | 'suppliers'
  | 'reports'
  | 'monitor'
  | 'plan'
  | 'products'
  | 'clients'
  | 'default';

@Component({
  selector: 'ts-app-sidebar',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  host: {
    '[class.ts-sidebar-mini]': '!layout.sidebarPinned()',
    '[class.ts-sidebar-pinned]': 'layout.sidebarPinned()',
  },
  template: `
    <aside
      class="sidebar sidebar-default sidebar-white sidebar-base navs-rounded-all"
      [class.sidebar-mini]="!layout.sidebarPinned()"
      [class.sidebar-hover]="!layout.sidebarPinned()"
      aria-label="Menu principal"
    >
      <div class="sidebar-header d-flex align-items-center justify-content-start">
        <a [routerLink]="homeLink()" class="navbar-brand">
          <div class="logo-main">
            <div class="logo-normal">
              @if (session.logoUrl(); as logo) {
                <img [src]="logo" alt="" class="rounded-1" style="height: 30px; width: auto; max-width: 140px" />
              } @else {
                <svg
                  class="text-primary icon-30"
                  width="30"
                  height="30"
                  viewBox="0 0 30 30"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect
                    x="-0.757324"
                    y="19.2427"
                    width="28"
                    height="4"
                    rx="2"
                    transform="rotate(-45 -0.757324 19.2427)"
                    fill="currentColor"
                  />
                  <rect
                    x="7.72803"
                    y="27.728"
                    width="28"
                    height="4"
                    rx="2"
                    transform="rotate(-45 7.72803 27.728)"
                    fill="currentColor"
                  />
                  <rect
                    x="10.5366"
                    y="16.3945"
                    width="16"
                    height="4"
                    rx="2"
                    transform="rotate(45 10.5366 16.3945)"
                    fill="currentColor"
                  />
                  <rect
                    x="10.5562"
                    y="-0.556152"
                    width="28"
                    height="4"
                    rx="2"
                    transform="rotate(45 10.5562 -0.556152)"
                    fill="currentColor"
                  />
                </svg>
              }
            </div>
            <div class="logo-mini">
              @if (session.logoUrl(); as logoMini) {
                <img [src]="logoMini" alt="" class="rounded-1" style="height: 30px; width: auto; max-width: 48px" />
              } @else {
                <svg
                  class="text-primary icon-30"
                  width="30"
                  height="30"
                  viewBox="0 0 30 30"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect x="-0.757324" y="19.2427" width="28" height="4" rx="2" transform="rotate(-45 -0.757324 19.2427)" fill="currentColor" />
                  <rect x="7.72803" y="27.728" width="28" height="4" rx="2" transform="rotate(-45 7.72803 27.728)" fill="currentColor" />
                  <rect x="10.5366" y="16.3945" width="16" height="4" rx="2" transform="rotate(45 10.5366 16.3945)" fill="currentColor" />
                  <rect x="10.5562" y="-0.556152" width="28" height="4" rx="2" transform="rotate(45 10.5562 -0.556152)" fill="currentColor" />
                </svg>
              }
            </div>
          </div>
          <h4 class="logo-title">{{ brandLabel() }}</h4>
        </a>
        <button
          type="button"
          class="sidebar-toggle"
          data-toggle="sidebar"
          data-active="true"
          (click)="layout.toggleSidebarPinned()"
          [attr.aria-pressed]="layout.sidebarPinned()"
          aria-label="Contraer o expandir menu"
        >
          <i class="icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4.25 12.2744L19.25 12.2744"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M10.2998 18.2988L4.2498 12.2748L10.2998 6.24976"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </i>
        </button>
      </div>

      <div class="sidebar-body pt-0 ts-native-scroll">
        <div class="sidebar-list">
          <ul class="navbar-nav iq-main-menu" id="sidebar-menu">
            <li class="nav-item static-item">
              <a class="nav-link static-item disabled" href="#" tabindex="-1" (click)="$event.preventDefault()">
                <span class="default-icon">{{ t('menu.main') }}</span>
                <span class="mini-icon">-</span>
              </a>
            </li>

            <li class="nav-item">
              <a
                class="nav-link"
                [routerLink]="homeLink()"
                routerLinkActive="active"
                [routerLinkActiveOptions]="routerActiveExact"
              >
                <i class="icon"><ng-container [ngTemplateOutlet]="menuIcon" [ngTemplateOutletContext]="{ icon: 'home' }" /></i>
                <span class="item-name">{{ t('menu.home') }}</span>
              </a>
            </li>

            @for (group of visibleGroups(); track group.id) {
              <li class="nav-item">
                <a
                  class="nav-link ts-nav-group"
                  href="#"
                  role="button"
                  [class.ts-nav-group--active]="isGroupActive(group)"
                  [class.ts-nav-group--open]="isGroupOpen(group)"
                  [attr.aria-expanded]="isGroupOpen(group)"
                  [attr.aria-controls]="'sidebar-' + group.id"
                  (click)="toggleGroup($event, group)"
                >
                  <i class="icon"><ng-container [ngTemplateOutlet]="menuIcon" [ngTemplateOutletContext]="{ icon: group.icon }" /></i>
                  <span class="item-name">{{ translateLabel(group) }}</span>
                  <i class="right-icon">
                    <svg class="icon-18" xmlns="http://www.w3.org/2000/svg" width="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </i>
                </a>
                <ul class="sub-nav collapse" [class.show]="isGroupOpen(group)" [id]="'sidebar-' + group.id">
                  @for (child of group.children; track child.label) {
                    @if (child.visible !== false) {
                      <li class="nav-item">
                        <a
                          class="nav-link ts-nav-sub"
                          [routerLink]="child.link"
                          [class.active]="isChildActive(child)"
                        >
                          <i class="icon">
                            <svg class="icon-10" xmlns="http://www.w3.org/2000/svg" width="10" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="8" fill="currentColor" />
                            </svg>
                          </i>
                          <i class="sidenav-mini-icon">{{ translateLabel(child).slice(0, 1) }}</i>
                          <span class="item-name">{{ translateLabel(child) }}</span>
                        </a>
                      </li>
                    }
                  }
                </ul>
              </li>
            }

            @for (item of directItems(); track item.label) {
              <li class="nav-item">
                <a
                  class="nav-link"
                  [routerLink]="item.link"
                  [class.active]="isDirectItemActive(item)"
                >
                  <i class="icon"><ng-container [ngTemplateOutlet]="menuIcon" [ngTemplateOutletContext]="{ icon: item.icon }" /></i>
                  <span class="item-name">{{ translateLabel(item) }}</span>
                </a>
              </li>
            }
          </ul>
        </div>
      </div>
      <div class="sidebar-footer"></div>
    </aside>

    <ng-template #menuIcon let-icon="icon">
      <svg width="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-20" aria-hidden="true">
        @switch (icon) {
          @case ('admin') {
            <path opacity="0.4" d="M4 5.5C4 3.57 5.57 2 7.5 2S11 3.57 11 5.5 9.43 9 7.5 9 4 7.43 4 5.5Z" fill="currentColor" />
            <path d="M2.5 18.25C2.5 15.35 4.85 13 7.75 13H10.5C13.4 13 15.75 15.35 15.75 18.25V20.5H2.5V18.25Z" fill="currentColor" />
            <path d="M17.8 3.4L19 5.8L21.65 6.2L19.72 8.08L20.18 10.72L17.8 9.48L15.42 10.72L15.88 8.08L13.95 6.2L16.6 5.8L17.8 3.4Z" fill="currentColor" />
          }
          @case ('sales') {
            <path opacity="0.4" d="M5 3H17.5C18.33 3 19 3.67 19 4.5V21L16.5 19.5L14 21L11.5 19.5L9 21L6.5 19.5L4 21V4C4 3.45 4.45 3 5 3Z" fill="currentColor" />
            <path d="M8 8H15V9.6H8V8ZM8 12H16V13.6H8V12ZM8 16H13V17.6H8V16Z" fill="currentColor" />
          }
          @case ('suppliers') {
            <path opacity="0.4" d="M3 8L12 3L21 8V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V8Z" fill="currentColor" />
            <path d="M7 11H17V13H7V11ZM7 15H14V17H7V15Z" fill="currentColor" />
          }
          @case ('reports') {
            <path opacity="0.4" d="M6 2H15L20 7V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z" fill="currentColor" />
            <path d="M14 2V8H20L14 2ZM7 17H9V12H7V17ZM11 17H13V9H11V17ZM15 17H17V14H15V17Z" fill="currentColor" />
          }
          @case ('monitor') {
            <path opacity="0.4" d="M4 4H20C21.1 4 22 4.9 22 6V15C22 16.1 21.1 17 20 17H4C2.9 17 2 16.1 2 15V6C2 4.9 2.9 4 4 4Z" fill="currentColor" />
            <path d="M8 20H16V22H8V20ZM10 17H14V20H10V17ZM5 11H8L10 8L13 14L15 11H19V13H16L13.6 16.6L10.6 10.6L9 13H5V11Z" fill="currentColor" />
          }
          @case ('plan') {
            <path opacity="0.4" d="M8 2H16C17.1 2 18 2.9 18 4V20C18 21.1 17.1 22 16 22H8C6.9 22 6 21.1 6 20V4C6 2.9 6.9 2 8 2Z" fill="currentColor" />
            <path d="M9 6H15V8H9V6ZM9 10H15V12H9V10ZM9 18H15V20H9V18Z" fill="currentColor" />
          }
          @case ('products') {
            <path opacity="0.4" d="M4 7L12 3L20 7V17L12 21L4 17V7Z" fill="currentColor" />
            <path d="M12 12L4.8 8.4L5.7 6.6L12 9.75L18.3 6.6L19.2 8.4L12 12ZM11 12H13V20H11V12Z" fill="currentColor" />
          }
          @case ('clients') {
            <path opacity="0.4" d="M7.5 11C9.43 11 11 9.43 11 7.5S9.43 4 7.5 4 4 5.57 4 7.5 5.57 11 7.5 11ZM16.5 12C18.16 12 19.5 10.66 19.5 9S18.16 6 16.5 6 13.5 7.34 13.5 9 14.84 12 16.5 12Z" fill="currentColor" />
            <path d="M2.5 20C2.5 16.96 4.96 14.5 8 14.5H9C12.04 14.5 14.5 16.96 14.5 20H2.5ZM14.75 20C14.56 18.26 13.79 16.7 12.64 15.51C13.35 15.19 14.15 15 15 15H16C19.04 15 21.5 17.46 21.5 20H14.75Z" fill="currentColor" />
          }
          @default {
            <path opacity="0.4" d="M16.0756 2H19.4616C20.8639 2 22.0001 3.14585 22.0001 4.55996V7.97452C22.0001 9.38864 20.8639 10.5345 19.4616 10.5345H16.0756C14.6734 10.5345 13.5371 9.38864 13.5371 7.97452V4.55996C13.5371 3.14585 14.6734 2 16.0756 2Z" fill="currentColor" />
            <path fill-rule="evenodd" clip-rule="evenodd" d="M4.53852 2H7.92449C9.32676 2 10.463 3.14585 10.463 4.55996V7.97452C10.463 9.38864 9.32676 10.5345 7.92449 10.5345H4.53852C3.13626 10.5345 2 9.38864 2 7.97452V4.55996C2 3.14585 3.13626 2 4.53852 2ZM4.53852 13.4655H7.92449C9.32676 13.4655 10.463 14.6114 10.463 16.0255V19.44C10.463 20.8532 9.32676 22 7.92449 22H4.53852C3.13626 22 2 20.8532 2 19.44V16.0255C2 14.6114 3.13626 13.4655 4.53852 13.4655ZM19.4615 13.4655H16.0755C14.6732 13.4655 13.537 14.6114 13.537 16.0255V19.44C13.537 20.8532 14.6732 22 16.0755 22H19.4615C20.8637 22 22 20.8532 22 19.44V16.0255C22 14.6114 20.8637 13.4655 19.4615 13.4655Z" fill="currentColor" />
          }
        }
      </svg>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .sidebar-header .logo-title {
        margin: 0 0 0 0.35rem;
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1.2;
        max-width: 8.5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sidebar:not(.sidebar-mini) .nav-link,
      .sidebar.sidebar-mini.sidebar-hover:hover .nav-link {
        min-height: 2.75rem;
        height: auto;
        align-items: center;
        justify-content: flex-start;
        white-space: normal;
      }

      .sidebar:not(.sidebar-mini) .nav-link .icon,
      .sidebar:not(.sidebar-mini) .nav-link .right-icon,
      .sidebar.sidebar-mini.sidebar-hover:hover .nav-link .icon,
      .sidebar.sidebar-mini.sidebar-hover:hover .nav-link .right-icon {
        flex: 0 0 auto;
      }

      .sidebar:not(.sidebar-mini) .nav-link .item-name,
      .sidebar.sidebar-mini.sidebar-hover:hover .nav-link .item-name {
        min-width: 0;
        display: inline;
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
        line-height: 1.25;
        word-break: normal;
        overflow-wrap: anywhere;
      }

      .sidebar:not(.sidebar-mini) .nav-link .right-icon,
      .sidebar.sidebar-mini.sidebar-hover:hover .nav-link .right-icon {
        display: inline-flex;
        margin-left: auto;
        align-self: center;
      }

      .sidebar.sidebar-mini:not(:hover) .nav-link {
        min-height: initial;
        height: var(--bs-nav-link-height, 2.75rem);
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }

      .sidebar.sidebar-mini:not(:hover) .nav-link .icon {
        margin: 0;
      }

      .sidebar.sidebar-mini:not(:hover) .nav-link .right-icon,
      .sidebar.sidebar-mini:not(:hover) .nav-link .item-name,
      .sidebar.sidebar-mini:not(:hover) .nav-link .sidenav-mini-icon,
      .sidebar.sidebar-mini:not(:hover) .static-item .default-icon,
      .sidebar.sidebar-mini:not(:hover) .static-item .mini-icon {
        display: none !important;
      }

      .sidebar.sidebar-mini:not(:hover) .sub-nav {
        display: none;
      }
    `,
  ],
})
export class TsAppSidebarComponent implements OnInit {
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);
  readonly layout = inject(ShellLayoutService);
  private readonly router = inject(Router);
  private readonly workflow = inject(SessionWorkflowService);
  private readonly i18n = inject(UiI18nService);

  readonly currentUrl = signal(this.router.url);
  readonly manuallyOpenGroup = signal<string | null>(null);
  readonly backendMenu = signal<MenuItemDto[] | null>(null);

  readonly homeLink = computed(() => ['/t', this.tenant.tenantSlug(), 'dashboard']);
  readonly miPlanLink = computed(() => ['/t', this.tenant.tenantSlug(), 'mi-plan']);
  readonly routerActiveExact = ROUTER_ACTIVE_EXACT;
  readonly routerActivePrefix = ROUTER_ACTIVE_PREFIX;
  readonly tieneEmpresaContexto = computed(() => !!this.session.profile()?.empresaId);

  readonly groups = computed<SidebarGroup[]>(() => {
    const dynamic = this.groupsFromBackendMenu();
    if (dynamic.length > 0) {
      return this.ensureVentasQuotationDesignMenu(
        this.ensureProveedoresSriDownloadMenu(this.ensureAdminDesignMenus(dynamic)),
      );
    }
    const slug = this.tenant.tenantSlug();
    const base = ['/t', slug];
    const adminVisible = this.session.puedeGestionarUsuariosEmpresa() || this.session.puedeConfiguracionTributaria();
    const canUsers = this.session.puedeGestionarUsuariosEmpresa();

    return [
          {
            id: 'administracion',
            label: 'Administracion',
            labelKey: 'menu.admin',
            icon: 'admin',
            visible: adminVisible,
            children: [
          { label: 'Empresa', labelKey: 'menu.company', link: [...base, 'admin', 'empresa'], visible: this.session.puedeConfiguracionTributaria() },
          { label: 'Diseno RIDE', labelKey: 'menu.rideDesign', link: [...base, 'admin', 'ride-diseno'], visible: this.session.puedeConfiguracionTributaria() },
          { label: 'Diseno correo', labelKey: 'menu.emailDesign', link: [...base, 'admin', 'correo-diseno'], visible: this.session.puedeConfiguracionTributaria() },
          { label: 'Sucursal y emision', labelKey: 'menu.branches', link: [...base, 'admin', 'sucursales'], visible: this.session.puedeConfiguracionTributaria() },
          { label: 'Usuarios', labelKey: 'menu.users', link: [...base, 'admin', 'usuarios'], visible: canUsers },
          { label: 'Invitaciones', labelKey: 'menu.invitations', link: [...base, 'admin', 'invitaciones'], visible: canUsers },
          { label: 'Roles', labelKey: 'menu.roles', link: [...base, 'admin', 'roles'], visible: canUsers },
          { label: 'API keys', labelKey: 'menu.apiKeys', link: [...base, 'integraciones', 'api-keys'], visible: this.session.puedeApiKeys() },
        ],
      },
          {
            id: 'ventas',
            label: 'Ventas',
            labelKey: 'menu.sales',
            icon: 'sales',
            children: [
          { label: 'Factura', labelKey: 'menu.invoices', link: [...base, 'facturas'] },
          { label: 'Cotizaciones', labelKey: 'menu.quotations', link: [...base, 'ventas', 'cotizaciones'] },
          {
            label: 'Diseno cotizacion',
            labelKey: 'menu.quotationDesign',
            link: [...base, 'ventas', 'cotizaciones', 'diseno'],
          },
          { label: 'Vendedores', labelKey: 'menu.salespeople', link: [...base, 'ventas', 'vendedores'] },
          { label: 'Notas credito', labelKey: 'menu.creditNotes', link: [...base, 'ventas', 'notas-credito'] },
          { label: 'Notas debito', labelKey: 'menu.debitNotes', link: [...base, 'ventas', 'notas-debito'] },
          { label: 'Guias', labelKey: 'menu.guides', link: [...base, 'ventas', 'guias'] },
          { label: 'Clientes', labelKey: 'menu.customers', link: [...base, 'clientes'], visible: this.session.puedeGestionarVentas() },
          { label: 'Productos', labelKey: 'menu.products', link: [...base, 'productos'], visible: this.session.puedeGestionarVentas() },
          { label: 'Servicios', labelKey: 'menu.services', link: [...base, 'servicios'], visible: this.session.puedeGestionarVentas() },
        ],
      },
          {
            id: 'proveedores',
            label: 'Proveedores',
            labelKey: 'menu.suppliers',
            icon: 'suppliers',
            children: [
          { label: 'Retenciones', labelKey: 'menu.withholdings', link: [...base, 'proveedores', 'retenciones'] },
          { label: 'Liquidaciones', labelKey: 'menu.purchaseSettlements', link: [...base, 'proveedores', 'liquidaciones'] },
          {
            label: 'Descarga SRI',
            labelKey: 'menu.sriDownload',
            link: [...base, 'proveedores', 'descarga-sri'],
            visible: this.session.puedeConfiguracionTributaria(),
          },
          { label: 'Proveedores', labelKey: 'menu.providers', link: [...base, 'proveedores'], visible: this.session.puedeGestionarProveedores() },
        ],
      },
          {
            id: 'reportes',
            label: 'Reportes',
            labelKey: 'menu.reports',
            icon: 'reports',
            children: [{ label: 'Reportes', labelKey: 'menu.reports', link: [...base, 'reportes'] }],
          },
        ];
      });

  readonly visibleGroups = computed(() =>
    this.groups()
      .map((group) => ({
        ...group,
        children: group.children.filter((child) => child.visible !== false),
      }))
      .filter((group) => group.visible !== false && group.children.length > 0),
  );

  readonly directItems = computed<SidebarDirectItem[]>(() => {
    const dynamic = this.directItemsFromBackendMenu();
    if (dynamic.length > 0) {
      return dynamic;
    }
    const slug = this.tenant.tenantSlug();
    const base = ['/t', slug];
    const items: SidebarDirectItem[] = [
      {
        label: 'Comprobantes electronicos',
        labelKey: 'menu.electronicDocuments',
        icon: 'monitor',
        link: [...base, 'comprobantes-electronicos'],
      },
      {
        label: 'Mi plan',
        labelKey: 'menu.plan',
        icon: 'plan',
        link: [...base, 'mi-plan'],
        visible: this.tieneEmpresaContexto(),
      },
    ];
    return items.filter((item) => item.visible !== false);
  });

  readonly brandLabel = computed(() => this.i18n.t('navbar.appBrand'));

  ngOnInit(): void {
    this.workflow.menu().subscribe({
      next: (items) => this.backendMenu.set(items),
      error: () => this.backendMenu.set(null),
    });

    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
      this.manuallyOpenGroup.set(null);
    });
  }

  toggleGroup(event: MouseEvent, group: SidebarGroup): void {
    event.preventDefault();
    const open = this.isGroupOpen(group);
    this.manuallyOpenGroup.set(open ? '' : group.id);
  }

  translateLabel(item: { label: string; labelKey?: string }): string {
    return item.labelKey ? this.i18n.t(item.labelKey, item.label) : item.label;
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  isGroupOpen(group: SidebarGroup): boolean {
    const manual = this.manuallyOpenGroup();
    if (manual !== null) {
      return manual === group.id;
    }
    return this.isGroupActive(group);
  }

  isGroupActive(group: SidebarGroup): boolean {
    return group.children.some((child) => this.isChildActive(child));
  }

  isChildActive(child: SidebarChild): boolean {
    return this.isBestMenuMatch(child.link, child.exact);
  }

  isDirectItemActive(item: SidebarDirectItem): boolean {
    return this.matchesRoute(item.link, item.exact);
  }

  private groupsFromBackendMenu(): SidebarGroup[] {
    const menu = this.backendMenu();
    if (!menu?.length) {
      return [];
    }
    return menu
      .filter((item) => (item.hijos?.length ?? 0) > 0)
      .sort((a, b) => a.orden - b.orden)
      .map((item) => ({
        id: this.menuId(item),
        label: item.fallbackLabel ?? item.etiqueta,
        labelKey: item.labelKey ?? this.labelKeyFromMenu(item),
        icon: this.iconFromMenu(item),
        children: (item.hijos ?? [])
          .filter((child) => !!child.rutaFront)
          .sort((a, b) => a.orden - b.orden)
          .map((child) => ({
            label: child.fallbackLabel ?? child.etiqueta,
            labelKey: child.labelKey ?? this.labelKeyFromMenu(child),
            link: routerLinkFromMenuPath(child.rutaFront, this.tenant.tenantSlug()) ?? this.homeLink(),
          })),
      }))
      .filter((group) => group.children.length > 0);
  }

  private directItemsFromBackendMenu(): SidebarDirectItem[] {
    const menu = this.backendMenu();
    if (!menu?.length) {
      return [];
    }
    return menu
      .filter((item) => !(item.hijos?.length) && !!item.rutaFront)
      .sort((a, b) => a.orden - b.orden)
      .map((item) => ({
        label: item.fallbackLabel ?? item.etiqueta,
        labelKey: item.labelKey ?? this.labelKeyFromMenu(item),
        icon: this.iconFromMenu(item),
        link: routerLinkFromMenuPath(item.rutaFront, this.tenant.tenantSlug()) ?? this.homeLink(),
      }));
  }

  private isBestMenuMatch(link: string[], exact?: boolean): boolean {
    if (!this.matchesRoute(link, exact)) {
      return false;
    }
    const currentLength = this.routePath(link).length;
    const bestLength = this.visibleGroups()
      .flatMap((group) => group.children.filter((child) => child.visible !== false))
      .filter((child) => this.matchesRoute(child.link, child.exact))
      .reduce((best, child) => Math.max(best, this.routePath(child.link).length), 0);
    return currentLength >= bestLength;
  }

  private matchesRoute(link: string[], exact?: boolean): boolean {
    const current = this.normalizeUrl(this.currentUrl());
    const path = this.routePath(link);
    if (exact) {
      return current === path;
    }
    return current === path || current.startsWith(`${path}/`);
  }

  private routePath(link: string[]): string {
    return this.normalizeUrl(link.join('/'));
  }

  private normalizeUrl(value: string): string {
    const clean = value.split('?')[0].split('#')[0].replace(/\/+$/, '');
    return clean.startsWith('/') ? clean : `/${clean}`;
  }

  private menuId(item: MenuItemDto): string {
    return (item.codigo || item.etiqueta).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  private iconFromMenu(item: MenuItemDto): SidebarIcon {
    const raw = `${item.icono ?? ''} ${item.codigo ?? ''} ${item.modulo ?? ''}`.toLowerCase();
    if (raw.includes('admin') || raw.includes('empresa') || raw.includes('sucursal') || raw.includes('rol')) {
      return 'admin';
    }
    if (raw.includes('venta') || raw.includes('factura') || raw.includes('guia') || raw.includes('nota')) {
      return 'sales';
    }
    if (
      raw.includes('proveedor') ||
      raw.includes('retencion') ||
      raw.includes('liquidacion') ||
      raw.includes('sri') ||
      raw.includes('descarga')
    ) {
      return 'suppliers';
    }
    if (raw.includes('reporte')) {
      return 'reports';
    }
    if (raw.includes('comprobante') || raw.includes('monitor')) {
      return 'monitor';
    }
    if (raw.includes('plan')) {
      return 'plan';
    }
    if (raw.includes('producto') || raw.includes('servicio')) {
      return 'products';
    }
    if (raw.includes('cliente')) {
      return 'clients';
    }
    return 'default';
  }

  /** Asegura entrada Descarga SRI cuando el menú viene de BD (sin esperar migración). */
  private ensureProveedoresSriDownloadMenu(groups: SidebarGroup[]): SidebarGroup[] {
    if (!this.session.puedeConfiguracionTributaria()) {
      return groups;
    }
    const base = ['/t', this.tenant.tenantSlug()];
    const sriChild: SidebarChild = {
      label: 'Descarga SRI recibidos',
      labelKey: 'menu.sriDownload',
      link: [...base, 'proveedores', 'descarga-sri'],
    };

    return groups.map((group) => {
      const isProveedores = group.id === 'proveedores' || group.labelKey === 'menu.suppliers';
      if (!isProveedores) {
        return group;
      }
      const children = [...group.children];
      if (children.some((c) => c.link.join('/').includes('descarga-sri'))) {
        return group;
      }
      const liquidacionesIdx = children.findIndex((c) => c.link.join('/').includes('liquidaciones'));
      const insertAt = liquidacionesIdx >= 0 ? liquidacionesIdx + 1 : children.length;
      children.splice(insertAt, 0, sriChild);
      return { ...group, children };
    });
  }

  /** Asegura diseño de cotización en Ventas cuando el menú viene de BD. */
  private ensureVentasQuotationDesignMenu(groups: SidebarGroup[]): SidebarGroup[] {
    const base = ['/t', this.tenant.tenantSlug()];
    const disenoChild: SidebarChild = {
      label: 'Diseno cotizacion',
      labelKey: 'menu.quotationDesign',
      link: [...base, 'ventas', 'cotizaciones', 'diseno'],
    };

    return groups.map((group) => {
      const isVentas = group.id === 'ventas' || group.labelKey === 'menu.sales';
      if (!isVentas) {
        return group;
      }
      const children = [...group.children];
      if (children.some((c) => c.link.join('/').includes('cotizaciones/diseno'))) {
        return group;
      }
      const cotIdx = children.findIndex((c) => c.link.join('/').includes('cotizaciones'));
      const insertAt = cotIdx >= 0 ? cotIdx + 1 : children.length;
      children.splice(insertAt, 0, disenoChild);
      return { ...group, children };
    });
  }

  /** Asegura diseño RIDE y correo cuando el menú viene de BD. */
  private ensureAdminDesignMenus(groups: SidebarGroup[]): SidebarGroup[] {
    if (!this.session.puedeConfiguracionTributaria()) {
      return groups;
    }
    const base = ['/t', this.tenant.tenantSlug()];
    const rideChild: SidebarChild = {
      label: 'Diseno RIDE',
      labelKey: 'menu.rideDesign',
      link: [...base, 'admin', 'ride-diseno'],
    };
    const emailChild: SidebarChild = {
      label: 'Diseno correo',
      labelKey: 'menu.emailDesign',
      link: [...base, 'admin', 'correo-diseno'],
    };

    return groups.map((group) => {
      const isAdmin = group.id === 'admin' || group.labelKey === 'menu.admin';
      if (!isAdmin) {
        return group;
      }
      const children = [...group.children];
      const empresaIdx = children.findIndex((c) => c.link.join('/').includes('/admin/empresa'));
      let insertAt = empresaIdx >= 0 ? empresaIdx + 1 : 0;
      if (!children.some((c) => c.link.join('/').includes('ride-diseno'))) {
        children.splice(insertAt, 0, rideChild);
        insertAt++;
      }
      if (!children.some((c) => c.link.join('/').includes('correo-diseno'))) {
        const rideIdx = children.findIndex((c) => c.link.join('/').includes('ride-diseno'));
        children.splice(rideIdx >= 0 ? rideIdx + 1 : insertAt, 0, emailChild);
      }
      return { ...group, children };
    });
  }

  private labelKeyFromMenu(item: MenuItemDto): string | undefined {
    const raw = `${item.codigo ?? ''} ${item.etiqueta ?? ''} ${item.rutaFront ?? ''}`.toLowerCase();
    if (raw.includes('correo-diseno') || raw.includes('email-design')) return 'menu.emailDesign';
    if (raw.includes('ride-diseno') || raw.includes('ride')) return 'menu.rideDesign';
    if (raw.includes('dashboard') || raw.includes('inicio')) return 'menu.home';
    if (raw.includes('cotizaciones/diseno') || raw.includes('cotizacion-diseno')) return 'menu.quotationDesign';
    if (raw.includes('cotizacion')) return 'menu.quotations';
    if (raw.includes('vendedor')) return 'menu.salespeople';
    if (raw.includes('factura')) return 'menu.invoices';
    if (raw.includes('notas-credito') || raw.includes('nota credito')) return 'menu.creditNotes';
    if (raw.includes('notas-debito') || raw.includes('nota debito')) return 'menu.debitNotes';
    if (raw.includes('guia')) return 'menu.guides';
    if (raw.includes('retencion')) return 'menu.withholdings';
    if (raw.includes('liquidacion')) return 'menu.purchaseSettlements';
    if (raw.includes('descarga-sri') || raw.includes('sri-descarga')) return 'menu.sriDownload';
    if (raw.includes('cliente')) return 'menu.customers';
    if (raw.includes('proveedor')) return 'menu.providers';
    if (raw.includes('producto')) return 'menu.products';
    if (raw.includes('servicio')) return 'menu.services';
    if (raw.includes('reporte')) return 'menu.reports';
    if (raw.includes('usuario')) return 'menu.users';
    if (raw.includes('rol')) return 'menu.roles';
    if (raw.includes('invit')) return 'menu.invitations';
    if (raw.includes('empresa')) return 'menu.company';
    if (raw.includes('sucursal') || raw.includes('emision')) return 'menu.branches';
    if (raw.includes('api')) return 'menu.apiKeys';
    if (raw.includes('plan')) return 'menu.plan';
    if (raw.includes('comprobante')) return 'menu.electronicDocuments';
    if (raw.includes('venta')) return 'menu.sales';
    if (raw.includes('admin')) return 'menu.admin';
    return undefined;
  }
}
