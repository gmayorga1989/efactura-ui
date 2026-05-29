import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  clearWebTokens,
  writeAccessToken,
  writeRefreshToken,
} from '../../../../core/auth.interceptor';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';
import type { MeResponse, TokenResponse } from '../../../../core/models/me.model';
import { extractApiErrorMessage } from '../../../../core/session/http-error.util';
import { SessionContextService } from '../../../../core/session/session-context.service';
import { tenantSlugFromMe } from '../../../../core/session/tenant-slug.util';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { TsLoginShellComponent } from '../../../../shared/ui/organisms/ts-login-shell/ts-login-shell.component';

@Component({
  selector: 'ts-activate-temporary-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsLoginShellComponent],
  template: `
    <ts-login-shell [brandTitle]="tenant.displayName()">
      <div class="activation-card">
        <div class="activation-icon" aria-hidden="true">
          <svg width="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </div>
        <h2>{{ t('activate.title') }}</h2>
        <p class="text-muted">{{ t('activate.subtitle') }}</p>
      </div>

      <form class="activation-form" (ngSubmit)="activar()">
        <label class="form-label">
          {{ t('activate.emailLabel') }}
          <input
            class="form-control"
            type="email"
            name="email"
            [(ngModel)]="email"
            required
            autocomplete="username"
            [readonly]="emailBloqueado"
            [class.activation-readonly]="emailBloqueado"
          />
        </label>
        <label class="form-label">
          {{ t('activate.tempPassword') }}
          <input class="form-control" type="password" name="passwordTemporal" [(ngModel)]="passwordTemporal" required autocomplete="current-password" />
        </label>
        <label class="form-label">
          {{ t('activate.newPassword') }}
          <input class="form-control" type="password" name="passwordNuevo" [(ngModel)]="passwordNuevo" required autocomplete="new-password" />
        </label>
        <label class="form-label">
          {{ t('activate.confirmPassword') }}
          <input class="form-control" type="password" name="passwordConfirmacion" [(ngModel)]="passwordConfirmacion" required autocomplete="new-password" />
        </label>
        @if (empresaId) {
          <div class="activation-scope">
            <span>{{ t('activate.company') }}</span>
            <strong>{{ empresaNombreVisible }}</strong>
          </div>
        }
        <div class="d-flex justify-content-center gap-2">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="loading">
            {{ loading ? t('activate.submitting') : t('activate.submit') }}
          </button>
          <a class="btn btn-light btn-sm" [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('login.back') }}</a>
        </div>
      </form>
    </ts-login-shell>
  `,
  styles: [
    `
      .activation-card {
        display: grid;
        justify-items: center;
        gap: 0.45rem;
        margin-bottom: 1.2rem;
        text-align: center;
      }
      .activation-icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        color: #0f766e;
        background: #f0fdfa;
        border: 1px solid #99f6e4;
        border-radius: 15px;
      }
      .activation-card h2 {
        margin: 0;
        color: #0f172a;
        font-size: 1.35rem;
        font-weight: 750;
      }
      .activation-card p {
        margin: 0;
        font-size: 0.9rem;
      }
      .activation-form {
        display: grid;
        gap: 0.85rem;
      }
      .activation-form .form-label {
        display: grid;
        gap: 0.35rem;
        margin: 0;
        color: #334155;
        font-size: 0.84rem;
        font-weight: 650;
      }
      .activation-form .form-control {
        min-height: 2.25rem;
        border-radius: 10px;
        font-size: 0.9rem;
      }
      .activation-form .form-control.activation-readonly {
        color: #475569;
        background: #f8fafc;
        border-color: #e2e8f0;
        cursor: default;
      }
      .activation-scope {
        display: grid;
        gap: 0.12rem;
        padding: 0.55rem 0.7rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
      .activation-scope span {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .activation-scope strong {
        color: #0f172a;
        font-size: 0.84rem;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class ActivateTemporaryPasswordPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionContextService);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);

  email = '';
  passwordTemporal = '';
  passwordNuevo = '';
  passwordConfirmacion = '';
  empresaId = '';
  empresaNombreVisible = '';
  emailBloqueado = false;
  loading = false;

  ngOnInit(): void {
    clearWebTokens();
    this.session.clearMe();
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.emailBloqueado = this.email.trim().length > 0;
    this.empresaId = this.route.snapshot.queryParamMap.get('empresaId') ?? '';
    this.empresaNombreVisible =
      this.route.snapshot.queryParamMap.get('empresaNombre') ??
      this.route.snapshot.queryParamMap.get('empresa') ??
      this.fallbackEmpresaLabel();
  }

  activar(): void {
    if (!this.email.trim() || !this.passwordTemporal || !this.passwordNuevo || !this.passwordConfirmacion) {
      this.toast.error(this.i18n.t('activate.completeFields'));
      return;
    }
    if (this.passwordNuevo !== this.passwordConfirmacion) {
      this.toast.error(this.i18n.t('activate.confirmMismatch'));
      return;
    }
    const body: {
      email: string;
      passwordTemporal: string;
      passwordNuevo: string;
      empresaId?: string;
    } = {
      email: this.email.trim(),
      passwordTemporal: this.passwordTemporal,
      passwordNuevo: this.passwordNuevo,
    };
    if (this.empresaId.trim()) {
      body.empresaId = this.empresaId.trim();
    }
    this.loading = true;
    this.http.post<TokenResponse>('/api/web/v1/auth/activate-temporary-password', body).subscribe({
      next: (tokens) => {
        writeAccessToken(tokens.accessToken);
        writeRefreshToken(tokens.refreshToken);
        this.loadMeAndNavigate();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.toast.error(extractApiErrorMessage(err, this.i18n.t('activate.activateError')));
      },
    });
  }

  private loadMeAndNavigate(): void {
    this.http.get<MeResponse>('/api/web/v1/me').subscribe({
      next: (me) => {
        this.session.setMe(me);
        const slug = tenantSlugFromMe(me);
        this.tenant.setSlug(slug);
        this.loading = false;
        void this.router.navigate(['/t', slug, 'dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.toast.error(extractApiErrorMessage(err, this.i18n.t('activate.profileError')));
      },
    });
  }

  private fallbackEmpresaLabel(): string {
    const tenantName = this.tenant.displayName();
    if (tenantName && tenantName !== 'default') {
      return tenantName;
    }
    return this.i18n.t('activate.assignedCompany');
  }

  t(key: string, params?: Record<string, unknown>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }
}
