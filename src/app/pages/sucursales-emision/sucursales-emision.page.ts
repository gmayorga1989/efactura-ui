import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { gridActionsMenu } from '../../shared/ui/grid-actions.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorLocalGridComponent } from '../../shared/ui/organisms/ts-tabulator-local-grid/ts-tabulator-local-grid.component';

interface EstablecimientoDto {
  id: string;
  codigo: string;
  nombre: string | null;
  direccion: string | null;
  estado: string;
  tieneComprobantes?: boolean;
  tieneComprobantesEmitidos?: boolean;
  comprobantesEmitidos?: boolean;
  editableCodigo?: boolean;
  editableDireccion?: boolean;
  puedeEditarCodigo?: boolean;
  puedeEditarDireccion?: boolean;
}

interface PuntoDto {
  id: string;
  establecimientoId: string;
  codigo: string;
  nombre: string | null;
  establecimientoCodigo: string;
  estado: string;
  tieneComprobantes?: boolean;
  tieneComprobantesEmitidos?: boolean;
  comprobantesEmitidos?: boolean;
  editableCodigo?: boolean;
  puedeEditarCodigo?: boolean;
}

interface EstablecimientoForm {
  id: string | null;
  codigo: string;
  nombre: string;
  direccion: string;
}

interface PuntoForm {
  id: string | null;
  establecimientoId: string;
  codigo: string;
  nombre: string;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  danger: boolean;
  onConfirm: () => void;
}

