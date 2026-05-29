import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { extractApiErrorMessage } from '../../../../core/session/http-error.util';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { TsLoginShellComponent } from '../../../../shared/ui/organisms/ts-login-shell/ts-login-shell.component';

@Component({
  selector: 'ts-accept-invite-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsLoginShellComponent],
  template: `
    <ts-login-shell [brandTitle]="tenant.displayName()">
      <div class="invite-card">
        <div class="invite-icon" aria-hidden="true">
          <svg width="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
            <path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h2>{{ t('invite.title') }}</h2>
        <p class="text-muted">{{ t('invite.subtitle') }}</p>
      </div>

      @if (!token) {
        <p class="text-danger small mb-0">{{ t('invite.noToken') }}</p>
      } @else if (done) {
        <p class="text-success small mb-3">{{ t('invite.success') }}</p>
        <div class="d-flex justify-content-center">
          <a class="btn btn-primary btn-sm" [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('invite.goLogin') }}</a>
        </div>
      } @else {
        <form class="invite-form" (ngSubmit)="aceptar()">
          <label class="invite-switch">
            <input type="checkbox" name="usuarioExistente" [(ngModel)]="usuarioExistente" />
            {{ t('invite.existingUserCheckbox') }}
          </label>

          @if (!usuarioExistente) {
            <label class="form-label">
              {{ t('invite.name') }}
              <input class="form-control" name="nombre" [(ngModel)]="nombre" required autocomplete="name" />
            </label>
          }
          <label class="form-label">
            {{ usuarioExistente ? t('invite.currentPassword') : t('invite.newPassword') }}
            <input
              class="form-control"
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              [autocomplete]="usuarioExistente ? 'current-password' : 'new-password'"
            />
          </label>
          <div class="d-flex justify-content-center gap-2">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="loading">
              {{ loading ? t('invite.processing') : t('invite.submit') }}
            </button>
            <a class="btn btn-light btn-sm" [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('login.back') }}</a>
          </div>
        </form>
      }
    </ts-login-shell>
  `,
  styles: [
    `
      .invite-card {
        display: grid;
        justify-items: center;
        gap: 0.45rem;
        margin-bottom: 1.2rem;
        text-align: center;
      }
      .invite-icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        color: #2563eb;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 15px;
      }
      .invite-card h2 {
        margin: 0;
        color: #0f172a;
        font-size: 1.35rem;
        font-weight: 750;
      }
      .invite-card p {
        margin: 0;
        font-size: 0.9rem;
      }
      .invite-form {
        display: grid;
        gap: 0.9rem;
      }
      .invite-form .form-label {
        display: grid;
        gap: 0.35rem;
        margin: 0;
        color: #334155;
        font-size: 0.84rem;
        font-weight: 650;
      }
      .invite-form .form-control {
        min-height: 2.25rem;
        border-radius: 10px;
        font-size: 0.9rem;
      }
      .invite-switch {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.65rem 0.75rem;
        color: #334155;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        font-size: 0.86rem;
        font-weight: 650;
      }
    `,
  ],
})
export class AcceptInvitePageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);

  token = '';
  nombre = '';
  password = '';
  usuarioExistente = false;
  loading = false;
  done = false;
  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.toast.error(this.i18n.t('invite.noToken'));
    }
  }

  aceptar(): void {
    if (!this.token) {
      this.toast.error(this.i18n.t('invite.noToken'));
      return;
    }
    if (!this.password) {
      this.toast.error(this.i18n.t('invite.passwordRequired'));
      return;
    }
    if (!this.usuarioExistente && !this.nombre.trim()) {
      this.toast.error(this.i18n.t('invite.nameRequired'));
      return;
    }
    const body = this.usuarioExistente
      ? { token: this.token, password: this.password }
      : { token: this.token, password: this.password, nombre: this.nombre.trim() };
    this.loading = true;
    this.http.post('/api/web/v1/auth/accept-invite', body).subscribe({
      next: () => {
        this.loading = false;
        this.done = true;
        this.toast.success(this.i18n.t('invite.success'));
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.toast.error(extractApiErrorMessage(err, this.i18n.t('invite.acceptError')));
      },
    });
  }

  t(key: string, params?: Record<string, unknown>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }
}
