import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { badgeClaseEstadoSri, tonoEstadoSri } from '../../shared/ui/sri-estado.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

type DashboardKpiUnit = 'currency' | 'percent' | 'number' | string;
type DashboardStatus = 'success' | 'warning' | 'danger' | 'neutral' | string;

interface DashboardEmpresa {
  empresaId?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  ruc?: string | null;
  estado?: string | null;
  ambienteSri?: number | string | null;
  logoUrl?: string | null;
  planCodigo?: string | null;
  planLimiteMes?: number | null;
  comprobantesMes?: number | null;
  certificadoActivo?: boolean | null;
  configuracionBasicaCompleta?: boolean | null;
}

interface DashboardKpi {
  key: string;
  labelKey?: string | null;
  fallbackLabel?: string | null;
  value: number;
  unit?: DashboardKpiUnit | null;
  status?: DashboardStatus | null;
  icon?: string | null;
}

interface DashboardMaestros {
  clientes?: number | null;
  proveedores?: number | null;
  productos?: number | null;
  servicios?: number | null;
  establecimientos?: number | null;
  puntosEmision?: number | null;
}

type DashboardRecord = Record<string, unknown>;

interface DashboardHomeResponse {
  empresaId?: string | null;
  desde?: string | null;
  hasta?: string | null;
  generadoEn?: string | null;
  empresa?: DashboardEmpresa | null;
  kpis?: DashboardKpi[] | null;
  comprobantesPorEstado?: DashboardRecord[] | null;
  comprobantesPorTipoEstado?: DashboardRecord[] | null;
  ventasPorDia?: DashboardRecord[] | null;
  comprobantesRecientes?: DashboardRecord[] | null;
  maestros?: DashboardMaestros | null;
  cacheable?: boolean | null;
}

interface ViewKpi {
  key: string;
  label: string;
  value: string;
  rawValue: number;
  status: DashboardStatus;
  icon: string;
  hint: string;
}

interface ChartPoint {
  label: string;
  value: number;
  height: number;
}

interface DistributionItem {
  label: string;
  value: number;
  percent: number;
  status: string;
}

interface RecentVoucher {
  id: string | null;
  type: string;
  number: string;
  customer: string;
  status: string;
  statusCode: string;
  amount: number;
  date: string;
}

interface SetupItem {
  label: string;
  value: string;
  ok: boolean;
}