@Component({
  selector: 'ts-sucursales-emision-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorLocalGridComponent],
  template: `
    <ts-page-layout
      [title]="t('branches.title')"
      [subtitle]="t('branches.subtitle')"
      [eyebrow]="t('users.eyebrow')"
    >
      <div page-actions>
        <button type="button" class="btn btn-soft-primary" (click)="reload()" [disabled]="loading()">{{ t('common.refresh') }}</button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>.
          } @else {
            {{ t('branches.companyRequired') }}
          }
        </p>
      } @else if (!session.puedeConfiguracionTributaria()) {
        <p class="text-muted mb-0">{{ t('branches.adminOnly') }}</p>
      } @else {
        <div class="ts-section-toolbar">
          <div class="ts-tabs" role="tablist" [attr.aria-label]="t('branches.taxMaintenance')">
            <button
              type="button"
              class="ts-tab"
              [class.active]="activeTab() === 'sucursales'"
              (click)="activeTab.set('sucursales')"
              role="tab"
              [attr.aria-selected]="activeTab() === 'sucursales'"
            >
              <svg class="icon-18" width="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 21V7.8C4 6.68 4 6.12 4.22 5.69C4.41 5.31 4.71 5.01 5.09 4.82C5.52 4.6 6.08 4.6 7.2 4.6H16.8C17.92 4.6 18.48 4.6 18.91 4.82C19.29 5.01 19.59 5.31 19.78 5.69C20 6.12 20 6.68 20 7.8V21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                <path d="M3 21H21M8 9H10M14 9H16M8 13H10M14 13H16M10 21V17H14V21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ t('branches.branches') }}</span>
            </button>
            <button
              type="button"
              class="ts-tab"
              [class.active]="activeTab() === 'emision'"
              (click)="activeTab.set('emision')"
              role="tab"
              [attr.aria-selected]="activeTab() === 'emision'"
            >
              <svg class="icon-18" width="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 8.5H17M7 12H13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                <path d="M5.5 19.5H18.5C19.6 19.5 20.5 18.6 20.5 17.5V6.5C20.5 5.4 19.6 4.5 18.5 4.5H5.5C4.4 4.5 3.5 5.4 3.5 6.5V17.5C3.5 18.6 4.4 19.5 5.5 19.5Z" stroke="currentColor" stroke-width="1.7" />
                <path d="M16.5 15.75H18.25M17.38 14.88V16.63" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
              <span>{{ t('branches.emissionPoints') }}</span>
            </button>
          </div>
        </div>

        @if (activeTab() === 'sucursales') {
          <div class="ts-grid-toolbar">
            <span>{{ t('branches.branchHelp') }}</span>
            <button type="button" class="btn btn-primary ts-primary-action" (click)="abrirSucursal()">{{ t('branches.newBranch') }}</button>
          </div>
          <ts-tabulator-local-grid
            [data]="establecimientosGrid()"
            [columns]="establecimientoColumns()"
            [reloadNonce]="gridNonce()"
            emptyContext="branches"
            height="430px"
            (rowAction)="onSucursalAction($event)"
          />
        } @else {
          <div class="ts-grid-toolbar">
            <span>{{ t('branches.pointHelp') }}</span>
            <button type="button" class="btn btn-primary ts-primary-action" (click)="abrirPunto()" [disabled]="!establecimientos().length">
              {{ t('branches.newPoint') }}
            </button>
          </div>
          <ts-tabulator-local-grid
            [data]="puntosGrid()"
            [columns]="puntoColumns()"
            [reloadNonce]="gridNonce()"
            emptyContext="emissionPoints"
            height="430px"
            (rowAction)="onPuntoAction($event)"
          />
        }

        @if (modal() === 'sucursal') {
          <div class="ts-modal-backdrop">
            <div class="ts-modal">
              <div class="ts-modal-header">
                <div class="ts-modal-heading">
                  <div class="ts-modal-icon" aria-hidden="true">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                      <path d="M4 20V8.2C4 7.08 4 6.52 4.22 6.09C4.41 5.71 4.71 5.41 5.09 5.22C5.52 5 6.08 5 7.2 5H16.8C17.92 5 18.48 5 18.91 5.22C19.29 5.41 19.59 5.71 19.78 6.09C20 6.52 20 7.08 20 8.2V20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                      <path d="M3 20H21M8 10H10M14 10H16M8 14H10M14 14H16M10 20V16.5H14V20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <span>{{ t('branches.establishment') }}</span>
                    <h5>{{ establecimientoForm.id ? t('branches.editBranch') : t('branches.newBranch') }}</h5>
                  </div>
                </div>
                <button type="button" class="ts-modal-close" (click)="cerrarModal()" [attr.aria-label]="t('common.close')">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
              <form class="ts-modal-form row g-2" (ngSubmit)="guardarEstablecimiento()">
                @if (sucursalBloqueada()) {
                  <div class="col-12">
                    <div class="alert alert-info py-2 mb-1">
                      {{ t('branches.branchLocked') }}
                    </div>
                  </div>
                }
                <div class="col-md-3">
                  <label class="form-label" for="est-codigo">{{ t('branches.code') }}</label>
                  <input
                    id="est-codigo"
                    class="form-control"
                    maxlength="3"
                    pattern="[0-9]{3}"
                    inputmode="numeric"
                    name="codigo"
                    [(ngModel)]="establecimientoForm.codigo"
                    [disabled]="sucursalBloqueada()"
                    required
                  />
                </div>
                <div class="col-md-9">
                  <label class="form-label" for="est-nombre">{{ t('branches.name') }}</label>
                  <input id="est-nombre" class="form-control" name="nombre" [(ngModel)]="establecimientoForm.nombre" required />
                </div>
                <div class="col-12">
                  <label class="form-label" for="est-dir">{{ t('branches.address') }}</label>
                  <input
                    id="est-dir"
                    class="form-control"
                    name="direccion"
                    [(ngModel)]="establecimientoForm.direccion"
                    [disabled]="sucursalBloqueada()"
                  />
                </div>
                <div class="col-12 ts-modal-footer">
                  <button type="button" class="btn btn-outline-secondary" (click)="cerrarModal()">{{ t('common.cancel') }}</button>
                  <button type="submit" class="btn btn-primary" [disabled]="loading()">{{ t('common.save') }}</button>
                </div>
              </form>
            </div>
          </div>
        }

        @if (modal() === 'punto') {
          <div class="ts-modal-backdrop">
            <div class="ts-modal">
              <div class="ts-modal-header">
                <div class="ts-modal-heading">
                  <div class="ts-modal-icon" aria-hidden="true">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                      <path d="M7 8.5H17M7 12H13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                      <path d="M5.5 19.5H18.5C19.6 19.5 20.5 18.6 20.5 17.5V6.5C20.5 5.4 19.6 4.5 18.5 4.5H5.5C4.4 4.5 3.5 5.4 3.5 6.5V17.5C3.5 18.6 4.4 19.5 5.5 19.5Z" stroke="currentColor" stroke-width="1.75" />
                      <path d="M16.5 15.75H18.25M17.38 14.88V16.63" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                    </svg>
                  </div>
                  <div>
                    <span>{{ t('branches.emissionPoint') }}</span>
                    <h5>{{ puntoForm.id ? t('branches.editPoint') : t('branches.newEmissionPoint') }}</h5>
                  </div>
                </div>
                <button type="button" class="ts-modal-close" (click)="cerrarModal()" [attr.aria-label]="t('common.close')">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
              <form class="ts-modal-form row g-2" (ngSubmit)="guardarPunto()">
                @if (puntoBloqueado()) {
                  <div class="col-12">
                    <div class="alert alert-info py-2 mb-1">
                      {{ t('branches.pointLocked') }}
                    </div>
                  </div>
                }
                <div class="col-md-6">
                  <label class="form-label" for="pto-est">{{ t('branches.branch') }}</label>
                  <select
                    id="pto-est"
                    class="form-select"
                    name="establecimientoId"
                    [(ngModel)]="puntoForm.establecimientoId"
                    [disabled]="!!puntoForm.id"
                    required
                  >
                    <option value="">{{ t('common.select') }}</option>
                    @for (e of establecimientos(); track e.id) {
                      <option [value]="e.id">{{ e.codigo }} - {{ e.nombre || t('branches.branch') }}</option>
                    }
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="form-label" for="pto-codigo">{{ t('branches.code') }}</label>
                  <input
                    id="pto-codigo"
                    class="form-control"
                    maxlength="3"
                    pattern="[0-9]{3}"
                    inputmode="numeric"
                    name="codigo"
                    [(ngModel)]="puntoForm.codigo"
                    [disabled]="puntoBloqueado()"
                    required
                  />
                </div>
                <div class="col-md-3">
                  <label class="form-label" for="pto-nombre">{{ t('branches.name') }}</label>
                  <input id="pto-nombre" class="form-control" name="nombre" [(ngModel)]="puntoForm.nombre" required />
                </div>
                <div class="col-12 ts-modal-footer">
                  <button type="button" class="btn btn-outline-secondary" (click)="cerrarModal()">{{ t('common.cancel') }}</button>
                  <button type="submit" class="btn btn-primary" [disabled]="loading()">{{ t('common.save') }}</button>
                </div>
              </form>
            </div>
          </div>
        }

        @if (confirmState(); as confirm) {
          <div class="ts-modal-backdrop">
            <div class="ts-confirm-modal">
              <div class="ts-confirm-icon" [class.ts-confirm-icon--danger]="confirm.danger" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9V13M12 17H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M10.29 4.86L2.82 17.5C2.11 18.7 2.98 20.2 4.37 20.2H19.63C21.02 20.2 21.89 18.7 21.18 17.5L13.71 4.86C13.02 3.7 10.98 3.7 10.29 4.86Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                </svg>
              </div>
              <h5>{{ confirm.title }}</h5>
              <p>{{ confirm.message }}</p>
              <div class="ts-confirm-actions">
                <button type="button" class="btn btn-outline-secondary" (click)="closeConfirm()">{{ t('common.cancel') }}</button>
                <button type="button" class="btn btn-primary" [class.btn-danger]="confirm.danger" (click)="acceptConfirm()">
                  {{ confirm.confirmText }}
                </button>
              </div>
            </div>
          </div>
        }
      }
    </ts-page-layout>
  `,
  styles: [
    `
      .ts-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1080;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgba(15, 23, 42, 0.48);
        backdrop-filter: blur(3px);
      }

      .ts-modal {
        width: min(660px, 100%);
        border-radius: 8px;
        background: #ffffff;
        overflow: hidden;
        border: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
      }

      .ts-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.15rem 0.85rem;
        border-bottom: 1px solid #edf1f7;
        background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      }

      .ts-modal-heading {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 0.7rem;
      }

      .ts-modal-icon {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        flex: 0 0 2.25rem;
        border: 1px solid #dfe7ff;
        border-radius: 8px;
        background: linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
        color: #3a57e8;
      }

      .ts-modal-header span {
        display: block;
        margin-bottom: 0.18rem;
        color: #8a92a6;
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
      }

      .ts-modal-header h5 {
        margin: 0;
        color: #1f2937;
        font-size: 1.05rem;
        font-weight: 650;
        line-height: 1.2;
      }

      .ts-modal-close {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border: 1px solid #e1e7f0;
        border-radius: 6px;
        background: #ffffff;
        color: #667085;
        transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
      }

      .ts-modal-close:hover {
        border-color: rgba(58, 87, 232, 0.3);
        background-color: #eef3ff !important;
        color: #2f46c0;
      }

      .ts-confirm-modal {
        width: min(390px, 100%);
        border: 1px solid rgba(226, 232, 240, 0.95);
        border-radius: 8px;
        background: #ffffff;
        padding: 1.15rem;
        text-align: center;
        box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
      }

      .ts-confirm-icon {
        display: grid;
        place-items: center;
        width: 2.75rem;
        height: 2.75rem;
        margin: 0 auto 0.75rem;
        border: 1px solid #dfe7ff;
        border-radius: 8px;
        background: #eef3ff;
        color: #3a57e8;
      }

      .ts-confirm-icon--danger {
        border-color: #fee2e2;
        background: #fff1f2;
        color: #dc2626;
      }

      .ts-confirm-modal h5 {
        margin: 0;
        color: #1f2937;
        font-size: 1.02rem;
        font-weight: 650;
      }

      .ts-confirm-modal p {
        margin: 0.45rem 0 1rem;
        color: #667085;
        font-size: 0.88rem;
        line-height: 1.35;
      }

      .ts-confirm-actions {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
      }

      .ts-modal-form {
        padding: 1rem 1.15rem 1.1rem;
      }

      .ts-modal-form .form-label {
        margin-bottom: 0.32rem;
        color: #667085;
        font-size: 0.82rem;
        font-weight: 600;
      }

      .ts-modal-form .form-control,
      .ts-modal-form .form-select {
        min-height: 2.35rem;
        border-color: #e1e7f0;
        border-radius: 6px;
        color: #26324d;
        font-size: 0.92rem;
      }

      .ts-modal-form .form-control:focus,
      .ts-modal-form .form-select:focus {
        border-color: rgba(58, 87, 232, 0.55);
        box-shadow: 0 0 0 0.16rem rgba(58, 87, 232, 0.1);
      }

      .ts-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding-top: 0.55rem;
      }

      .ts-section-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.7rem;
      }

      .ts-tabs {
        display: inline-flex;
        gap: 0.25rem;
        padding: 0.25rem;
        border: 1px solid #e4e9f2;
        border-radius: 8px;
        background: #f7f9fd;
      }

      .ts-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-height: 2.1rem;
        padding: 0 0.72rem;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #536179;
        font-weight: 600;
        white-space: nowrap;
      }

      .ts-tab:hover {
        background: #eef3ff;
        color: #2f46c0;
      }

      .ts-tab.active {
        background: #3a57e8;
        color: #ffffff;
        box-shadow: 0 8px 18px rgba(58, 87, 232, 0.2);
      }

      .ts-grid-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.55rem;
        color: #7b879a;
        font-size: 0.84rem;
      }

      .ts-primary-action {
        min-height: 2rem;
        padding-right: 0.78rem;
        padding-left: 0.78rem;
        border-radius: 6px;
        font-size: 0.84rem;
        font-weight: 600;
      }

      @media (max-width: 575.98px) {
        .d-flex.justify-content-between {
          align-items: stretch !important;
          flex-direction: column;
        }

        .ts-grid-toolbar {
          align-items: stretch;
          flex-direction: column;
        }

        .ts-tabs {
          width: 100%;
        }

        .ts-tab {
          flex: 1;
          justify-content: center;
        }
      }
    `,
  ],
})
export class SucursalesEmisionPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly loading = signal(false);
  readonly activeTab = signal<'sucursales' | 'emision'>('sucursales');
  readonly modal = signal<'sucursal' | 'punto' | null>(null);
  readonly establecimientos = signal<EstablecimientoDto[]>([]);
  readonly puntos = signal<PuntoDto[]>([]);
  readonly gridNonce = signal(0);
  readonly sucursalBloqueada = signal(false);
  readonly puntoBloqueado = signal(false);
  readonly confirmState = signal<ConfirmState | null>(null);

  establecimientoForm: EstablecimientoForm = this.emptyEstablecimiento();
  puntoForm: PuntoForm = this.emptyPunto();

  readonly establecimientosGrid = signal<Record<string, unknown>[]>([]);
  readonly puntosGrid = signal<Record<string, unknown>[]>([]);

  readonly establecimientoColumns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    return [
      {
        title: '',
        field: 'id',
        width: 64,
        headerSort: false,
        hozAlign: 'center',
        formatter: (cell: unknown) => this.actionMenuFormatter(this.cellRow<EstablecimientoDto>(cell).estado),
      },
      { title: this.t('branches.code'), field: 'codigo', width: 100 },
      { title: this.t('branches.branch'), field: 'nombre', minWidth: 220 },
      { title: this.t('branches.address'), field: 'direccion', minWidth: 260 },
      { title: this.t('common.status'), field: 'estado', width: 120, formatter: (cell: unknown) => this.estadoFormatter(this.cellValue(cell)) },
    ];
  });

  readonly puntoColumns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    return [
      {
        title: '',
        field: 'id',
        width: 64,
        headerSort: false,
        hozAlign: 'center',
        formatter: (cell: unknown) => this.actionMenuFormatter(this.cellRow<PuntoDto>(cell).estado),
      },
      { title: this.t('branches.branch'), field: 'establecimientoCodigo', width: 120 },
      { title: this.t('branches.code'), field: 'codigo', width: 100 },
      { title: this.t('branches.name'), field: 'nombre', minWidth: 220 },
      { title: this.t('common.status'), field: 'estado', width: 120, formatter: (cell: unknown) => this.estadoFormatter(this.cellValue(cell)) },
    ];
  });

  t(key: string): string {
    return this.i18n.t(key);
  }

  ngOnInit(): void {
    const defaultTab = this.route.snapshot.data['defaultTab'];
    if (defaultTab === 'emision' || defaultTab === 'sucursales') {
      this.activeTab.set(defaultTab);
    }
    if (this.tokenPresent && this.tieneEmpresa && this.session.puedeConfiguracionTributaria()) {
      this.reload();
    }
  }

  reload(): void {
    this.loading.set(true);
    this.http.get<EstablecimientoDto[]>('/api/web/v1/tributario/establecimientos').subscribe({
      next: (list) => {
        this.establecimientos.set(list);
        this.establecimientosGrid.set(list as unknown as Record<string, unknown>[]);
        if (!list.length) {
          this.puntos.set([]);
          this.puntosGrid.set([]);
          this.loading.set(false);
          return;
        }
        forkJoin(
          list.map((e) =>
            this.http
              .get<PuntoDto[]>(`/api/web/v1/tributario/establecimientos/${e.id}/puntos-emision`)
              .pipe(catchError(() => of([] as PuntoDto[]))),
          ),
        ).subscribe({
          next: (results) => {
            const puntos = results.flat();
            this.puntos.set(puntos);
            this.puntosGrid.set(puntos as unknown as Record<string, unknown>[]);
            this.gridNonce.update((n) => n + 1);
            this.loading.set(false);
          },
          error: (err: HttpErrorResponse) => this.fail(err),
        });
      },
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  abrirSucursal(row?: EstablecimientoDto): void {
    this.showMsg('', true);
    if (!row) {
      this.sucursalBloqueada.set(false);
      this.establecimientoForm = this.emptyEstablecimiento();
      this.modal.set('sucursal');
      return;
    }
    this.loading.set(true);
    this.http.get<EstablecimientoDto>(`/api/web/v1/tributario/establecimientos/${row.id}`).subscribe({
      next: (detail) => {
        const current = { ...row, ...detail };
        this.loading.set(false);
        this.sucursalBloqueada.set(this.hasComprobantes(current) || !this.canEditSucursalCodes(current));
        this.establecimientoForm = {
          id: current.id,
          codigo: current.codigo,
          nombre: current.nombre ?? '',
          direccion: current.direccion ?? '',
        };
        this.modal.set('sucursal');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.showMsg(extractApiErrorMessage(err, this.t('branches.loadBranchError')), false);
      },
    });
  }

  abrirPunto(row?: PuntoDto): void {
    this.showMsg('', true);
    if (!row) {
      this.puntoBloqueado.set(false);
      this.puntoForm = this.emptyPunto();
      this.modal.set('punto');
      return;
    }
    this.loading.set(true);
    const base = `/api/web/v1/tributario/establecimientos/${row.establecimientoId}/puntos-emision`;
    this.http.get<PuntoDto>(`${base}/${row.id}`).subscribe({
      next: (detail) => {
        const current = { ...row, ...detail };
        this.loading.set(false);
        this.puntoBloqueado.set(this.hasComprobantes(current) || !this.canEditPuntoCode(current));
        this.puntoForm = {
          id: current.id,
          establecimientoId: current.establecimientoId,
          codigo: current.codigo,
          nombre: current.nombre ?? '',
        };
        this.modal.set('punto');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.showMsg(extractApiErrorMessage(err, this.t('branches.loadPointError')), false);
      },
    });
  }

  cerrarModal(): void {
    this.modal.set(null);
  }

  onSucursalAction(event: { action: string; row: Record<string, unknown> }): void {
    const row = event.row as unknown as EstablecimientoDto;
    if (event.action === 'edit') {
      this.abrirSucursal(row);
      return;
    }
    if (event.action === 'activate' || event.action === 'inactivate') {
      this.cambiarEstadoSucursal(row, event.action === 'activate' ? 'ACTIVO' : 'INACTIVO');
    }
  }

  onPuntoAction(event: { action: string; row: Record<string, unknown> }): void {
    const row = event.row as unknown as PuntoDto;
    if (event.action === 'edit') {
      this.abrirPunto(row);
      return;
    }
    if (event.action === 'activate' || event.action === 'inactivate') {
      this.cambiarEstadoPunto(row, event.action === 'activate' ? 'ACTIVO' : 'INACTIVO');
    }
  }

  guardarEstablecimiento(): void {
    const body = {
      codigo: this.codigo3(this.establecimientoForm.codigo),
      nombre: this.establecimientoForm.nombre.trim() || null,
      direccion: this.establecimientoForm.direccion.trim() || null,
    };
    if (!body.nombre) {
      this.showMsg(this.t('branches.nameRequired'), false);
      return;
    }
    if (!this.establecimientoForm.id && !body.codigo) {
      this.showMsg(this.t('branches.codeRequired'), false);
      return;
    }
    if (!(this.establecimientoForm.id && this.sucursalBloqueada()) && !body.codigo) {
      this.showMsg(this.t('branches.codeRequired'), false);
      return;
    }
    this.loading.set(true);
    const req = this.establecimientoForm.id
      ? this.http.patch(
          `/api/web/v1/tributario/establecimientos/${this.establecimientoForm.id}`,
          this.sucursalBloqueada() ? { nombre: body.nombre } : body,
        )
      : this.http.post('/api/web/v1/tributario/establecimientos', body);
    req.subscribe({
      next: () => {
        this.loading.set(false);
        this.cerrarModal();
        this.showMsg(this.t('branches.branchSaved'), true);
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.showMsg(extractApiErrorMessage(err, this.t('branches.saveBranchError')), false);
      },
    });
  }

  guardarPunto(): void {
    const establecimientoId = this.puntoForm.establecimientoId;
    const body = {
      codigo: this.codigo3(this.puntoForm.codigo),
      nombre: this.puntoForm.nombre.trim() || null,
    };
    if (!establecimientoId) {
      this.showMsg(this.t('branches.selectBranch'), false);
      return;
    }
    if (!body.nombre) {
      this.showMsg(this.t('branches.pointNameRequired'), false);
      return;
    }
    if (!this.puntoForm.id && !body.codigo) {
      this.showMsg(this.t('branches.pointCodeRequired'), false);
      return;
    }
    if (!(this.puntoForm.id && this.puntoBloqueado()) && !body.codigo) {
      this.showMsg(this.t('branches.codeRequired'), false);
      return;
    }
    this.loading.set(true);
    const base = `/api/web/v1/tributario/establecimientos/${establecimientoId}/puntos-emision`;
    const req = this.puntoForm.id
      ? this.http.patch(`${base}/${this.puntoForm.id}`, this.puntoBloqueado() ? { nombre: body.nombre } : body)
      : this.http.post(base, body);
    req.subscribe({
      next: () => {
        this.loading.set(false);
        this.cerrarModal();
        this.showMsg(this.t('branches.pointSaved'), true);
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.showMsg(extractApiErrorMessage(err, this.t('branches.savePointError')), false);
      },
    });
  }

  cambiarEstadoSucursal(row: EstablecimientoDto, estado: 'ACTIVO' | 'INACTIVO'): void {
    if (estado === 'INACTIVO') {
      this.openConfirm({
        title: this.t('branches.inactivateBranchTitle'),
        message: this.i18n.t('branches.inactivateBranchMessage', { codigo: row.codigo }),
        confirmText: this.t('common.inactivate'),
        danger: true,
        onConfirm: () => this.patchEstadoSucursal(row, estado),
      });
      return;
    }
    this.patchEstadoSucursal(row, estado);
  }

  cambiarEstadoPunto(row: PuntoDto, estado: 'ACTIVO' | 'INACTIVO'): void {
    if (estado === 'INACTIVO') {
      this.openConfirm({
        title: this.t('branches.inactivatePointTitle'),
        message: this.i18n.t('branches.inactivatePointMessage', { codigo: row.codigo }),
        confirmText: this.t('common.inactivate'),
        danger: true,
        onConfirm: () => this.patchEstadoPunto(row, estado),
      });
      return;
    }
    this.patchEstadoPunto(row, estado);
  }

  openConfirm(state: ConfirmState): void {
    this.confirmState.set(state);
  }

  closeConfirm(): void {
    this.confirmState.set(null);
  }

  acceptConfirm(): void {
    const state = this.confirmState();
    if (!state) {
      return;
    }
    this.confirmState.set(null);
    state.onConfirm();
  }

  private patchEstadoSucursal(row: EstablecimientoDto, estado: 'ACTIVO' | 'INACTIVO'): void {
    this.loading.set(true);
    this.http.patch(`/api/web/v1/tributario/establecimientos/${row.id}/estado`, { estado }).subscribe({
      next: () => {
        this.loading.set(false);
        this.showMsg(estado === 'ACTIVO' ? this.t('branches.branchActivated') : this.t('branches.branchInactivated'), true);
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.showMsg(extractApiErrorMessage(err, this.t('branches.statusBranchError')), false);
      },
    });
  }

  private patchEstadoPunto(row: PuntoDto, estado: 'ACTIVO' | 'INACTIVO'): void {
    this.loading.set(true);
    const base = `/api/web/v1/tributario/establecimientos/${row.establecimientoId}/puntos-emision`;
    this.http.patch(`${base}/${row.id}/estado`, { estado }).subscribe({
      next: () => {
        this.loading.set(false);
        this.showMsg(estado === 'ACTIVO' ? this.t('branches.pointActivated') : this.t('branches.pointInactivated'), true);
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.showMsg(extractApiErrorMessage(err, this.t('branches.statusPointError')), false);
      },
    });
  }

  private fail(err: HttpErrorResponse): void {
    this.loading.set(false);
    this.showMsg(extractApiErrorMessage(err, this.t('branches.loadError')), false);
  }

  private emptyEstablecimiento(): EstablecimientoForm {
    return { id: null, codigo: '', nombre: '', direccion: '' };
  }

  private emptyPunto(): PuntoForm {
    return { id: null, establecimientoId: this.establecimientos()[0]?.id ?? '', codigo: '', nombre: '' };
  }

  private codigo3(value: string): string {
    const clean = value.trim();
    return /^\d{3}$/.test(clean) ? clean : '';
  }

  private showMsg(text: string, ok: boolean): void {
    const textTrim = text.trim();
    if (!textTrim) {
      return;
    }
    if (ok) {
      this.toast.success(textTrim);
    } else {
      this.toast.error(textTrim);
    }
  }

  private actionMenuFormatter(estado?: string): string {
    const active = estado !== 'INACTIVO';
    return gridActionsMenu(
      [
        { action: 'edit', label: this.t('common.edit'), icon: 'edit' },
        active
          ? { action: 'inactivate', label: this.t('common.inactivate'), icon: 'inactivate', danger: true }
          : { action: 'activate', label: this.t('common.activate'), icon: 'activate' },
      ],
      'Acciones',
    );
  }

  private estadoFormatter(value: unknown): string {
    const estado = String(value ?? '').toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const cls = estado === 'ACTIVO' ? 'text-bg-success' : 'text-bg-secondary';
    return `<span class="badge ${cls}">${estado}</span>`;
  }

  private cellValue(cell: unknown): unknown {
    return (cell as { getValue?: () => unknown }).getValue?.();
  }

  private cellRow<T>(cell: unknown): Partial<T> {
    const row = (cell as { getRow?: () => { getData?: () => T } }).getRow?.();
    return row?.getData?.() ?? {};
  }

  private hasComprobantes(row: EstablecimientoDto | PuntoDto): boolean {
    return !!(row.tieneComprobantes || row.tieneComprobantesEmitidos || row.comprobantesEmitidos);
  }

  private canEditSucursalCodes(row: EstablecimientoDto): boolean {
    if (row.editableCodigo === false || row.editableDireccion === false) {
      return false;
    }
    if (row.puedeEditarCodigo === false || row.puedeEditarDireccion === false) {
      return false;
    }
    return true;
  }

  private canEditPuntoCode(row: PuntoDto): boolean {
    if (row.editableCodigo === false || row.puedeEditarCodigo === false) {
      return false;
    }
    return true;
  }
}
