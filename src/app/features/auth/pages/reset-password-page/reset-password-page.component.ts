import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { clearWebTokens } from '../../../../core/auth.interceptor';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';
import { extractApiErrorMessage } from '../../../../core/session/http-error.util';
import { SessionContextService } from '../../../../core/session/session-context.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { TsLoginShellComponent } from '../../../../shared/ui/organisms/ts-login-shell/ts-login-shell.component';

@Component({
  selector: 'ts-reset-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsLoginShellComponent],
  template: `
    <ts-login-shell [brandTitle]="tenant.displayName()">
      <div class="reset-heading">
        <div class="reset-heading__icon" aria-hidden="true">
          <svg width="23" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            <path d="M12 14v2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </div>
        <h2>{{ success ? t('reset.successTitle') : t('reset.title') }}</h2>
        <p>
          {{
            success
              ? t('reset.successSubtitle')
              : t('reset.subtitle')
          }}
        </p>
      </div>

      @if (!success) {
        <form class="reset-form" (ngSubmit)="confirmReset()">
          <label class="reset-field">
            <span>{{ t('reset.newPassword') }}</span>
            <div class="reset-input">
              <svg width="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.7" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
              <input
                type="password"
                name="passwordNuevo"
                [(ngModel)]="passwordNuevo"
                autocomplete="new-password"
                required
                minlength="8"
                [placeholder]="t('reset.minPlaceholder')"
              />
            </div>
          </label>

          <label class="reset-field">
            <span>{{ t('reset.confirmPassword') }}</span>
            <div class="reset-input">
              <svg width="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <input
                type="password"
                name="passwordConfirmacion"
                [(ngModel)]="passwordConfirmacion"
                autocomplete="new-password"
                required
                minlength="8"
                [placeholder]="t('reset.repeatPlaceholder')"
              />
            </div>
          </label>

          <button type="submit" class="reset-submit" [disabled]="loading || !token">
            @if (loading) {
              <span class="reset-spinner" aria-hidden="true"></span>
            }
            {{ loading ? t('reset.updating') : t('reset.submit') }}
          </button>
        </form>
      } @else {
        <div class="reset-success">
          <svg width="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ t('reset.successMessage') }}
        </div>
      }

      <a class="reset-secondary" [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('reset.goLogin') }}</a>
    </ts-login-shell>
  `,
  styles: [
    `
      .reset-heading {
        display: grid;
        justify-items: center;
        gap: 0.45rem;
        margin-bottom: 1.3rem;
        text-align: center;
      }
      .reset-heading__icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        color: #7c3aed;
        background: #f5f3ff;
        border: 1px solid #ddd6fe;
        border-radius: 15px;
      }
      .reset-heading h2 {
        margin: 0;
        color: #0f172a;
        font-size: 1.35rem;
        font-weight: 750;
      }
      .reset-heading p {
        max-width: 28rem;
        margin: 0;
        color: #64748b;
        font-size: 0.9rem;
        line-height: 1.45;
      }
      .reset-form {
        display: grid;
        gap: 0.85rem;
      }
      .reset-field {
        display: grid;
        gap: 0.35rem;
        color: #334155;
        font-size: 0.84rem;
        font-weight: 700;
      }
      .reset-input {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        min-height: 2.55rem;
        padding: 0 0.75rem;
        color: #64748b;
        background: #fff;
        border: 1px solid #dbe3ef;
        border-radius: 12px;
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }
      .reset-input:focus-within {
        border-color: #c4b5fd;
        box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
      }
      .reset-input input {
        width: 100%;
        border: 0;
        outline: 0;
        color: #0f172a;
        background: transparent;
        font-size: 0.92rem;
      }
      .reset-submit,
      .reset-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        min-height: 2.35rem;
        border-radius: 11px;
        font-size: 0.88rem;
        font-weight: 750;
      }
      .reset-submit {
        margin-top: 0.15rem;
        border: 0;
        color: #fff;
        background: #7c3aed;
        box-shadow: 0 10px 24px rgba(124, 58, 237, 0.2);
      }
      .reset-submit:hover:not(:disabled) {
        background: #6d28d9;
      }
      .reset-secondary {
        width: 100%;
        margin-top: 0.8rem;
        color: #334155;
        background: #fff;
        border: 1px solid #dbe3ef;
        text-decoration: none;
      }
      .reset-error {
        padding: 0.6rem 0.75rem;
        color: #b91c1c;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 12px;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .reset-success {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.7rem 0.8rem;
        color: #166534;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        font-size: 0.86rem;
        font-weight: 750;
      }
      .reset-spinner {
        display: inline-block;
        width: 0.9rem;
        height: 0.9rem;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 999px;
        animation: reset-spin 700ms linear infinite;
      }
      @keyframes reset-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  private readonly session = inject(SessionContextService);
  readonly tenant = inject(TenantContextService);

  token = '';
  passwordNuevo = '';
  passwordConfirmacion = '';
  loading = false;
  success = false;

  ngOnInit(): void {
    clearWebTokens();
    this.session.clearMe();
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.toast.error(this.t('reset.invalidLink'));
    }
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  confirmReset(): void {
    if (!this.token) {
      this.toast.error(this.t('reset.invalidLink'));
      return;
    }
    if (this.passwordNuevo.length < 8) {
      this.toast.error(this.t('reset.minError'));
      return;
    }
    if (this.passwordNuevo !== this.passwordConfirmacion) {
      this.toast.error(this.t('reset.confirmError'));
      return;
    }
    this.loading = true;
    this.http
      .post('/api/web/v1/auth/password-reset/confirm', {
        token: this.token,
        passwordNuevo: this.passwordNuevo,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
          this.passwordNuevo = '';
          this.passwordConfirmacion = '';
          this.toast.success(this.t('reset.successMessage'));
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.toast.error(extractApiErrorMessage(err, this.t('reset.expiredError')));
        },
      });
  }
}
