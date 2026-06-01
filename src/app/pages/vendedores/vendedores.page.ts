import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { gridActionsMenu } from '../../shared/ui/grid-actions.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorLocalGridComponent } from '../../shared/ui/organisms/ts-tabulator-local-grid/ts-tabulator-local-grid.component';
import {
  escapeHtml,
  tabulatorCellValue,
  tabulatorCodeCell,
  tabulatorMoneyCell,
  tabulatorTextareaCell,
} from '../../shared/ui/tabulator-formatters.util';
import { VendedoresService, type VendedorDto, type VendedorKpiDto, type VendedorPayload } from './vendedores.service';

const ILLU_KPI = '/assets/illustrations/grid-kpi.svg';
const ILLU_TEAM = '/assets/illustrations/grid-team.svg';

interface VendedorGridRow extends Record<string, unknown> {
  id: string;
  codigoInterno: string;
  nombreCompleto: string;
  email: string;
  codigo: string;
}

interface KpiGridRow extends Record<string, unknown> {
  vendedorId: string;
  codigoInterno: string;
  nombreCompleto: string;
  metaMonto: number;
  ventasMonto: number;
  porcentajeAvance: number;
  cotizacionesConvertidas: number;
}

type VendedoresTab = 'kpi' | 'team';

@Component({
  selector: 'ts-vendedores-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorLocalGridComponent],
  template: `
    <ts-page-layout [title]="t('salespeople.title')" [subtitle]="t('salespeople.subtitle')" [eyebrow]="t('menu.sales')">
      <div page-actions class="d-flex flex-wrap gap-2">
        <a class="btn btn-outline-secondary btn-sm" [routerLink]="['/t', tenant.tenantSlug(), 'ventas', 'cotizaciones']">
          {{ t('quotation.title') }}
        </a>
        <button type="button" class="btn btn-soft-primary btn-sm" (click)="recargarTodo()" [disabled]="loading()">
          {{ t('common.refresh') }}
        </button>
        @if (activeTab() === 'team') {
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirModalNuevo()">{{ t('salespeople.new') }}</button>
        }
      </div>

      <div class="ts-section-toolbar">
        <div class="ts-tabs" role="tablist" [attr.aria-label]="t('salespeople.title')">
          <button
            type="button"
            class="ts-tab"
            [class.active]="activeTab() === 'kpi'"
            (click)="activeTab.set('kpi')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'kpi'"
          >
            <svg class="icon-18" width="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 19V5M10 19V11M16 19V8M22 19V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <span>{{ t('salespeople.tabKpi') }}</span>
          </button>
          <button
            type="button"
            class="ts-tab"
            [class.active]="activeTab() === 'team'"
            (click)="activeTab.set('team')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'team'"
          >
            <svg class="icon-18" width="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
              <circle cx="9.5" cy="7" r="4" stroke="currentColor" stroke-width="1.8" />
            </svg>
            <span>{{ t('salespeople.tabTeam') }}</span>
          </button>
        </div>
      </div>

      @if (activeTab() === 'kpi') {
        <div class="ts-grid-toolbar">
          <span>{{ t('salespeople.kpiHelp') }}</span>
          <div class="d-flex flex-wrap align-items-end gap-2">
            <label class="mb-0 small text-secondary">
              {{ t('salespeople.period') }}
              <div class="d-flex gap-2 mt-1">
                <input
                  type="number"
                  class="form-control form-control-sm"
                  style="width: 5.5rem"
                  [(ngModel)]="metaAnio"
                  name="kpiAnio"
                  (change)="cargarKpis()"
                />
                <select
                  class="form-select form-select-sm"
                  style="width: 6.5rem"
                  [(ngModel)]="metaMes"
                  name="kpiMes"
                  (change)="cargarKpis()"
                >
                  @for (m of meses; track m) {
                    <option [ngValue]="m">{{ m }}</option>
                  }
                </select>
              </div>
            </label>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="descargarPlantillaMetas()">
              {{ t('salespeople.downloadGoalsTemplate') }}
            </button>
          </div>
        </div>
        <ts-tabulator-local-grid
          [data]="kpiRows()"
          [columns]="kpiCols()"
          [reloadNonce]="kpiGridNonce()"
          [emptyTitle]="t('salespeople.kpiEmptyTitle')"
          [emptyDescription]="t('salespeople.kpiEmptyDescription')"
          [emptyImageSrc]="illuKpi"
          [emptyFallbackText]="t('salespeople.kpiEmpty')"
          height="min(420px, calc(100vh - 16rem))"
        />
      } @else {
        <div class="ts-grid-toolbar">
          <span>{{ t('salespeople.teamHelp') }}</span>
        </div>
        <ts-tabulator-local-grid
          [data]="teamRows()"
          [columns]="teamCols()"
          [reloadNonce]="teamGridNonce()"
          [emptyTitle]="t('salespeople.teamEmptyTitle')"
          [emptyDescription]="t('salespeople.teamEmptyDescription')"
          [emptyImageSrc]="illuTeam"
          [emptyFallbackText]="t('salespeople.teamEmpty')"
          height="min(420px, calc(100vh - 16rem))"
          (rowAction)="onTeamAction($event)"
        />
      }
    </ts-page-layout>

    @if (modalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarModal()"></div>
      <section class="ts-form-modal" role="dialog" aria-modal="true" aria-labelledby="vendedor-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
              <circle cx="9.5" cy="7" r="4" stroke="currentColor" stroke-width="1.8" />
              <path d="M19 8v6M22 11h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </div>
          <div>
            <p class="ts-form-modal__eyebrow mb-0">{{ t('menu.sales') }}</p>
            <h3 id="vendedor-modal-title" class="mb-0">{{ editId() ? t('salespeople.edit') : t('salespeople.new') }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarModal()">
            &times;
          </button>
        </header>

        <form class="ts-form-modal__form" (ngSubmit)="guardar()">
          <div class="ts-form-modal__body">
          <label class="form-label">
            {{ t('salespeople.internalCode') }}
            @if (editId() && codigoInternoActual()) {
              <input class="form-control" [value]="codigoInternoActual()" readonly disabled />
            } @else {
              <input class="form-control text-muted" [value]="t('salespeople.codeAutoOnSave')" readonly disabled />
            }
          </label>
          <label class="form-label">
            {{ t('salespeople.additionalCode') }}
            <input class="form-control" [(ngModel)]="form.codigo" name="codigoAdicional" maxlength="30" />
            <small class="text-muted">{{ t('salespeople.additionalCodeHint') }}</small>
          </label>
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label">
                {{ t('salespeople.firstName') }}
                <input class="form-control" [(ngModel)]="form.nombres" name="nombres" required />
              </label>
            </div>
            <div class="col-md-6">
              <label class="form-label">
                {{ t('salespeople.lastName') }}
                <input class="form-control" [(ngModel)]="form.apellidos" name="apellidos" />
              </label>
            </div>
            <div class="col-md-6">
              <label class="form-label">
                {{ t('salespeople.email') }}
                <input type="email" class="form-control" [(ngModel)]="form.email" name="email" />
              </label>
            </div>
            <div class="col-md-6">
              <label class="form-label">
                {{ t('salespeople.phone') }}
                <input class="form-control" [(ngModel)]="form.telefono" name="telefono" />
              </label>
            </div>
            <div class="col-12">
              <label class="form-label">
                {{ t('salespeople.idDocument') }}
                <input class="form-control" [(ngModel)]="form.documentoIdentidad" name="documentoIdentidad" />
              </label>
            </div>
          </div>
          </div>

          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarModal()" [disabled]="saving()">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving() || !form.nombres.trim()">
              {{ saving() ? t('common.saving') : t('common.save') }}
            </button>
          </footer>
        </form>
      </section>
    }

    @if (metaModalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarMetaModal()"></div>
      <section
        class="ts-form-modal ts-form-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendedor-meta-modal-title"
      >
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
            </svg>
          </div>
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('salespeople.addGoal') }}</p>
            <h3 id="vendedor-meta-modal-title" class="mb-0">{{ metaVendedorLabel() }}</h3>
            <p class="ts-form-modal__subtitle mb-0">{{ t('salespeople.addGoalHint') }}</p>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarMetaModal()">
            &times;
          </button>
        </header>

        <form class="ts-form-modal__form" (ngSubmit)="guardarMeta()">
          <div class="ts-form-modal__body">
            <div class="row g-2">
              <div class="col-6">
                <label class="form-label">
                  {{ t('salespeople.year') }}
                  <input
                    type="number"
                    class="form-control"
                    [(ngModel)]="metaFormAnio"
                    name="metaFormAnio"
                    required
                  />
                </label>
              </div>
              <div class="col-6">
                <label class="form-label">
                  {{ t('salespeople.month') }}
                  <select class="form-select" [(ngModel)]="metaFormMes" name="metaFormMes" required>
                    @for (m of meses; track m) {
                      <option [ngValue]="m">{{ m }}</option>
                    }
                  </select>
                </label>
              </div>
              <div class="col-12">
                <label class="form-label">
                  {{ t('salespeople.goalAmount') }}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    class="form-control"
                    [(ngModel)]="metaFormMonto"
                    name="metaFormMonto"
                    required
                  />
                </label>
              </div>
            </div>
          </div>
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarMetaModal()" [disabled]="saving()">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">
              {{ saving() ? t('common.saving') : t('salespeople.saveGoal') }}
            </button>
          </footer>
        </form>
      </section>
    }
  `,
  styles: [
    `
      .ts-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1090;
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(3px);
      }
      .ts-form-modal {
        width: min(600px, calc(100vw - 2rem));
      }
      .ts-form-modal__header {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid var(--ef-divider);
        background: var(--ef-page-header-bg, linear-gradient(180deg, #ffffff 0%, #f8fafc 100%));
      }
      .ts-form-modal__icon {
        display: grid;
        place-items: center;
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        color: var(--lux-primary-strong, #2563eb);
        background: var(--ef-page-icon-bg, #eff6ff);
        border: 1px solid var(--ef-page-icon-border, #bfdbfe);
        border-radius: 12px;
      }
      .ts-form-modal__eyebrow {
        color: var(--ef-muted-soft, #64748b);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ts-form-modal__header h3 {
        color: var(--text);
        font-size: 1rem;
        font-weight: 700;
      }
      .ts-form-modal__close {
        display: grid;
        place-items: center;
        margin-left: auto;
        width: 32px;
        height: 32px;
        border: 1px solid var(--ef-surface-border);
        border-radius: 10px;
        color: var(--muted);
        background: var(--ef-surface-raised, #fff);
        font-size: 1.2rem;
        line-height: 1;
      }
      .ts-form-modal__body .form-label {
        display: grid;
        gap: 0.35rem;
        margin: 0;
        color: var(--ef-label);
        font-size: 0.82rem;
        font-weight: 650;
      }
      :host ::ng-deep .ts-kpi-pct {
        display: inline-flex;
        align-items: center;
        min-height: 1.45rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.76rem;
        font-weight: 750;
        color: #475569;
        background: #f1f5f9;
      }
      :host ::ng-deep .ts-kpi-pct--ok {
        color: #15803d;
        background: #dcfce7;
      }
    `,
  ],
})
export class VendedoresPage implements OnInit {
  readonly tenant = inject(TenantContextService);
  readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  private readonly vendedoresSvc = inject(VendedoresService);

