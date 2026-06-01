import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorSpringGridComponent } from '../../shared/ui/organisms/ts-tabulator-spring-grid/ts-tabulator-spring-grid.component';
import { gridActionsMenu } from '../../shared/ui/grid-actions.util';
import {
  maestroErrorMessage,
  MaestrosService,
  type ClienteProveedor,
  type MaestroEntidadTipo,
  type ProductoImportResult,
  type ProductoServicio,
  type ProductoServicioTipo,
} from './maestros.service';

interface MaestroListConfig {
  title: string;
  subtitle: string;
  eyebrow: string;
  tipo: MaestroEntidadTipo;
  clase: 'cliente' | 'producto';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Component({
  selector: 'ts-maestro-list-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorSpringGridComponent],
  template: `
    <ts-page-layout [title]="listTitle()" [subtitle]="listSubtitle()" [eyebrow]="t('masters.eyebrow')">
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-primary" [routerLink]="['/t', tenant.tenantSlug(), config().tipo, 'nuevo']">{{ t('common.create') }}</a>
        @if (config().clase === 'producto') {
          <button type="button" class="btn btn-soft-primary" (click)="abrirImportModal()">{{ t('masters.importFromTemplate') }}</button>
        }
        <button type="button" class="btn btn-soft-primary" (click)="refrescar()" [disabled]="loading()">{{ t('common.refresh') }}</button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('common.toContinue') }}
          } @else {
            {{ t('masters.companyRequired') }}
          }
        </p>
      } @else {
        @if (config().clase === 'cliente') {
          <div class="maestro-filters">
            <label class="maestro-filter maestro-filter--grow">
              <span>{{ t('common.search') }}</span>
              <input
                class="form-control form-control-sm"
                [ngModel]="q()"
                (ngModelChange)="q.set($event)"
                name="q"
                [placeholder]="t('masters.searchPlaceholder')"
                (keyup.enter)="aplicarFiltros()"
              />
            </label>
            <label class="maestro-filter">
              <span>{{ t('common.status') }}</span>
              <select class="form-select form-select-sm" [ngModel]="estado()" (ngModelChange)="estado.set($event); aplicarFiltros()" name="estado">
                <option value="">{{ t('common.all') }}</option>
                <option value="ACTIVO">{{ t('common.active') }}</option>
                <option value="INACTIVO">{{ t('common.inactive') }}</option>
              </select>
            </label>
            <label class="maestro-filter">
              <span>{{ t('masters.thirdPartyType') }}</span>
              <select class="form-select form-select-sm" [ngModel]="tipoTercero()" (ngModelChange)="tipoTercero.set($event); aplicarFiltros()" name="tipoTercero">
                <option [value]="defaultTipoTercero()">{{ t('masters.base') }}</option>
                <option value="AMBOS">{{ t('masters.both') }}</option>
                <option value="">{{ t('common.all') }}</option>
              </select>
            </label>
            <button type="button" class="btn btn-soft-primary btn-sm" (click)="aplicarFiltros()">{{ t('common.filter') }}</button>
          </div>
        }

        <ts-tabulator-spring-grid
          [ajaxUrl]="endpoint()"
          [ajaxParams]="ajaxParams()"
          [columns]="columns()"
          [reloadNonce]="gridNonce()"
          emptyContext="masters"
          height="min(620px, calc(100vh - 15.5rem))"
          (rowAction)="onRowAction($event)"
        />
      }
    </ts-page-layout>

    @if (importModalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarImportModal()"></div>
      <section class="ts-form-modal ts-form-modal--import" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
        <header class="ts-form-modal__header ts-form-modal__header--compact">
          <div class="ts-form-modal__head-text">
            <h3 id="import-modal-title" class="mb-0">{{ t('masters.importModalTitle') }}</h3>
            <p class="ts-form-modal__subtitle mb-0">{{ t('masters.importModalHint') }}</p>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarImportModal()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
          </button>
        </header>
        <div class="ts-form-modal__body ts-import-modal-body">
          <div class="ts-import-modal-actions">
            <button type="button" class="btn btn-light btn-sm" (click)="descargarPlantilla()" [disabled]="importLoading()">
              {{ t('masters.downloadTemplate') }}
            </button>
          </div>
          <label class="ts-import-file-label">
            <span>{{ t('masters.uploadTemplate') }}</span>
            <input
              type="file"
              class="form-control form-control-sm"
              accept=".csv,text/csv,text/plain"
              (change)="onImportFileSelected($event)"
              [disabled]="importLoading()"
            />
            @if (importFileName()) {
              <span class="ts-import-file-name">{{ importFileName() }}</span>
            }
          </label>
          @if (importResult()) {
            <p class="ts-import-summary mb-2" [class.text-danger]="importResult()!.errores > 0">
              {{
                t('masters.importSummary', {
                  total: importResult()!.totalFilas,
                  creados: importResult()!.creados,
                  actualizados: importResult()!.actualizados,
                  errores: importResult()!.errores,
                })
              }}
            </p>
            @if (importResult()!.detalles.length) {
              <div class="ts-import-details-wrap">
                <table class="table table-sm table-bordered mb-0 ts-import-details">
                  <thead>
                    <tr>
                      <th>{{ t('masters.importRow') }}</th>
                      <th>{{ t('masters.importCode') }}</th>
                      <th>{{ t('masters.importStatus') }}</th>
                      <th>{{ t('masters.importMessage') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of importResult()!.detalles; track d.fila + (d.codigoPrincipal ?? '')) {
                      <tr [class.table-danger]="d.estado === 'ERROR'">
                        <td>{{ d.fila }}</td>
                        <td>{{ d.codigoPrincipal ?? '—' }}</td>
                        <td>{{ d.estado }}</td>
                        <td>{{ d.mensaje }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        </div>
        <footer class="ts-form-modal__footer ts-import-modal-footer">
          <button type="button" class="btn btn-light" (click)="cerrarImportModal()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-primary" (click)="ejecutarImportacion()" [disabled]="importLoading() || !importFile()">
            {{ importLoading() ? t('common.loading') : t('masters.importRun') }}
          </button>
        </footer>
      </section>
    }

    @if (deleteConfirmId(); as id) {
      <div class="ts-modal-backdrop" (click)="cancelarEliminar()"></div>
      <section class="ts-confirm-modal" role="alertdialog" aria-modal="true">
        <h3>{{ t('common.delete') }}</h3>
        <p>{{ t('masters.deleteConfirm') }}</p>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-light btn-sm" (click)="cancelarEliminar()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-danger btn-sm" (click)="confirmarEliminar(id)">{{ t('common.delete') }}</button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .maestro-filters {
        display: flex;
        align-items: end;
        gap: 0.65rem;
        flex-wrap: wrap;
        margin-bottom: 0.8rem;
        padding: 0.72rem;
        background: var(--card);
        border: 1px solid var(--ef-surface-border, #e2e8f0);
        border-radius: 12px;
        box-shadow: var(--ef-surface-shadow);
      }
      .maestro-filter {
        display: grid;
        gap: 0.25rem;
        min-width: 150px;
        margin: 0;
      }
      .maestro-filter--grow {
        flex: 1 1 260px;
      }
      .maestro-filter span {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 750;
        text-transform: uppercase;
      }
      .ts-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1090;
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(3px);
      }
      .ts-form-modal {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(720px, calc(100vw - 2rem));
        background: var(--card);
        border: 1px solid var(--ef-surface-border);
        border-radius: 16px;
        box-shadow: var(--ef-surface-shadow);
        overflow: hidden;
        color: var(--text);
      }
      .ts-form-modal--import {
        width: min(560px, calc(100vw - 2rem));
      }
      .ts-form-modal__header {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.9rem 1rem;
        border-bottom: 1px solid rgba(226, 232, 240, 0.95);
        background: var(--ef-page-header-bg, linear-gradient(180deg, #ffffff 0%, #f8fafc 100%));
        border-bottom-color: var(--ef-divider);
      }
      .ts-form-modal__head-text {
        flex: 1;
        min-width: 0;
      }
      .ts-form-modal__header h3 {
        margin: 0;
        color: #0f172a;
        font-size: 1rem;
        font-weight: 700;
      }
      .ts-form-modal__subtitle {
        margin-top: 0.2rem;
        color: #64748b;
        font-size: 0.78rem;
        line-height: 1.35;
      }
      .ts-form-modal__close {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        margin-left: auto;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid rgba(203, 213, 225, 0.95);
        border-radius: 10px;
        color: #64748b;
        background: #fff;
        line-height: 0;
        cursor: pointer;
      }
      .ts-form-modal__close:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
      .ts-form-modal__close svg {
        width: 17px;
        height: 17px;
      }
      .ts-form-modal__body {
        padding: 1rem 1.1rem;
      }
      .ts-import-modal-body {
        display: grid;
        gap: 0.85rem;
      }
      .ts-import-modal-actions {
        display: flex;
        justify-content: flex-start;
      }
      .ts-import-file-label {
        display: grid;
        gap: 0.35rem;
        margin: 0;
      }
      .ts-import-file-label > span {
        color: #475569;
        font-size: 0.76rem;
        font-weight: 750;
      }
      .ts-import-file-name {
        font-size: 0.78rem;
        color: #64748b;
      }
      .ts-import-summary {
        font-size: 0.84rem;
        color: #0f766e;
        font-weight: 600;
      }
      .ts-import-details-wrap {
        max-height: 220px;
        overflow: auto;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
      }
      .ts-import-details {
        font-size: 0.78rem;
      }
      .ts-form-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.85rem 1.1rem 1.05rem;
      }
      .ts-confirm-modal {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(420px, calc(100vw - 2rem));
        padding: 1rem 1.1rem;
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
      }
      .ts-confirm-modal h3 {
        margin: 0 0 0.45rem;
        color: #0f172a;
        font-size: 1rem;
        font-weight: 700;
      }
      .ts-confirm-modal p {
        margin: 0 0 0.9rem;
        color: #64748b;
        font-size: 0.88rem;
      }
    `,
  ],
})
export class MaestroListPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly maestros = inject(MaestrosService);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly loading = signal(false);
  readonly deleteConfirmId = signal<string | null>(null);
  readonly gridNonce = signal(0);
  readonly q = signal('');
  readonly estado = signal('ACTIVO');
  readonly tipoTercero = signal('');
  readonly config = signal<MaestroListConfig>({
    title: 'Maestro',
    subtitle: '',
    eyebrow: 'Maestros',
    tipo: 'clientes',
    clase: 'cliente',
  });
  readonly importModalOpen = signal(false);
  readonly importLoading = signal(false);
  readonly importFile = signal<File | null>(null);
  readonly importFileName = signal('');
  readonly importResult = signal<ProductoImportResult | null>(null);

  readonly endpoint = computed(() => this.maestros.endpoint(this.config().tipo));
  readonly ajaxParams = computed(() =>
    this.config().clase === 'cliente'
      ? {
          q: this.q().trim(),
          estado: this.estado(),
          tipoTercero: this.tipoTercero() || this.defaultTipoTercero(),
        }
      : {},
  );
  readonly columns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    return this.config().clase === 'cliente' ? this.clienteColumns() : this.productoColumns();
  });

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.config.set(data as MaestroListConfig);
      this.tipoTercero.set(this.defaultTipoTercero());
    });
  }

  refrescar(): void {
    this.gridNonce.update((n) => n + 1);
  }

  t(key: string, params?: Record<string, unknown>): string {
    return this.i18n.t(key, params);
  }

  abrirImportModal(): void {
    this.importFile.set(null);
    this.importFileName.set('');
    this.importResult.set(null);
    this.importModalOpen.set(true);
  }

  cerrarImportModal(): void {
    this.importModalOpen.set(false);
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.importFile.set(file);
    this.importFileName.set(file?.name ?? '');
    this.importResult.set(null);
  }

  descargarPlantilla(): void {
    const tipo = this.config().tipo as ProductoServicioTipo;
    this.importLoading.set(true);
    this.maestros.descargarPlantillaImportacion(tipo).subscribe({
      next: (blob) => {
        this.importLoading.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plantilla-${tipo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.importLoading.set(false);
        this.showMsg(this.t('masters.importError'), false);
      },
    });
  }

  ejecutarImportacion(): void {
    const file = this.importFile();
    if (!file) {
      this.showMsg(this.t('masters.importFileRequired'), false);
      return;
    }
    const tipo = this.config().tipo as ProductoServicioTipo;
    this.importLoading.set(true);
    this.maestros.importarDesdePlantilla(tipo, file).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        this.importResult.set(res);
        this.refrescar();
        const ok = res.errores === 0;
        this.showMsg(this.t('masters.importSuccess'), ok);
      },
      error: (err: unknown) => {
        this.importLoading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.importError')), false);
      },
    });
  }

  private showMsg(text: string, ok: boolean): void {
    if (ok) {
      this.toast.success(text);
    } else {
      this.toast.error(text);
    }
  }

  cancelarEliminar(): void {
    this.deleteConfirmId.set(null);
  }

  confirmarEliminar(id: string): void {
    this.deleteConfirmId.set(null);
    this.loading.set(true);
    this.maestros.delete(this.config().tipo, id).subscribe({
      next: () => {
        this.loading.set(false);
        this.showMsg(this.t('masters.deleted'), true);
        this.refrescar();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.deleteError')), false);
      },
    });
  }

  listTitle(): string {
    const keys: Partial<Record<MaestroEntidadTipo, string>> = {
      clientes: 'masters.customersTitle',
      proveedores: 'masters.providersTitle',
      productos: 'masters.productsTitle',
      servicios: 'masters.servicesTitle',
    };
    return this.t(keys[this.config().tipo] ?? 'masters.customersTitle');
  }

  listSubtitle(): string {
    const keys: Partial<Record<MaestroEntidadTipo, string>> = {
      clientes: 'masters.customersSubtitle',
      proveedores: 'masters.providersSubtitle',
      productos: 'masters.productsSubtitle',
      servicios: 'masters.servicesSubtitle',
    };
    return this.t(keys[this.config().tipo] ?? 'masters.customersSubtitle');
  }

  aplicarFiltros(): void {
    this.refrescar();
  }

  defaultTipoTercero(): 'CLIENTE' | 'PROVEEDOR' {
    return this.config().tipo === 'proveedores' ? 'PROVEEDOR' : 'CLIENTE';
  }

  onRowAction(event: { action: string; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    if (!id) {
      return;
    }
    if (event.action === 'edit') {
      void this.router.navigate(['/t', this.tenant.tenantSlug(), this.config().tipo, id, 'editar']);
      return;
    }
    if (event.action === 'delete') {
      this.eliminar(id);
    }
  }

  private eliminar(id: string): void {
    this.deleteConfirmId.set(id);
  }

  private clienteColumns(): ColumnDefinition[] {
    return [
      this.actionsColumn(),
      { title: this.t('masters.typeId'), field: 'tipoIdentificacion', width: 90, formatter: 'textarea' },
      { title: this.t('masters.identification'), field: 'identificacion', minWidth: 145, formatter: 'textarea' },
      { title: this.t('masters.businessName'), field: 'razonSocial', minWidth: 240, formatter: 'textarea' },
      { title: this.t('masters.tradeName'), field: 'nombreComercial', minWidth: 190, formatter: 'textarea' },
      { title: this.t('masters.type'), field: 'tipoTercero', width: 120, formatter: 'textarea' },
      { title: this.t('masters.email'), field: 'email', minWidth: 180, formatter: 'textarea' },
      { title: this.t('masters.phone'), field: 'telefono', minWidth: 120, formatter: 'textarea' },
      {
        title: this.t('common.status'),
        field: 'estado',
        width: 105,
        formatter: (cell: unknown) => this.estadoFormatter((cell as { getData: () => ClienteProveedor }).getData()),
      },
    ];
  }

  private productoColumns(): ColumnDefinition[] {
    return [
      this.actionsColumn(),
      { title: this.t('masters.code'), field: 'codigoPrincipal', minWidth: 140 },
      { title: this.t('masters.auxCode'), field: 'codigoAuxiliar', minWidth: 140 },
      { title: this.t('masters.description'), field: 'descripcion', minWidth: 260 },
      { title: this.t('masters.type'), field: 'tipo', width: 110 },
      {
        title: this.t('masters.unitPrice'),
        field: 'precioUnitario',
        hozAlign: 'right',
        width: 140,
        formatter: (cell: unknown) => {
          const v = Number((cell as { getValue: () => unknown }).getValue());
          return Number.isFinite(v) ? v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
        },
      },
      { title: 'IVA', field: 'ivaCodigo', width: 90 },
      {
        title: this.t('common.status'),
        field: 'estado',
        width: 105,
        formatter: (cell: unknown) => this.estadoFormatter((cell as { getData: () => ProductoServicio }).getData()),
      },
    ];
  }

  private estadoFormatter(row: { activo?: boolean | null; estado?: string | null }): string {
    const inactive = row.activo === false || String(row.estado ?? '').toLowerCase().includes('inactivo');
    const label = row.estado?.trim() || (inactive ? this.t('common.inactive') : this.t('common.active'));
    const cls = inactive ? 'bg-light text-muted' : 'bg-soft-success text-success';
    return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
  }

  private actionsColumn(): ColumnDefinition {
    return {
      title: '',
      field: 'id',
      width: 82,
      headerSort: false,
      hozAlign: 'center',
      formatter: () =>
        gridActionsMenu(
          [
            { action: 'edit', label: this.t('common.edit'), icon: 'edit' },
            { action: 'delete', label: this.t('common.inactivate'), icon: 'inactivate', danger: true },
          ],
          this.t('common.actions'),
        ),
    };
  }
}
