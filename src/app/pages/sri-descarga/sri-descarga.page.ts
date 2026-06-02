import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import {
  defaultCustomMonthValue,
  resolveSriSyncPeriod,
  type SriSyncPeriodPreset,
} from '../../core/sri/sri-sync-period.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { gridActionsMenu, type GridActionItem } from '../../shared/ui/grid-actions.util';
import {
  escapeHtml,
  formatMoney,
  TABULATOR_FROZEN_PROPS,
  tabulatorFechaCell,
  tabulatorMoneyCell,
  tabulatorTextareaCell,
} from '../../shared/ui/tabulator-formatters.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorLocalGridComponent } from '../../shared/ui/organisms/ts-tabulator-local-grid/ts-tabulator-local-grid.component';
import { TsTabulatorSpringGridComponent } from '../../shared/ui/organisms/ts-tabulator-spring-grid/ts-tabulator-spring-grid.component';

import { connectSriSyncSse } from '../../core/sri/sri-sync-sse.util';
import { sriProgressDetail, sriProgressLabel } from '../../core/sri/sri-bot-log-display.util';
import { rangoMesEnCurso } from '../../core/util/fecha-local.util';
import { TsSriComprobanteModalComponent } from '../../shared/ui/organisms/ts-sri-comprobante-modal/ts-sri-comprobante-modal.component';
import { TsSriSyncLogsModalComponent } from '../../shared/ui/organisms/ts-sri-sync-logs-modal/ts-sri-sync-logs-modal.component';

type SriTab = 'sincronizacion' | 'comprobantes' | 'credenciales' | 'integracion';

interface SriPortalCredentialStatusResponse {
  serviceEnabled: boolean;
  provisioned: boolean;
  subscriberId?: string | null;
  configured: boolean;
  portalUsuarioMasked?: string | null;
  vigenteDesde?: string | null;
}

interface SriSyncRunResponse {
  id?: string;
  estado: string;
  tipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  comprobantesNuevos?: number;
  comprobantesDuplicados?: number;
  mensaje?: string;
  iniciadoEn?: string;
  finalizadoEn?: string;
}

interface SriBotLogResponse {
  id: string;
  tipoOperacion: string;
  estado: string;
  mensaje?: string;
  duracionMs?: number;
  fecha: string;
}

interface SriComprobanteRecibidoResponse {
  id: string;
  claveAcceso: string;
  tipoComprobante?: string;
  rucEmisor?: string;
  razonSocialEmisor?: string;
  fechaEmision?: string;
  valorTotal?: number;
  xmlStorageKey?: string;
  estado?: string;
  fechaCreacion?: string;
}

interface SriPagedResponse<T> {
  content: T[];
  totalElements: number;
  page: number;
  size: number;
}

interface SriWebhookResponse {
  id: string;
  url: string;
  eventos?: string[];
  estado?: string;
  fechaCreacion?: string;
}

interface SriApiKeyStatusResponse {
  configured: boolean;
  masked?: string | null;
  maskedPreview?: string | null;
}

interface SriApiKeyCreatedResponse {
  apiKey: string;
  mensaje?: string;
}

interface SriComprobanteResumenMensual {
  anio: number;
  mes: number;
  totalComprobantes: number;
  valorTotal?: number;
}

interface SriComprobantesFilters {
  fechaDesde: string;
  fechaHasta: string;
  claveAcceso: string;
  rucEmisor: string;
  razonSocial: string;
}

type ResumenMesEstado = 'futuro' | 'pendiente' | 'descargado';

interface ResumenMesCard {
  anio: number;
  mes: number;
  mesLabel: string;
  totalComprobantes: number;
  valorTotal: number;
  estado: ResumenMesEstado;
}

