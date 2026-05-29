import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { gridActionsMenu, type GridActionItem } from '../../shared/ui/grid-actions.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorLocalGridComponent } from '../../shared/ui/organisms/ts-tabulator-local-grid/ts-tabulator-local-grid.component';

type EstadoRol = 'ACTIVO' | 'INACTIVO';
type FiltroRol = 'TODOS' | EstadoRol;

interface RolRow extends Record<string, unknown> {
  id: string;
  codigo: string;
  nombre: string;
  sistema: boolean;
  estado: EstadoRol | string;
  usuariosAsignados: number;
  permisosCodigos: string[];
}

interface PermisoCatalogo {
  id: string;
  codigo: string;
  descripcion?: string;
  modulo?: string;
}

interface RolForm {
  codigo: string;
  nombre: string;
  permisosCodigos: string[];
}

interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  variant: 'danger' | 'primary';
  onConfirm: () => void;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Component({
  selector: 'ts-admin-roles-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorLocalGridComponent],
  template: `
    <ts-page-layout [title]="t('roles.title')" [subtitle]="t('roles.subtitle')" [eyebrow]="t('users.eyebrow')">
      <div page-actions class="d-flex gap-2">
        @if (tokenPresent && tieneEmpresa) {
          <button type="button" class="btn btn-soft-primary btn-sm" (click)="cargar()" [disabled]="loading()">
            {{ t('common.refresh') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirCrear()" [disabled]="loading()">
            {{ t('roles.new') }}
          </button>
        }
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('common.toContinue') }}
          } @else {
            {{ t('roles.companyRequired') }}
          }
        </p>
      } @else {
        <div class="ts-role-filters" aria-label="Filtros de roles">
          @for (filtro of filtros; track filtro.value) {
            <button
              type="button"
              class="ts-role-filter"
              [class.active]="estadoFiltro() === filtro.value"
              (click)="cambiarFiltro(filtro.value)"
            >
              {{ t(filtro.labelKey) }}
            </button>
          }
        </div>
        <ts-tabulator-local-grid
          [data]="rows()"
          [columns]="cols()"
          [reloadNonce]="gridNonce()"
          emptyContext="roles"
          height="480px"
          (rowAction)="onRowAction($event)"
        />
      }
    </ts-page-layout>

    @if (modalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarModal()"></div>
      <section class="ts-form-modal" role="dialog" aria-modal="true" aria-labelledby="rol-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </div>
          <div>
            <p class="ts-form-modal__eyebrow mb-0">{{ t('users.eyebrow') }}</p>
            <h3 id="rol-modal-title" class="mb-0">{{ editingId() ? t('roles.edit') : t('roles.new') }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarModal()">&times;</button>
        </header>

        <form class="ts-form-modal__body" (ngSubmit)="guardarRol()">
          <label class="form-label">
            {{ t('roles.code') }}
            <input
              class="form-control"
              name="codigo"
              [(ngModel)]="form.codigo"
              [readonly]="!!editingId()"
              [class.ts-readonly]="!!editingId()"
              required
              autocomplete="off"
            />
          </label>
          <label class="form-label">
            {{ t('roles.name') }}
            <input class="form-control" name="nombre" [(ngModel)]="form.nombre" required autocomplete="off" />
          </label>
          <div class="ts-permission-picker">
            <div class="ts-permission-picker__head">
              <span>{{ t('roles.permissions') }}</span>
              <small>{{ t('roles.selectedCount', { count: form.permisosCodigos.length }) }}</small>
            </div>
            <div class="ts-permission-picker__list">
              @for (permiso of permisos(); track permiso.codigo) {
                <label class="ts-permission-option">
                  <input
                    type="checkbox"
                    [checked]="permisoSeleccionado(permiso.codigo)"
                    (change)="togglePermiso(permiso.codigo)"
                  />
                  <span>
                    <strong>{{ etiquetaPermiso(permiso.codigo) }}</strong>
                    <small class="text-muted d-block">{{ permiso.codigo }}</small>
                    <small>{{ permiso.modulo || t('roles.general') }}{{ permiso.descripcion ? ' — ' + permiso.descripcion : '' }}</small>
                  </span>
                </label>
              }
            </div>
          </div>
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarModal()" [disabled]="saving()">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">
              {{ saving() ? t('profile.saving') : t('common.save') }}
            </button>
          </footer>
        </form>
      </section>
    }

    @if (detailState(); as d) {
      <div class="ts-modal-backdrop" (click)="cerrarDetalle()"></div>
      <section class="ts-detail-modal" role="dialog" aria-modal="true">
        <header class="ts-detail-modal__header">
          <div>
            <p class="ts-detail-modal__eyebrow mb-0">{{ t('roles.role') }}</p>
            <h3 class="mb-0">{{ d.codigo }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarDetalle()">&times;</button>
        </header>
        <div class="ts-detail-modal__body">
          <div><span>{{ t('roles.name') }}</span><strong>{{ d.nombre }}</strong></div>
          <div><span>{{ t('common.status') }}</span><strong>{{ d.estado }}</strong></div>
          <div><span>{{ t('roles.system') }}</span><strong>{{ d.sistema ? 'Si' : 'No' }}</strong></div>
          <div><span>{{ t('roles.assignedUsers') }}</span><strong>{{ d.usuariosAsignados || 0 }}</strong></div>
          <div class="ts-detail-modal__wide">
            <span>{{ t('roles.permissions') }}</span>
            @if ((d.permisosCodigos || []).length) {
              <div class="ts-perm-detail">
                @for (c of d.permisosCodigos || []; track c) {
                  <div class="ts-perm-detail__row">
                    <strong>{{ etiquetaPermiso(c) }}</strong>
                    <span class="text-muted small">{{ c }}</span>
                  </div>
                }
              </div>
            } @else {
              <strong>-</strong>
            }
          </div>
        </div>
      </section>
    }

    @if (confirmState(); as c) {
      <div class="ts-modal-backdrop" (click)="cancelarConfirmacion()"></div>
      <section class="ts-confirm-modal" role="dialog" aria-modal="true">
        <h3>{{ c.title }}</h3>
        <p>{{ c.message }}</p>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-light btn-sm" (click)="cancelarConfirmacion()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-sm" [class.btn-danger]="c.variant === 'danger'" [class.btn-primary]="c.variant === 'primary'" (click)="confirmar()">
            {{ c.confirmText }}
          </button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .ts-role-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-bottom: 0.9rem;
        padding: 0.25rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
      .ts-role-filter {
        min-height: 1.95rem;
        padding: 0.28rem 0.7rem;
        border: 0;
        border-radius: 9px;
        color: #475569;
        background: transparent;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .ts-role-filter:hover,
      .ts-role-filter.active {
        color: #1d4ed8;
        background: #eff6ff;
      }
      .ts-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1090;
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(3px);
      }
      .ts-form-modal,
      .ts-detail-modal,
      .ts-confirm-modal {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(640px, calc(100vw - 2rem));
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      .ts-form-modal__header,
      .ts-detail-modal__header {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid rgba(226, 232, 240, 0.95);
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .ts-detail-modal__header {
        justify-content: space-between;
      }
      .ts-form-modal__icon {
        display: grid;
        place-items: center;
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        color: #2563eb;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
      }
      .ts-form-modal__eyebrow,
      .ts-detail-modal__eyebrow {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ts-form-modal__header h3,
      .ts-detail-modal__header h3,
      .ts-confirm-modal h3 {
        color: #0f172a;
        font-size: 1rem;
        font-weight: 700;
      }
      .ts-form-modal__close {
        display: grid;
        place-items: center;
        margin-left: auto;
        width: 32px;
        height: 32px;
        border: 1px solid rgba(203, 213, 225, 0.9);
        border-radius: 10px;
        color: #475569;
        background: #fff;
        font-size: 1.2rem;
        line-height: 1;
      }
      .ts-form-modal__close:hover {
        color: #0f172a;
        background: #f8fafc;
        border-color: #94a3b8;
      }
      .ts-form-modal__body {
        display: grid;
        gap: 0.8rem;
        padding: 1rem 1.1rem 1.1rem;
      }
      .ts-form-modal__body .form-label {
        display: grid;
        gap: 0.35rem;
        margin: 0;
        color: #334155;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .ts-form-modal__body .form-control {
        min-height: 2.25rem;
        border-radius: 10px;
        font-size: 0.88rem;
      }
      .ts-readonly {
        color: #475569;
        background: #f8fafc;
      }
      .ts-permission-picker {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
      }
      .ts-permission-picker__head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.65rem 0.8rem;
        color: #334155;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.82rem;
        font-weight: 750;
      }
      .ts-permission-picker__head small {
        color: #64748b;
        font-weight: 700;
      }
      .ts-permission-picker__list {
        display: grid;
        gap: 0.25rem;
        max-height: 260px;
        overflow: auto;
        padding: 0.45rem;
      }
      .ts-permission-option {
        display: flex;
        align-items: flex-start;
        gap: 0.55rem;
        padding: 0.5rem 0.55rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .ts-permission-option:hover {
        background: #f8fafc;
      }
      .ts-permission-option input {
        margin-top: 0.15rem;
      }
      .ts-permission-option span {
        display: grid;
        gap: 0.1rem;
      }
      .ts-permission-option strong {
        color: #0f172a;
        font-size: 0.8rem;
      }
      .ts-permission-option small {
        color: #64748b;
        font-size: 0.76rem;
      }
      .ts-form-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .ts-detail-modal {
        width: min(540px, calc(100vw - 2rem));
      }
      .ts-detail-modal__body {
        display: grid;
        gap: 0.55rem;
        padding: 1rem 1.1rem 1.1rem;
      }
      .ts-detail-modal__body div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.55rem 0.7rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
      }
      .ts-detail-modal__body .ts-detail-modal__wide {
        display: grid;
      }
      .ts-detail-modal__body span {
        color: #64748b;
        font-size: 0.78rem;
        font-weight: 700;
      }
      .ts-detail-modal__body strong {
        color: #0f172a;
        font-size: 0.84rem;
        text-align: right;
        overflow-wrap: anywhere;
      }
      .ts-detail-modal__wide strong {
        text-align: left;
      }
      .ts-detail-modal__body .ts-perm-detail {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0;
        margin: 0;
        background: transparent;
        border: none;
        border-radius: 0;
        justify-content: flex-start;
      }
      .ts-detail-modal__body .ts-perm-detail__row {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.12rem;
        width: 100%;
        padding: 0.45rem 0.65rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }
      .ts-detail-modal__body .ts-perm-detail__row strong {
        text-align: left;
      }
      .ts-confirm-modal {
        width: min(430px, calc(100vw - 2rem));
        padding: 1.1rem;
      }
      .ts-confirm-modal p {
        color: #475569;
        font-size: 0.9rem;
      }
      :host ::ng-deep .ts-grid-cell-wrap {
        display: block;
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.25;
      }
      :host ::ng-deep .ts-role-status {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        min-height: 1.45rem;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        font-size: 0.74rem;
        font-weight: 750;
      }
      :host ::ng-deep .ts-role-status--active {
        color: #15803d;
        background: #dcfce7;
      }
      :host ::ng-deep .ts-role-status--inactive {
        color: #475569;
        background: #e2e8f0;
      }
    `,
  ],
})
export class AdminRolesPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly rows = signal<RolRow[]>([]);
  readonly permisos = signal<PermisoCatalogo[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly gridNonce = signal(0);
  readonly modalOpen = signal(false);
  readonly editingId = signal('');
  readonly detailState = signal<RolRow | null>(null);
  readonly confirmState = signal<ConfirmState | null>(null);
  readonly estadoFiltro = signal<FiltroRol>('TODOS');
  readonly filtros: { value: FiltroRol; labelKey: string }[] = [
    { value: 'TODOS', labelKey: 'common.all' },
    { value: 'ACTIVO', labelKey: 'common.active' },
    { value: 'INACTIVO', labelKey: 'common.inactive' },
  ];

  form: RolForm = this.emptyForm();

  readonly cols = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    return [
    {
      title: '',
      width: 72,
      hozAlign: 'center',
      formatter: (cell: unknown) => this.actionMenuFormatter(cell),
    },
    {
      title: this.t('roles.code'),
      field: 'codigo',
      minWidth: 150,
      formatter: (cell: unknown) => this.textareaFormatter((cell as { getValue: () => unknown }).getValue()),
    },
    {
      title: this.t('roles.name'),
      field: 'nombre',
      minWidth: 180,
      formatter: (cell: unknown) => this.textareaFormatter((cell as { getValue: () => unknown }).getValue()),
    },
    {
      title: this.t('common.status'),
      field: 'estado',
      minWidth: 120,
      formatter: (cell: unknown) => this.estadoFormatter((cell as { getValue: () => unknown }).getValue()),
    },
    {
      title: this.t('roles.system'),
      field: 'sistema',
      width: 100,
      formatter: (cell: unknown) =>
        (cell as { getValue: () => unknown }).getValue()
          ? '<span class="badge bg-secondary-subtle text-secondary">Sistema</span>'
          : '<span class="badge bg-light text-dark">Personal</span>',
    },
    {
      title: this.t('roles.users'),
      field: 'usuariosAsignados',
      width: 110,
      hozAlign: 'right',
    },
    {
      title: this.t('roles.permissions'),
      field: 'permisosCodigos',
      minWidth: 260,
      formatter: (cell: unknown) => {
        const value = (cell as { getValue: () => unknown }).getValue();
        const permisos = Array.isArray(value) ? value : [];
        const shown = permisos.slice(0, 6);
        const more = permisos.length > 6 ? ` <span class="text-muted">+${permisos.length - 6}</span>` : '';
        return (
          shown
            .map((p) => {
              const code = String(p);
              const label = escapeHtml(this.etiquetaPermiso(code));
              return `<span class="badge bg-light text-dark me-1" title="${escapeHtml(code)}">${label}</span>`;
            })
            .join('') + more
        );
      },
    },
    ];
  });

  constructor() {
    if (this.tokenPresent && this.tieneEmpresa) {
      this.cargarPermisos();
      this.cargar();
    }
  }

  t(key: string, params?: Record<string, unknown>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  /** Etiqueta corta para el picker y la grilla; si no hay i18n, devuelve el codigo. */
  etiquetaPermiso(codigo: string): string {
    const key = `roles.permiso.${codigo}`;
    const txt = this.t(key);
    return txt === key ? codigo : txt;
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<unknown>(this.rolesUrl()).subscribe({
      next: (res) => {
        this.rows.set(this.toArray<RolRow>(res));
        this.gridNonce.update((n) => n + 1);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.notifyError(extractApiErrorMessage(err, this.t('roles.loadError')));
        this.loading.set(false);
        if (err.status === 401) {
          void this.router.navigate(['/t', this.tenant.tenantSlug(), 'login']);
        }
      },
    });
  }

  cargarPermisos(): void {
    this.http.get<unknown>('/api/web/v1/permisos-catalogo').subscribe({
      next: (res) => this.permisos.set(this.toArray<PermisoCatalogo>(res).filter((p) => !!p.codigo)),
      error: () => this.permisos.set([]),
    });
  }

  cambiarFiltro(value: FiltroRol): void {
    this.estadoFiltro.set(value);
    this.cargar();
  }

  abrirCrear(): void {
    this.editingId.set('');
    this.form = this.emptyForm();
    this.modalOpen.set(true);
  }

  abrirEditar(row: RolRow): void {
    if (row.sistema) {
      this.notifyError(this.t('roles.systemEditError'));
      return;
    }
    this.editingId.set(row.id);
    this.form = {
      codigo: row.codigo,
      nombre: row.nombre,
      permisosCodigos: Array.isArray(row.permisosCodigos) ? [...row.permisosCodigos] : [],
    };
    this.modalOpen.set(true);
  }

  cerrarModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  guardarRol(): void {
    const editing = this.editingId();
    const codigo = this.form.codigo.trim().toUpperCase();
    const nombre = this.form.nombre.trim();
    if (!editing && !/^[A-Z0-9_]+$/.test(codigo)) {
      this.notifyError(this.t('roles.codeFormatError'));
      return;
    }
    if (!nombre) {
      this.notifyError(this.t('roles.nameRequired'));
      return;
    }
    this.saving.set(true);
    const req = editing
      ? this.http.put(`${this.rolesBaseUrl()}/${encodeURIComponent(editing)}`, {
          nombre,
          permisosCodigos: this.form.permisosCodigos,
        })
      : this.http.post(this.rolesBaseUrl(), {
          codigo,
          nombre,
          permisosCodigos: this.form.permisosCodigos,
        });
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.notifySuccess(editing ? this.t('roles.updated') : this.t('roles.created'));
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.notifyError(extractApiErrorMessage(err, this.t('roles.saveError')));
      },
    });
  }

  permisoSeleccionado(codigo: string): boolean {
    return this.form.permisosCodigos.includes(codigo);
  }

  togglePermiso(codigo: string): void {
    const current = new Set(this.form.permisosCodigos);
    if (current.has(codigo)) {
      current.delete(codigo);
    } else {
      current.add(codigo);
    }
    this.form.permisosCodigos = [...current].sort();
  }

  onRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    const row = ev.row as RolRow;
    if (ev.action === 'detalle') {
      this.detailState.set(row);
      return;
    }
    if (ev.action === 'editar') {
      this.abrirEditar(row);
      return;
    }
    if (ev.action === 'activar' || ev.action === 'inactivar') {
      const estado: EstadoRol = ev.action === 'activar' ? 'ACTIVO' : 'INACTIVO';
      this.confirmState.set({
        title: estado === 'ACTIVO' ? this.t('roles.activateTitle') : this.t('roles.inactivateTitle'),
        message: estado === 'ACTIVO' ? this.t('roles.activateMessage') : this.t('roles.inactivateMessage'),
        confirmText: estado === 'ACTIVO' ? this.t('common.activate') : this.t('common.inactivate'),
        variant: estado === 'ACTIVO' ? 'primary' : 'danger',
        onConfirm: () => this.cambiarEstado(row, estado),
      });
      return;
    }
    if (ev.action === 'eliminar') {
      this.confirmState.set({
        title: this.t('roles.deleteTitle'),
        message: this.t('roles.deleteMessage', { code: row.codigo }),
        confirmText: this.t('common.delete'),
        variant: 'danger',
        onConfirm: () => this.eliminar(row),
      });
    }
  }

  cerrarDetalle(): void {
    this.detailState.set(null);
  }

  cancelarConfirmacion(): void {
    this.confirmState.set(null);
  }

  confirmar(): void {
    const state = this.confirmState();
    this.confirmState.set(null);
    state?.onConfirm();
  }

  private cambiarEstado(row: RolRow, estado: EstadoRol): void {
    if (row.sistema) {
      this.notifyError(this.t('roles.systemModifyError'));
      return;
    }
    this.http.put(`${this.rolesBaseUrl()}/${encodeURIComponent(row.id)}/estado`, { estado }).subscribe({
      next: () => {
        this.notifySuccess(estado === 'ACTIVO' ? this.t('roles.activated') : this.t('roles.inactivated'));
        this.cargar();
      },
      error: (err: HttpErrorResponse) => this.notifyError(extractApiErrorMessage(err, this.t('roles.statusError'))),
    });
  }

  private eliminar(row: RolRow): void {
    if (row.sistema) {
      this.notifyError(this.t('roles.systemDeleteError'));
      return;
    }
    if ((row.usuariosAsignados ?? 0) > 0) {
      this.notifyError(this.t('roles.assignedDeleteError'));
      return;
    }
    this.http.delete(`${this.rolesBaseUrl()}/${encodeURIComponent(row.id)}`).subscribe({
      next: () => {
        this.notifySuccess(this.t('roles.deleted'));
        this.cargar();
      },
      error: (err: HttpErrorResponse) => this.notifyError(extractApiErrorMessage(err, this.t('roles.deleteError'))),
    });
  }

  private rolesUrl(): string {
    const base = this.rolesBaseUrl();
    if (this.estadoFiltro() === 'TODOS') {
      return base;
    }
    return `${base}?estado=${encodeURIComponent(this.estadoFiltro())}`;
  }

  private rolesBaseUrl(): string {
    const me = this.session.profile();
    const empresaId = me?.empresaId;
    if (this.isPlatformAdmin() && empresaId) {
      return `/api/web/v1/empresas/${encodeURIComponent(empresaId)}/roles`;
    }
    return '/api/web/v1/roles';
  }

  private isPlatformAdmin(): boolean {
    const me = this.session.profile();
    return (me?.roles ?? []).includes('PLATFORM_ADMIN') || (me?.permisos ?? []).includes('PLATFORM_ADMIN');
  }

  private toArray<T>(res: unknown): T[] {
    if (Array.isArray(res)) {
      return res as T[];
    }
    if (res && typeof res === 'object' && Array.isArray((res as { content?: unknown }).content)) {
      return (res as { content: T[] }).content;
    }
    return [];
  }

  private emptyForm(): RolForm {
    return { codigo: '', nombre: '', permisosCodigos: [] };
  }

  private notifyError(text: string): void {
    this.toast.error(text);
  }

  private notifySuccess(text: string): void {
    this.toast.success(text);
  }

  private textareaFormatter(value: unknown): string {
    return `<span class="ts-grid-cell-wrap">${escapeHtml(value)}</span>`;
  }

  private estadoFormatter(value: unknown): string {
    const estado = String(value ?? 'ACTIVO').toUpperCase();
    const cls = estado === 'ACTIVO' ? 'ts-role-status--active' : 'ts-role-status--inactive';
    return `<span class="ts-role-status ${cls}">${escapeHtml(estado)}</span>`;
  }

  private actionMenuFormatter(cell: unknown): string {
    const row = (cell as { getRow?: () => { getData: () => RolRow } }).getRow?.().getData();
    if (!row) {
      return '';
    }
    const disabled = row.sistema;
    const estado = String(row.estado ?? 'ACTIVO').toUpperCase();
    const actions: GridActionItem[] = [
      { action: 'detalle', label: 'Ver detalle', icon: 'view' },
    ];
    if (!disabled) {
      actions.push({ action: 'editar', label: this.t('common.edit'), icon: 'edit' });
      actions.push(
        estado === 'ACTIVO'
          ? { action: 'inactivar', label: this.t('common.inactivate'), icon: 'inactivate', danger: true }
          : { action: 'activar', label: this.t('common.activate'), icon: 'activate' },
      );
      if (Number(row.usuariosAsignados ?? 0) === 0) {
        actions.push({ action: 'eliminar', label: this.t('common.delete'), icon: 'delete', danger: true });
      }
    }
    return gridActionsMenu(actions, this.t('common.actions'));
  }
}