@Component({
  selector: 'ts-dashboard-page',
  standalone: true,
  imports: [RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout [title]="t('dashboard.title')" [subtitle]="dashboardSubtitle()" [eyebrow]="t('menu.dashboard')">
      @if (loading() && !home()) {
        <div class="ts-home-skeleton">
          <div class="ts-home-skeleton__hero"></div>
          <div class="ts-home-skeleton__grid">
            <span></span><span></span><span></span><span></span>
          </div>
        </div>
      } @else if (loadError()) {
        <section class="ts-home-empty">
          <h5>{{ t('dashboard.loadError', 'No se pudo cargar el dashboard') }}</h5>
          <p>{{ loadError() }}</p>
          <button type="button" class="btn btn-primary btn-sm" (click)="loadHome()">
            {{ t('common.refresh') }}
          </button>
        </section>
      } @else if (home()) {
        <div class="ts-home">
          <section class="ts-home-hero">
            <div class="ts-home-company">
              <div class="ts-home-company__logo">
                @if (empresa()?.logoUrl) {
                  <img [src]="empresa()?.logoUrl" [alt]="companyName()" />
                } @else {
                  <span>{{ companyInitials() }}</span>
                }
              </div>
              <div class="ts-home-company__main">
                <p class="ts-home-company__eyebrow">{{ t('dashboard.companyOverview', 'Resumen de compania') }}</p>
                <h2>{{ companyName() }}</h2>
                <div class="ts-home-company__meta">
                  <span>{{ empresa()?.ruc || t('dashboard.noRuc', 'RUC no registrado') }}</span>
                  <span class="ts-home-pill" [class.ts-home-pill--ok]="empresa()?.estado === 'ACTIVO'">
                    {{ empresa()?.estado || t('common.status') }}
                  </span>
                  <span class="ts-home-pill ts-home-pill--soft">{{ sriEnvironmentLabel() }}</span>
                </div>
              </div>
            </div>
            <div class="ts-home-hero__actions">
              <span class="ts-home-generated">
                {{ t('dashboard.generatedAt', 'Generado') }}: {{ formatDateTime(home()?.generadoEn) }}
              </span>
              <button type="button" class="btn btn-light btn-sm" (click)="refreshHome()" [disabled]="refreshing()">
                {{ refreshing() ? t('dashboard.refreshing', 'Recalculando...') : t('common.refresh') }}
              </button>
            </div>
          </section>

          <section class="ts-home-kpis" [attr.aria-label]="t('dashboard.kpis', 'Indicadores')">
            @for (kpi of viewKpis(); track kpi.key) {
              <article
                class="ts-home-kpi"
                [class.ts-home-kpi--success]="kpi.status === 'success'"
                [class.ts-home-kpi--warning]="kpi.status === 'warning'"
                [class.ts-home-kpi--danger]="kpi.status === 'danger'"
              >
                <div class="ts-home-kpi__icon">{{ iconGlyph(kpi.icon) }}</div>
                <div>
                  <p>{{ kpi.label }}</p>
                  <strong>{{ kpi.value }}</strong>
                  <span>{{ kpi.hint }}</span>
                </div>
              </article>
            }
          </section>

          <div class="ts-home-grid">
            <section class="ts-home-panel ts-home-panel--wide">
              <div class="ts-home-panel__head">
                <div>
                  <h5>{{ t('dashboard.salesByDay', 'Ventas por dia') }}</h5>
                  <p>{{ periodLabel() }}</p>
                </div>
                <strong>{{ formatMoney(totalSales()) }}</strong>
              </div>
              @if (salesChart().length) {
                <div class="ts-home-bars">
                  @for (point of salesChart(); track point.label) {
                    <div class="ts-home-bars__item">
                      <span class="ts-home-bars__bar" [style.height.%]="point.height" [title]="point.label + ': ' + formatMoney(point.value)"></span>
                      <small>{{ point.label }}</small>
                    </div>
                  }
                </div>
              } @else {
                <div class="ts-home-emptyline">{{ t('dashboard.noSalesData', 'Sin ventas registradas en el periodo.') }}</div>
              }
            </section>

            <section class="ts-home-panel">
              <div class="ts-home-panel__head">
                <div>
                  <h5>{{ t('dashboard.sriDistribution', 'Distribucion por estado SRI') }}</h5>
                  <p>{{ t('dashboard.documentsPeriod', 'Comprobantes del periodo') }}</p>
                </div>
              </div>
              @if (statusDistribution().length) {
                <div class="ts-home-distribution">
                  @for (item of statusDistribution(); track item.label) {
                    <div class="ts-home-distribution__row">
                      <div>
                        <span
                          class="ts-home-dot"
                          [class.ts-home-dot--success]="item.status === 'success'"
                          [class.ts-home-dot--warning]="item.status === 'warning'"
                          [class.ts-home-dot--danger]="item.status === 'danger'"
                        ></span>
                        <strong>{{ item.label }}</strong>
                        <small>{{ item.value }}</small>
                      </div>
                      <span class="ts-home-distribution__track">
                        <span [style.width.%]="item.percent"></span>
                      </span>
                    </div>
                  }
                </div>
              } @else {
                <div class="ts-home-emptyline">{{ t('dashboard.noStatusData', 'Sin comprobantes por estado.') }}</div>
              }
            </section>

            <section class="ts-home-panel">
              <div class="ts-home-panel__head">
                <div>
                  <h5>{{ t('dashboard.setupStatus', 'Estado de configuracion') }}</h5>
                  <p>{{ t('dashboard.setupSubtitle', 'Preparacion para emitir') }}</p>
                </div>
              </div>
              <div class="ts-home-checks">
                @for (item of setupItems(); track item.label) {
                  <div class="ts-home-check">
                    <span [class.ts-home-check__icon--ok]="item.ok" class="ts-home-check__icon">{{ item.ok ? 'OK' : '!' }}</span>
                    <div>
                      <strong>{{ item.label }}</strong>
                      <small>{{ item.value }}</small>
                    </div>
                  </div>
                }
              </div>
            </section>

            <section class="ts-home-panel">
              <div class="ts-home-panel__head">
                <div>
                  <h5>{{ t('dashboard.masters', 'Maestros') }}</h5>
                  <p>{{ t('dashboard.mastersSubtitle', 'Catalogos operativos') }}</p>
                </div>
              </div>
              <div class="ts-home-masters">
                @for (item of masterCounters(); track item.label) {
                  <div>
                    <strong>{{ item.value }}</strong>
                    <span>{{ item.label }}</span>
                  </div>
                }
              </div>
            </section>

            <section class="ts-home-panel ts-home-panel--wide">
              <div class="ts-home-panel__head">
                <div>
                  <h5>{{ t('dashboard.recentDocuments', 'Ultimos comprobantes') }}</h5>
                  <p>{{ t('dashboard.recentDocumentsSubtitle', 'Actividad reciente de emision') }}</p>
                </div>
              </div>
              @if (recentVouchers().length) {
                <div class="ts-home-table">
                  @for (doc of recentVouchers(); track doc.id || doc.number) {
                    <a class="ts-home-doc" [routerLink]="doc.id ? voucherLink(doc.id) : null">
                      <span>
                        <strong>{{ doc.type }}</strong>
                        <small>{{ doc.number }}</small>
                      </span>
                      <span>{{ doc.customer }}</span>
                      <span [class]="badgeClaseEstadoSri(doc.statusCode)">
                        <span class="ts-sri-badge__dot" aria-hidden="true"></span>
                        {{ doc.status }}
                      </span>
                      <span>{{ formatMoney(doc.amount) }}</span>
                      <span>{{ formatDate(doc.date) }}</span>
                    </a>
                  }
                </div>
              } @else {
                <div class="ts-home-emptyline">{{ t('dashboard.noRecentDocuments', 'Aun no hay comprobantes recientes.') }}</div>
              }
            </section>
          </div>
        </div>
      }
    </ts-page-layout>
  `,
  styles: [
    `
      .ts-home {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .ts-home-hero,
      .ts-home-panel,
      .ts-home-kpi,
      .ts-home-empty {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        background: #fff;
        box-shadow: var(--ef-surface-shadow);
      }

      .ts-home-hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.15rem;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eef7f5 100%);
      }

      .ts-home-company {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        min-width: 0;
      }

      .ts-home-company__logo {
        display: grid;
        place-items: center;
        width: 4rem;
        height: 4rem;
        border-radius: 9px;
        background: #0f766e;
        color: #fff;
        font-size: 1.2rem;
        font-weight: 700;
        overflow: hidden;
        flex-shrink: 0;
      }

      .ts-home-company__logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #fff;
      }

      .ts-home-company__eyebrow,
      .ts-home-panel__head p,
      .ts-home-kpi p,
      .ts-home-generated {
        margin: 0;
        color: #64748b;
        font-size: 0.76rem;
      }

      .ts-home-company__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
      }

      .ts-home-company h2 {
        margin: 0.1rem 0 0.35rem;
        color: #0f172a;
        font-size: clamp(1.3rem, 2vw, 1.8rem);
        font-weight: 700;
        line-height: 1.1;
      }

      .ts-home-company__meta,
      .ts-home-hero__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.45rem;
      }

      .ts-home-company__meta {
        color: #475569;
        font-size: 0.82rem;
      }

      .ts-home-hero__actions {
        justify-content: flex-end;
      }

      .ts-home-pill {
        display: inline-flex;
        align-items: center;
        min-height: 1.45rem;
        border-radius: 999px;
        padding: 0.18rem 0.55rem;
        background: #f1f5f9;
        color: #475569;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .ts-home-pill--ok {
        background: #dcfce7;
        color: #166534;
      }

      .ts-home-pill--soft {
        background: #e0f2fe;
        color: #075985;
      }

      .ts-home-kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.8rem;
      }

      .ts-home-kpi {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.9rem;
      }

      .ts-home-kpi__icon {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 8px;
        background: #ecfeff;
        color: #0f766e;
        font-weight: 800;
        flex-shrink: 0;
      }

      .ts-home-kpi strong {
        display: block;
        color: #0f172a;
        font-size: 1.35rem;
        line-height: 1.2;
      }

      .ts-home-kpi span {
        color: #64748b;
        font-size: 0.72rem;
      }

      .ts-home-kpi--success .ts-home-kpi__icon {
        background: #dcfce7;
        color: #166534;
      }

      .ts-home-kpi--warning .ts-home-kpi__icon {
        background: #fef3c7;
        color: #92400e;
      }

      .ts-home-kpi--danger .ts-home-kpi__icon {
        background: #fee2e2;
        color: #991b1b;
      }

      .ts-home-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr);
        gap: 0.9rem;
      }

      .ts-home-panel {
        padding: 1rem;
        min-width: 0;
      }

      .ts-home-panel--wide {
        grid-column: span 1;
      }

      .ts-home-panel__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
      }

      .ts-home-panel__head h5 {
        margin: 0;
        color: #0f172a;
        font-size: 0.95rem;
        font-weight: 700;
      }

      .ts-home-panel__head strong {
        color: #0f766e;
        font-size: 1rem;
        white-space: nowrap;
      }

      .ts-home-bars {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(1.35rem, 1fr));
        align-items: end;
        gap: 0.42rem;
        height: 16rem;
        padding-top: 0.5rem;
      }

      .ts-home-bars__item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 0.35rem;
        height: 100%;
        min-width: 0;
      }

      .ts-home-bars__bar {
        width: 100%;
        min-height: 0.35rem;
        border-radius: 6px 6px 2px 2px;
        background: linear-gradient(180deg, #14b8a6 0%, #1e5b96 100%);
      }

      .ts-home-bars small {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #64748b;
        font-size: 0.68rem;
        white-space: nowrap;
      }

      .ts-home-distribution,
      .ts-home-checks,
      .ts-home-table {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }

      .ts-home-distribution__row {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .ts-home-distribution__row > div {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: #334155;
        font-size: 0.78rem;
      }

      .ts-home-distribution__row small {
        margin-left: auto;
        color: #64748b;
      }

      .ts-home-distribution__track {
        height: 0.42rem;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }

      .ts-home-distribution__track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: #1e5b96;
      }

      .ts-home-dot {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: #64748b;
      }

      .ts-home-dot--success {
        background: #16a34a;
      }

      .ts-home-dot--warning {
        background: #d97706;
      }

      .ts-home-dot--danger {
        background: #dc2626;
      }

      .ts-home-check {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem;
        border: 1px solid var(--ef-divider, #e2e8f0);
        border-radius: 8px;
        background: #fafbfc;
      }

      .ts-home-check__icon {
        display: grid;
        place-items: center;
        width: 1.65rem;
        height: 1.65rem;
        border-radius: 999px;
        background: #fef3c7;
        color: #92400e;
        font-size: 0.8rem;
        font-weight: 800;
        flex-shrink: 0;
      }

      .ts-home-check__icon--ok {
        background: #dcfce7;
        color: #166534;
      }

      .ts-home-check strong,
      .ts-home-check small {
        display: block;
      }

      .ts-home-check strong {
        color: #1e293b;
        font-size: 0.78rem;
      }

      .ts-home-check small {
        color: #64748b;
        font-size: 0.72rem;
      }

      .ts-home-masters {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .ts-home-masters div {
        padding: 0.75rem;
        border-radius: 8px;
        background: #f8fafc;
      }

      .ts-home-masters strong,
      .ts-home-masters span {
        display: block;
      }

      .ts-home-masters strong {
        color: #0f172a;
        font-size: 1.25rem;
      }

      .ts-home-masters span {
        color: #64748b;
        font-size: 0.75rem;
      }

      .ts-home-doc {
        display: grid;
        grid-template-columns: minmax(8rem, 1.2fr) minmax(8rem, 1fr) auto auto auto;
        gap: 0.75rem;
        align-items: center;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--ef-divider, #e2e8f0);
        border-radius: 8px;
        color: #334155;
        text-decoration: none;
        background: #fff;
      }

      .ts-home-doc:hover {
        border-color: rgba(30, 91, 150, 0.28);
        background: #f8fafc;
      }

      .ts-home-doc strong,
      .ts-home-doc small {
        display: block;
      }

      .ts-home-doc strong {
        color: #0f172a;
        font-size: 0.78rem;
      }

      .ts-home-doc small,
      .ts-home-doc {
        font-size: 0.75rem;
      }

      .ts-home-empty,
      .ts-home-emptyline {
        color: #64748b;
      }

      .ts-home-empty {
        padding: 1.25rem;
      }

      .ts-home-empty h5 {
        color: #0f172a;
      }

      .ts-home-emptyline {
        display: grid;
        place-items: center;
        min-height: 8rem;
        border: 1px dashed var(--ef-input-border-hover, #94a3b8);
        border-radius: 8px;
        background: #f8fafc;
        font-size: 0.85rem;
      }

      .ts-home-skeleton {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }

      .ts-home-skeleton__hero,
      .ts-home-skeleton__grid span {
        border-radius: 10px;
        background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 48%, #f1f5f9 100%);
        background-size: 200% 100%;
        animation: ts-home-pulse 1.4s ease infinite;
      }

      .ts-home-skeleton__hero {
        height: 7rem;
      }

      .ts-home-skeleton__grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.8rem;
      }

      .ts-home-skeleton__grid span {
        height: 5.5rem;
      }

      @keyframes ts-home-pulse {
        0% { background-position: 0 0; }
        100% { background-position: -200% 0; }
      }

      @media (max-width: 1199.98px) {
        .ts-home-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .ts-home-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 767.98px) {
        .ts-home-hero,
        .ts-home-panel__head {
          flex-direction: column;
          align-items: stretch;
        }

        .ts-home-kpis,
        .ts-home-skeleton__grid,
        .ts-home-masters {
          grid-template-columns: 1fr;
        }

        .ts-home-doc {
          grid-template-columns: 1fr;
          gap: 0.35rem;
        }
      }
    `,
  ],
})
export class DashboardPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly home = signal<DashboardHomeResponse | null>(null);
  readonly loading = signal(false);
  readonly refreshing = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly empresa = computed(() => this.home()?.empresa ?? null);
  readonly dashboardSubtitle = computed(() => {
    const home = this.home();
    if (!home) {
      return this.i18n.t('dashboard.subtitle', { tenant: this.tenant.tenantSlug() });
    }
    return this.i18n.t('dashboard.subtitlePeriod', 'Periodo {{desde}} - {{hasta}}', {
      desde: this.formatDate(home.desde),
      hasta: this.formatDate(home.hasta),
    });
  });

  readonly viewKpis = computed<ViewKpi[]>(() => {
    const kpis = this.home()?.kpis ?? [];
    const empresa = this.empresa();
    return [
      this.kpiView(this.findKpi(kpis, 'ventasMes'), 'ventasMes', 'dashboard.kpi.monthSales', 'Ventas del mes', 0, 'currency', 'trending-up'),
      this.kpiView(this.findKpi(kpis, 'documentosMes'), 'documentosMes', 'dashboard.kpi.monthDocs', 'Documentos del mes', empresa?.comprobantesMes ?? 0, 'number', 'file-text'),
      this.kpiView(this.findKpi(kpis, 'tasaAutorizacion'), 'tasaAutorizacion', 'dashboard.kpi.authorizationRate', 'Tasa de autorizacion', 0, 'percent', 'shield-check'),
      this.kpiView(this.findKpi(kpis, 'usoPlan'), 'usoPlan', 'dashboard.kpi.planUsage', 'Uso del plan', this.planUsagePercent(), 'percent', 'gauge'),
    ];
  });

  readonly salesChart = computed<ChartPoint[]>(() => {
    const raw = this.home()?.ventasPorDia ?? [];
    const points = raw.map((item) => ({
      label: this.shortDate(this.pickString(item, ['fecha', 'dia', 'date', 'label'])),
      value: this.pickNumber(item, ['total', 'ventas', 'valor', 'monto', 'value']),
    }));
    const max = Math.max(...points.map((p) => p.value), 0);
    return points.map((p) => ({ ...p, height: max > 0 ? Math.max((p.value / max) * 100, 4) : 4 }));
  });

  readonly totalSales = computed(() => this.salesChart().reduce((acc, item) => acc + item.value, 0));

  readonly statusDistribution = computed<DistributionItem[]>(() => {
    const raw = this.home()?.comprobantesPorEstado ?? [];
    const items = raw.map((item) => ({
      label: this.statusLabel(this.pickString(item, ['estado', 'estadoSri', 'status', 'label'])),
      value: this.pickNumber(item, ['cantidad', 'count', 'total', 'value']),
      status: this.statusTone(this.pickString(item, ['estado', 'estadoSri', 'status', 'label'])),
    }));
    const total = Math.max(items.reduce((acc, item) => acc + item.value, 0), 1);
    return items.map((item) => ({ ...item, percent: Math.round((item.value / total) * 100) }));
  });

  readonly recentVouchers = computed<RecentVoucher[]>(() => {
    const raw = this.home()?.comprobantesRecientes ?? [];
    return raw.slice(0, 8).map((item) => {
      const statusCode = this.pickString(item, ['estadoSri', 'estado', 'status']);
      return {
        id: this.pickString(item, ['id', 'comprobanteId', 'uuid']) || null,
        type: this.documentTypeLabel(this.pickString(item, ['tipo', 'tipoComprobante', 'documentType'])),
        number: this.pickString(item, ['numero', 'secuencial', 'numeroComprobante', 'claveAcceso']) || '-',
        customer: this.pickString(item, ['cliente', 'razonSocialComprador', 'receptor', 'nombreCliente']) || '-',
        status: this.statusLabel(statusCode),
        statusCode,
        amount: this.pickNumber(item, ['total', 'importeTotal', 'valorTotal', 'monto']),
        date: this.pickString(item, ['fechaEmision', 'fecha', 'createdAt', 'emitidoEn']),
      };
    });
  });

  readonly setupItems = computed<SetupItem[]>(() => {
    const empresa = this.empresa();
    const maestros = this.home()?.maestros ?? {};
    return [
      {
        label: this.t('dashboard.setup.certificate', 'Certificado activo'),
        value: empresa?.certificadoActivo ? this.t('common.active') : this.t('common.inactive'),
        ok: !!empresa?.certificadoActivo,
      },
      {
        label: this.t('dashboard.setup.branches', 'Sucursales configuradas'),
        value: String(maestros.establecimientos ?? 0),
        ok: (maestros.establecimientos ?? 0) > 0,
      },
      {
        label: this.t('dashboard.setup.emissionPoints', 'Puntos de emision configurados'),
        value: String(maestros.puntosEmision ?? 0),
        ok: (maestros.puntosEmision ?? 0) > 0,
      },
      {
        label: this.t('dashboard.setup.basicConfig', 'Configuracion basica completa'),
        value: empresa?.configuracionBasicaCompleta ? this.t('common.success') : this.t('dashboard.pending', 'Pendiente'),
        ok: !!empresa?.configuracionBasicaCompleta,
      },
    ];
  });

  readonly masterCounters = computed(() => {
    const maestros = this.home()?.maestros ?? {};
    return [
      { label: this.t('menu.customers'), value: maestros.clientes ?? 0 },
      { label: this.t('menu.providers'), value: maestros.proveedores ?? 0 },
      { label: this.t('menu.products'), value: maestros.productos ?? 0 },
      { label: this.t('menu.services'), value: maestros.servicios ?? 0 },
    ];
  });

  ngOnInit(): void {
    this.loadHome();
  }

  loadHome(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.http
      .get<DashboardHomeResponse>('/api/web/v1/dashboard/home')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.loadError.set(extractApiErrorMessage(err, this.t('dashboard.loadError', 'No se pudo cargar el dashboard.')));
        },
      });
  }

  refreshHome(): void {
    this.refreshing.set(true);
    this.http
      .post<DashboardHomeResponse>('/api/web/v1/dashboard/home/refresh', {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.refreshing.set(false);
          this.toast.success(this.t('dashboard.refreshed', 'Dashboard actualizado.'));
        },
        error: (err: HttpErrorResponse) => {
          this.refreshing.set(false);
          this.toast.error(extractApiErrorMessage(err, this.t('dashboard.refreshError', 'No se pudo recalcular el dashboard.')));
        },
      });
  }

  t(key: string, fallback?: string, params?: Record<string, unknown>): string {
    return this.i18n.t(key, fallback ?? params ?? undefined, params);
  }

  companyName(): string {
    const empresa = this.empresa();
    return empresa?.nombreComercial || empresa?.razonSocial || this.t('dashboard.companyFallback', 'Compania');
  }

  companyInitials(): string {
    return this.companyName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'EC';
  }

  sriEnvironmentLabel(): string {
    const ambiente = String(this.empresa()?.ambienteSri ?? '');
    if (ambiente === '2') {
      return this.t('company.production');
    }
    if (ambiente === '1') {
      return this.t('company.test');
    }
    return this.t('company.sriEnvironment');
  }

  periodLabel(): string {
    const home = this.home();
    return `${this.formatDate(home?.desde)} - ${this.formatDate(home?.hasta)}`;
  }

  voucherLink(id: string): string[] {
    return ['/t', this.tenant.tenantSlug(), 'comprobantes', id];
  }

  formatMoney(value: number | null | undefined): string {
    return new Intl.NumberFormat(this.locale(), { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value ?? 0);
  }

  formatNumber(value: number | null | undefined): string {
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  formatPercent(value: number | null | undefined): string {
    const normalized = value != null && value <= 1 ? value * 100 : value ?? 0;
    return `${new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 1 }).format(normalized)}%`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(this.locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(this.locale(), {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  iconGlyph(icon: string | null | undefined): string {
    const map: Record<string, string> = {
      'trending-up': '+',
      'file-text': '#',
      'shield-check': 'OK',
      gauge: '%',
    };
    return map[icon ?? ''] ?? '*';
  }

  private findKpi(kpis: DashboardKpi[], key: string): DashboardKpi | undefined {
    return kpis.find((kpi) => kpi.key === key);
  }

  private kpiView(
    kpi: DashboardKpi | undefined,
    key: string,
    labelKey: string,
    fallbackLabel: string,
    fallbackValue: number,
    fallbackUnit: DashboardKpiUnit,
    fallbackIcon: string,
  ): ViewKpi {
    const value = kpi?.value ?? fallbackValue;
    const unit = kpi?.unit ?? fallbackUnit;
    return {
      key,
      label: this.t(kpi?.labelKey || labelKey, kpi?.fallbackLabel || fallbackLabel),
      value: this.formatByUnit(value, unit),
      rawValue: value,
      status: kpi?.status ?? this.statusFromValue(key, value),
      icon: kpi?.icon ?? fallbackIcon,
      hint: this.kpiHint(key),
    };
  }

  private formatByUnit(value: number, unit: DashboardKpiUnit): string {
    if (unit === 'currency') {
      return this.formatMoney(value);
    }
    if (unit === 'percent') {
      return this.formatPercent(value);
    }
    return this.formatNumber(value);
  }

  private kpiHint(key: string): string {
    if (key === 'usoPlan') {
      const empresa = this.empresa();
      const limit = empresa?.planLimiteMes;
      return limit ? `${empresa?.comprobantesMes ?? 0}/${limit} ${this.t('plan.documents')}` : this.t('plan.noMonthlyLimit');
    }
    if (key === 'tasaAutorizacion') {
      return this.t('dashboard.kpi.authorizationHint', 'Documentos autorizados frente al total');
    }
    return this.periodLabel();
  }

  private planUsagePercent(): number {
    const empresa = this.empresa();
    const used = empresa?.comprobantesMes ?? 0;
    const limit = empresa?.planLimiteMes ?? 0;
    return limit > 0 ? (used / limit) * 100 : 0;
  }

  private statusFromValue(key: string, value: number): DashboardStatus {
    if (key === 'usoPlan') {
      return value >= 90 ? 'danger' : value >= 75 ? 'warning' : 'success';
    }
    if (key === 'tasaAutorizacion') {
      const percent = value <= 1 ? value * 100 : value;
      return percent >= 95 ? 'success' : percent >= 80 ? 'warning' : 'danger';
    }
    return 'neutral';
  }

  private shortDate(value: string): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(this.locale(), { day: '2-digit', month: 'short' }).format(date);
  }

  private statusLabel(value: string): string {
    if (!value) {
      return '-';
    }
    const normalized = value.toUpperCase();
    const keys: Record<string, string> = {
      AUTORIZADO: 'invoice.statusAuthorized',
      RECIBIDA: 'invoice.statusReceived',
      RECHAZADO: 'invoice.statusRejected',
      RECHAZADA: 'invoice.statusRejected',
      PENDIENTE: 'invoice.statusPending',
      BORRADOR: 'invoice.statusDraft',
    };
    return keys[normalized] ? this.t(keys[normalized], value) : value.replace(/_/g, ' ');
  }

  readonly badgeClaseEstadoSri = badgeClaseEstadoSri;

  private statusTone(value: string): string {
    return tonoEstadoSri(value);
  }

  private documentTypeLabel(value: string): string {
    const normalized = value.toUpperCase();
    const keys: Record<string, string> = {
      FACTURA: 'rideDesign.docInvoice',
      NOTA_CREDITO: 'rideDesign.docCreditNote',
      NOTA_DEBITO: 'rideDesign.docDebitNote',
      GUIA_REMISION: 'rideDesign.docGuide',
      RETENCION: 'rideDesign.docWithholding',
      LIQUIDACION_COMPRA: 'rideDesign.docPurchaseSettlement',
    };
    return keys[normalized] ? this.t(keys[normalized], value) : value || '-';
  }

  private pickString(item: DashboardRecord, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];
      if (value != null && value !== '') {
        return String(value);
      }
    }
    return '';
  }

  private pickNumber(item: DashboardRecord, keys: string[]): number {
    for (const key of keys) {
      const value = item[key];
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return 0;
  }

  private locale(): string {
    const language = this.i18n.language();
    if (language === 'en') {
      return 'en-US';
    }
    if (language === 'pt') {
      return 'pt-BR';
    }
    if (language === 'fr') {
      return 'fr-FR';
    }
    return 'es-EC';
  }
}