@Component({
  selector: 'ts-sri-descarga-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TsPageLayoutComponent,
    TsTabulatorSpringGridComponent,
    TsTabulatorLocalGridComponent,
    TsSriComprobanteModalComponent,
    TsSriSyncLogsModalComponent,
  ],
  template: `
    <ts-page-layout [title]="t('sriDownload.title')" [subtitle]="t('sriDownload.subtitle')" [eyebrow]="t('menu.suppliers')">
      <div page-actions>
        <button
          type="button"
          class="btn btn-outline-secondary sri-refresh-btn"
          (click)="reload()"
          [disabled]="loading()"
          [attr.aria-label]="t('common.refresh')"
          [title]="t('common.refresh')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">{{ t('sriDownload.companyRequired') }}</p>
      } @else if (!sriDownloadServiceEnabled()) {
        <div class="ts-panel">
          <p class="mb-0">{{ t('company.sriPortalServiceDisabled') }}</p>
        </div>
      } @else {
        <nav class="sri-tabs mb-3" aria-label="Secciones descarga SRI">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              class="sri-tabs__btn"
              [class.sri-tabs__btn--active]="activeTab() === tab.id"
              (click)="setTab(tab.id)"
            >
              {{ t(tab.labelKey) }}
            </button>
          }
        </nav>

        @if (activeTab() === 'sincronizacion') {
          @if (!sriCredentialConfigured()) {
            <p class="text-muted">{{ t('company.sriPortalSyncNeedsCredentials') }}</p>
          } @else {
            <section class="sri-sync-card" [attr.aria-label]="t('sriDownload.syncCardTitle')">
            <div class="sri-sync-card__head">
              <div class="sri-sync-card__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <div>
                <h2 class="sri-sync-card__title">{{ t('sriDownload.syncCardTitle') }}</h2>
                <p class="sri-sync-card__subtitle">{{ t('sriDownload.syncCardSubtitle') }}</p>
              </div>
            </div>

            <div class="sri-period-pills" role="group" [attr.aria-label]="t('sriDownload.syncPeriodLabel')">
              <button
                type="button"
                class="sri-period-pill"
                [class.sri-period-pill--active]="syncPeriodPreset === 'current_month'"
                (click)="setSyncPeriodPreset('current_month')"
              >
                {{ t('sriDownload.syncPeriodCurrentMonth') }}
              </button>
              <button
                type="button"
                class="sri-period-pill"
                [class.sri-period-pill--active]="syncPeriodPreset === 'previous_month'"
                (click)="setSyncPeriodPreset('previous_month')"
              >
                {{ t('sriDownload.syncPeriodPreviousMonth') }}
              </button>
              <button
                type="button"
                class="sri-period-pill"
                [class.sri-period-pill--active]="syncPeriodPreset === 'custom_month'"
                (click)="setSyncPeriodPreset('custom_month')"
              >
                {{ t('sriDownload.syncPeriodCustomMonth') }}
              </button>
            </div>

            <div class="sri-sync-card__footer">
              <div class="sri-sync-card__range-wrap">
                @if (syncPeriodPreset === 'custom_month') {
                  <input
                    type="month"
                    class="form-control form-control-sm sri-sync-month-input"
                    [(ngModel)]="syncCustomMonth"
                    name="syncCustomMonth"
                    [attr.aria-label]="t('sriDownload.syncPeriodMonth')"
                  />
                }
                <div class="sri-sync-range">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M8 3v2M16 3v2M4 9h16M6 6h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span>{{ syncPeriodPreviewFormatted() }}</span>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-primary sri-sync-submit"
                (click)="sincronizarAhora()"
                [disabled]="loading() || sriSyncInProgress()"
              >
                @if (sriSyncInProgress()) {
                  <span class="sri-sync-spinner" aria-hidden="true"></span>
                }
                {{ sriSyncInProgress() ? t('company.sriPortalSyncRunning') : t('company.sriPortalSyncNow') }}
              </button>
            </div>
            @if (sriSyncInProgress() && syncProgressLines().length > 0) {
              <div class="sri-sync-progress" aria-live="polite">
                <div class="sri-sync-progress__header">
                  <span class="sri-sync-progress__pulse" aria-hidden="true"></span>
                  <p class="sri-sync-progress__title">{{ t('sriDownload.progressTitle') }}</p>
                </div>
                <div class="sri-sync-progress__timeline">
                  @for (line of syncProgressLines(); track line.id; let last = $last; let idx = $index) {
                    <div
                      class="sri-progress-step"
                      [class.sri-progress-step--active]="last"
                      [class.sri-progress-step--done]="!last"
                      [class.sri-progress-step--error]="line.estado === 'ERROR'"
                    >
                      <div class="sri-progress-step__rail" aria-hidden="true">
                        <span class="sri-progress-step__dot">{{ idx + 1 }}</span>
                      </div>
                      <div class="sri-progress-step__body">
                        <strong class="sri-progress-step__label">{{ progressLabel(line.tipoOperacion) }}</strong>
                        @if (progressDetail(line); as detail) {
                          <span class="sri-progress-step__detail">{{ detail }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
            </section>

            <section class="ts-panel mt-3">
              <div class="sri-summary-head">
                <div>
                  <h5 class="mb-1">{{ t('sriDownload.summaryYearTitle') }}</h5>
                  <p class="text-muted small mb-0">{{ t('sriDownload.summaryYearSubtitle') }}</p>
                </div>
                <label class="sri-summary-year">
                  <span class="small text-muted">{{ t('sriDownload.summaryYearFilter') }}</span>
                  <select
                    class="form-select form-select-sm"
                    [ngModel]="resumenAnio()"
                    (ngModelChange)="cambiarResumenAnio($event)"
                    name="resumenAnio"
                  >
                    @for (y of resumenAniosDisponibles(); track y) {
                      <option [ngValue]="y">{{ y }}</option>
                    }
                  </select>
                </label>
              </div>
              <div class="sri-month-cards" role="list">
                @for (card of resumenMesCards(); track card.mes) {
                  <article
                    class="sri-month-card"
                    [class.sri-month-card--descargado]="card.estado === 'descargado'"
                    [class.sri-month-card--pendiente]="card.estado === 'pendiente'"
                    [class.sri-month-card--futuro]="card.estado === 'futuro'"
                    role="listitem"
                  >
                    <header class="sri-month-card__head">
                      <span class="sri-month-card__month">{{ card.mesLabel }}</span>
                      <span
                        class="sri-month-card__badge"
                        [class.sri-month-card__badge--descargado]="card.estado === 'descargado'"
                        [class.sri-month-card__badge--pendiente]="card.estado === 'pendiente'"
                        [class.sri-month-card__badge--futuro]="card.estado === 'futuro'"
                      >
                        {{ estadoMesLabel(card.estado) }}
                      </span>
                    </header>
                    <div class="sri-month-card__metrics">
                      <div class="sri-month-card__metric">
                        <span class="sri-month-card__metric-label">{{ t('sriDownload.colTotalDocs') }}</span>
                        <strong class="sri-month-card__metric-value">{{ card.totalComprobantes }}</strong>
                      </div>
                      <div class="sri-month-card__metric">
                        <span class="sri-month-card__metric-label">{{ t('sriDownload.colTotalAmount') }}</span>
                        <strong class="sri-month-card__metric-value sri-month-card__metric-value--money">{{
                          formatMoney(card.valorTotal)
                        }}</strong>
                      </div>
                    </div>
                    @if (card.estado !== 'futuro') {
                      <button
                        type="button"
                        class="btn btn-sm sri-month-card__sync"
                        [class.btn-primary]="card.estado === 'pendiente'"
                        [class.btn-outline-primary]="card.estado === 'descargado'"
                        (click)="sincronizarMes(card.anio, card.mes)"
                        [disabled]="loading() || sriSyncInProgress()"
                      >
                        {{ t('sriDownload.syncMonth') }}
                      </button>
                    }
                  </article>
                }
              </div>
            </section>

            <section class="ts-panel mt-3">
              <h5 class="mb-3">{{ t('sriDownload.auditTitle') }}</h5>
              @if (syncRuns().length === 0) {
                <p class="text-muted mb-0">{{ t('sriDownload.auditEmpty') }}</p>
              } @else {
                <ts-tabulator-local-grid
                  [data]="syncRunsGridData()"
                  [columns]="auditColumns()"
                  [reloadNonce]="auditGridNonce()"
                  emptyContext="sriAudit"
                  height="min(300px, calc(100vh - 22rem))"
                  (rowAction)="onAuditGridAction($event)"
                />
              }
            </section>
            <ts-sri-sync-logs-modal
              [open]="modalLogsAbierto()"
              [logs]="botLogs()"
              [syncRun]="syncRunForLogs()"
              (closed)="cerrarModalLogs()"
            />
          }
        }

        @if (activeTab() === 'integracion') {
          <section class="ts-panel">
            <h5 class="mb-3">{{ t('sriDownload.integrationTitle') }}</h5>
            <p class="text-muted small">{{ t('sriDownload.integrationSubtitle') }}</p>

            <div class="sri-api-docs mb-4">
              <h6>{{ t('sriDownload.apiDocsTitle') }}</h6>
              <p class="small text-muted">{{ t('sriDownload.apiDocsIntro') }}</p>
              <p class="small mb-2">
                <a [href]="erpApiDocsUrl" target="_blank" rel="noopener noreferrer">{{ t('sriDownload.apiDocsScalarLink') }}</a>
              </p>
              <ul class="small sri-api-docs__list">
                <li><code>POST /api/sri-download/v1/public/comprobantes/descargar</code> — {{ t('sriDownload.apiDocsErpDescarga') }}</li>
              </ul>
              <p class="small mb-1"><strong>{{ t('sriDownload.apiDocsAuth') }}</strong></p>
              <pre class="sri-api-docs__pre">X-Api-Key: sk_sri_... (generada en esta pestaña)</pre>
              <p class="small mb-1 mt-2"><strong>{{ t('sriDownload.apiDocsErpBodyTitle') }}</strong></p>
              <pre class="sri-api-docs__pre">{{ erpDescargaBodyExample() }}</pre>
              <p class="small text-muted mt-2">{{ t('sriDownload.apiDocsErpNote') }}</p>
            </div>

            <h6 class="mt-4">{{ t('sriDownload.apiKeyTitle') }}</h6>
            @if (apiKeyPlain()) {
              <div class="alert alert-warning small">
                {{ t('sriDownload.apiKeyRevealHint') }}
                <code class="d-block mt-2 user-select-all">{{ apiKeyPlain() }}</code>
              </div>
            } @else if (apiKeyConfigured()) {
              <p class="small text-muted mb-2">{{ t('sriDownload.apiKeyConfigured') }}: {{ apiKeyMasked() }}</p>
            } @else {
              <p class="small text-muted mb-2">{{ t('sriDownload.apiKeyNotConfigured') }}</p>
            }
            <div class="d-flex flex-wrap gap-2 mb-4">
              <button type="button" class="btn btn-primary btn-sm" (click)="generarApiKey()" [disabled]="loading()">
                {{ apiKeyConfigured() ? t('sriDownload.apiKeyRegenerate') : t('sriDownload.apiKeyGenerate') }}
              </button>
              @if (apiKeyConfigured()) {
                <button type="button" class="btn btn-outline-danger btn-sm" (click)="revocarApiKey()" [disabled]="loading()">
                  {{ t('sriDownload.apiKeyRevoke') }}
                </button>
              }
            </div>

            <h6>{{ t('sriDownload.webhookTitle') }}</h6>
            <div class="ts-stack mb-3">
              <label class="ts-field">
                <span>{{ t('sriDownload.webhookUrl') }}</span>
                <input class="form-control" [(ngModel)]="webhookUrl" name="webhookUrl" placeholder="https://..." />
              </label>
              <label class="ts-field">
                <span>{{ t('sriDownload.webhookSecret') }}</span>
                <input
                  type="password"
                  class="form-control"
                  [(ngModel)]="webhookSecret"
                  name="webhookSecret"
                  [placeholder]="t('sriDownload.webhookSecretOptional')"
                />
              </label>
            </div>
            <button type="button" class="btn btn-primary btn-sm mb-3" (click)="guardarWebhook()" [disabled]="loading()">
              {{ t('sriDownload.webhookSave') }}
            </button>

            @if (webhooks().length > 0) {
              <ts-tabulator-local-grid
                [data]="webhooksGridData()"
                [columns]="webhookColumns()"
                [reloadNonce]="webhooksGridNonce()"
                emptyContext="sriWebhooks"
                height="200px"
                (rowAction)="onWebhookGridAction($event)"
              />
            } @else {
              <p class="text-muted small mb-0">{{ t('sriDownload.webhookEmpty') }}</p>
            }
          </section>
        }

        @if (activeTab() === 'credenciales') {
          <section class="ts-panel">
            <div class="ts-panel-header mb-3">
              <div>
                <h5>{{ t('company.sriDownloadTitle') }}</h5>
                <p class="mb-0">{{ t('company.sriDownloadSubtitle') }}</p>
              </div>
              @if (sriCredentialConfigured()) {
                <span class="badge bg-soft-success text-success">{{ t('company.sriPortalConfigured') }}</span>
              } @else {
                <span class="badge bg-light text-muted">{{ t('company.sriPortalNotConfigured') }}</span>
              }
            </div>
            @if (sriCredentialConfigured() && sriPortalUsuarioMasked()) {
              <p class="small text-muted">
                {{ t('company.sriPortalMaskedUser') }}: <strong>{{ sriPortalUsuarioMasked() }}</strong>
                @if (sriCredentialVigenteDesde()) {
                  · {{ sriCredentialVigenteDesde() | date: 'yyyy-MM-dd HH:mm' }}
                }
              </p>
            }
            <div class="ts-stack">
              <label class="ts-field">
                <span>{{ t('company.sriPortalUser') }}</span>
                <input class="form-control" [(ngModel)]="sriPortalUsuario" name="sriPortalUsuario" autocomplete="username" />
              </label>
              <label class="ts-field">
                <span>{{ t('company.sriPortalPassword') }}</span>
                <input
                  type="password"
                  class="form-control"
                  [(ngModel)]="sriPortalClave"
                  name="sriPortalClave"
                  autocomplete="new-password"
                  [placeholder]="sriCredentialConfigured() ? t('company.sriPortalPasswordKeep') : ''"
                />
              </label>
            </div>
            <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
              @if (sriCredentialConfigured()) {
                <button type="button" class="btn btn-outline-danger" (click)="eliminarCredenciales()" [disabled]="loading()">
                  {{ t('company.sriPortalRemove') }}
                </button>
              }
              <button type="button" class="btn btn-primary" (click)="guardarCredenciales()" [disabled]="loading()">
                {{ t('company.sriPortalSave') }}
              </button>
            </div>
          </section>
        }

        @if (activeTab() === 'comprobantes') {
          <section class="ts-panel">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h5 class="mb-0">{{ t('sriDownload.receivedTitle') }}</h5>
              <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="mostrarFiltrosComprobantes.set(!mostrarFiltrosComprobantes())">
                  {{ mostrarFiltrosComprobantes() ? t('monitor.hideFilters') : t('monitor.showFilters') }}
                </button>
                <button type="button" class="btn btn-soft-primary btn-sm" (click)="aplicarFiltrosComprobantes()">
                  {{ t('common.search') }}
                </button>
                @if (mostrarFiltrosComprobantes()) {
                  <button type="button" class="btn btn-outline-secondary btn-sm" (click)="limpiarFiltrosComprobantes()">
                    {{ t('monitor.clear') }}
                  </button>
                }
              </div>
            </div>
            @if (mostrarFiltrosComprobantes()) {
            <form class="row g-2 align-items-end mb-3" (ngSubmit)="aplicarFiltrosComprobantes()">
              <div class="col-md-2">
                <label class="form-label">{{ t('monitor.from') }}</label>
                <input type="date" class="form-control" [(ngModel)]="comprobantesFilters.fechaDesde" name="fechaDesde" />
              </div>
              <div class="col-md-2">
                <label class="form-label">{{ t('monitor.to') }}</label>
                <input type="date" class="form-control" [(ngModel)]="comprobantesFilters.fechaHasta" name="fechaHasta" />
              </div>
              <div class="col-md-3">
                <label class="form-label">{{ t('sriDownload.colAccessKey') }}</label>
                <input class="form-control" [(ngModel)]="comprobantesFilters.claveAcceso" name="claveAcceso" />
              </div>
              <div class="col-md-2">
                <label class="form-label">RUC</label>
                <input class="form-control" [(ngModel)]="comprobantesFilters.rucEmisor" name="rucEmisor" />
              </div>
              <div class="col-md-3">
                <label class="form-label">{{ t('sriDownload.colIssuer') }}</label>
                <input class="form-control" [(ngModel)]="comprobantesFilters.razonSocial" name="razonSocial" />
              </div>
            </form>
            }
            <ts-tabulator-spring-grid
              ajaxUrl="/api/web/v1/sri-descarga/comprobantes"
              [ajaxParams]="comprobantesFilterParams()"
              [columns]="comprobantesColumns()"
              [reloadNonce]="comprobantesGridNonce()"
              emptyContext="documents"
              [frozenColumns]="1"
              height="min(520px, calc(100vh - 20rem))"
              (rowAction)="onComprobantesGridAction($event)"
            />
          </section>
          <ts-sri-comprobante-modal
            [open]="modalDetalleAbierto()"
            [detalle]="comprobanteDetalle()"
            [platformParams]="platformParams()"
            (closed)="cerrarModalDetalle()"
          />
        }
      }
    </ts-page-layout>
  `,
  styles: [
    `
      .ts-panel {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        background: var(--card);
        padding: 1.25rem;
        box-shadow: var(--ef-surface-shadow);
        color: var(--text);
      }

      .ts-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .sri-refresh-btn {
        display: grid;
        place-items: center;
        width: 2.1rem;
        height: 2.1rem;
        padding: 0;
      }

      .sri-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        margin-bottom: 1rem;
        border-bottom: 1px solid var(--ef-surface-border, #e2e8f0);
      }

      .sri-tabs__btn {
        border: none;
        background: transparent;
        border-radius: 0;
        padding: 0.6rem 1rem;
        margin-bottom: -1px;
        font-size: 0.875rem;
        font-weight: 600;
        color: #64748b;
        border-bottom: 2px solid transparent;
        transition:
          color 0.15s ease,
          border-color 0.15s ease;
      }

      .sri-tabs__btn:hover {
        color: #334155;
      }

      .sri-tabs__btn--active {
        color: var(--ef-primary, #2563eb);
        border-bottom-color: var(--ef-primary, #2563eb);
        background: transparent;
      }

      .sri-sync-card {
        display: grid;
        gap: 1rem;
        margin-bottom: 1.25rem;
        padding: 1.1rem 1.2rem;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: color-mix(in srgb, var(--bg) 15%, var(--card));
        box-shadow: var(--ef-surface-shadow);
        border-color: var(--ef-surface-border);
      }

      .sri-sync-card__head {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
      }

      .sri-sync-card__icon {
        display: grid;
        flex-shrink: 0;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 10px;
        border: 1px solid #c7d2fe;
        background: var(--ef-surface-raised, #fff);
        color: var(--lux-primary-strong);
        box-shadow: 0 1px 2px rgba(79, 70, 229, 0.12);
      }

      .sri-sync-card__title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 650;
        color: #0f172a;
        line-height: 1.3;
      }

      .sri-sync-card__subtitle {
        margin: 0.2rem 0 0;
        font-size: 0.8rem;
        line-height: 1.45;
        color: #64748b;
      }

      .sri-period-pills {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0.2rem;
        padding: 0.2rem;
        border-radius: 10px;
        background: rgba(226, 232, 240, 0.65);
      }

      .sri-period-pill {
        border: none;
        background: transparent;
        border-radius: 8px;
        padding: 0.42rem 0.9rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #475569;
        transition:
          background 0.15s ease,
          color 0.15s ease,
          box-shadow 0.15s ease;
      }

      .sri-period-pill:hover {
        color: #1e293b;
      }

      .sri-period-pill--active {
        background: color-mix(in srgb, var(--lux-indigo) 14%, var(--card));
        color: var(--lux-primary-strong);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--lux-indigo) 20%, transparent);
      }

      .sri-sync-card__footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .sri-sync-card__range-wrap {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }

      .sri-sync-month-input {
        width: auto;
        min-width: 9.5rem;
        max-width: 11rem;
      }

      .sri-sync-range {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.5rem 0.85rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: var(--ef-input-bg);
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
      }

      .sri-sync-range svg {
        flex-shrink: 0;
        color: #64748b;
      }

      .sri-sync-submit {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 10.5rem;
        justify-content: center;
        padding-inline: 1.15rem;
        font-weight: 600;
      }

      .sri-sync-spinner {
        width: 0.95rem;
        height: 0.95rem;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        border-radius: 50%;
        animation: sri-spin 0.7s linear infinite;
      }

      @keyframes sri-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 575.98px) {
        .sri-sync-card__footer {
          flex-direction: column;
          align-items: stretch;
        }

        .sri-sync-submit {
          width: 100%;
        }
      }

      .ts-stack {
        display: grid;
        gap: 1rem;
        max-width: 480px;
      }

      .sri-sync-progress {
        margin-top: 1rem;
        padding: 1rem 1.1rem;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }

      .sri-sync-progress__header {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin-bottom: 0.85rem;
      }

      .sri-sync-progress__pulse {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 50%;
        background: #2563eb;
        box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
        animation: sri-pulse 1.6s ease-out infinite;
      }

      @keyframes sri-pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
        }
        70% {
          box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
        }
      }

      .sri-sync-progress__title {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 650;
        color: #0f172a;
        letter-spacing: -0.01em;
      }

      .sri-sync-progress__timeline {
        display: grid;
        gap: 0;
        max-height: min(320px, 42vh);
        overflow-y: auto;
        padding-right: 0.25rem;
      }

      .sri-progress-step {
        display: grid;
        grid-template-columns: 2rem 1fr;
        gap: 0.65rem;
        padding: 0.45rem 0;
      }

      .sri-progress-step__rail {
        display: flex;
        justify-content: center;
      }

      .sri-progress-step__dot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 999px;
        font-size: 0.65rem;
        font-weight: 700;
        color: #64748b;
        background: #e2e8f0;
      }

      .sri-progress-step--done .sri-progress-step__dot {
        color: #047857;
        background: #d1fae5;
      }

      .sri-progress-step--active .sri-progress-step__dot {
        color: #fff;
        background: #2563eb;
      }

      .sri-progress-step--error .sri-progress-step__dot {
        color: #fff;
        background: #dc2626;
      }

      .sri-progress-step__body {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
        padding-bottom: 0.35rem;
        border-bottom: 1px solid #f1f5f9;
      }

      .sri-progress-step:last-child .sri-progress-step__body {
        border-bottom: none;
        padding-bottom: 0;
      }

      .sri-progress-step__label {
        font-size: 0.8125rem;
        font-weight: 650;
        color: #1e293b;
        line-height: 1.35;
      }

      .sri-progress-step__detail {
        font-size: 0.78rem;
        color: #64748b;
        line-height: 1.4;
      }

      .sri-progress-step--error .sri-progress-step__label {
        color: #b91c1c;
      }

      .sri-api-docs__list {
        padding-left: 1.1rem;
      }

      .sri-summary-head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-end;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .sri-summary-year {
        display: grid;
        gap: 0.25rem;
        min-width: 7rem;
      }

      .sri-month-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
        gap: 0.85rem;
      }

      @media (min-width: 992px) {
        .sri-month-cards {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      .sri-month-card {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding: 0.95rem 1rem;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
        background: var(--card);
        min-height: 10.5rem;
        min-width: 0;
        overflow: hidden;
        transition: box-shadow 0.15s ease, transform 0.15s ease;
      }

      .sri-month-card:hover {
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
      }

      .sri-month-card--descargado {
        background: color-mix(in srgb, #16a34a 12%, var(--card));
        border-color: color-mix(in srgb, #22c55e 35%, var(--ef-surface-border));
      }

      .sri-month-card--pendiente {
        background: color-mix(in srgb, #d97706 10%, var(--card));
        border-color: color-mix(in srgb, #fbbf24 35%, var(--ef-surface-border));
      }

      .sri-month-card--futuro {
        background: color-mix(in srgb, var(--bg) 18%, var(--card));
        border-color: var(--ef-surface-border);
        opacity: 0.88;
      }

      .sri-month-card__head {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.4rem;
        min-width: 0;
      }

      .sri-month-card__month {
        font-weight: 700;
        font-size: 0.9375rem;
        color: var(--text);
        letter-spacing: -0.01em;
      }

      .sri-month-card__badge {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        padding: 0.15rem 0.45rem;
        border-radius: 999px;
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sri-month-card__badge--descargado {
        color: #047857;
        background: rgba(16, 185, 129, 0.15);
      }

      .sri-month-card__badge--pendiente {
        color: #b45309;
        background: rgba(245, 158, 11, 0.18);
      }

      .sri-month-card__badge--futuro {
        color: #64748b;
        background: rgba(100, 116, 139, 0.12);
      }

      .sri-month-card__metrics {
        display: grid;
        gap: 0.45rem;
      }

      .sri-month-card__metric {
        display: grid;
        gap: 0.1rem;
        min-width: 0;
      }

      .sri-month-card__metric-label {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--muted);
      }

      .sri-month-card__metric-value {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text);
        line-height: 1.2;
      }

      .sri-month-card__metric-value--money {
        font-size: 0.92rem;
        font-variant-numeric: tabular-nums;
        word-break: break-word;
      }

      .sri-month-card__sync {
        margin-top: auto;
        width: 100%;
        font-size: 0.75rem;
        font-weight: 650;
        padding: 0.4rem 0.55rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sri-api-docs__pre {
        font-size: 0.75rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.65rem 0.75rem;
        white-space: pre-wrap;
      }
    `,
  ],
})
export class SriDescargaPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly session = inject(SessionContextService);
  readonly tenant = inject(TenantContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;

  readonly tabs: { id: SriTab; labelKey: string }[] = [
    { id: 'sincronizacion', labelKey: 'sriDownload.tabSync' },
    { id: 'comprobantes', labelKey: 'sriDownload.tabReceived' },
    { id: 'credenciales', labelKey: 'sriDownload.tabCredentials' },
    { id: 'integracion', labelKey: 'sriDownload.tabIntegration' },
  ];

  readonly activeTab = signal<SriTab>('sincronizacion');
  readonly loading = signal(false);
  readonly sriDownloadServiceEnabled = signal(true);
  readonly sriCredentialConfigured = signal(false);
  readonly sriPortalUsuarioMasked = signal<string | null>(null);
  readonly sriCredentialVigenteDesde = signal<string | null>(null);
  readonly sriSyncInProgress = signal(false);
  readonly syncProgressLines = signal<SriBotLogResponse[]>([]);
  readonly activeSyncRunId = signal<string | null>(null);
  syncPeriodPreset: SriSyncPeriodPreset = 'current_month';
  syncCustomMonth = defaultCustomMonthValue();

  readonly syncRuns = signal<SriSyncRunResponse[]>([]);
  readonly botLogs = signal<SriBotLogResponse[]>([]);
  readonly modalLogsAbierto = signal(false);
  readonly syncRunForLogs = signal<SriSyncRunResponse | null>(null);
  readonly auditGridNonce = signal(0);
  readonly comprobantesGridNonce = signal(0);
  readonly resumenGridNonce = signal(0);
  readonly resumenAnio = signal(new Date().getFullYear());
  readonly resumenMensual = signal<SriComprobanteResumenMensual[]>([]);
  readonly mostrarFiltrosComprobantes = signal(false);

  readonly modalDetalleAbierto = signal(false);
  readonly comprobanteDetalle = signal<SriComprobanteRecibidoResponse | null>(null);

  comprobantesFilters: SriComprobantesFilters = this.defaultComprobantesFilters();
  readonly comprobantesFilterParams = signal<Record<string, string>>({});

  readonly apiKeyConfigured = signal(false);
  readonly apiKeyMasked = signal<string | null>(null);
  readonly apiKeyPlain = signal<string | null>(null);
  readonly webhooks = signal<SriWebhookResponse[]>([]);
  readonly webhooksGridNonce = signal(0);
  webhookUrl = '';
  webhookSecret = '';

  private sseAbort: AbortController | null = null;
  private botLogsPollTimer: ReturnType<typeof setInterval> | null = null;

  readonly resumenAniosDisponibles = computed(() => {
    const current = new Date().getFullYear();
    const years = new Set<number>();
    for (let offset = 0; offset <= 5; offset++) {
      years.add(current - offset);
    }
    years.add(this.resumenAnio());
    for (const run of this.syncRuns()) {
      if (run.fechaDesde) {
        years.add(Number.parseInt(run.fechaDesde.substring(0, 4), 10));
      }
      if (run.fechaHasta) {
        years.add(Number.parseInt(run.fechaHasta.substring(0, 4), 10));
      }
    }
    return Array.from(years)
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);
  });

  readonly resumenMesCards = computed<ResumenMesCard[]>(() => {
    const anio = this.resumenAnio();
    const byMes = new Map(this.resumenMensual().map((r) => [r.mes, r]));
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const row = byMes.get(mes);
      const totalComprobantes = row?.totalComprobantes ?? 0;
      const valorTotal = row?.valorTotal ?? 0;
      return {
        anio,
        mes,
        mesLabel: this.mesEtiqueta(mes),
        totalComprobantes,
        valorTotal,
        estado: this.estadoMes(anio, mes, totalComprobantes),
      };
    });
  });

  readonly syncRunsGridData = computed(() =>
    this.syncRuns().map((run) => ({ ...run }) as Record<string, unknown>),
  );

  readonly webhooksGridData = computed(() =>
    this.webhooks().map((wh) => ({ ...wh }) as Record<string, unknown>),
  );

  readonly comprobantesColumns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const actions: GridActionItem[] = [
      { action: 'view', label: this.t('sriDownload.viewDetail'), icon: 'view' },
      { action: 'xml', label: this.t('sriDownload.downloadXml'), icon: 'xml' },
    ];
    return [
      {
        title: '',
        field: 'id',
        width: 72,
        headerSort: false,
        hozAlign: 'center',
        ...TABULATOR_FROZEN_PROPS,
        formatter: () => gridActionsMenu(actions, this.t('common.actions')),
      },
      {
        title: this.t('sriDownload.colDate'),
        field: 'fechaEmision',
        width: 110,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorFechaCell(c.getValue());
        },
      },
      {
        title: this.t('sriDownload.colIssuer'),
        field: 'razonSocialEmisor',
        minWidth: 180,
        formatter: (cell: unknown) => {
          const c = cell as { getData: () => SriComprobanteRecibidoResponse };
          const d = c.getData();
          const name = d.razonSocialEmisor || '—';
          const ruc = d.rucEmisor ? `<div class="small text-muted">${escapeHtml(d.rucEmisor)}</div>` : '';
          return `<div>${escapeHtml(name)}</div>${ruc}`;
        },
      },
      {
        title: this.t('sriDownload.colAccessKey'),
        field: 'claveAcceso',
        minWidth: 220,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return '<code class="ts-cell-textarea">' + escapeHtml(String(c.getValue() ?? '')) + '</code>';
        },
      },
      {
        title: this.t('sriDownload.colTotal'),
        field: 'valorTotal',
        hozAlign: 'right',
        width: 110,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorMoneyCell(c.getValue());
        },
      },
    ];
  });

  readonly auditColumns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const actions: GridActionItem[] = [{ action: 'logs', label: this.t('sriDownload.viewLogs'), icon: 'view' }];
    return [
      {
        title: '',
        field: 'id',
        width: 72,
        headerSort: false,
        hozAlign: 'center',
        ...TABULATOR_FROZEN_PROPS,
        formatter: () => gridActionsMenu(actions, this.t('common.actions')),
      },
      {
        title: this.t('sriDownload.colStarted'),
        field: 'iniciadoEn',
        width: 130,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          const raw = tabulatorFechaCell(c.getValue());
          const plain = raw.replace(/<[^>]+>/g, '') || String(c.getValue() ?? '—');
          return tabulatorTextareaCell(plain);
        },
      },
      {
        title: this.t('common.status'),
        field: 'estado',
        width: 110,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(String(c.getValue() ?? ''));
        },
      },
      {
        title: this.t('sriDownload.colRange'),
        field: 'fechaDesde',
        minWidth: 160,
        formatter: (cell: unknown) => {
          const c = cell as { getData: () => SriSyncRunResponse };
          const d = c.getData();
          if (d.fechaDesde && d.fechaHasta) {
            return tabulatorTextareaCell(`${d.fechaDesde} — ${d.fechaHasta}`);
          }
          return tabulatorTextareaCell('—');
        },
      },
      {
        title: this.t('sriDownload.colNew'),
        field: 'comprobantesNuevos',
        width: 80,
        hozAlign: 'right',
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(String(c.getValue() ?? '0'));
        },
      },
      {
        title: this.t('sriDownload.colMessage'),
        field: 'mensaje',
        minWidth: 200,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
    ];
  });

  readonly webhookColumns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const actions: GridActionItem[] = [
      { action: 'delete', label: this.t('common.delete'), icon: 'delete', danger: true },
    ];
    return [
      {
        title: '',
        field: 'id',
        width: 72,
        headerSort: false,
        hozAlign: 'center',
        ...TABULATOR_FROZEN_PROPS,
        formatter: () => gridActionsMenu(actions, this.t('common.actions')),
      },
      {
        title: this.t('sriDownload.webhookUrl'),
        field: 'url',
        minWidth: 240,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('common.status'),
        field: 'estado',
        width: 100,
      },
    ];
  });

  sriPortalUsuario = '';
  sriPortalClave = '';

  ngOnInit(): void {
    if (!this.tieneEmpresa) {
      return;
    }
    this.comprobantesFilterParams.set(this.buildComprobantesAjaxParams(this.comprobantesFilters));
    this.reload();
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  setTab(tab: SriTab): void {
    this.activeTab.set(tab);
    if (tab === 'sincronizacion') {
      this.loadSyncRuns();
      this.loadResumenMensual();
    }
    if (tab === 'comprobantes') {
      this.comprobantesFilterParams.set(this.buildComprobantesAjaxParams(this.comprobantesFilters));
    }
    if (tab === 'integracion') {
      this.loadIntegration();
    }
  }

  reload(): void {
    this.loadCredentials();
    this.restoreSyncState();
    if (this.activeTab() === 'sincronizacion') {
      this.loadSyncRuns();
      this.loadResumenMensual();
    }
    if (this.activeTab() === 'comprobantes') {
      this.comprobantesGridNonce.update((n) => n + 1);
    }
    if (this.activeTab() === 'integracion') {
      this.loadIntegration();
    }
  }

  aplicarFiltrosComprobantes(): void {
    this.comprobantesFilterParams.set(this.buildComprobantesAjaxParams(this.comprobantesFilters));
    this.comprobantesGridNonce.update((n) => n + 1);
  }

  limpiarFiltrosComprobantes(): void {
    this.comprobantesFilters = this.defaultComprobantesFilters();
    this.aplicarFiltrosComprobantes();
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto.set(false);
  }

  cerrarModalLogs(): void {
    this.modalLogsAbierto.set(false);
    this.syncRunForLogs.set(null);
    this.botLogs.set([]);
  }

  readonly erpApiDocsUrl = 'http://localhost:8085/api/sri-download/v1/docs';

  erpDescargaBodyExample(): string {
    return JSON.stringify(
      {
        ruc: '1793230378001',
        contrasena: 'clave-portal-sri',
        anio: 2026,
        mes: 1,
        tiposComprobante: [1, 6],
      },
      null,
      2,
    );
  }

  webhookPayloadExample(): string {
    return JSON.stringify(
      {
        evento: 'sync.completed',
        syncRunId: 'uuid',
        estado: 'COMPLETADO',
        comprobantesNuevos: 12,
        comprobantesDuplicados: 3,
        comprobantesDetectados: 15,
        mensaje: 'Descarga portal OK...',
      },
      null,
      2,
    );
  }

  platformParams(): HttpParams {
    return this.buildPlatformParams();
  }

  mesEtiqueta(mes: number): string {
    const key = `sriDownload.month.${mes}`;
    const t = this.t(key);
    return t !== key ? t : String(mes);
  }

  formatMoney(value: unknown): string {
    return formatMoney(value);
  }

  cambiarResumenAnio(anio: number): void {
    const safe = Number(anio);
    if (!Number.isFinite(safe)) {
      return;
    }
    this.resumenAnio.set(safe);
    this.loadResumenMensual();
  }

  estadoMesLabel(estado: ResumenMesEstado): string {
    if (estado === 'descargado') {
      return this.t('sriDownload.monthStatusDownloaded');
    }
    if (estado === 'pendiente') {
      return this.t('sriDownload.monthStatusPending');
    }
    return this.t('sriDownload.monthStatusFuture');
  }

  sincronizarMes(anio: number, mes: number): void {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    this.sincronizarRango(desde, hasta);
  }

  guardarCredenciales(): void {
    const usuario = this.sriPortalUsuario.trim();
    if (!usuario) {
      this.toast.error(this.t('company.sriPortalUserRequired'));
      return;
    }
    if (!this.sriPortalClave.trim()) {
      this.toast.error(this.t('company.sriPortalPasswordRequired'));
      return;
    }
    this.loading.set(true);
    this.http
      .put<SriPortalCredentialStatusResponse>(
        '/api/web/v1/sri-descarga/portal-credentials',
        { portalUsuario: usuario, portalClave: this.sriPortalClave },
        { params: this.platformParams() },
      )
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.applyCredentialStatus(res);
          this.sriPortalClave = '';
          this.toast.success(this.t('company.sriPortalSaved'));
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(this.httpError(err, this.t('company.sriPortalSaveError')));
        },
      });
  }

  eliminarCredenciales(): void {
    this.loading.set(true);
    this.http.delete<void>('/api/web/v1/sri-descarga/portal-credentials', { params: this.platformParams() }).subscribe({
      next: () => {
        this.loading.set(false);
        this.sriCredentialConfigured.set(false);
        this.sriPortalUsuarioMasked.set(null);
        this.sriCredentialVigenteDesde.set(null);
        this.sriPortalUsuario = '';
        this.sriPortalClave = '';
        this.toast.success(this.t('company.sriPortalRemoved'));
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(this.httpError(err, this.t('company.sriPortalRemoveError')));
      },
    });
  }

  syncPeriodPreviewFormatted(): string {
    const range = resolveSriSyncPeriod(this.syncPeriodPreset, this.syncCustomMonth);
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };
    return `${fmt(range.fechaDesde)} — ${fmt(range.fechaHasta)}`;
  }

  setSyncPeriodPreset(preset: SriSyncPeriodPreset): void {
    this.syncPeriodPreset = preset;
  }

  sincronizarAhora(): void {
    if (this.sriSyncInProgress()) {
      return;
    }
    if (!this.sriCredentialConfigured()) {
      this.toast.error(this.t('company.sriPortalSyncNeedsCredentials'));
      return;
    }
    const range = resolveSriSyncPeriod(this.syncPeriodPreset, this.syncCustomMonth);
    this.sincronizarRango(range.fechaDesde, range.fechaHasta);
  }

  sincronizarRango(fechaDesde: string, fechaHasta: string): void {
    if (this.sriSyncInProgress()) {
      return;
    }
    if (!this.sriCredentialConfigured()) {
      this.toast.error(this.t('company.sriPortalSyncNeedsCredentials'));
      return;
    }
    this.sriSyncInProgress.set(true);
    this.syncProgressLines.set([]);
    this.http
      .post<SriSyncRunResponse>(
        '/api/web/v1/sri-descarga/sync',
        { fechaDesde, fechaHasta },
        { params: this.platformParams() },
      )
      .subscribe({
        next: (res) => {
          if (res.id) {
            this.activeSyncRunId.set(res.id);
            this.iniciarSseProgreso(res.id);
          }
          if (res.estado === 'EN_PROGRESO') {
            this.toast.info(this.t('company.sriPortalSyncStarted'));
            this.pollSyncStatus(0);
            return;
          }
          this.finalizarSync(res);
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.toast.info(this.t('company.sriPortalSyncStarted'));
            this.resolverSyncEnProgreso();
            return;
          }
          this.sriSyncInProgress.set(false);
          this.toast.error(this.httpError(err, this.t('company.sriPortalSyncError')));
        },
      });
  }

  onComprobantesGridAction(event: { action: string; row: Record<string, unknown> }): void {
    if (event.action === 'view') {
      this.verDetalle(event.row as unknown as SriComprobanteRecibidoResponse);
      return;
    }
    if (event.action === 'xml') {
      this.descargarXmlComprobante(event.row as unknown as SriComprobanteRecibidoResponse);
    }
  }

  onAuditGridAction(event: { action: string; row: Record<string, unknown> }): void {
    if (event.action === 'logs') {
      this.verBotLogs(event.row as unknown as SriSyncRunResponse);
    }
  }

  onWebhookGridAction(event: { action: string; row: Record<string, unknown> }): void {
    if (event.action === 'delete') {
      const id = String(event.row['id'] ?? '');
      if (id) {
        this.eliminarWebhook(id);
      }
    }
  }

  progressLabel(tipo: string): string {
    return sriProgressLabel((k) => this.t(k), tipo);
  }

  progressDetail(log: SriBotLogResponse): string | null {
    return sriProgressDetail((k) => this.t(k), log);
  }

  generarApiKey(): void {
    this.loading.set(true);
    this.http
      .post<SriApiKeyCreatedResponse>('/api/web/v1/sri-descarga/integration/api-key', {}, { params: this.platformParams() })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.apiKeyPlain.set(res.apiKey);
          this.apiKeyConfigured.set(true);
          this.apiKeyMasked.set('sk_sri_****');
          this.toast.success(this.t('sriDownload.apiKeyGenerated'));
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(this.httpError(err, this.t('sriDownload.apiKeyError')));
        },
      });
  }

  revocarApiKey(): void {
    this.loading.set(true);
    this.http
      .delete<void>('/api/web/v1/sri-descarga/integration/api-key', { params: this.platformParams() })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.apiKeyConfigured.set(false);
          this.apiKeyMasked.set(null);
          this.apiKeyPlain.set(null);
          this.toast.success(this.t('sriDownload.apiKeyRevoked'));
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(this.httpError(err, this.t('sriDownload.apiKeyError')));
        },
      });
  }

  guardarWebhook(): void {
    const url = this.webhookUrl.trim();
    if (!url) {
      this.toast.error(this.t('sriDownload.webhookUrlRequired'));
      return;
    }
    const body: Record<string, unknown> = {
      url,
      eventos: ['sync.completed', 'sync.failed'],
    };
    if (this.webhookSecret.trim()) {
      body['secret'] = this.webhookSecret.trim();
    }
    this.loading.set(true);
    this.http
      .put<SriWebhookResponse>('/api/web/v1/sri-descarga/integration/webhooks', body, { params: this.platformParams() })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.webhookUrl = '';
          this.webhookSecret = '';
          this.toast.success(this.t('sriDownload.webhookSaved'));
          this.loadWebhooks();
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(this.httpError(err, this.t('sriDownload.webhookError')));
        },
      });
  }

  eliminarWebhook(webhookId: string): void {
    this.loading.set(true);
    this.http
      .delete<void>(`/api/web/v1/sri-descarga/integration/webhooks/${webhookId}`, { params: this.platformParams() })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.toast.success(this.t('sriDownload.webhookDeleted'));
          this.loadWebhooks();
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(this.httpError(err, this.t('sriDownload.webhookError')));
        },
      });
  }

  verBotLogs(run: SriSyncRunResponse): void {
    if (!run.id) {
      return;
    }
    this.syncRunForLogs.set(run);
    this.modalLogsAbierto.set(true);
    this.botLogs.set([]);
    this.http
      .get<SriBotLogResponse[]>(`/api/web/v1/sri-descarga/sync-runs/${run.id}/bot-logs`, {
        params: this.platformParams(),
      })
      .subscribe({
        next: (logs) => this.botLogs.set(logs),
        error: (err) => this.toast.error(this.httpError(err, this.t('sriDownload.botLogsLoadError'))),
      });
  }

  verDetalle(c: SriComprobanteRecibidoResponse): void {
    this.http
      .get<SriComprobanteRecibidoResponse>(`/api/web/v1/sri-descarga/comprobantes/${c.id}`, {
        params: this.buildPlatformParams(),
      })
      .subscribe({
        next: (det) => {
          this.comprobanteDetalle.set({
            ...det,
            valorTotal: this.normalizarValorTotal(det.valorTotal),
          });
          this.modalDetalleAbierto.set(true);
        },
        error: (err) => this.toast.error(this.httpError(err, this.t('sriDownload.detailLoadError'))),
      });
  }

  descargarXmlComprobante(c: SriComprobanteRecibidoResponse): void {
    if (!c?.id) {
      return;
    }
    this.http
      .get(`/api/web/v1/sri-descarga/comprobantes/${c.id}/xml`, {
        params: this.platformParams(),
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${c.claveAcceso || c.id}.xml`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: (err) => this.toast.error(this.httpError(err, this.t('sriDownload.xmlDownloadError'))),
      });
  }

  private loadIntegration(): void {
    this.loadApiKeyStatus();
    this.loadWebhooks();
  }

  private loadApiKeyStatus(): void {
    this.http
      .get<SriApiKeyStatusResponse>('/api/web/v1/sri-descarga/integration/api-key', { params: this.platformParams() })
      .subscribe({
        next: (res) => {
          this.apiKeyConfigured.set(res.configured);
          this.apiKeyMasked.set(res.masked ?? res.maskedPreview ?? null);
        },
        error: () => {
          this.apiKeyConfigured.set(false);
          this.apiKeyMasked.set(null);
        },
      });
  }

  private loadWebhooks(): void {
    this.http
      .get<SriWebhookResponse[]>('/api/web/v1/sri-descarga/integration/webhooks', { params: this.platformParams() })
      .subscribe({
        next: (hooks) => {
          this.webhooks.set(hooks);
          this.webhooksGridNonce.update((n) => n + 1);
        },
        error: () => this.webhooks.set([]),
      });
  }

  private iniciarSseProgreso(syncRunId: string): void {
    this.detenerSseProgreso();
    this.iniciarPollBotLogs(syncRunId);
    const params: Record<string, string> = {};
    const empresaId = this.session.profile()?.empresaId;
    if (this.session.hasAnyAuthority('PLATFORM_ADMIN') && empresaId) {
      params['empresaId'] = empresaId;
    }
    this.sseAbort = connectSriSyncSse(syncRunId, params, {
      onBotLog: (payload) => {
        const log = payload as unknown as SriBotLogResponse;
        this.syncProgressLines.update((lines) => {
          const idx = lines.findIndex((l) => l.id === log.id);
          if (idx >= 0) {
            const next = [...lines];
            next[idx] = log;
            return next;
          }
          return [...lines, log];
        });
      },
      onSyncRun: (payload) => {
        const run = payload as unknown as SriSyncRunResponse;
        if (run.estado && run.estado !== 'EN_PROGRESO') {
          this.finalizarSync(run);
        }
      },
      onError: () => {
        /* polling de bot-logs mantiene el progreso visible */
      },
    });
  }

  private iniciarPollBotLogs(syncRunId: string): void {
    this.detenerPollBotLogs();
    const fetchLogs = () => {
      this.http
        .get<SriBotLogResponse[]>(`/api/web/v1/sri-descarga/sync-runs/${syncRunId}/bot-logs`, {
          params: this.platformParams(),
        })
        .subscribe({
          next: (logs) => this.syncProgressLines.set(logs),
          error: () => {},
        });
    };
    fetchLogs();
    this.botLogsPollTimer = setInterval(fetchLogs, 2500);
  }

  private detenerPollBotLogs(): void {
    if (this.botLogsPollTimer) {
      clearInterval(this.botLogsPollTimer);
      this.botLogsPollTimer = null;
    }
  }

  private detenerSseProgreso(): void {
    this.sseAbort?.abort();
    this.sseAbort = null;
  }

  private loadResumenMensual(): void {
    const anio = this.resumenAnio();
    this.http
      .get<SriComprobanteResumenMensual[]>('/api/web/v1/sri-descarga/comprobantes/resumen-mensual', {
        params: this.buildPlatformParams().set('anio', String(anio)),
      })
      .subscribe({
        next: (rows) => {
          this.resumenMensual.set(rows);
          this.resumenGridNonce.update((n) => n + 1);
        },
        error: () => this.resumenMensual.set([]),
      });
  }

  private defaultComprobantesFilters(): SriComprobantesFilters {
    const rango = rangoMesEnCurso();
    return {
      fechaDesde: rango.desde,
      fechaHasta: rango.hasta,
      claveAcceso: '',
      rucEmisor: '',
      razonSocial: '',
    };
  }

  private filtersToParams(filters: SriComprobantesFilters): Record<string, string> {
    const p: Record<string, string> = {};
    if (filters.fechaDesde) p['fechaDesde'] = filters.fechaDesde;
    if (filters.fechaHasta) p['fechaHasta'] = filters.fechaHasta;
    if (filters.claveAcceso.trim()) p['claveAcceso'] = filters.claveAcceso.trim();
    if (filters.rucEmisor.trim()) p['rucEmisor'] = filters.rucEmisor.trim();
    if (filters.razonSocial.trim()) p['razonSocial'] = filters.razonSocial.trim();
    return p;
  }

  private buildComprobantesAjaxParams(filters: SriComprobantesFilters): Record<string, string> {
    const params = this.filtersToParams(filters);
    const empresaId = this.session.profile()?.empresaId;
    if (this.session.hasAnyAuthority('PLATFORM_ADMIN') && empresaId) {
      params['empresaId'] = empresaId;
    }
    return params;
  }

  private restoreSyncState(): void {
    if (!readAccessToken()) {
      return;
    }
    this.http
      .get<SriSyncRunResponse>('/api/web/v1/sri-descarga/sync/status', { params: this.platformParams() })
      .subscribe({
        next: (res) => {
          if (res.estado === 'EN_PROGRESO') {
            this.sriSyncInProgress.set(true);
            if (res.id) {
              this.activeSyncRunId.set(res.id);
              this.iniciarSseProgreso(res.id);
            }
            this.pollSyncStatus(0);
          }
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
            return;
          }
        },
      });
  }

  private loadCredentials(): void {
    this.http
      .get<SriPortalCredentialStatusResponse>('/api/web/v1/sri-descarga/portal-credentials', {
        params: this.platformParams(),
      })
      .subscribe({
        next: (res) => this.applyCredentialStatus(res),
        error: () => this.sriDownloadServiceEnabled.set(false),
      });
  }

  private resolverSyncEnProgreso(): void {
    this.http
      .get<SriSyncRunResponse>('/api/web/v1/sri-descarga/sync/status', { params: this.platformParams() })
      .subscribe({
        next: (res) => {
          if (res.id) {
            this.activeSyncRunId.set(res.id);
            this.iniciarSseProgreso(res.id);
          }
          this.sriSyncInProgress.set(true);
          this.pollSyncStatus(0);
        },
        error: () => this.pollSyncStatus(0),
      });
  }

  private loadSyncRuns(): void {
    this.loading.set(true);
    this.http
      .get<SriSyncRunResponse[]>('/api/web/v1/sri-descarga/sync-runs', {
        params: this.platformParams().set('limit', '30'),
      })
      .subscribe({
        next: (runs) => {
          this.loading.set(false);
          this.syncRuns.set(runs);
          this.auditGridNonce.update((n) => n + 1);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(this.httpError(err, this.t('sriDownload.auditLoadError')));
        },
      });
  }

  private applyCredentialStatus(res: SriPortalCredentialStatusResponse): void {
    this.sriDownloadServiceEnabled.set(res.serviceEnabled);
    this.sriCredentialConfigured.set(res.configured);
    this.sriPortalUsuarioMasked.set(res.portalUsuarioMasked ?? null);
    this.sriCredentialVigenteDesde.set(res.vigenteDesde ?? null);
  }

  private pollSyncStatus(intento: number): void {
    if (intento >= 120) {
      this.sriSyncInProgress.set(false);
      this.detenerSseProgreso();
      this.toast.error(this.t('company.sriPortalSyncTimeout'));
      return;
    }
    setTimeout(() => {
      this.http
        .get<SriSyncRunResponse>('/api/web/v1/sri-descarga/sync/status', { params: this.platformParams() })
        .subscribe({
          next: (res) => {
            if (res.estado === 'EN_PROGRESO') {
              this.pollSyncStatus(intento + 1);
              return;
            }
            this.finalizarSync(res);
          },
          error: (err) => {
            if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
              this.sriSyncInProgress.set(false);
              return;
            }
            if (err instanceof HttpErrorResponse && err.status >= 500) {
              this.sriSyncInProgress.set(false);
              this.toast.error(this.t('company.sriPortalSyncError'));
              return;
            }
            this.pollSyncStatus(intento + 1);
          },
        });
    }, 3000);
  }

  private finalizarSync(res: SriSyncRunResponse): void {
    this.detenerSseProgreso();
    this.detenerPollBotLogs();
    const syncId = res.id ?? this.activeSyncRunId();
    if (syncId) {
      this.http
        .get<SriBotLogResponse[]>(`/api/web/v1/sri-descarga/sync-runs/${syncId}/bot-logs`, {
          params: this.platformParams(),
        })
        .subscribe({
          next: (logs) => this.syncProgressLines.set(logs),
          error: () => {},
        });
    }
    this.sriSyncInProgress.set(false);
    if (res.estado === 'ERROR') {
      this.toast.error(res.mensaje || this.t('company.sriPortalSyncError'));
      this.loadSyncRuns();
      return;
    }
    const nuevos = res.comprobantesNuevos ?? 0;
    this.toast.success(this.t('company.sriPortalSyncDone').replace('{n}', String(nuevos)));
    if (res.fechaDesde) {
      const anioSync = Number.parseInt(res.fechaDesde.substring(0, 4), 10);
      if (Number.isFinite(anioSync)) {
        this.resumenAnio.set(anioSync);
      }
    }
    this.comprobantesGridNonce.update((n) => n + 1);
    this.loadResumenMensual();
    this.loadSyncRuns();
  }

  private buildPlatformParams(): HttpParams {
    const isPlatformAdmin = this.session.hasAnyAuthority('PLATFORM_ADMIN');
    const empresaId = this.session.profile()?.empresaId;
    if (isPlatformAdmin && empresaId) {
      return new HttpParams().set('empresaId', empresaId);
    }
    return new HttpParams();
  }

  private estadoMes(anio: number, mes: number, totalComprobantes: number): ResumenMesEstado {
    const now = new Date();
    const currentAnio = now.getFullYear();
    const currentMes = now.getMonth() + 1;
    if (anio > currentAnio || (anio === currentAnio && mes > currentMes)) {
      return 'futuro';
    }
    if (totalComprobantes > 0 || this.mesTieneSyncCompletada(anio, mes)) {
      return 'descargado';
    }
    return 'pendiente';
  }

  private mesTieneSyncCompletada(anio: number, mes: number): boolean {
    const desdeMes = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const hastaMes = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    return this.syncRuns().some(
      (run) =>
        (run.estado === 'COMPLETADO' || run.estado === 'OK') &&
        run.fechaDesde === desdeMes &&
        run.fechaHasta === hastaMes,
    );
  }

  private normalizarValorTotal(value: unknown): number | undefined {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const n = Number(String(value));
    return Number.isFinite(n) ? n : undefined;
  }

  private httpError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      return extractApiErrorMessage(err, fallback);
    }
    return fallback;
  }
}
