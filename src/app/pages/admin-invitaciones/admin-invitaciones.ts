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

interface RolOption {
  codigo: string;
  nombre?: string;
}

interface InvitacionRow extends Record<string, unknown> {
  id: string;
  email?: string;
  rolCodigo?: string;
  estado?: string;
  expiraEn?: string;
  fechaCreacion?: string;
  invitadoPorEmail?: string;
  acceptUrl?: string;
  expirada?: boolean;
}

interface InvitacionResponse {
  id: string;
  token?: string;
  expiraEn?: string;
  acceptUrl?: string;
  emailEnviado?: boolean;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
}

type FiltroInvitacion = 'TODOS' | 'PENDIENTE' | 'ACEPTADA' | 'CANCELADA' | 'EXPIRADA';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Component({
  selector: 'ts-admin-invitaciones-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorLocalGridComponent],
  template: `
    <ts-page-layout
      [title]="t('invitations.title')"
      [subtitle]="t('invitations.subtitle')"
      [eyebrow]="t('users.eyebrow')"
    >
      <div page-actions class="d-flex gap-2">
        @if (tokenPresent && tieneEmpresa) {
          <button type="button" class="btn btn-soft-primary btn-sm" (click)="cargar()" [disabled]="loading()">
            {{ t('common.refresh') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirCrear()" [disabled]="loading()">
            {{ t('invitations.new') }}
          </button>
        }
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('common.toContinue') }}
          } @else {
            {{ t('invitations.companyRequired') }}
          }
        </p>
      } @else {
        @if (supportNotice()) {
          <div class="alert alert-warning py-2 mb-3">
            {{ supportNotice() }}
            @if (lastAcceptUrl()) {
              <div class="small mt-1">
                {{ t('invitations.supportUrl') }}: <span class="text-break">{{ lastAcceptUrl() }}</span>
              </div>
            }
          </div>
        }
        <div class="ts-invite-filters" aria-label="Filtros de invitaciones">
          @for (filtro of filtros; track filtro.value) {
            <button
              type="button"
              class="ts-invite-filter"
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
          emptyContext="invitations"
          height="430px"
          (rowAction)="onRowAction($event)"
        />
      }
    </ts-page-layout>

    @if (modalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarModal()"></div>
      <section class="ts-form-modal" role="dialog" aria-modal="true" aria-labelledby="invitacion-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <p class="ts-form-modal__eyebrow mb-0">{{ t('users.eyebrow') }}</p>
            <h3 id="invitacion-modal-title" class="mb-0">{{ t('invitations.new') }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarModal()">&times;</button>
        </header>

        <form class="ts-form-modal__body" (ngSubmit)="crearInvitacion()">
          <label class="form-label">
            {{ t('login.email') }}
            <input class="form-control" type="email" name="email" [(ngModel)]="email" required autocomplete="off" />
          </label>
          <label class="form-label">
            {{ t('invitations.role') }}
            <select class="form-select" name="rolCodigo" [(ngModel)]="rolCodigo" required>
              <option value="">{{ t('invitations.selectRole') }}</option>
              @for (rol of roles(); track rol.codigo) {
                <option [value]="rol.codigo">{{ rol.codigo }}{{ rol.nombre ? ' - ' + rol.nombre : '' }}</option>
              }
            </select>
          </label>
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarModal()" [disabled]="saving()">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">
              {{ saving() ? t('invitations.sending') : t('invitations.create') }}
            </button>
          </footer>
        </form>
      </section>
    }

    @if (confirmState(); as c) {
      <div class="ts-modal-backdrop" (click)="cancelarConfirmacion()"></div>
      <section class="ts-confirm-modal" role="dialog" aria-modal="true">
        <h3>{{ c.title }}</h3>
        <p>{{ c.message }}</p>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-light btn-sm" (click)="cancelarConfirmacion()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-danger btn-sm" (click)="confirmar()">{{ c.confirmText }}</button>
        </div>
      </section>
    }

    @if (detailState(); as d) {
      <div class="ts-modal-backdrop" (click)="cerrarDetalle()"></div>
      <section class="ts-detail-modal" role="dialog" aria-modal="true">
        <header class="ts-detail-modal__header">
          <div>
            <p class="ts-detail-modal__eyebrow mb-0">{{ t('invitations.invitation') }}</p>
            <h3 class="mb-0">{{ d.email }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarDetalle()">&times;</button>
        </header>
        <div class="ts-detail-modal__body">
          <div><span>{{ t('invitations.role') }}</span><strong>{{ d.rolCodigo || '-' }}</strong></div>
          <div><span>{{ t('common.status') }}</span><strong>{{ estadoLabel(d.estado) }}</strong></div>
          <div><span>{{ t('invitations.createdAt') }}</span><strong>{{ fmtIso(d.fechaCreacion) || '-' }}</strong></div>
          <div><span>{{ t('invitations.expiresAt') }}</span><strong>{{ fmtIso(d.expiraEn) || '-' }}</strong></div>
          <div><span>{{ t('invitations.invitedBy') }}</span><strong>{{ d.invitadoPorEmail || '-' }}</strong></div>
        </div>
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
      .ts-form-modal,
      .ts-confirm-modal {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(520px, calc(100vw - 2rem));
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      .ts-form-modal__header {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid rgba(226, 232, 240, 0.95);
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .ts-form-modal__icon {
        display: grid;
        place-items: center;
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        color: #7c3aed;
        background: #f5f3ff;
        border: 1px solid #ddd6fe;
        border-radius: 12px;
      }
      .ts-form-modal__eyebrow {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      .ts-form-modal__header h3,
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
      .ts-form-modal__body .form-control,
      .ts-form-modal__body .form-select {
        min-height: 2.25rem;
        border-radius: 10px;
        font-size: 0.88rem;
      }
      .ts-form-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding-top: 0.25rem;
      }
      .ts-confirm-modal {
        width: min(420px, calc(100vw - 2rem));
        padding: 1.1rem;
      }
      .ts-detail-modal {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(520px, calc(100vw - 2rem));
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      .ts-detail-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid rgba(226, 232, 240, 0.95);
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .ts-detail-modal__eyebrow {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ts-detail-modal__header h3 {
        color: #0f172a;
        font-size: 1rem;
        font-weight: 700;
        overflow-wrap: anywhere;
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
      .ts-confirm-modal p {
        color: #475569;
        font-size: 0.9rem;
      }
      .ts-invite-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-bottom: 0.9rem;
        padding: 0.25rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
      .ts-invite-filter {
        min-height: 1.95rem;
        padding: 0.28rem 0.7rem;
        border: 0;
        border-radius: 9px;
        color: #475569;
        background: transparent;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .ts-invite-filter:hover,
      .ts-invite-filter.active {
        color: #1d4ed8;
        background: #eff6ff;
      }
      :host ::ng-deep .ts-invite-status {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        min-height: 1.45rem;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        font-size: 0.74rem;
        font-weight: 750;
        line-height: 1.15;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      :host ::ng-deep .ts-invite-status--pending {
        color: #92400e;
        background: #fef3c7;
      }
      :host ::ng-deep .ts-invite-status--accepted {
        color: #15803d;
        background: #dcfce7;
      }
      :host ::ng-deep .ts-invite-status--cancelled {
        color: #b91c1c;
        background: #fee2e2;
      }
      :host ::ng-deep .ts-invite-status--expired {
        color: #475569;
        background: #e2e8f0;
      }
      :host ::ng-deep .ts-grid-cell-wrap {
        display: block;
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.25;
      }
    `,
  ],
})
export class AdminInvitacionesPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly rows = signal<InvitacionRow[]>([]);
  readonly roles = signal<RolOption[]>([]);
  readonly supportNotice = signal('');
  readonly lastAcceptUrl = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly confirmState = signal<ConfirmState | null>(null);
  readonly detailState = signal<InvitacionRow | null>(null);
  readonly estadoFiltro = signal<FiltroInvitacion>('TODOS');
  readonly gridNonce = signal(0);
  readonly filtros: { value: FiltroInvitacion; labelKey: string }[] = [
    { value: 'TODOS', labelKey: 'common.all' },
    { value: 'PENDIENTE', labelKey: 'invitations.pending' },
    { value: 'ACEPTADA', labelKey: 'invitations.accepted' },
    { value: 'CANCELADA', labelKey: 'invitations.cancelled' },
    { value: 'EXPIRADA', labelKey: 'invitations.expired' },
  ];

  email = '';
  rolCodigo = '';

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
      title: this.t('login.email'),
      field: 'email',
      minWidth: 220,
      formatter: (cell: unknown) => this.textareaFormatter((cell as { getValue: () => unknown }).getValue()),
    },
    {
      title: this.t('invitations.role'),
      field: 'rolCodigo',
      minWidth: 140,
      formatter: (cell: unknown) => this.textareaFormatter((cell as { getValue: () => unknown }).getValue()),
    },
    {
      title: this.t('common.status'),
      field: 'estado',
      minWidth: 165,
      formatter: (cell: unknown) => this.estadoFormatter((cell as { getValue: () => unknown }).getValue()),
    },
    {
      title: this.t('invitations.expiresAt'),
      field: 'expiraEn',
      minWidth: 170,
      formatter: (c: unknown) =>
        this.textareaFormatter(this.fmtIso((c as { getValue: () => unknown }).getValue() as string | undefined)),
    },
    {
      title: this.t('invitations.createdAt'),
      field: 'fechaCreacion',
      minWidth: 170,
      formatter: (c: unknown) =>
        this.textareaFormatter(this.fmtIso((c as { getValue: () => unknown }).getValue() as string | undefined)),
    },
    {
      title: this.t('invitations.invitedBy'),
      field: 'invitadoPorEmail',
      minWidth: 200,
      formatter: (cell: unknown) => this.textareaFormatter((cell as { getValue: () => unknown }).getValue()),
    },
    ];
  });

  constructor() {
    if (this.tokenPresent && this.tieneEmpresa) {
      this.cargarRoles();
      this.cargar();
    }
  }

  t(key: string, params?: Record<string, unknown>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<unknown>(this.historialUrl()).subscribe({
      next: (res) => {
        this.rows.set(this.toArray<InvitacionRow>(res).map((row) => this.normalizeRow(row)));
        this.gridNonce.update((n) => n + 1);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.notifyError(extractApiErrorMessage(err, this.t('invitations.loadError')));
        if (err.status === 401) {
          void this.router.navigate(['/t', this.tenant.tenantSlug(), 'login']);
        }
      },
    });
  }

  cargarRoles(): void {
    this.http.get<unknown>('/api/web/v1/roles').subscribe({
      next: (res) => this.roles.set(this.toArray<RolOption>(res).filter((r) => !!r.codigo)),
      error: () => this.roles.set([]),
    });
  }

  cambiarFiltro(value: FiltroInvitacion): void {
    this.estadoFiltro.set(value);
    this.cargar();
  }

  abrirCrear(): void {
    this.email = '';
    this.rolCodigo = '';
    this.modalOpen.set(true);
  }

  cerrarModal(): void {
    if (!this.saving()) {
      this.modalOpen.set(false);
    }
  }

  crearInvitacion(): void {
    this.supportNotice.set('');
    this.lastAcceptUrl.set('');
    if (!this.email.trim() || !this.rolCodigo) {
      this.notifyError(this.t('invitations.createRequired'));
      return;
    }
    this.saving.set(true);
    this.http
      .post<InvitacionResponse>(this.invitacionesUrl(), {
        email: this.email.trim(),
        rolCodigo: this.rolCodigo,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.modalOpen.set(false);
          if (res.emailEnviado === false) {
            this.supportNotice.set(this.t('invitations.emailNotSent'));
            this.lastAcceptUrl.set(res.acceptUrl ?? '');
          } else {
            this.notifySuccess(this.t('invitations.created'));
          }
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.notifyError(extractApiErrorMessage(err, this.t('invitations.createError')));
        },
      });
  }

  onRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    const row = ev.row as InvitacionRow;
    if (ev.action === 'detalle') {
      this.detailState.set(row);
      return;
    }
    if (!this.esPendiente(row)) {
      this.notifyError(this.t('invitations.notPending'));
      return;
    }
    if (ev.action === 'cancelar') {
      this.confirmState.set({
        title: this.t('invitations.cancelTitle'),
        message: this.i18n.t('invitations.cancelMessage', { email: row.email ?? this.t('invitations.thisUser') }),
        confirmText: this.t('invitations.cancelConfirm'),
        onConfirm: () => this.cancelar(row),
      });
      return;
    }
    if (ev.action === 'reenviar') {
      this.reenviar(row);
    }
  }

  cancelarConfirmacion(): void {
    this.confirmState.set(null);
  }

  confirmar(): void {
    const state = this.confirmState();
    this.confirmState.set(null);
    state?.onConfirm();
  }

  cerrarDetalle(): void {
    this.detailState.set(null);
  }

  private cancelar(row: InvitacionRow): void {
    if (!row.id) {
      return;
    }
    if (!this.esPendiente(row)) {
      this.notifyError(this.t('invitations.cancelOnlyPending'));
      return;
    }
    this.http.post(`${this.invitacionesUrl()}/${encodeURIComponent(row.id)}/cancelacion`, {}).subscribe({
      next: () => {
        this.notifySuccess(this.t('invitations.cancelledOne'));
        this.cargar();
      },
      error: (err: HttpErrorResponse) =>
        this.notifyError(extractApiErrorMessage(err, this.t('invitations.cancelError'))),
    });
  }

  private reenviar(row: InvitacionRow): void {
    if (!row.id) {
      return;
    }
    if (!this.esPendiente(row)) {
      this.notifyError(this.t('invitations.resendOnlyPending'));
      return;
    }
    this.http.post(`${this.invitacionesUrl()}/${encodeURIComponent(row.id)}/reenvio`, {}).subscribe({
      next: () => this.notifySuccess(this.t('invitations.resent')),
      error: (err: HttpErrorResponse) =>
        this.notifyError(extractApiErrorMessage(err, this.t('invitations.resendError'))),
    });
  }

  private invitacionesUrl(): string {
    const me = this.session.profile();
    const empresaId = me?.empresaId;
    if (this.isPlatformAdmin() && empresaId) {
      return `/api/web/v1/empresas/${encodeURIComponent(empresaId)}/invitaciones`;
    }
    return '/api/web/v1/invitaciones';
  }

  private historialUrl(): string {
    const params = new URLSearchParams();
    params.set('incluirExpiradas', 'true');
    if (this.estadoFiltro() !== 'TODOS') {
      params.set('estado', this.estadoFiltro());
    }
    return `${this.invitacionesUrl()}?${params.toString()}`;
  }

  private isPlatformAdmin(): boolean {
    const me = this.session.profile();
    return (me?.roles ?? []).includes('PLATFORM_ADMIN') || (me?.permisos ?? []).includes('PLATFORM_ADMIN');
  }

  fmtIso(s: string | undefined): string {
    if (!s) {
      return '';
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
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

  private textareaFormatter(value: unknown): string {
    return `<span class="ts-grid-cell-wrap">${escapeHtml(value)}</span>`;
  }

  private normalizeRow(row: InvitacionRow): InvitacionRow {
    const estado = this.normalizeEstado(row.estado);
    const effectiveEstado =
      row.expirada === true || (estado === 'PENDIENTE' && this.isExpired(row.expiraEn)) ? 'EXPIRADA' : estado;
    return { ...row, estado: effectiveEstado, expirada: effectiveEstado === 'EXPIRADA' };
  }

  private actionMenuFormatter(cell: unknown): string {
    const row = (cell as { getRow?: () => { getData: () => InvitacionRow } }).getRow?.().getData();
    const actions: GridActionItem[] = [];
    if (this.esPendiente(row)) {
      actions.push(
        { action: 'reenviar', label: this.t('invitations.resend'), icon: 'resend' },
        { action: 'cancelar', label: this.t('invitations.cancel'), icon: 'cancel', danger: true },
      );
    }
    actions.push({ action: 'detalle', label: this.t('common.view'), icon: 'view' });
    return gridActionsMenu(actions, this.t('common.actions'));
  }

  private estadoFormatter(value: unknown): string {
    const estado = this.normalizeEstado(value);
    const meta: Record<string, { label: string; cls: string }> = {
      PENDIENTE: { label: 'Pendiente', cls: 'ts-invite-status--pending' },
      PENDIENTE_CONFIRMACION: { label: 'Pendiente', cls: 'ts-invite-status--pending' },
      ACEPTADA: { label: 'Aceptada', cls: 'ts-invite-status--accepted' },
      ACTIVADA: { label: 'Activada', cls: 'ts-invite-status--accepted' },
      CANCELADA: { label: 'Cancelada', cls: 'ts-invite-status--cancelled' },
      EXPIRADA: { label: 'Expirada', cls: 'ts-invite-status--expired' },
    };
    const item = meta[estado] ?? { label: this.humanEstado(estado), cls: 'ts-invite-status--expired' };
    return `<span class="ts-invite-status ${item.cls}">${escapeHtml(item.label)}</span>`;
  }

  private normalizeEstado(value: unknown): string {
    return String(value ?? 'PENDIENTE').trim().toUpperCase() || 'PENDIENTE';
  }

  private humanEstado(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private esPendiente(row: InvitacionRow | undefined): boolean {
    const estado = this.normalizeEstado(row?.estado);
    return estado === 'PENDIENTE' || estado === 'PENDIENTE_CONFIRMACION';
  }

  estadoLabel(value: unknown): string {
    const estado = this.normalizeEstado(value);
    const labels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      PENDIENTE_CONFIRMACION: 'Pendiente',
      ACEPTADA: 'Aceptada',
      ACTIVADA: 'Activada',
      CANCELADA: 'Cancelada',
      EXPIRADA: 'Expirada',
    };
    return labels[estado] ?? this.humanEstado(estado);
  }

  private isExpired(value: string | undefined): boolean {
    if (!value) {
      return false;
    }
    const d = new Date(value);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  }

  private notifyError(text: string): void {
    this.toast.error(text);
  }

  private notifySuccess(text: string): void {
    this.toast.success(text);
  }
}