  readonly illuKpi = ILLU_KPI;
  readonly illuTeam = ILLU_TEAM;
  readonly meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  readonly activeTab = signal<VendedoresTab>('kpi');
  readonly vendedores = signal<VendedorDto[]>([]);
  readonly kpis = signal<VendedorKpiDto[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly teamGridNonce = signal(0);
  readonly kpiGridNonce = signal(0);
  readonly modalOpen = signal(false);
  readonly metaModalOpen = signal(false);
  readonly editId = signal<string | null>(null);
  readonly codigoInternoActual = signal<string | null>(null);
  readonly metaVendedorId = signal<string | null>(null);
  readonly metaVendedorLabel = signal('');

  form: VendedorPayload = { nombres: '', apellidos: '', email: '', codigo: '', estado: 'ACTIVO' };
  metaAnio = new Date().getFullYear();
  metaMes = new Date().getMonth() + 1;
  metaFormAnio = new Date().getFullYear();
  metaFormMes = new Date().getMonth() + 1;
  metaFormMonto = 0;

  readonly teamRows = computed<VendedorGridRow[]>(() =>
    this.vendedores().map((v) => ({
      id: v.id,
      codigoInterno: v.codigoInterno ?? '',
      nombreCompleto: v.nombreCompleto,
      email: v.email ?? '',
      codigo: v.codigo ?? '',
    })),
  );

  readonly kpiRows = computed<KpiGridRow[]>(() => {
    const codigos = new Map(this.vendedores().map((v) => [v.id, v.codigoInterno ?? '']));
    return this.kpis().map((k) => ({
      vendedorId: k.vendedorId,
      codigoInterno: codigos.get(k.vendedorId) ?? '—',
      nombreCompleto: k.nombreCompleto,
      metaMonto: k.metaMonto,
      ventasMonto: k.ventasMonto,
      porcentajeAvance: k.porcentajeAvance,
      cotizacionesConvertidas: k.cotizacionesConvertidas,
    }));
  });

  readonly teamCols = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const t = (k: string) => this.t(k);
    return [
      {
        title: '',
        field: 'id',
        width: 80,
        hozAlign: 'center',
        headerSort: false,
        formatter: () =>
          gridActionsMenu(
            [
              { action: 'edit', label: t('common.edit'), icon: 'edit' },
              { action: 'addGoal', label: t('salespeople.addGoal'), icon: 'goal' },
            ],
            t('common.actions'),
          ),
      },
      {
        title: t('salespeople.internalCode'),
        field: 'codigoInterno',
        width: 110,
        formatter: (cell: unknown) => tabulatorCodeCell(cell),
      },
      {
        title: t('salespeople.label'),
        field: 'nombreCompleto',
        minWidth: 200,
        formatter: (cell: unknown) => tabulatorTextareaCell(tabulatorCellValue(cell)),
      },
      {
        title: t('salespeople.email'),
        field: 'email',
        minWidth: 180,
        formatter: (cell: unknown) => tabulatorTextareaCell(tabulatorCellValue(cell) || '—'),
      },
      {
        title: t('salespeople.additionalCode'),
        field: 'codigo',
        width: 140,
        formatter: (cell: unknown) => tabulatorTextareaCell(tabulatorCellValue(cell) || '—'),
      },
    ];
  });

  readonly kpiCols = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const t = (k: string) => this.t(k);
    return [
      {
        title: t('salespeople.internalCode'),
        field: 'codigoInterno',
        width: 110,
        formatter: (cell: unknown) => tabulatorCodeCell(cell),
      },
      {
        title: t('salespeople.label'),
        field: 'nombreCompleto',
        minWidth: 200,
        formatter: (cell: unknown) => tabulatorTextareaCell(tabulatorCellValue(cell)),
      },
      {
        title: t('salespeople.goalAmount'),
        field: 'metaMonto',
        hozAlign: 'right',
        width: 120,
        formatter: (cell: unknown) => tabulatorMoneyCell(tabulatorCellValue(cell)),
      },
      {
        title: t('salespeople.sales'),
        field: 'ventasMonto',
        hozAlign: 'right',
        width: 120,
        formatter: (cell: unknown) => tabulatorMoneyCell(tabulatorCellValue(cell)),
      },
      {
        title: '%',
        field: 'porcentajeAvance',
        hozAlign: 'right',
        width: 90,
        formatter: (cell: unknown) => {
          const pct = Number(tabulatorCellValue(cell) ?? 0);
          const cls = pct >= 100 ? 'ts-kpi-pct ts-kpi-pct--ok' : 'ts-kpi-pct';
          return `<span class="${cls}">${escapeHtml(pct.toFixed(1))}%</span>`;
        },
      },
      {
        title: t('quotation.converted'),
        field: 'cotizacionesConvertidas',
        hozAlign: 'right',
        width: 110,
      },
    ];
  });

  ngOnInit(): void {
    this.i18n.initializeFromProfileOnce();
    this.recargarTodo();
  }

  recargarTodo(): void {
    this.loading.set(true);
    this.vendedoresSvc.listar(0, 100, 'ACTIVO').subscribe({
      next: (p) => {
        this.vendedores.set(p.content ?? []);
        this.teamGridNonce.update((n) => n + 1);
        this.cargarKpis();
      },
      error: () => {
        this.vendedores.set([]);
        this.teamGridNonce.update((n) => n + 1);
        this.loading.set(false);
      },
    });
  }

  cargarKpis(): void {
    this.vendedoresSvc.kpis(this.metaAnio, this.metaMes).subscribe({
      next: (k) => {
        this.kpis.set(k);
        this.kpiGridNonce.update((n) => n + 1);
        this.loading.set(false);
      },
      error: () => {
        this.kpis.set([]);
        this.kpiGridNonce.update((n) => n + 1);
        this.loading.set(false);
      },
    });
  }

  onTeamAction(event: { action: string; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    const v = this.vendedores().find((x) => x.id === id);
    if (!v) {
      return;
    }
    if (event.action === 'edit') {
      this.abrirModalEditar(v);
      return;
    }
    if (event.action === 'addGoal') {
      this.abrirMetaModal(v);
    }
  }

  abrirModalNuevo(): void {
    this.editId.set(null);
    this.codigoInternoActual.set(null);
    this.form = {
      nombres: '',
      apellidos: '',
      email: '',
      telefono: '',
      documentoIdentidad: '',
      codigo: '',
      estado: 'ACTIVO',
    };
    this.modalOpen.set(true);
  }

  abrirModalEditar(v: VendedorDto): void {
    this.editId.set(v.id);
    this.codigoInternoActual.set(v.codigoInterno);
    this.form = {
      codigo: v.codigo ?? '',
      nombres: v.nombres,
      apellidos: v.apellidos,
      email: v.email,
      telefono: v.telefono,
      documentoIdentidad: v.documentoIdentidad,
      notas: v.notas,
      estado: v.estado,
    };
    this.modalOpen.set(true);
  }

  abrirMetaModal(v: VendedorDto): void {
    this.metaVendedorId.set(v.id);
    this.metaVendedorLabel.set(`${v.codigoInterno ?? ''} — ${v.nombreCompleto}`.trim());
    this.metaFormAnio = this.metaAnio;
    this.metaFormMes = this.metaMes;
    this.metaFormMonto = 0;
    this.vendedoresSvc.metas(v.id, this.metaFormAnio).subscribe({
      next: (metas) => {
        const m = metas.find((x) => x.periodoMes === this.metaFormMes);
        this.metaFormMonto = m?.metaMonto ?? 0;
        this.metaModalOpen.set(true);
      },
      error: () => {
        this.metaFormMonto = 0;
        this.metaModalOpen.set(true);
      },
    });
  }

  cerrarModal(): void {
    if (this.saving()) {
      return;
    }
    this.modalOpen.set(false);
    this.editId.set(null);
  }

  cerrarMetaModal(): void {
    if (this.saving()) {
      return;
    }
    this.metaModalOpen.set(false);
    this.metaVendedorId.set(null);
    this.metaVendedorLabel.set('');
  }

  guardar(): void {
    const payload: VendedorPayload = {
      ...this.form,
      codigo: this.form.codigo?.trim() || undefined,
      nombres: this.form.nombres.trim(),
    };
    const id = this.editId();
    this.saving.set(true);
    const req = id ? this.vendedoresSvc.actualizar(id, payload) : this.vendedoresSvc.crear(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.t('common.saved'));
        this.cerrarModal();
        this.recargarTodo();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.t('salespeople.saveError'));
      },
    });
  }

  guardarMeta(): void {
    const id = this.metaVendedorId();
    if (!id) {
      return;
    }
    this.saving.set(true);
    this.vendedoresSvc
      .guardarMeta(id, {
        periodoAnio: this.metaFormAnio,
        periodoMes: this.metaFormMes,
        metaMonto: this.metaFormMonto,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success(this.t('salespeople.goalSaved'));
          this.cerrarMetaModal();
          this.cargarKpis();
        },
        error: () => {
          this.saving.set(false);
          this.toast.error(this.t('salespeople.goalError'));
        },
      });
  }

  descargarPlantillaMetas(): void {
    const lista = this.vendedores();
    if (!lista.length) {
      this.toast.error(this.t('salespeople.goalsTemplateEmpty'));
      return;
    }
    const metaPorVendedor = new Map(this.kpis().map((k) => [k.vendedorId, k.metaMonto]));
    const filas: string[][] = [
      [
        this.t('salespeople.internalCode'),
        this.t('salespeople.label'),
        this.t('salespeople.year'),
        this.t('salespeople.month'),
        this.t('salespeople.goalAmount'),
      ],
      ...lista.map((v) => [
        v.codigoInterno ?? '',
        v.nombreCompleto,
        String(this.metaAnio),
        String(this.metaMes),
        metaPorVendedor.has(v.id) ? String(metaPorVendedor.get(v.id) ?? '') : '',
      ]),
    ];
    descargarCsv(this.t('salespeople.goalsTemplateFile'), filas);
  }

  t(key: string): string {
    return this.i18n.t(key);
  }
}

function descargarCsv(nombreArchivo: string, filas: string[][]): void {
  const sep = ';';
  const escapar = (valor: string) => {
    const s = String(valor ?? '');
    if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const contenido = '\uFEFF' + filas.map((fila) => fila.map(escapar).join(sep)).join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
