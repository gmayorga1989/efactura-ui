import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  readIdentityHandoffAccess,
  readIdentityHandoffRefresh,
} from '../../../../core/auth.interceptor';
import type { SuiteIdentityPublicStatus } from '../../../../core/models/me.model';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { SessionContextService } from '../../../../core/session/session-context.service';

@Component({
  selector: 'ts-ecosystem-apps-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loaded() && status(); as st) {
      @if (st.enabled && shellBase()) {
        <section class="eco" aria-labelledby="eco-title">
          <div class="eco-head">
            <h2 id="eco-title" class="eco-title">{{ t('dashboard.ecosystemTitle') }}</h2>
            <p class="eco-sub">{{ t('dashboard.ecosystemSubtitle') }}</p>
          </div>
          <div class="eco-grid">
            <article class="eco-card">
              <div class="eco-card__brand eco-card__brand--suite" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="4" y="4" width="32" height="32" rx="9" stroke="currentColor" stroke-width="1.6" />
                  <path d="M12 20h16M20 12v16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </div>
              <div class="eco-card__body">
                <h3 class="eco-card__title">{{ t('dashboard.ecoSuiteTitle') }}</h3>
                <p class="eco-card__desc">{{ t('dashboard.ecoSuiteDesc') }}</p>
                <button type="button" class="eco-btn" (click)="openShellHome()">
                  {{ t('dashboard.ecoSuiteCta') }}
                </button>
              </div>
            </article>

            <article class="eco-card eco-card--current">
              <div class="eco-card__brand eco-card__brand--ef" aria-hidden="true">
                <span class="eco-ef">e</span>
              </div>
              <div class="eco-card__body">
                <h3 class="eco-card__title">{{ t('dashboard.ecoEfacturaTitle') }}</h3>
                <p class="eco-card__desc">{{ t('dashboard.ecoEfacturaDesc') }}</p>
                <span class="eco-pill">{{ t('dashboard.ecoHere') }}</span>
              </div>
            </article>

            <article class="eco-card" [class.eco-card--muted]="!session.puedeAbrirCarteraSuite()">
              <div class="eco-card__brand eco-card__brand--cartera" aria-hidden="true">
                <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                  <path
                    d="M8 14h24v16a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V14z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                  <path d="M8 14V11a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v3" stroke="currentColor" stroke-width="1.6" />
                  <path d="M14 22h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </div>
              <div class="eco-card__body">
                <h3 class="eco-card__title">{{ t('dashboard.ecoCarteraTitle') }}</h3>
                <p class="eco-card__desc">{{ t('dashboard.ecoCarteraDesc') }}</p>
                @if (session.puedeAbrirCarteraSuite()) {
                  <div class="eco-actions">
                    @if (puedeCarteraDirecto()) {
                      <button type="button" class="eco-btn" (click)="openCarteraDirect()">
                        {{ t('dashboard.ecoCarteraDirect') }}
                      </button>
                      <button type="button" class="eco-btn eco-btn--ghost" (click)="openShellLaunch('cartera')">
                        {{ t('dashboard.ecoOpenViaSuite') }}
                      </button>
                    } @else {
                      <button type="button" class="eco-btn" (click)="openShellLaunch('cartera')">
                        {{ t('dashboard.ecoOpenViaSuite') }}
                      </button>
                    }
                  </div>
                } @else {
                  <span class="eco-lock">{{ t('dashboard.ecoNoPermission') }}</span>
                }
              </div>
            </article>

            <article class="eco-card" [class.eco-card--muted]="!session.puedeAbrirPosSuite()">
              <div class="eco-card__brand eco-card__brand--pos" aria-hidden="true">
                <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                  <rect x="9" y="10" width="22" height="18" rx="3" stroke="currentColor" stroke-width="1.6" />
                  <path d="M14 28h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  <circle cx="20" cy="19" r="2.5" fill="currentColor" />
                </svg>
              </div>
              <div class="eco-card__body">
                <h3 class="eco-card__title">{{ t('dashboard.ecoPosTitle') }}</h3>
                <p class="eco-card__desc">{{ t('dashboard.ecoPosDesc') }}</p>
                @if (session.puedeAbrirPosSuite()) {
                  <div class="eco-actions">
                    @if (puedePosDirecto()) {
                      <button type="button" class="eco-btn" (click)="openPosDirect()">
                        {{ t('dashboard.ecoPosDirect') }}
                      </button>
                      <button type="button" class="eco-btn eco-btn--ghost" (click)="openShellLaunch('pos')">
                        {{ t('dashboard.ecoOpenViaSuite') }}
                      </button>
                    } @else {
                      <button type="button" class="eco-btn" (click)="openShellLaunch('pos')">
                        {{ t('dashboard.ecoPosCta') }}
                      </button>
                    }
                  </div>
                } @else {
                  <span class="eco-lock">{{ t('dashboard.ecoNoPermission') }}</span>
                }
              </div>
            </article>
          </div>
          <p class="eco-foot">{{ t('dashboard.ecoFootnote') }}</p>
        </section>
      }
    }
  `,
  styles: `
    .eco {
      margin-top: 1.75rem;
      padding: 1.35rem 1.25rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: linear-gradient(145deg, #f8fafc 0%, #eef2ff 55%, #f1f5f9 100%);
      box-shadow: 0 12px 40px -18px rgba(15, 23, 42, 0.25);
    }
    .eco-head {
      margin-bottom: 1.1rem;
    }
    .eco-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .eco-sub {
      margin: 0.35rem 0 0;
      font-size: 0.82rem;
      color: #64748b;
      max-width: 48rem;
    }
    .eco-grid {
      display: grid;
      gap: 0.85rem;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    }
    .eco-card {
      display: flex;
      gap: 0.85rem;
      align-items: flex-start;
      padding: 1rem 1rem 1.05rem;
      border-radius: 0.85rem;
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.35);
      min-height: 7.5rem;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }
    .eco-card:hover:not(.eco-card--current):not(.eco-card--muted) {
      border-color: rgba(99, 102, 241, 0.45);
      box-shadow: 0 8px 26px -12px rgba(79, 70, 229, 0.35);
    }
    .eco-card--current {
      border-color: rgba(16, 185, 129, 0.45);
      background: linear-gradient(160deg, #ecfdf5 0%, #fff 65%);
    }
    .eco-card--muted {
      opacity: 0.72;
    }
    .eco-card__brand {
      flex-shrink: 0;
      width: 3.1rem;
      height: 3.1rem;
      border-radius: 0.75rem;
      display: grid;
      place-items: center;
      color: #fff;
    }
    .eco-card__brand--suite {
      background: linear-gradient(135deg, #6366f1, #4338ca);
    }
    .eco-card__brand--ef {
      background: linear-gradient(135deg, #059669, #0f766e);
      font-weight: 800;
      font-size: 1.35rem;
    }
    .eco-ef {
      margin-top: -0.1rem;
    }
    .eco-card__brand--cartera {
      background: linear-gradient(135deg, #0ea5e9, #0369a1);
    }
    .eco-card__brand--pos {
      background: linear-gradient(135deg, #f97316, #c2410c);
    }
    .eco-card__body {
      min-width: 0;
    }
    .eco-card__title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }
    .eco-card__desc {
      margin: 0.35rem 0 0.65rem;
      font-size: 0.78rem;
      line-height: 1.35;
      color: #64748b;
    }
    .eco-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      align-items: center;
    }
    .eco-btn {
      border: none;
      border-radius: 0.55rem;
      padding: 0.38rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
    }
    .eco-btn:hover {
      filter: brightness(1.06);
    }
    .eco-btn--ghost {
      color: #4338ca;
      background: rgba(99, 102, 241, 0.12);
    }
    .eco-pill {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.28rem 0.55rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.15);
      color: #047857;
    }
    .eco-lock {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 600;
    }
    .eco-foot {
      margin: 1rem 0 0;
      font-size: 0.72rem;
      color: #94a3b8;
    }
  `,
})
export class EcosystemAppsPanelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly session = inject(SessionContextService);
  private readonly i18n = inject(UiI18nService);

  readonly status = signal<SuiteIdentityPublicStatus | null>(null);
  readonly loaded = signal(false);

  readonly puedeCarteraDirecto = computed(() => {
    if (!this.session.puedeAbrirCarteraSuite()) {
      return false;
    }
    const at = readIdentityHandoffAccess()?.trim();
    const rt = readIdentityHandoffRefresh()?.trim();
    const base = (this.status()?.carteraBaseUrl ?? '').trim();
    return !!(at && rt && base);
  });

  readonly puedePosDirecto = computed(() => {
    if (!this.session.puedeAbrirPosSuite()) {
      return false;
    }
    const at = readIdentityHandoffAccess()?.trim();
    const rt = readIdentityHandoffRefresh()?.trim();
    const base = (this.status()?.posBaseUrl ?? '').trim();
    return !!(at && rt && base);
  });

  ngOnInit(): void {
    this.http.get<SuiteIdentityPublicStatus>('/api/public/v1/auth/suite-identity').subscribe({
      next: (s) => {
        this.status.set(s);
        this.loaded.set(true);
      },
      error: () => {
        this.status.set(null);
        this.loaded.set(true);
      },
    });
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  shellBase(): string {
    return (this.status()?.suiteShellBaseUrl ?? '').trim().replace(/\/+$/, '');
  }

  private carteraBase(): string {
    return (this.status()?.carteraBaseUrl ?? '').trim().replace(/\/+$/, '');
  }

  private posBase(): string {
    return (this.status()?.posBaseUrl ?? '').trim().replace(/\/+$/, '');
  }

  /** Abre Suite: puente opaco a eFactura si hay handoff Identity; si falla, URL legacy con ?at=. */
  private openSuiteEntry(launch?: 'cartera' | 'pos'): void {
    const base = this.shellBase();
    if (!base) return;
    const at = readIdentityHandoffAccess()?.trim();
    const rt = readIdentityHandoffRefresh()?.trim();
    if (!at) {
      window.open(this.suiteUrlPlain(base, launch), '_blank', 'noopener,noreferrer');
      return;
    }
    this.http
      .post<{ bridgeId: string }>('/api/public/v1/auth/suite-shell-bridge', {
        identityAccess: at,
        identityRefresh: rt || null,
      })
      .subscribe({
        next: (r) => {
          const u = new URL('/auth/handoff', `${base}/`);
          u.searchParams.set('bridgeId', r.bridgeId);
          if (launch) {
            u.searchParams.set('launch', launch);
          }
          window.open(u.toString(), '_blank', 'noopener,noreferrer');
        },
        error: () => {
          window.open(this.suiteHandoffLegacy(base, at, rt || null, launch), '_blank', 'noopener,noreferrer');
        },
      });
  }

  private suiteUrlPlain(base: string, launch?: 'cartera' | 'pos'): string {
    return launch ? `${base}/home?launch=${encodeURIComponent(launch)}` : `${base}/home`;
  }

  private suiteHandoffLegacy(base: string, access: string, refresh: string | null, launch?: 'cartera' | 'pos'): string {
    const u = new URL('/auth/handoff', `${base}/`);
    u.searchParams.set('at', access);
    if (refresh) {
      u.searchParams.set('rt', refresh);
    }
    if (launch) {
      u.searchParams.set('launch', launch);
    }
    return u.toString();
  }

  openShellHome(): void {
    this.openSuiteEntry();
  }

  openShellLaunch(target: 'cartera' | 'pos'): void {
    this.openSuiteEntry(target);
  }

  openCarteraDirect(): void {
    const base = this.carteraBase();
    const at = readIdentityHandoffAccess()?.trim();
    const rt = readIdentityHandoffRefresh()?.trim();
    if (!base || !at || !rt) {
      this.openShellLaunch('cartera');
      return;
    }
    const url = new URL('/auth/callback', `${base}/`);
    url.searchParams.set('at', at);
    url.searchParams.set('rt', rt);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  openPosDirect(): void {
    const base = this.posBase();
    const at = readIdentityHandoffAccess()?.trim();
    const rt = readIdentityHandoffRefresh()?.trim();
    if (!base || !at || !rt) {
      this.openShellLaunch('pos');
      return;
    }
    const url = new URL('/auth/callback', `${base}/`);
    url.searchParams.set('at', at);
    url.searchParams.set('rt', rt);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }
}
