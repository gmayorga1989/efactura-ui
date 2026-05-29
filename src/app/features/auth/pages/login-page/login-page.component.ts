import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  clearWebTokens,
  writeAccessToken,
  writeRefreshToken,
} from '../../../../core/auth.interceptor';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';
import type {
  EmpresaLoginOptionDto,
  IdentityGatewayTokenResponse,
  LoginResult,
  MeResponse,
  SuiteIdentityPublicStatus,
  TokenResponse,
} from '../../../../core/models/me.model';
import { extractApiErrorMessage } from '../../../../core/session/http-error.util';
import { SessionContextService } from '../../../../core/session/session-context.service';
import { tenantSlugFromMe } from '../../../../core/session/tenant-slug.util';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { TsLoginShellComponent } from '../../../../shared/ui/organisms/ts-login-shell/ts-login-shell.component';

type LoginStep = 'credentials' | 'mfa' | 'select-empresa' | 'forgot-password';

@Component({
  selector: 'ts-login-page',
  standalone: true,
  imports: [FormsModule, TsLoginShellComponent],
  template: `
    <ts-login-shell [brandTitle]="tenant.displayName()">
      @if (step === 'credentials') {
        <div class="auth-heading">
          <div class="auth-heading__icon" aria-hidden="true">
            <svg width="22" viewBox="0 0 24 24" fill="none">
              <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
            </svg>
          </div>
          <h2>{{ t('login.title') }}</h2>
          <p>{{ t('login.subtitle') }}</p>
        </div>

        <form class="auth-form" (ngSubmit)="submitLogin()">
          <label class="auth-field">
            <span>{{ t('login.email') }}</span>
            <div class="auth-input">
              <svg width="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <input
                type="email"
                name="email"
                [(ngModel)]="email"
                autocomplete="username"
                required
                placeholder="usuario@correo.com"
              />
            </div>
          </label>

          <label class="auth-field">
            <span>{{ t('login.password') }}</span>
            <div class="auth-input">
              <svg width="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.7" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
              <input
                type="password"
                name="password"
                [(ngModel)]="password"
                autocomplete="current-password"
                required
                [placeholder]="t('login.passwordPlaceholder')"
              />
            </div>
          </label>

          @if (suiteIdentityLoaded && suiteIdentityStatus?.enabled) {
            <p class="auth-hint-suite" role="status">
              {{ t('login.suiteIdentityHint') }}
            </p>
          }

          @if (suiteIdentityLoaded && suiteIdentityStatus && !suiteIdentityStatus.enabled) {
            @if (suiteIdentityStatus.cryptoReady === false) {
              <p class="auth-hint-warn" role="status">{{ t('login.suiteIdentityCryptoHint') }}</p>
            } @else if (suiteIdentityStatus.featureFlag === false) {
              <p class="auth-hint-warn" role="status">{{ t('login.suiteIdentityFlagOffHint') }}</p>
            }
          }

          <button type="submit" class="auth-submit" [disabled]="loading || !suiteIdentityLoaded">
            @if (loading) {
              <span class="auth-spinner" aria-hidden="true"></span>
            }
            {{ loading ? loadingMessage : t('login.submit') }}
          </button>

          <button type="button" class="auth-link" [disabled]="loading" (click)="showForgotPassword()">
            {{ t('login.forgot') }}
          </button>
        </form>
      } @else if (step === 'forgot-password') {
        <div class="auth-heading">
          <div class="auth-heading__icon auth-heading__icon--reset" aria-hidden="true">
            <svg width="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12a7 7 0 0 1 11.95-4.95L19 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M19 5v4h-4M19 12a7 7 0 0 1-11.95 4.95L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M5 19v-4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h2>{{ t('login.resetTitle') }}</h2>
          <p>{{ t('login.resetSubtitle') }}</p>
        </div>

        <form class="auth-form" (ngSubmit)="requestPasswordReset()">
          <label class="auth-field">
            <span>{{ t('login.email') }}</span>
            <div class="auth-input">
              <svg width="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <input
                type="email"
                name="resetEmail"
                [(ngModel)]="resetEmail"
                autocomplete="email"
                required
                placeholder="usuario@correo.com"
              />
            </div>
          </label>

          <button type="submit" class="auth-submit" [disabled]="loading">
            @if (loading) {
              <span class="auth-spinner" aria-hidden="true"></span>
            }
            {{ loading ? loadingMessage : t('login.sendInstructions') }}
          </button>
          <button type="button" class="auth-secondary auth-secondary--flat" [disabled]="loading" (click)="backToCredentials()">
            {{ t('login.backToLogin') }}
          </button>
        </form>
      } @else if (step === 'mfa') {
        <div class="auth-heading">
          <div class="auth-heading__icon auth-heading__icon--mfa" aria-hidden="true">
            <svg width="22" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <path d="M12 14v2.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </div>
          <h2>{{ t('login.mfaTitle') }}</h2>
          <p>{{ t('login.mfaSubtitle') }}</p>
        </div>

        <form class="auth-form" (ngSubmit)="submitMfa()">
          <label class="auth-field">
            <span>{{ t('login.mfaCode') }}</span>
            <div class="auth-input">
              <svg width="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
              <input
                type="text"
                name="mfaCode"
                [(ngModel)]="mfaCode"
                inputmode="numeric"
                maxlength="6"
                autocomplete="one-time-code"
                required
                placeholder="123456"
              />
            </div>
          </label>

          <button type="submit" class="auth-submit" [disabled]="loading">
            @if (loading) {
              <span class="auth-spinner" aria-hidden="true"></span>
            }
            {{ loading ? loadingMessage : t('login.verify') }}
          </button>
          <button type="button" class="auth-secondary auth-secondary--flat" [disabled]="loading" (click)="backToCredentials()">
            {{ t('login.back') }}
          </button>
        </form>
      } @else {
        <div class="auth-heading">
          <div class="auth-heading__icon auth-heading__icon--company" aria-hidden="true">
            <svg width="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
              <path d="M8 7h5M8 11h5M8 15h3M17 9h1a2 2 0 0 1 2 2v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </div>
          <h2>{{ t('login.companyTitle') }}</h2>
          <p>{{ t('login.companySubtitle', { email }) }}</p>
        </div>

        <div class="company-list">
          @for (opt of empresaOptions; track trackEmpresa(opt)) {
            <button
              type="button"
              class="company-option"
              [class.company-option--disabled]="!opt.seleccionable"
              [class.company-option--loading]="isSelectingEmpresa(opt)"
              [disabled]="!opt.seleccionable || loading"
              [title]="opt.motivoNoSeleccion ?? ''"
              (click)="submitSelectEmpresa(opt)"
            >
              <span class="company-option__avatar" aria-hidden="true">{{ empresaInitials(opt) }}</span>
              <span class="company-option__body">
                <strong>{{ etiquetaEmpresa(opt) }}</strong>
                @if (opt.ruc && !opt.esPlataforma) {
                  <small>RUC {{ opt.ruc }}</small>
                }
                @if (!opt.seleccionable && opt.motivoNoSeleccion) {
                  <small class="company-option__reason">{{ opt.motivoNoSeleccion }}</small>
                }
              </span>
              @if (isSelectingEmpresa(opt)) {
                <span class="auth-spinner company-option__spinner" aria-hidden="true"></span>
              } @else {
                <svg class="company-option__arrow" width="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              }
            </button>
          }
        </div>

        @if (loading) {
          <div class="auth-progress">
            <span class="auth-spinner" aria-hidden="true"></span>
            {{ loadingMessage }}
          </div>
        }

        <button type="button" class="auth-secondary" [disabled]="loading" (click)="backToCredentials()">
          {{ t('login.backToCredentials') }}
        </button>
      }
    </ts-login-shell>
  `,
  styles: [
    `
      .auth-heading {
        display: grid;
        justify-items: center;
        gap: 0.45rem;
        margin-bottom: 1.35rem;
        text-align: center;
      }
      .auth-heading__icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        color: #2563eb;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 15px;
      }
      .auth-heading__icon--company {
        color: #0f766e;
        background: #f0fdfa;
        border-color: #99f6e4;
      }
      .auth-heading__icon--reset {
        color: #7c3aed;
        background: #f5f3ff;
        border-color: #ddd6fe;
      }
      .auth-heading__icon--mfa {
        color: #b45309;
        background: #fffbeb;
        border-color: #fde68a;
      }
      .auth-heading h2 {
        margin: 0;
        color: #0f172a;
        font-size: 1.35rem;
        font-weight: 750;
      }
      .auth-heading p {
        max-width: 28rem;
        margin: 0;
        color: #64748b;
        font-size: 0.9rem;
        line-height: 1.45;
      }
      .auth-form {
        display: grid;
        gap: 0.85rem;
      }
      .auth-hint-suite {
        margin: -0.2rem 0 0;
        padding: 0 0.1rem;
        font-size: 0.78rem;
        line-height: 1.35;
        color: #64748b;
        font-weight: 600;
      }
      .auth-hint-warn {
        margin: -0.15rem 0 0;
        padding: 0.45rem 0.55rem;
        font-size: 0.76rem;
        line-height: 1.35;
        color: #92400e;
        font-weight: 650;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 10px;
      }
      .auth-field {
        display: grid;
        gap: 0.35rem;
        color: #334155;
        font-size: 0.84rem;
        font-weight: 700;
      }
      .auth-input {
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
      .auth-input:focus-within {
        border-color: #93c5fd;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
      }
      .auth-input input {
        width: 100%;
        border: 0;
        outline: 0;
        color: #0f172a;
        background: transparent;
        font-size: 0.92rem;
      }
      .auth-submit,
      .auth-secondary,
      .auth-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        min-height: 2.35rem;
        border-radius: 11px;
        font-size: 0.88rem;
        font-weight: 750;
      }
      .auth-submit {
        margin-top: 0.25rem;
        border: 0;
        color: #fff;
        background: #2563eb;
        box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
      }
      .auth-submit:hover:not(:disabled) {
        background: #1d4ed8;
      }
      .auth-secondary {
        width: 100%;
        margin-top: 0.8rem;
        border: 1px solid #dbe3ef;
        color: #334155;
        background: #fff;
      }
      .auth-secondary--flat {
        margin-top: 0;
      }
      .auth-link {
        min-height: 1.8rem;
        border: 0;
        color: #2563eb;
        background: transparent;
        font-size: 0.82rem;
        box-shadow: none;
      }
      .auth-link:hover:not(:disabled) {
        color: #1d4ed8;
        text-decoration: underline;
      }
      .auth-error {
        padding: 0.6rem 0.75rem;
        color: #b91c1c;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 12px;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .auth-success {
        padding: 0.6rem 0.75rem;
        color: #166534;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .auth-progress {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.8rem;
        padding: 0.6rem 0.75rem;
        color: #1d4ed8;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
        font-size: 0.82rem;
        font-weight: 750;
      }
      .auth-spinner {
        display: inline-block;
        width: 0.9rem;
        height: 0.9rem;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 999px;
        animation: auth-spin 700ms linear infinite;
      }
      .company-list {
        display: grid;
        gap: 0.55rem;
        max-height: 360px;
        overflow: auto;
        padding-right: 0.2rem;
      }
      .company-option {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        min-height: 4rem;
        padding: 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        color: #0f172a;
        background: #fff;
        text-align: left;
        transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }
      .company-option:hover:not(:disabled) {
        border-color: #93c5fd;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
        transform: translateY(-1px);
      }
      .company-option--disabled {
        opacity: 0.62;
        cursor: not-allowed;
      }
      .company-option--loading {
        border-color: #93c5fd;
        box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
        opacity: 1;
      }
      .company-option__avatar {
        display: grid;
        place-items: center;
        flex: 0 0 40px;
        width: 40px;
        height: 40px;
        color: #1d4ed8;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 13px;
        font-size: 0.82rem;
        font-weight: 800;
      }
      .company-option__body {
        display: grid;
        gap: 0.12rem;
        min-width: 0;
      }
      .company-option__body strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.9rem;
      }
      .company-option__body small {
        color: #64748b;
        font-size: 0.76rem;
        font-weight: 650;
      }
      .company-option__reason {
        color: #b91c1c !important;
      }
      .company-option__arrow {
        margin-left: auto;
        color: #94a3b8;
      }
      .company-option__spinner {
        margin-left: auto;
        color: #2563eb;
      }
      @keyframes auth-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoginPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = inject(SessionContextService);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);

  step: LoginStep = 'credentials';
  email = '';
  password = '';
  mfaCode = '';
  resetEmail = '';
  loading = false;
  loadingMessage = '';

  sessionTicket = '';
  empresaOptions: EmpresaLoginOptionDto[] = [];
  selectingEmpresaKey = '';

  suiteIdentityStatus: SuiteIdentityPublicStatus | null = null;
  suiteIdentityLoaded = false;

  ngOnInit(): void {
    this.session.clearMe();
    clearWebTokens();
    this.http.get<SuiteIdentityPublicStatus>('/api/public/v1/auth/suite-identity').subscribe({
      next: (s) => {
        this.suiteIdentityStatus = s;
        this.suiteIdentityLoaded = true;
      },
      error: () => {
        this.suiteIdentityStatus = {
          enabled: false,
          featureFlag: false,
          cryptoReady: false,
          identityBaseUrl: '',
          issuer: '',
          companySlug: '',
        };
        this.suiteIdentityLoaded = true;
      },
    });
  }

  trackEmpresa(opt: EmpresaLoginOptionDto): string {
    return opt.esPlataforma ? 'platform' : (opt.empresaId ?? 'unknown');
  }

  etiquetaEmpresa(opt: EmpresaLoginOptionDto): string {
    if (opt.esPlataforma) {
      return this.t('navbar.platform');
    }
    const nc = opt.nombreComercial?.trim();
    return nc || opt.razonSocial;
  }

  empresaInitials(opt: EmpresaLoginOptionDto): string {
    if (opt.esPlataforma) {
      return 'PL';
    }
    const label = this.etiquetaEmpresa(opt).replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0] ?? 'E').slice(0, 2).toUpperCase();
  }

  backToCredentials(): void {
    if (this.loading) {
      return;
    }
    this.step = 'credentials';
    this.sessionTicket = '';
    this.empresaOptions = [];
    this.selectingEmpresaKey = '';
    this.mfaCode = '';
  }

  showForgotPassword(): void {
    if (this.loading) {
      return;
    }
    this.step = 'forgot-password';
    this.resetEmail = this.email.trim();
  }

  t(key: string, params?: Record<string, unknown>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  submitLogin(): void {
    if (!this.email.trim() || !this.password) {
      this.toast.error(this.i18n.t('login.requiredCredentials', 'Ingresa correo y contrasena.'));
      return;
    }
    if (!this.suiteIdentityLoaded) {
      this.toast.error(this.t('login.waitSuiteConfig'));
      return;
    }
    if (this.suiteIdentityStatus?.enabled) {
      this.submitSuiteIdentityLogin();
      return;
    }
    this.loading = true;
    this.loadingMessage = this.i18n.t('login.validating', 'Validando credenciales...');
    this.http
      .post<LoginResult>('/api/web/v1/auth/login', {
        email: this.email.trim(),
        password: this.password,
      })
      .subscribe({
        next: (res) => this.handleLoginResult(res),
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.loadingMessage = '';
          this.toast.error(extractApiErrorMessage(err, this.i18n.t('login.invalidCredentials', 'Credenciales invalidas o error de red.')));
        },
      });
  }

  private submitSuiteIdentityLogin(): void {
    const status = this.suiteIdentityStatus;
    if (!status?.enabled) {
      return;
    }
    const base = status.identityBaseUrl.replace(/\/+$/, '');
    const slug = (status.companySlug ?? '').trim();
    if (!base || !slug) {
      this.toast.error(this.t('login.suiteIdentityMisconfigured'));
      return;
    }
    this.loading = true;
    this.loadingMessage = this.t('login.validatingIdentity');
    const loginUrl = `${base}/api/v1/auth/login`;
    this.http
      .post<IdentityGatewayTokenResponse>(loginUrl, {
        companySlug: slug,
        email: this.email.trim(),
        password: this.password,
      })
      .pipe(
        switchMap((ig) =>
          this.http.post<TokenResponse>(
            '/api/web/v1/auth/suite/exchange',
            {},
            {
              headers: {
                Authorization: `Bearer ${ig.accessToken}`,
              },
            },
          ),
        ),
      )
      .subscribe({
        next: (tokens) =>
          this.handleLoginResult({
            loginStep: 'COMPLETE',
            tokens,
            sessionTicket: null,
            empresas: null,
          }),
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.loadingMessage = '';
          this.toast.error(extractApiErrorMessage(err, this.t('login.suiteIdentityError')));
        },
      });
  }

  submitMfa(): void {
    if (!/^\d{6}$/.test(this.mfaCode.trim())) {
      this.toast.error(this.i18n.t('login.mfaRequired', 'Ingresa un codigo 2FA de 6 digitos.'));
      return;
    }
    this.loading = true;
    this.loadingMessage = this.i18n.t('login.verifyingCode', 'Verificando codigo...');
    this.http
      .post<LoginResult>('/api/web/v1/auth/login', {
        email: this.email.trim(),
        password: this.password,
        mfaCode: this.mfaCode.trim(),
      })
      .subscribe({
        next: (res) => this.handleLoginResult(res),
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.loadingMessage = '';
          this.toast.error(extractApiErrorMessage(err, this.i18n.t('login.invalidMfa', 'Codigo 2FA invalido.')));
        },
      });
  }

  requestPasswordReset(): void {
    if (!this.resetEmail.trim()) {
      this.toast.error(this.i18n.t('login.emailRequired', 'Ingresa tu correo.'));
      return;
    }
    this.loading = true;
    this.loadingMessage = this.i18n.t('login.sendingInstructions', 'Enviando instrucciones...');
    this.http
      .post('/api/web/v1/auth/password-reset/request', {
        email: this.resetEmail.trim(),
      })
      .subscribe({
        next: () => this.finishPasswordResetRequest(),
        error: () => this.finishPasswordResetRequest(),
      });
  }

  private finishPasswordResetRequest(): void {
    this.loading = false;
    this.loadingMessage = '';
    this.toast.success(
      this.i18n.t(
        'login.resetGenericMessage',
        'Si el correo existe en el sistema, se enviaron instrucciones para recuperar la contrasena.',
      ),
    );
  }

  submitSelectEmpresa(opt: EmpresaLoginOptionDto): void {
    if (!opt.seleccionable || this.loading) {
      return;
    }
    this.loading = true;
    this.loadingMessage = this.i18n.t('login.confirmingCompany', 'Confirmando empresa...');
    this.selectingEmpresaKey = this.trackEmpresa(opt);
    const empresaId = opt.esPlataforma ? null : opt.empresaId;
    this.http
      .post<LoginResult>('/api/web/v1/auth/select-empresa', {
        sessionTicket: this.sessionTicket,
        empresaId,
      })
      .subscribe({
        next: (res) => this.handleLoginResult(res),
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.loadingMessage = '';
          this.selectingEmpresaKey = '';
          this.toast.error(extractApiErrorMessage(err, this.i18n.t('login.companyConfirmError', 'No se pudo confirmar la empresa.')));
        },
      });
  }

  isSelectingEmpresa(opt: EmpresaLoginOptionDto): boolean {
    return this.loading && this.selectingEmpresaKey === this.trackEmpresa(opt);
  }

  private handleLoginResult(res: LoginResult): void {
    if (res.loginStep === 'COMPLETE' && res.tokens) {
      this.loadingMessage = this.t('login.loadingWorkspace');
      this.persistTokens(res.tokens);
      this.loadMeAndNavigate();
      return;
    }
    if (res.loginStep === 'SELECT_EMPRESA' && res.sessionTicket && res.empresas?.length) {
      this.loading = false;
      this.loadingMessage = '';
      this.selectingEmpresaKey = '';
      this.step = 'select-empresa';
      this.sessionTicket = res.sessionTicket;
      this.empresaOptions = res.empresas;
      return;
    }
    if (res.loginStep === 'MFA_REQUIRED' || res.mfaRequired) {
      this.loading = false;
      this.loadingMessage = '';
      this.step = 'mfa';
      this.mfaCode = '';
      return;
    }
    this.loading = false;
    this.loadingMessage = '';
    this.selectingEmpresaKey = '';
    this.toast.error(this.t('login.genericUnexpected'));
  }

  private persistTokens(t: TokenResponse): void {
    writeAccessToken(t.accessToken);
    writeRefreshToken(t.refreshToken);
  }

  private loadMeAndNavigate(): void {
    this.http.get<MeResponse>('/api/web/v1/me').subscribe({
      next: (me) => {
        this.session.setMe(me);
        const slug = tenantSlugFromMe(me);
        this.tenant.setSlug(slug);
        this.loadingMessage = this.t('login.openingDashboard');
        void this.router.navigate(['/t', slug, 'dashboard'], { replaceUrl: true }).finally(() => {
          this.loading = false;
          this.loadingMessage = '';
          this.selectingEmpresaKey = '';
        });
      },
      error: () => {
        this.loading = false;
        this.loadingMessage = '';
        this.selectingEmpresaKey = '';
        this.toast.error(this.t('login.profileLoadError'));
      },
    });
  }
}
