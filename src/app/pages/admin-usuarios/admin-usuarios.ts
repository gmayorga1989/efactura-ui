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
import { gridActionsMenu } from '../../shared/ui/grid-actions.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorLocalGridComponent } from '../../shared/ui/organisms/ts-tabulator-local-grid/ts-tabulator-local-grid.component';

type EstadoUsuario = 'ACTIVO' | 'INACTIVO' | 'PENDIENTE_CONFIRMACION';

interface RolOption {
  codigo: string;
  nombre?: string;
}

interface UsuarioRow extends Record<string, unknown> {
  membresiaId?: string;
  id?: string;
  email?: string;
  nombre?: string;
  estado?: EstadoUsuario | string;
  roles?: string[];
  avatarUrl?: string | null;
  enLinea?: boolean | null;
  ultimoPing?: string | null;
}

interface UsuarioForm {
  email: string;
  password: string;
  nombre: string;
  rolCodigo: string;
  estado: EstadoUsuario;
  roles: string[];
}

interface ReenvioTemporalResponse {
  membresiaId?: string;
  estado?: string;
  emailEnviado?: boolean;
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
  selector: 'ts-admin-usuarios-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorLocalGridComponent],
  template: `
    <ts-page-layout
      [title]="t('users.title')"
      [subtitle]="t('users.subtitle')"
      [eyebrow]="t('users.eyebrow')"
    >
      <div page-actions class="d-flex gap-2">
        @if (tokenPresent && tieneEmpresa) {
          <button type="button" class="btn btn-soft-primary btn-sm" (click)="cargar()" [disabled]="loading()">
            {{ t('common.refresh') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirCrear()" [disabled]="loading()">
            {{ t('users.new') }}
          </button>
        }
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('common.toContinue') }}
          } @else {
            {{ t('users.companyRequired') }}
          }
        </p>
      } @else {
        <ts-tabulator-local-grid
          [data]="rows()"
          [columns]="cols()"
          [reloadNonce]="gridNonce()"
          emptyContext="users"
          height="470px"
          (rowAction)="onRowAction($event)"
        />
      }
    </ts-page-layout>

    @if (modalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarModal()"></div>
      <section class="ts-form-modal" role="dialog" aria-modal="true" aria-labelledby="usuario-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <circle cx="9.5" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/>
              <path d="M19 8v6M22 11h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <p class="ts-form-modal__eyebrow mb-0">{{ t('users.eyebrow') }}</p>
            <h3 id="usuario-modal-title" class="mb-0">{{ editingId() ? t('users.edit') : t('users.new') }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarModal()">&times;</button>
        </header>

        <form class="ts-form-modal__body" (ngSubmit)="guardarUsuario()">
          @if (!editingId()) {
            <label class="form-label">
              {{ t('login.email') }}
              <input class="form-control" type="email" name="email" [(ngModel)]="form.email" required autocomplete="off" />
            </label>
            <label class="form-label">
              <span class="ts-password-label">
                {{ t('users.temporaryPassword') }}
                <button type="button" class="btn btn-light btn-sm ts-password-generate" (click)="generarClaveTemporal()">
                  {{ t('users.generatePassword') }}
                </button>
              </span>
              <input class="form-control" type="text" name="password" [(ngModel)]="form.password" required autocomplete="new-password" />
              <small class="text-muted">{{ t('users.passwordHelp') }}</small>
            </label>
          }
          <label class="form-label">
            {{ t('users.name') }}
            <input class="form-control" type="text" name="nombre" [(ngModel)]="form.nombre" required autocomplete="off" />
          </label>
          @if (!editingId()) {
            <label class="form-label">
              {{ t('users.initialRole') }}
              <select class="form-select" name="rolCodigo" [(ngModel)]="form.rolCodigo" required>
                <option value="">{{ t('users.selectRole') }}</option>
                @for (rol of roles(); track rol.codigo) {
                  <option [value]="rol.codigo">{{ rol.codigo }}{{ rol.nombre ? ' - ' + rol.nombre : '' }}</option>
                }
              </select>
            </label>
          } @else {
            <label class="form-label">
              {{ t('common.status') }}
              <select class="form-select" name="estado" [(ngModel)]="form.estado">
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
                @if (form.estado === 'PENDIENTE_CONFIRMACION') {
                  <option value="PENDIENTE_CONFIRMACION">PENDIENTE_CONFIRMACION</option>
                }
              </select>
            </label>
            <label class="form-label">
              {{ t('users.roles') }}
              <select class="form-select" name="roles" multiple size="5" [(ngModel)]="form.roles">
                @for (rol of roles(); track rol.codigo) {
                  <option [value]="rol.codigo">{{ rol.codigo }}{{ rol.nombre ? ' - ' + rol.nombre : '' }}</option>
                }
              </select>
            </label>
          }
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarModal()" [disabled]="saving()">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">
              {{ saving() ? t('common.saving') : t('common.save') }}
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
          <button type="button" class="btn btn-sm" [class.btn-danger]="c.variant === 'danger'" [class.btn-primary]="c.variant === 'primary'" (click)="confirmar()">
            {{ c.confirmText }}
          </button>
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
        width: min(560px, calc(100vw - 2rem));
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
        color: #2563eb;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
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
      .ts-password-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
      .ts-password-generate {
        min-height: 1.8rem !important;
        padding: 0.2rem 0.55rem !important;
        font-size: 0.76rem !important;
        font-weight: 700;
      }
      .ts-form-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding-top: 0.25rem;
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
      :host ::ng-deep .ts-user-cell {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        min-width: 0;
      }
      :host ::ng-deep .ts-user-cell__avatar {
        position: relative;
        display: grid;
        place-items: center;
        flex: 0 0 34px;
        width: 34px;
        height: 34px;
        color: #1d4ed8;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 999px;
        font-size: 0.76rem;
        font-weight: 850;
        overflow: visible;
      }
      :host ::ng-deep .ts-user-cell__avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }
      :host ::ng-deep .ts-user-cell__presence {
        position: absolute;
        right: -2px;
        bottom: -1px;
        width: 0.56rem;
        height: 0.56rem;
        border: 1.5px solid #fff;
        border-radius: 999px;
        background: #94a3b8;
        z-index: 2;
      }
      :host ::ng-deep .ts-user-cell__presence--online {
        background: #22c55e;
      }
      :host ::ng-deep .ts-user-cell__body {
        min-width: 0;
      }
      :host ::ng-deep .ts-user-cell__name,
      :host ::ng-deep .ts-user-cell__email {
        display: block;
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.2;
      }
      :host ::ng-deep .ts-user-cell__name {
        color: #0f172a;
        font-size: 0.86rem;
        font-weight: 800;
      }
      :host ::ng-deep .ts-user-cell__email {
        margin-top: 0.08rem;
        color: #64748b;
        font-size: 0.76rem;
      }
      :host ::ng-deep .ts-grid-status-pill {
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
      :host ::ng-deep .ts-grid-status-pill--active {
        color: #15803d;
        background: #dcfce7;
      }
      :host ::ng-deep .ts-grid-status-pill--inactive {
        color: #475569;
        background: #e2e8f0;
      }
      :host ::ng-deep .ts-grid-status-pill--pending {
        color: #92400e;
        background: #fef3c7;
      }
    `,
  ],
})
export class AdminUsuariosPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly rows = signal<UsuarioRow[]>([]);
  readonly roles = signal<RolOption[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly gridNonce = signal(0);
  readonly modalOpen = signal(false);
  readonly editingId = signal('');
  readonly confirmState = signal<ConfirmState | null>(null);

  form: UsuarioForm = this.emptyForm();

  readonly cols = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    return [
    {
      title: '',
      width: 72,
      hozAlign: 'center',
      headerSort: false,
      formatter: (cell: unknown) => this.actionMenuFormatter(cell),
    },
    {
      title: this.t('users.user'),
      field: 'nombre',
      minWidth: 280,
      formatter: (cell: unknown) => this.usuarioFormatter((cell as { getData: () => UsuarioRow }).getData()),
    },
    {
      title: this.t('common.status'),
      field: 'estado',
      minWidth: 180,
      formatter: (cell: unknown) => {
        const estado = String((cell as { getValue: () => unknown }).getValue() ?? '');
        if (estado === 'PENDIENTE_CONFIRMACION') {
          return `<span class="ts-grid-status-pill ts-grid-status-pill--pending">${escapeHtml(this.t('users.pendingConfirmation'))}</span>`;
        }
        const cls = estado === 'ACTIVO' ? 'ts-grid-status-pill--active' : 'ts-grid-status-pill--inactive';
        const label = estado === 'ACTIVO' ? this.t('common.active') : this.t('common.inactive');
        return `<span class="ts-grid-status-pill ${cls}">${escapeHtml(label)}</span>`;
      },
    },
    {
      title: this.t('users.roles'),
      field: 'roles',
      minWidth: 220,
      formatter: (cell: unknown) => {
        const value = (cell as { getValue: () => unknown }).getValue();
        const roles = Array.isArray(value) ? value : [];
        return roles.map((r) => `<span class="badge bg-light text-dark me-1">${escapeHtml(r)}</span>`).join('');
      },
    },
    ];
  });

  constructor() {
    if (this.tokenPresent && this.tieneEmpresa) {
      this.cargarRoles();
      this.cargar();
    }
  }

  cargar(): void {
    if (!this.tieneEmpresa) {
      return;
    }
    this.loading.set(true);
    this.http.get<unknown>(this.usuariosUrl()).subscribe({
      next: (res) => {
        this.rows.set(this.toArray<UsuarioRow>(res));
        this.gridNonce.update((n) => n + 1);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.notifyError(extractApiErrorMessage(err, this.t('users.loadError')));
        if (err.status === 401) {
          void this.router.navigate(['/t', this.tenant.tenantSlug(), 'login']);
        }
      },
    });
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  private usuarioFormatter(row: UsuarioRow): string {
    const name = String(row.nombre ?? this.t('navbar.userFallback'));
    const email = String(row.email ?? '');
    const avatarUrl = String(row.avatarUrl ?? '').trim();
    const initials = this.initials(name || email);
    const avatar = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" />`
      : escapeHtml(initials);
    const onlineClass = row.enLinea ? ' ts-user-cell__presence--online' : '';
    return `
      <div class="ts-user-cell">
        <span class="ts-user-cell__avatar">
          ${avatar}
          <span class="ts-user-cell__presence${onlineClass}"></span>
        </span>
        <span class="ts-user-cell__body">
          <span class="ts-user-cell__name">${escapeHtml(name)}</span>
          <span class="ts-user-cell__email">${escapeHtml(email)}</span>
        </span>
      </div>`;
  }

  cargarRoles(): void {
    this.http.get<unknown>('/api/web/v1/roles').subscribe({
      next: (res) => this.roles.set(this.toArray<RolOption>(res).filter((r) => !!r.codigo)),
      error: () => this.roles.set([]),
    });
  }

  abrirCrear(): void {
    this.editingId.set('');
    this.form = this.emptyForm();
    this.modalOpen.set(true);
  }

  abrirEditar(row: UsuarioRow): void {
    const id = this.rowId(row);
    if (!id) {
      this.notifyError(this.t('users.missingMembershipEdit'));
      return;
    }
    this.editingId.set(id);
    this.form = {
      email: String(row.email ?? ''),
      password: '',
      nombre: String(row.nombre ?? ''),
      rolCodigo: '',
      estado: this.normalizeEstado(row.estado),
      roles: Array.isArray(row.roles) ? [...row.roles] : [],
    };
    this.modalOpen.set(true);
  }

  cerrarModal(): void {
    if (this.saving()) {
      return;
    }
    this.modalOpen.set(false);
  }

  generarClaveTemporal(): void {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%*?';
    const all = upper + lower + digits + symbols;
    const chars = [
      this.randomChar(upper),
      this.randomChar(lower),
      this.randomChar(digits),
      this.randomChar(symbols),
    ];
    while (chars.length < 14) {
      chars.push(this.randomChar(all));
    }
    this.form.password = this.shuffle(chars).join('');
  }

  guardarUsuario(): void {
    const editing = this.editingId();
    if (!this.form.nombre.trim()) {
      this.notifyError(this.t('users.nameRequired'));
      return;
    }
    if (!editing && (!this.form.email.trim() || !this.form.password || !this.form.rolCodigo)) {
      this.notifyError(this.t('users.createRequired'));
      return;
    }
    this.saving.set(true);
    const req = editing
      ? this.http.patch(`${this.usuariosUrl()}/${encodeURIComponent(editing)}`, {
          nombre: this.form.nombre.trim(),
          estado: this.form.estado,
          roles: this.form.roles,
        })
      : this.http.post(this.usuariosUrl(), {
          email: this.form.email.trim(),
          password: this.form.password,
          nombre: this.form.nombre.trim(),
          rolCodigo: this.form.rolCodigo,
        });
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.notifySuccess(
          editing
            ? this.t('users.updated')
            : this.t('users.created'),
        );
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.notifyError(extractApiErrorMessage(err, this.t('users.saveError')));
      },
    });
  }

  onRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    const row = ev.row as UsuarioRow;
    if (ev.action === 'editar') {
      this.abrirEditar(row);
      return;
    }
    if (ev.action === 'reenviar-temporal') {
      this.reenviarCorreoTemporal(row);
      return;
    }
    if (ev.action === 'activar' || ev.action === 'inactivar') {
      const estado: EstadoUsuario = ev.action === 'activar' ? 'ACTIVO' : 'INACTIVO';
      this.confirmState.set({
        title: estado === 'ACTIVO' ? this.t('users.activateTitle') : this.t('users.inactivateTitle'),
        message:
          estado === 'ACTIVO'
            ? this.t('users.activateMessage')
            : this.t('users.inactivateMessage'),
        confirmText: estado === 'ACTIVO' ? this.t('common.activate') : this.t('common.inactivate'),
        variant: estado === 'ACTIVO' ? 'primary' : 'danger',
        onConfirm: () => this.cambiarEstado(row, estado),
      });
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

  private cambiarEstado(row: UsuarioRow, estado: EstadoUsuario): void {
    const id = this.rowId(row);
    if (!id) {
      this.notifyError(this.t('users.missingMembership'));
      return;
    }
    this.http
      .patch(`${this.usuariosUrl()}/${encodeURIComponent(id)}`, {
        nombre: String(row.nombre ?? ''),
        estado,
        roles: Array.isArray(row.roles) ? row.roles : [],
      })
      .subscribe({
        next: () => {
          this.notifySuccess(estado === 'ACTIVO' ? this.t('users.activated') : this.t('users.inactivated'));
          this.cargar();
        },
        error: (err: HttpErrorResponse) =>
          this.notifyError(extractApiErrorMessage(err, this.t('users.statusError'))),
      });
  }

  private reenviarCorreoTemporal(row: UsuarioRow): void {
    const id = this.rowId(row);
    if (!id) {
      this.notifyError(this.t('users.missingMembershipResend'));
      return;
    }
    if (this.normalizeEstado(row.estado) !== 'PENDIENTE_CONFIRMACION') {
      this.notifyError(this.t('users.resendOnlyPending'));
      return;
    }
    this.http
      .post<ReenvioTemporalResponse>(`${this.usuariosUrl()}/${encodeURIComponent(id)}/reenviar-temporal`, {})
      .subscribe({
        next: (res) => {
          if (res.emailEnviado === false) {
            this.notifyError(this.t('users.resendWarning'));
          } else {
            this.notifySuccess(this.t('users.resendSuccess'));
          }
          this.cargar();
        },
        error: (err: HttpErrorResponse) =>
          this.notifyError(extractApiErrorMessage(err, this.t('users.resendError'))),
      });
  }

  private usuariosUrl(): string {
    const me = this.session.profile();
    const empresaId = me?.empresaId;
    if (this.isPlatformAdmin() && empresaId) {
      return `/api/web/v1/empresas/${encodeURIComponent(empresaId)}/usuarios`;
    }
    return '/api/web/v1/usuarios';
  }

  private isPlatformAdmin(): boolean {
    const me = this.session.profile();
    return (me?.roles ?? []).includes('PLATFORM_ADMIN') || (me?.permisos ?? []).includes('PLATFORM_ADMIN');
  }

  private rowId(row: UsuarioRow): string {
    return String(row.membresiaId ?? row.id ?? '');
  }

  private initials(value: string): string {
    const parts = value
      .replace(/@.*/, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0] ?? 'U').slice(0, 2).toUpperCase();
  }

  private normalizeEstado(value: unknown): EstadoUsuario {
    const estado = String(value ?? 'ACTIVO');
    if (estado === 'INACTIVO' || estado === 'PENDIENTE_CONFIRMACION') {
      return estado;
    }
    return 'ACTIVO';
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

  private notifyError(text: string): void {
    this.toast.error(text);
  }

  private notifySuccess(text: string): void {
    this.toast.success(text);
  }

  private emptyForm(): UsuarioForm {
    return { email: '', password: '', nombre: '', rolCodigo: '', estado: 'ACTIVO', roles: [] };
  }

  private randomChar(chars: string): string {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
      const data = new Uint32Array(1);
      cryptoApi.getRandomValues(data);
      return chars[data[0] % chars.length];
    }
    return chars[Math.floor(Math.random() * chars.length)];
  }

  private shuffle(chars: string[]): string[] {
    const copy = [...chars];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.randomIndex(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private randomIndex(max: number): number {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
      const data = new Uint32Array(1);
      cryptoApi.getRandomValues(data);
      return data[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  private actionMenuFormatter(cell: unknown): string {
    const row = (cell as { getRow?: () => { getData: () => UsuarioRow } }).getRow?.().getData();
    const estado = this.normalizeEstado(row?.estado);
    return gridActionsMenu(
      [
        { action: 'editar', label: this.t('common.edit'), icon: 'edit' },
        ...(estado === 'PENDIENTE_CONFIRMACION'
          ? [{ action: 'reenviar-temporal', label: this.t('users.resendEmail'), icon: 'resend' as const }]
          : []),
        { action: 'inactivar', label: this.t('common.inactivate'), icon: 'inactivate', danger: true },
        ...(estado === 'INACTIVO'
          ? [{ action: 'activar', label: this.t('common.activate'), icon: 'activate' as const }]
          : []),
      ],
      this.t('common.actions'),
    );
  }

  private actionIcon(kind: 'editar' | 'activar' | 'inactivar' | 'reenviar'): string {
    const icons: Record<typeof kind, string> = {
      editar: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20H8L18.5 9.5C19.6 8.4 19.6 6.6 18.5 5.5C17.4 4.4 15.6 4.4 14.5 5.5L4 16V20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          <path d="M13.5 6.5L17.5 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>`,
      activar: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21Z" stroke="currentColor" stroke-width="1.8" />
          <path d="M8 12.3L10.6 14.9L16.2 9.3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`,
      inactivar: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21Z" stroke="currentColor" stroke-width="1.8" />
          <path d="M8 8L16 16M16 8L8 16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>`,
      reenviar: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6H20V18H4V6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          <path d="M4 7L12 13L20 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M17 20L20 17L17 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`,
    };
    return icons[kind];
  }
}
