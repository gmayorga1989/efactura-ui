import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { SpringPage } from '../../core/models/page.model';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { rangoMesEnCurso } from '../../core/util/fecha-local.util';
import { etiquetaEstadoSri, tonoEstadoSri } from '../../shared/ui/sri-estado.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

type ReportTab = 'ventas' | 'liquidaciones' | 'guias' | 'retenciones';
type ReportRecord = Record<string, unknown>;

interface ReportFilters {
  desde: string;
  hasta: string;
  estadoSri: string;
  identificacion: string;
  establecimiento: string;
  puntoEmision: string;
  page: number;
  size: number;
}

interface ReportSummary {
  totalDocumentos?: number | null;
  subtotal?: number | null;
  descuentos?: number | null;
  iva?: number | null;
  total?: number | null;
  totalFacturas?: number | null;
  totalNotasCredito?: number | null;
  totalNotasDebito?: number | null;
  totalNeto?: number | null;
  totalLiquidaciones?: number | null;
  totalGuias?: number | null;
  totalRetenciones?: number | null;
  baseImponible?: number | null;
  valorRetenido?: number | null;
  autorizadas?: number | null;
  pendientes?: number | null;
}

interface ReportResponse {
  empresaId?: string | null;
  desde?: string | null;
  hasta?: string | null;
  resumen?: ReportSummary | null;
  estados?: ReportRecord[] | null;
  tiposEstado?: ReportRecord[] | null;
  documentos?: SpringPage<ReportRecord> | null;
  liquidaciones?: SpringPage<ReportRecord> | null;
  guias?: SpringPage<ReportRecord> | null;
  retenciones?: SpringPage<ReportRecord> | null;
}

interface SummaryCard {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
}

interface DistributionItem {
  label: string;
  value: number;
  percent: number;
  tone: string;
}

interface TypeStateItem {
  type: string;
  state: string;
  value: number;
}

interface RetentionLine {
  codigo: string;
  codigoRetencion: string;
  baseImponible: number;
  porcentaje: number;
  valor: number;
  sustentoTipo: string;
  sustentoNumero: string;
  sustentoFecha: string;
}

interface ExportColumn {
  label: string;
  value: (row: ReportRecord) => string | number;
}

const REPORT_TABS: { id: ReportTab; labelKey: string; fallback: string; endpoint: string }[] = [
  { id: 'ventas', labelKey: 'reports.tabs.sales', fallback: 'Ventas', endpoint: '/api/web/v1/reportes/ventas' },
  {
    id: 'liquidaciones',
    labelKey: 'reports.tabs.settlements',
    fallback: 'Liquidaciones',
    endpoint: '/api/web/v1/reportes/liquidaciones',
  },
  { id: 'guias', labelKey: 'reports.tabs.guides', fallback: 'Guias emitidas', endpoint: '/api/web/v1/reportes/guias' },
  {
    id: 'retenciones',
    labelKey: 'reports.tabs.withholdings',
    fallback: 'Retenciones emitidas',
    endpoint: '/api/web/v1/reportes/retenciones',
  },
];

@Component({
  selector: 'ts-reportes-page',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout [title]="t('reports.title')" [subtitle]="t('reports.subtitle')" [eyebrow]="t('reports.eyebrow')">
      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('reports.signInHelp') }}
          } @else {
            {{ t('reports.selectCompany') }}
          }
        </p>
      } @else if (!session.puedeVerReportes()) {
        <p class="text-muted mb-0">{{ t('reports.permissionRequired') }}</p>
      } @else {
        <div class="ts-reports">
          <nav class="ts-reports-tabs" [attr.aria-label]="t('reports.nav', 'Navegacion de reportes')">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                class="ts-reports-tabs__btn"
                [class.ts-reports-tabs__btn--active]="activeTab() === tab.id"
                (click)="selectTab(tab.id)"
              >
                {{ t(tab.labelKey, tab.fallback) }}
              </button>
            }
          </nav>

          <form class="ts-reports-filters" (ngSubmit)="applyFilters()">
            <label>
              <span>{{ t('monitor.from', 'Desde') }}</span>
              <input type="date" name="desde" [(ngModel)]="filters.desde" required />
            </label>
            <label>
              <span>{{ t('monitor.to', 'Hasta') }}</span>
              <input type="date" name="hasta" [(ngModel)]="filters.hasta" required />
            </label>
            <label>
              <span>{{ t('documents.sriStatus', 'Estado SRI') }}</span>
              <select name="estadoSri" [(ngModel)]="filters.estadoSri">
                <option value="">{{ t('common.all') }}</option>
                <option value="AUTORIZADO">{{ t('invoice.statusAuthorized') }}</option>
                <option value="PENDIENTE_AUTORIZACION">{{ t('invoice.statusPending') }}</option>
                <option value="RECIBIDA">{{ t('invoice.statusReceived') }}</option>
                <option value="DEVUELTO">{{ t('invoice.statusReturned') }}</option>
                <option value="NO_AUTORIZADO">{{ t('invoice.statusRejected') }}</option>
                <option value="ERROR">{{ t('invoice.statusError') }}</option>
              </select>
            </label>
            <label class="ts-reports-filters__wide">
              <span>{{ t('reports.identificationFilter', 'Identificacion / cliente / proveedor') }}</span>
              <input name="identificacion" [(ngModel)]="filters.identificacion" />
            </label>
            <label>
              <span>{{ t('monitor.establishmentShort', 'Est.') }}</span>
              <input name="establecimiento" [(ngModel)]="filters.establecimiento" maxlength="3" />
            </label>
            <label>
              <span>{{ t('monitor.emissionPointShort', 'Pto.') }}</span>
              <input name="puntoEmision" [(ngModel)]="filters.puntoEmision" maxlength="3" />
            </label>
            <label>
              <span>{{ t('reports.pageSize', 'Filas') }}</span>
              <select name="size" [(ngModel)]="filters.size">
                <option [ngValue]="10">10</option>
                <option [ngValue]="20">20</option>
                <option [ngValue]="50">50</option>
                <option [ngValue]="100">100</option>
              </select>
            </label>
            <div class="ts-reports-filters__actions">
              <button type="submit" class="btn btn-primary btn-sm">{{ t('common.search') }}</button>
              <button type="button" class="btn btn-light btn-sm" (click)="refresh()" [disabled]="loading()">
                {{ t('common.refresh') }}
              </button>
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="exportExcel()" [disabled]="loading() || !pageRows().length">
                {{ t('reports.exportExcel', 'Excel') }}
              </button>
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="exportPdf()" [disabled]="loading() || !pageRows().length">
                {{ t('reports.exportPdf', 'PDF') }}
              </button>
            </div>
          </form>

          @if (loading()) {
            <div class="ts-reports-loading">
              <span></span><span></span><span></span>
            </div>
          } @else if (errorMessage()) {
            <section class="ts-reports-empty">
              <h5>{{ t('reports.loadError', 'No se pudo cargar el reporte') }}</h5>
              <p>{{ errorMessage() }}</p>
              <button type="button" class="btn btn-primary btn-sm" (click)="refresh()">{{ t('common.refresh') }}</button>
            </section>
          } @else {
            <section class="ts-reports-cards">
              @for (card of summaryCards(); track card.label) {
                <article
                  class="ts-reports-card"
                  [class.ts-reports-card--primary]="card.tone === 'primary'"
                  [class.ts-reports-card--success]="card.tone === 'success'"
                  [class.ts-reports-card--warning]="card.tone === 'warning'"
                >
                  <span>{{ card.label }}</span>
                  <strong>{{ card.value }}</strong>
                </article>
              }
            </section>

            @if (activeTab() === 'ventas') {
              <div class="ts-reports-analytics">
                <section class="ts-reports-panel">
                  <div class="ts-reports-panel__head">
                    <h5>{{ t('reports.sriStatusDistribution', 'Distribucion por estado SRI') }}</h5>
                  </div>
                  <ng-container [ngTemplateOutlet]="distributionTpl"></ng-container>
                </section>
                <section class="ts-reports-panel">
                  <div class="ts-reports-panel__head">
                    <h5>{{ t('reports.typeStateDistribution', 'Distribucion por tipo y estado') }}</h5>
                  </div>
                  @if (typeStateItems().length) {
                    <div class="ts-reports-type-state">
                      @for (item of typeStateItems(); track item.type + item.state) {
                        <div>
                          <strong>{{ item.type }}</strong>
                          <span>{{ item.state }}</span>
                          <b>{{ item.value }}</b>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="ts-reports-emptyline">{{ t('reports.noTypeStateData', 'Sin datos por tipo y estado.') }}</div>
                  }
                </section>
              </div>
            } @else {
              <section class="ts-reports-panel ts-reports-panel--compact">
                <div class="ts-reports-panel__head">
                  <h5>{{ t('reports.sriStatusDistribution', 'Distribucion por estado SRI') }}</h5>
                </div>
                <ng-container [ngTemplateOutlet]="distributionTpl"></ng-container>
              </section>
            }

            <section class="ts-reports-panel">
              <div class="ts-reports-panel__head">
                <div>
                  <h5>{{ activeTabLabel() }}</h5>
                  <p>{{ pageLabel() }}</p>
                </div>
              </div>

              @if (!pageRows().length) {
                <div class="ts-reports-emptyline">{{ t('reports.empty', 'No hay datos para los filtros seleccionados.') }}</div>
              } @else if (activeTab() === 'ventas') {
                <div class="ts-reports-table-wrap">
                  <table class="ts-reports-table">
                    <thead>
                      <tr>
                        <th class="ts-reports-table__actions">{{ t('common.actions') }}</th>
                        <th>{{ t('reports.col.date', 'Fecha') }}</th>
                        <th>{{ t('reports.col.type', 'Tipo') }}</th>
                        <th>{{ t('reports.col.number', 'Numero') }}</th>
                        <th>{{ t('reports.col.identification', 'Identificacion') }}</th>
                        <th>{{ t('reports.col.customer', 'Cliente') }}</th>
                        <th>{{ t('invoice.subtotal') }}</th>
                        <th>{{ t('invoice.discount') }}</th>
                        <th>{{ t('invoice.taxBreakdown', 'IVA') }}</th>
                        <th>{{ t('invoice.total', 'Total') }}</th>
                        <th>{{ t('documents.sriStatus', 'Estado SRI') }}</th>
                        <th>{{ t('invoice.authorization', 'Autorizacion') }}</th>
                        <th>{{ t('reports.col.origin', 'Origen') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of pageRows(); track rowId(row)) {
                        <tr>
                          <td class="ts-reports-table__actions"><a class="ts-reports-action" [routerLink]="detailLink(row)">{{ t('common.view') }}</a></td>
                          <td>{{ formatDate(pickString(row, ['fecha', 'fechaEmision', 'emitidoEn'])) }}</td>
                          <td>{{ docType(pickString(row, ['tipo', 'tipoComprobante'])) }}</td>
                          <td>{{ pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' }}</td>
                          <td>{{ pickString(row, ['identificacion', 'identificacionReceptor', 'identificacionComprador']) || '-' }}</td>
                          <td>{{ pickString(row, ['cliente', 'razonSocialReceptor', 'razonSocialComprador', 'nombre']) || '-' }}</td>
                          <td>{{ money(pickNumber(row, ['subtotal', 'subtotalSinImpuestos'])) }}</td>
                          <td>{{ money(pickNumber(row, ['descuentos', 'descuento', 'totalDescuento'])) }}</td>
                          <td>{{ money(pickNumber(row, ['iva', 'valorIva'])) }}</td>
                          <td>{{ money(pickNumber(row, ['total', 'valorTotal', 'importeTotal'])) }}</td>
                          <td><span class="ts-reports-badge" [class]="badgeClass(row)">{{ statusLabel(row) }}</span></td>
                          <td>{{ pickString(row, ['autorizacion', 'numeroAutorizacion']) || '-' }}</td>
                          <td>{{ pickString(row, ['origen', 'source']) || '-' }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="6">{{ t('reports.visibleTotals', 'Totales visibles') }}</td>
                        <td>{{ money(columnTotal(['subtotal', 'subtotalSinImpuestos'])) }}</td>
                        <td>{{ money(columnTotal(['descuentos', 'descuento', 'totalDescuento'])) }}</td>
                        <td>{{ money(columnTotal(['iva', 'valorIva'])) }}</td>
                        <td>{{ money(columnTotal(['total', 'valorTotal', 'importeTotal'])) }}</td>
                        <td colspan="3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              } @else if (activeTab() === 'liquidaciones') {
                <div class="ts-reports-table-wrap">
                  <table class="ts-reports-table">
                    <thead>
                      <tr>
                        <th class="ts-reports-table__actions">{{ t('common.actions') }}</th>
                        <th>{{ t('reports.col.date', 'Fecha') }}</th>
                        <th>{{ t('reports.col.number', 'Numero') }}</th>
                        <th>{{ t('reports.col.identification', 'Identificacion') }}</th>
                        <th>{{ t('reports.col.provider', 'Proveedor') }}</th>
                        <th>{{ t('invoice.subtotal') }}</th>
                        <th>{{ t('invoice.taxBreakdown', 'IVA') }}</th>
                        <th>{{ t('invoice.total', 'Total') }}</th>
                        <th>{{ t('documents.sriStatus', 'Estado SRI') }}</th>
                        <th>{{ t('invoice.authorization', 'Autorizacion') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of pageRows(); track rowId(row)) {
                        <tr>
                          <td class="ts-reports-table__actions"><a class="ts-reports-action" [routerLink]="detailLink(row)">{{ t('common.view') }}</a></td>
                          <td>{{ formatDate(pickString(row, ['fecha', 'fechaEmision'])) }}</td>
                          <td>{{ pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' }}</td>
                          <td>{{ pickString(row, ['identificacion', 'identificacionProveedor', 'identificacionReceptor']) || '-' }}</td>
                          <td>{{ pickString(row, ['proveedor', 'razonSocialProveedor', 'razonSocialReceptor']) || '-' }}</td>
                          <td>{{ money(pickNumber(row, ['subtotal', 'subtotalSinImpuestos'])) }}</td>
                          <td>{{ money(pickNumber(row, ['iva', 'valorIva'])) }}</td>
                          <td>{{ money(pickNumber(row, ['total', 'valorTotal', 'importeTotal'])) }}</td>
                          <td><span class="ts-reports-badge" [class]="badgeClass(row)">{{ statusLabel(row) }}</span></td>
                          <td>{{ pickString(row, ['autorizacion', 'numeroAutorizacion']) || '-' }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="5">{{ t('reports.visibleTotals', 'Totales visibles') }}</td>
                        <td>{{ money(columnTotal(['subtotal', 'subtotalSinImpuestos'])) }}</td>
                        <td>{{ money(columnTotal(['iva', 'valorIva'])) }}</td>
                        <td>{{ money(columnTotal(['total', 'valorTotal', 'importeTotal'])) }}</td>
                        <td colspan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              } @else if (activeTab() === 'guias') {
                <div class="ts-reports-table-wrap">
                  <table class="ts-reports-table">
                    <thead>
                      <tr>
                        <th class="ts-reports-table__actions">{{ t('common.actions') }}</th>
                        <th>{{ t('reports.col.issueDate', 'Fecha emision') }}</th>
                        <th>{{ t('reports.col.number', 'Numero') }}</th>
                        <th>{{ t('documents.sriStatus', 'Estado SRI') }}</th>
                        <th>{{ t('reports.col.recipient', 'Destinatario') }}</th>
                        <th>{{ t('reports.col.identification', 'Identificacion') }}</th>
                        <th>{{ t('reports.col.departureAddress', 'Direccion partida') }}</th>
                        <th>{{ t('reports.col.destinationAddress', 'Direccion destino') }}</th>
                        <th>{{ t('reports.col.transferReason', 'Motivo traslado') }}</th>
                        <th>{{ t('reports.col.carrier', 'Transportista') }}</th>
                        <th>{{ t('reports.col.carrierRuc', 'RUC transportista') }}</th>
                        <th>{{ t('reports.col.plate', 'Placa') }}</th>
                        <th>{{ t('reports.col.transportStart', 'Inicio transporte') }}</th>
                        <th>{{ t('reports.col.transportEnd', 'Fin transporte') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of pageRows(); track rowId(row)) {
                        <tr>
                          <td class="ts-reports-table__actions"><a class="ts-reports-action" [routerLink]="detailLink(row)">{{ t('common.view') }}</a></td>
                          <td>{{ formatDate(pickString(row, ['fechaEmision', 'fecha'])) }}</td>
                          <td>{{ pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' }}</td>
                          <td><span class="ts-reports-badge" [class]="badgeClass(row)">{{ statusLabel(row) }}</span></td>
                          <td>{{ pickString(row, ['destinatario', 'razonSocialDestinatario', 'cliente']) || '-' }}</td>
                          <td>{{ pickString(row, ['identificacion', 'identificacionDestinatario']) || '-' }}</td>
                          <td>{{ pickString(row, ['direccionPartida', 'dirPartida']) || '-' }}</td>
                          <td>{{ pickString(row, ['direccionDestino', 'dirDestino']) || '-' }}</td>
                          <td>{{ pickString(row, ['motivoTraslado', 'motivo']) || '-' }}</td>
                          <td>{{ pickString(row, ['transportista', 'razonSocialTransportista']) || '-' }}</td>
                          <td>{{ pickString(row, ['rucTransportista', 'identificacionTransportista']) || '-' }}</td>
                          <td>{{ pickString(row, ['placa']) || '-' }}</td>
                          <td>{{ formatDate(pickString(row, ['fechaInicioTransporte', 'inicioTransporte'])) }}</td>
                          <td>{{ formatDate(pickString(row, ['fechaFinTransporte', 'finTransporte'])) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="ts-reports-table-wrap">
                  <table class="ts-reports-table">
                    <thead>
                      <tr>
                        <th class="ts-reports-table__actions">{{ t('common.actions') }}</th>
                        <th>{{ t('reports.col.date', 'Fecha') }}</th>
                        <th>{{ t('reports.col.number', 'Numero') }}</th>
                        <th>{{ t('reports.col.withheldSubject', 'Sujeto retenido') }}</th>
                        <th>{{ t('reports.col.identification', 'Identificacion') }}</th>
                        <th>{{ t('reports.col.taxBase', 'Base imponible') }}</th>
                        <th>{{ t('reports.col.withheldValue', 'Valor retenido') }}</th>
                        <th>{{ t('documents.sriStatus', 'Estado SRI') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of pageRows(); track rowId(row)) {
                        <tr>
                          <td class="ts-reports-table__actions">
                            <button type="button" class="ts-reports-expand" (click)="toggleRetention(row)">
                              {{ isRetentionExpanded(row) ? '-' : '+' }}
                            </button>
                            <a class="ts-reports-action" [routerLink]="detailLink(row)">{{ t('common.view') }}</a>
                          </td>
                          <td>{{ formatDate(pickString(row, ['fecha', 'fechaEmision'])) }}</td>
                          <td>{{ pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' }}</td>
                          <td>{{ pickString(row, ['sujetoRetenido', 'razonSocialSujetoRetenido', 'proveedor']) || '-' }}</td>
                          <td>{{ pickString(row, ['identificacion', 'identificacionSujetoRetenido']) || '-' }}</td>
                          <td>{{ money(pickNumber(row, ['baseImponible', 'base'])) }}</td>
                          <td>{{ money(pickNumber(row, ['valorRetenido', 'totalRetenido', 'valor'])) }}</td>
                          <td><span class="ts-reports-badge" [class]="badgeClass(row)">{{ statusLabel(row) }}</span></td>
                        </tr>
                        @if (isRetentionExpanded(row)) {
                          <tr class="ts-reports-lines-row">
                            <td colspan="8">
                              @if (retentionLines(row).length) {
                                <div class="ts-reports-lines">
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>{{ t('reports.col.code', 'Codigo') }}</th>
                                        <th>{{ t('reports.col.withholdingCode', 'Codigo retencion') }}</th>
                                        <th>{{ t('reports.col.taxBase', 'Base imponible') }}</th>
                                        <th>{{ t('reports.col.percent', 'Porcentaje') }}</th>
                                        <th>{{ t('reports.col.value', 'Valor') }}</th>
                                        <th>{{ t('reports.col.supportType', 'Documento sustento tipo') }}</th>
                                        <th>{{ t('reports.col.supportNumber', 'Documento sustento numero') }}</th>
                                        <th>{{ t('reports.col.supportDate', 'Documento sustento fecha') }}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      @for (line of retentionLines(row); track line.codigo + line.codigoRetencion + line.sustentoNumero) {
                                        <tr>
                                          <td>{{ line.codigo }}</td>
                                          <td>{{ line.codigoRetencion }}</td>
                                          <td>{{ money(line.baseImponible) }}</td>
                                          <td>{{ percent(line.porcentaje) }}</td>
                                          <td>{{ money(line.valor) }}</td>
                                          <td>{{ line.sustentoTipo }}</td>
                                          <td>{{ line.sustentoNumero }}</td>
                                          <td>{{ formatDate(line.sustentoFecha) }}</td>
                                        </tr>
                                      }
                                    </tbody>
                                  </table>
                                </div>
                              } @else {
                                <div class="ts-reports-emptyline ts-reports-emptyline--small">{{ t('reports.noRetentionLines', 'Sin lineas de retencion.') }}</div>
                              }
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="5">{{ t('reports.visibleTotals', 'Totales visibles') }}</td>
                        <td>{{ money(columnTotal(['baseImponible', 'base'])) }}</td>
                        <td>{{ money(columnTotal(['valorRetenido', 'totalRetenido', 'valor'])) }}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              }

              <div class="ts-reports-pagination">
                <button type="button" class="btn btn-light btn-sm" (click)="goPage(0)" [disabled]="page().first">
                  {{ t('common.first', 'Primera') }}
                </button>
                <button type="button" class="btn btn-light btn-sm" (click)="goPage(filters.page - 1)" [disabled]="page().first">
                  {{ t('common.back') }}
                </button>
                <span>{{ t('reports.pageOf', 'Pagina {{page}} de {{total}}', { page: filters.page + 1, total: totalPages() }) }}</span>
                <button type="button" class="btn btn-light btn-sm" (click)="goPage(filters.page + 1)" [disabled]="page().last">
                  {{ t('common.next', 'Siguiente') }}
                </button>
              </div>
            </section>
          }
        </div>
      }

      <ng-template #distributionTpl>
        @if (statusDistribution().length) {
          <div class="ts-reports-distribution">
            @for (item of statusDistribution(); track item.label) {
              <div class="ts-reports-distribution__row">
                <div>
                  <span class="ts-reports-dot" [class.ts-reports-dot--success]="item.tone === 'success'" [class.ts-reports-dot--warning]="item.tone === 'warning'" [class.ts-reports-dot--danger]="item.tone === 'danger'"></span>
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.value }}</small>
                </div>
                <span class="ts-reports-distribution__track"><span [style.width.%]="item.percent"></span></span>
              </div>
            }
          </div>
        } @else {
          <div class="ts-reports-emptyline">{{ t('reports.noStatusData', 'Sin datos por estado.') }}</div>
        }
      </ng-template>
    </ts-page-layout>
  `,
  styles: [
    `
      .ts-reports {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .ts-reports-tabs,
      .ts-reports-filters,
      .ts-reports-panel,
      .ts-reports-card,
      .ts-reports-empty {
        border: 1px solid rgba(17, 24, 39, 0.08);
        border-radius: 10px;
        background: var(--card);
        box-shadow: var(--ef-surface-shadow);
        color: var(--text);
      }

      .ts-reports-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        padding: 0.45rem;
        background: var(--ef-tabs-bg, #f8fafc);
      }

      .ts-reports-tabs__btn {
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #475569;
        font-size: 0.84rem;
        font-weight: 700;
        padding: 0.55rem 0.8rem;
      }

      .ts-reports-tabs__btn--active {
        background: color-mix(in srgb, var(--lux-indigo) 14%, var(--card));
        color: var(--lux-primary-strong);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--lux-indigo) 20%, transparent);
      }

      .ts-reports-filters {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 0.65rem;
        align-items: end;
        padding: 0.9rem;
      }

      .ts-reports-filters label {
        display: flex;
        flex-direction: column;
        gap: 0.22rem;
        grid-column: span 2;
        min-width: 0;
      }

      .ts-reports-filters span {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .ts-reports-filters input,
      .ts-reports-filters select {
        min-height: 2rem;
        border: 1px solid #dbe2ea;
        border-radius: 7px;
        padding: 0.28rem 0.45rem;
        color: #1e293b;
        font-size: 0.8rem;
        background: var(--ef-input-bg);
      }

      .ts-reports-filters__wide {
        grid-column: span 3;
      }

      .ts-reports-filters__actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.35rem;
        grid-column: 1 / -1;
        padding-top: 0.2rem;
      }

      .ts-reports-cards {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .ts-reports-card {
        padding: 0.85rem;
      }

      .ts-reports-card span {
        display: block;
        color: #64748b;
        font-size: 0.74rem;
        font-weight: 700;
      }

      .ts-reports-card strong {
        display: block;
        margin-top: 0.25rem;
        color: var(--text);
        font-size: 1.22rem;
        line-height: 1.2;
      }

      .ts-reports-card--primary strong {
        color: #0f766e;
      }

      .ts-reports-card--success strong {
        color: #166534;
      }

      .ts-reports-card--warning strong {
        color: #92400e;
      }

      .ts-reports-analytics {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.75fr);
        gap: 0.85rem;
      }

      .ts-reports-panel {
        padding: 1rem;
        min-width: 0;
      }

      .ts-reports-panel--compact {
        max-width: 48rem;
      }

      .ts-reports-panel__head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.8rem;
      }

      .ts-reports-panel__head h5 {
        margin: 0;
        color: #0f172a;
        font-size: 0.96rem;
        font-weight: 800;
      }

      .ts-reports-panel__head p {
        margin: 0.2rem 0 0;
        color: #64748b;
        font-size: 0.76rem;
      }

      .ts-reports-distribution {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }

      .ts-reports-distribution__row {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .ts-reports-distribution__row > div {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: #334155;
        font-size: 0.8rem;
      }

      .ts-reports-distribution__row small {
        margin-left: auto;
        color: #64748b;
      }

      .ts-reports-distribution__track {
        height: 0.44rem;
        overflow: hidden;
        border-radius: 999px;
        background: #e2e8f0;
      }

      .ts-reports-distribution__track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: #1e5b96;
      }

      .ts-reports-dot {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: #64748b;
        flex-shrink: 0;
      }

      .ts-reports-dot--success {
        background: #16a34a;
      }

      .ts-reports-dot--warning {
        background: #d97706;
      }

      .ts-reports-dot--danger {
        background: #dc2626;
      }

      .ts-reports-type-state {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
      }

      .ts-reports-type-state div {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.1rem 0.45rem;
        padding: 0.65rem;
        border: 1px solid rgba(17, 24, 39, 0.06);
        border-radius: 8px;
        background: #f8fafc;
      }

      .ts-reports-type-state strong {
        color: #0f172a;
        font-size: 0.76rem;
      }

      .ts-reports-type-state span {
        color: #64748b;
        font-size: 0.72rem;
      }

      .ts-reports-type-state b {
        grid-row: span 2;
        color: #0f766e;
        font-size: 1rem;
      }

      .ts-reports-table-wrap {
        overflow-x: auto;
        border: 1px solid rgba(17, 24, 39, 0.06);
        border-radius: 10px;
        background: #f8fafc;
      }

      .ts-reports-table {
        width: 100%;
        min-width: 72rem;
        border-collapse: separate;
        border-spacing: 0;
      }

      .ts-reports-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        padding: 0.65rem;
        background: #f8fafc;
        color: #64748b;
        font-size: 0.7rem;
        font-weight: 800;
        text-align: left;
        white-space: nowrap;
      }

      .ts-reports-table td {
        padding: 0.62rem 0.65rem;
        border-top: 1px solid rgba(17, 24, 39, 0.06);
        border-bottom: 0;
        background: var(--card);
        color: var(--text);
        font-size: 0.76rem;
        vertical-align: top;
        white-space: nowrap;
      }

      .ts-reports-table td:first-child {
        border-left: 0;
        border-radius: 0;
      }

      .ts-reports-table td:last-child {
        border-right: 0;
        border-radius: 0;
      }

      .ts-reports-table tfoot td {
        position: sticky;
        bottom: 0;
        border-top: 2px solid #cbd5e1;
        background: #f1f5f9;
        color: #0f172a;
        font-weight: 800;
      }

      .ts-reports-table__actions {
        left: 0;
        min-width: 7rem;
        background: #fff;
      }

      th.ts-reports-table__actions {
        background: #f8fafc;
      }

      .ts-reports-action {
        display: inline-flex;
        align-items: center;
        min-height: 1.55rem;
        border-radius: 999px;
        padding: 0.12rem 0.55rem;
        background: #e0f2fe;
        color: #075985;
        font-size: 0.7rem;
        font-weight: 800;
        text-decoration: none;
      }

      .ts-reports-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.14rem 0.5rem;
        background: #f1f5f9;
        color: #475569;
        font-size: 0.7rem;
        font-weight: 800;
      }

      .ts-reports-badge--success {
        background: #dcfce7;
        color: #166534;
      }

      .ts-reports-badge--warning {
        background: #fef3c7;
        color: #92400e;
      }

      .ts-reports-badge--danger {
        background: #fee2e2;
        color: #991b1b;
      }

      .ts-reports-badge--info,
      .ts-reports-badge--draft {
        background: #e0f2fe;
        color: #075985;
      }

      .ts-reports-pagination {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.45rem;
        margin-top: 0.85rem;
        color: #64748b;
        font-size: 0.78rem;
      }

      .ts-reports-expand {
        width: 1.55rem;
        height: 1.55rem;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: #fff;
        color: #0f766e;
        font-weight: 800;
      }

      .ts-reports-lines-row td {
        white-space: normal;
        background: #f8fafc;
      }

      .ts-reports-lines {
        overflow-x: auto;
      }

      .ts-reports-lines table {
        width: 100%;
        min-width: 54rem;
        border-collapse: collapse;
      }

      .ts-reports-lines th,
      .ts-reports-lines td {
        border: 1px solid #e2e8f0;
        border-radius: 0;
        background: #fff;
        padding: 0.45rem;
      }

      .ts-reports-empty,
      .ts-reports-emptyline {
        color: #64748b;
      }

      .ts-reports-empty {
        padding: 1.25rem;
      }

      .ts-reports-empty h5 {
        color: #0f172a;
      }

      .ts-reports-emptyline {
        display: grid;
        place-items: center;
        min-height: 8rem;
        border: 1px dashed rgba(17, 24, 39, 0.14);
        border-radius: 8px;
        background: #f8fafc;
        font-size: 0.85rem;
      }

      .ts-reports-emptyline--small {
        min-height: 3rem;
      }

      .ts-reports-loading {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }

      .ts-reports-loading span {
        height: 6rem;
        border-radius: 10px;
        background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 48%, #f1f5f9 100%);
        background-size: 200% 100%;
        animation: ts-reports-pulse 1.4s ease infinite;
      }

      @keyframes ts-reports-pulse {
        0% { background-position: 0 0; }
        100% { background-position: -200% 0; }
      }

      @media (max-width: 1199.98px) {
        .ts-reports-filters,
        .ts-reports-cards,
        .ts-reports-analytics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .ts-reports-filters__wide {
          grid-column: span 2;
        }
      }

      @media (max-width: 767.98px) {
        .ts-reports-filters,
        .ts-reports-cards,
        .ts-reports-analytics,
        .ts-reports-type-state,
        .ts-reports-loading {
          grid-template-columns: 1fr;
        }

        .ts-reports-filters__wide {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class ReportesPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tabs = REPORT_TABS;
  readonly activeTab = signal<ReportTab>('ventas');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly response = signal<ReportResponse | null>(null);
  readonly expandedRetentionIds = signal<Set<string>>(new Set());

  tokenPresent = false;
  tieneEmpresa = false;
  filters: ReportFilters = this.defaultFilters();

  readonly page = computed<SpringPage<ReportRecord>>(() => this.extractPage(this.response(), this.activeTab()));
  readonly pageRows = computed(() => this.page().content ?? []);
  readonly totalPages = computed(() => Math.max(this.page().totalPages || 1, 1));

  readonly summaryCards = computed<SummaryCard[]>(() => {
    const resumen = this.response()?.resumen ?? {};
    const totalDocs = this.page().totalElements || this.numberValue(resumen.totalDocumentos);
    if (this.activeTab() === 'ventas') {
      return [
        { label: this.t('reports.cards.netTotal', 'Total neto'), value: this.moneyValue(resumen.totalNeto ?? resumen.total), tone: 'primary' },
        { label: this.t('reports.cards.invoicesTotal', 'Total facturas'), value: this.moneyValue(resumen.totalFacturas), tone: 'success' },
        { label: this.t('reports.cards.creditNotesTotal', 'Total notas credito'), value: this.moneyValue(resumen.totalNotasCredito), tone: 'warning' },
        { label: this.t('reports.cards.debitNotesTotal', 'Total notas debito'), value: this.moneyValue(resumen.totalNotasDebito), tone: 'neutral' },
        { label: this.t('reports.cards.documentsTotal', 'Total documentos'), value: this.integer(totalDocs), tone: 'neutral' },
      ];
    }
    if (this.activeTab() === 'liquidaciones') {
      return [
        { label: this.t('reports.cards.settlementsTotal', 'Total liquidaciones'), value: this.moneyValue(resumen.totalLiquidaciones ?? resumen.total), tone: 'primary' },
        { label: this.t('reports.cards.documentsTotal', 'Total documentos'), value: this.integer(totalDocs), tone: 'neutral' },
        { label: this.t('reports.cards.sriStates', 'Estados SRI'), value: this.integer(this.statusDistribution().length), tone: 'success' },
      ];
    }
    if (this.activeTab() === 'guias') {
      const authorized = this.countByStatus('AUTORIZADO', resumen.autorizadas);
      const pending = Math.max(totalDocs - authorized, this.numberValue(resumen.pendientes));
      return [
        { label: this.t('reports.cards.guidesTotal', 'Total guias'), value: this.integer(resumen.totalGuias ?? totalDocs), tone: 'primary' },
        { label: this.t('reports.cards.authorized', 'Autorizadas'), value: this.integer(authorized), tone: 'success' },
        { label: this.t('reports.cards.pending', 'Pendientes / No autorizadas'), value: this.integer(pending), tone: 'warning' },
      ];
    }
    return [
      { label: this.t('reports.cards.withholdingsTotal', 'Total retenciones'), value: this.integer(resumen.totalRetenciones ?? totalDocs), tone: 'primary' },
      { label: this.t('reports.cards.taxBase', 'Base imponible'), value: this.moneyValue(resumen.baseImponible), tone: 'neutral' },
      { label: this.t('reports.cards.withheldValue', 'Valor retenido'), value: this.moneyValue(resumen.valorRetenido ?? resumen.total), tone: 'success' },
      { label: this.t('reports.cards.sriStates', 'Estados SRI'), value: this.integer(this.statusDistribution().length), tone: 'neutral' },
    ];
  });

  readonly statusDistribution = computed<DistributionItem[]>(() => {
    const rows = this.response()?.estados ?? [];
    const items = rows.map((row) => {
      const estado = this.pickString(row, ['estadoSri', 'estado', 'status', 'label']);
      return {
        label: this.statusLabelFromValue(estado),
        value: this.pickNumber(row, ['total', 'cantidad', 'count', 'value']),
        tone: tonoEstadoSri(estado),
      };
    });
    const total = Math.max(items.reduce((sum, item) => sum + item.value, 0), 1);
    return items.map((item) => ({ ...item, percent: Math.round((item.value / total) * 100) }));
  });

  readonly typeStateItems = computed<TypeStateItem[]>(() => {
    const rows = this.response()?.tiposEstado ?? [];
    return rows.map((row) => ({
      type: this.docType(this.pickString(row, ['tipo', 'tipoComprobante', 'documentType'])),
      state: this.statusLabelFromValue(this.pickString(row, ['estadoSri', 'estado', 'status'])),
      value: this.pickNumber(row, ['total', 'cantidad', 'count', 'value']),
    }));
  });

  ngOnInit(): void {
    this.tokenPresent = !!readAccessToken();
    this.tieneEmpresa = !!this.session.profile()?.empresaId;
    if (!this.tokenPresent || !this.tieneEmpresa || !this.session.puedeVerReportes()) {
      return;
    }
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.readQueryParams(params);
      this.loadReport();
    });
  }

  selectTab(tab: ReportTab): void {
    this.navigateWithFilters({ tab, page: 0 });
  }

  applyFilters(): void {
    this.navigateWithFilters({ ...this.filters, page: 0 });
  }

  refresh(): void {
    this.loadReport();
  }

  goPage(page: number): void {
    const bounded = Math.max(0, Math.min(page, this.totalPages() - 1));
    this.navigateWithFilters({ page: bounded });
  }

  exportExcel(): void {
    this.fetchExportRows((rows) => {
      const html = this.buildExportHtml(rows, 'excel');
      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      this.downloadBlob(blob, `${this.exportFileName()}.xls`);
    });
  }

  exportPdf(): void {
    this.fetchExportRows((rows) => {
      const html = this.buildExportHtml(rows, 'pdf');
      const win = window.open('', '_blank', 'width=1200,height=800');
      if (!win) {
        this.downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${this.exportFileName()}.html`);
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    });
  }

  activeTabLabel(): string {
    const tab = this.tabs.find((item) => item.id === this.activeTab());
    return tab ? this.t(tab.labelKey, tab.fallback) : this.t('reports.title');
  }

  pageLabel(): string {
    const page = this.page();
    return this.t('reports.pageSummary', '{{total}} registros. Pagina {{page}} de {{pages}}', {
      total: page.totalElements ?? 0,
      page: this.filters.page + 1,
      pages: this.totalPages(),
    });
  }

  rowId(row: ReportRecord): string {
    return this.pickString(row, ['id', 'comprobanteId', 'uuid', 'numero', 'numeroComprobante']) || JSON.stringify(row);
  }

  detailLink(row: ReportRecord): string[] {
    const id = this.pickString(row, ['id', 'comprobanteId', 'uuid']);
    return ['/t', this.tenant.tenantSlug(), 'comprobantes', id];
  }

  statusLabel(row: ReportRecord): string {
    return this.statusLabelFromValue(this.pickString(row, ['estadoSri', 'estado', 'status']));
  }

  statusTone(row: ReportRecord): string {
    return tonoEstadoSri(this.pickString(row, ['estadoSri', 'estado', 'status']));
  }

  badgeClass(row: ReportRecord): string {
    return `ts-reports-badge ts-reports-badge--${this.statusTone(row)}`;
  }

  columnTotal(keys: string[]): number {
    return this.pageRows().reduce((sum, row) => sum + this.pickNumber(row, keys), 0);
  }

  toggleRetention(row: ReportRecord): void {
    const id = this.rowId(row);
    const next = new Set(this.expandedRetentionIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedRetentionIds.set(next);
  }

  isRetentionExpanded(row: ReportRecord): boolean {
    return this.expandedRetentionIds().has(this.rowId(row));
  }

  retentionLines(row: ReportRecord): RetentionLine[] {
    const raw = row['lineas'] ?? row['detalles'] ?? row['items'];
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => {
      const line = item as ReportRecord;
      return {
        codigo: this.pickString(line, ['codigo', 'codigoImpuesto']) || '-',
        codigoRetencion: this.pickString(line, ['codigoRetencion', 'codRetencion']) || '-',
        baseImponible: this.pickNumber(line, ['baseImponible', 'base']),
        porcentaje: this.pickNumber(line, ['porcentaje', 'porcentajeRetener']),
        valor: this.pickNumber(line, ['valor', 'valorRetenido']),
        sustentoTipo: this.pickString(line, ['documentoSustentoTipo', 'tipoDocumentoSustento']) || '-',
        sustentoNumero: this.pickString(line, ['documentoSustentoNumero', 'numeroDocumentoSustento']) || '-',
        sustentoFecha: this.pickString(line, ['documentoSustentoFecha', 'fechaDocumentoSustento']),
      };
    });
  }

  docType(value: string): string {
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

  formatDate(value: string): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(this.locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  money(value: number): string {
    return this.moneyValue(value);
  }

  percent(value: number): string {
    return `${new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 2 }).format(value)}%`;
  }

  t(key: string, fallback?: string | Record<string, unknown>, params?: Record<string, unknown>): string {
    return this.i18n.t(key, fallback as string | Record<string, unknown> | undefined, params);
  }

  pickString(row: ReportRecord, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (value != null && value !== '') {
        return String(value);
      }
    }
    return '';
  }

  pickNumber(row: ReportRecord, keys: string[]): number {
    for (const key of keys) {
      const value = row[key];
      const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private fetchExportRows(done: (rows: ReportRecord[]) => void): void {
    const tab = this.tabs.find((item) => item.id === this.activeTab()) ?? this.tabs[0];
    const total = this.page().totalElements || this.pageRows().length || this.filters.size;
    const size = Math.min(Math.max(total, this.filters.size, 1), 5000);
    this.http
      .get<ReportResponse>(tab.endpoint, { params: this.httpParams(0, size) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => done(this.extractPage(response, this.activeTab()).content ?? []),
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(extractApiErrorMessage(err, this.t('reports.exportError', 'No se pudo exportar el reporte.')));
        },
      });
  }

  private exportColumns(): ExportColumn[] {
    if (this.activeTab() === 'ventas') {
      return [
        { label: this.t('reports.col.date', 'Fecha'), value: (row) => this.formatDate(this.pickString(row, ['fecha', 'fechaEmision', 'emitidoEn'])) },
        { label: this.t('reports.col.type', 'Tipo'), value: (row) => this.docType(this.pickString(row, ['tipo', 'tipoComprobante'])) },
        { label: this.t('reports.col.number', 'Numero'), value: (row) => this.pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' },
        { label: this.t('reports.col.identification', 'Identificacion'), value: (row) => this.pickString(row, ['identificacion', 'identificacionReceptor', 'identificacionComprador']) || '-' },
        { label: this.t('reports.col.customer', 'Cliente'), value: (row) => this.pickString(row, ['cliente', 'razonSocialReceptor', 'razonSocialComprador', 'nombre']) || '-' },
        { label: this.t('invoice.subtotal'), value: (row) => this.pickNumber(row, ['subtotal', 'subtotalSinImpuestos']) },
        { label: this.t('invoice.discount'), value: (row) => this.pickNumber(row, ['descuentos', 'descuento', 'totalDescuento']) },
        { label: this.t('invoice.taxBreakdown', 'IVA'), value: (row) => this.pickNumber(row, ['iva', 'valorIva']) },
        { label: this.t('invoice.total', 'Total'), value: (row) => this.pickNumber(row, ['total', 'valorTotal', 'importeTotal']) },
        { label: this.t('documents.sriStatus', 'Estado SRI'), value: (row) => this.statusLabel(row) },
        { label: this.t('invoice.authorization', 'Autorizacion'), value: (row) => this.pickString(row, ['autorizacion', 'numeroAutorizacion']) || '-' },
        { label: this.t('reports.col.origin', 'Origen'), value: (row) => this.pickString(row, ['origen', 'source']) || '-' },
      ];
    }
    if (this.activeTab() === 'liquidaciones') {
      return [
        { label: this.t('reports.col.date', 'Fecha'), value: (row) => this.formatDate(this.pickString(row, ['fecha', 'fechaEmision'])) },
        { label: this.t('reports.col.number', 'Numero'), value: (row) => this.pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' },
        { label: this.t('reports.col.identification', 'Identificacion'), value: (row) => this.pickString(row, ['identificacion', 'identificacionProveedor', 'identificacionReceptor']) || '-' },
        { label: this.t('reports.col.provider', 'Proveedor'), value: (row) => this.pickString(row, ['proveedor', 'razonSocialProveedor', 'razonSocialReceptor']) || '-' },
        { label: this.t('invoice.subtotal'), value: (row) => this.pickNumber(row, ['subtotal', 'subtotalSinImpuestos']) },
        { label: this.t('invoice.taxBreakdown', 'IVA'), value: (row) => this.pickNumber(row, ['iva', 'valorIva']) },
        { label: this.t('invoice.total', 'Total'), value: (row) => this.pickNumber(row, ['total', 'valorTotal', 'importeTotal']) },
        { label: this.t('documents.sriStatus', 'Estado SRI'), value: (row) => this.statusLabel(row) },
        { label: this.t('invoice.authorization', 'Autorizacion'), value: (row) => this.pickString(row, ['autorizacion', 'numeroAutorizacion']) || '-' },
      ];
    }
    if (this.activeTab() === 'guias') {
      return [
        { label: this.t('reports.col.issueDate', 'Fecha emision'), value: (row) => this.formatDate(this.pickString(row, ['fechaEmision', 'fecha'])) },
        { label: this.t('reports.col.number', 'Numero'), value: (row) => this.pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' },
        { label: this.t('documents.sriStatus', 'Estado SRI'), value: (row) => this.statusLabel(row) },
        { label: this.t('reports.col.recipient', 'Destinatario'), value: (row) => this.pickString(row, ['destinatario', 'razonSocialDestinatario', 'cliente']) || '-' },
        { label: this.t('reports.col.identification', 'Identificacion'), value: (row) => this.pickString(row, ['identificacion', 'identificacionDestinatario']) || '-' },
        { label: this.t('reports.col.departureAddress', 'Direccion partida'), value: (row) => this.pickString(row, ['direccionPartida', 'dirPartida']) || '-' },
        { label: this.t('reports.col.destinationAddress', 'Direccion destino'), value: (row) => this.pickString(row, ['direccionDestino', 'dirDestino']) || '-' },
        { label: this.t('reports.col.transferReason', 'Motivo traslado'), value: (row) => this.pickString(row, ['motivoTraslado', 'motivo']) || '-' },
        { label: this.t('reports.col.carrier', 'Transportista'), value: (row) => this.pickString(row, ['transportista', 'razonSocialTransportista']) || '-' },
        { label: this.t('reports.col.carrierRuc', 'RUC transportista'), value: (row) => this.pickString(row, ['rucTransportista', 'identificacionTransportista']) || '-' },
        { label: this.t('reports.col.plate', 'Placa'), value: (row) => this.pickString(row, ['placa']) || '-' },
        { label: this.t('reports.col.transportStart', 'Inicio transporte'), value: (row) => this.formatDate(this.pickString(row, ['fechaInicioTransporte', 'inicioTransporte'])) },
        { label: this.t('reports.col.transportEnd', 'Fin transporte'), value: (row) => this.formatDate(this.pickString(row, ['fechaFinTransporte', 'finTransporte'])) },
      ];
    }
    return [
      { label: this.t('reports.col.date', 'Fecha'), value: (row) => this.formatDate(this.pickString(row, ['fecha', 'fechaEmision'])) },
      { label: this.t('reports.col.number', 'Numero'), value: (row) => this.pickString(row, ['numero', 'numeroComprobante', 'secuencial']) || '-' },
      { label: this.t('reports.col.withheldSubject', 'Sujeto retenido'), value: (row) => this.pickString(row, ['sujetoRetenido', 'razonSocialSujetoRetenido', 'proveedor']) || '-' },
      { label: this.t('reports.col.identification', 'Identificacion'), value: (row) => this.pickString(row, ['identificacion', 'identificacionSujetoRetenido']) || '-' },
      { label: this.t('reports.col.taxBase', 'Base imponible'), value: (row) => this.pickNumber(row, ['baseImponible', 'base']) },
      { label: this.t('reports.col.withheldValue', 'Valor retenido'), value: (row) => this.pickNumber(row, ['valorRetenido', 'totalRetenido', 'valor']) },
      { label: this.t('documents.sriStatus', 'Estado SRI'), value: (row) => this.statusLabel(row) },
    ];
  }

  private buildExportHtml(rows: ReportRecord[], mode: 'excel' | 'pdf'): string {
    const columns = this.exportColumns();
    const title = this.activeTabLabel();
    const period = `${this.filters.desde} - ${this.filters.hasta}`;
    const summary = this.summaryCards();
    const totals = this.exportTotals(rows, columns);
    const css = `
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px;background:#fff}
      .head{border-bottom:3px solid #0f766e;padding-bottom:14px;margin-bottom:18px}
      .eyebrow{color:#0f766e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
      h1{font-size:24px;margin:4px 0;color:#0f172a}.meta{font-size:12px;color:#64748b}
      .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
      .card{border:1px solid #dbe2ea;border-radius:8px;padding:10px;background:#f8fafc}
      .card span{display:block;color:#64748b;font-size:11px;font-weight:700}.card strong{display:block;margin-top:4px;font-size:18px;color:#0f766e}
      table{width:100%;border-collapse:collapse;font-size:11px}th{background:#0f172a;color:#fff;text-align:left;padding:8px;border:1px solid #0f172a}
      td{padding:7px;border:1px solid #dbe2ea}tbody tr:nth-child(even) td{background:#f8fafc}
      tfoot td{background:#ecfdf5;font-weight:700;color:#0f172a}.num{text-align:right}
      @media print{body{margin:12mm}.summary{grid-template-columns:repeat(4,1fr)}button{display:none}@page{size:landscape;margin:10mm}}
    `;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${this.escape(title)}</title><style>${css}</style></head><body>
      <section class="head">
        <div class="eyebrow">${this.escape(this.t('reports.title'))}</div>
        <h1>${this.escape(title)}</h1>
        <div class="meta">${this.escape(period)} · ${this.escape(this.t('reports.generatedAt', 'Generado'))}: ${this.escape(new Date().toLocaleString(this.locale()))}</div>
      </section>
      <section class="summary">${summary.map((card) => `<div class="card"><span>${this.escape(card.label)}</span><strong>${this.escape(card.value)}</strong></div>`).join('')}</section>
      <table>
        <thead><tr>${columns.map((col) => `<th>${this.escape(col.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${columns.map((col) => this.exportCell(col.value(row))).join('')}</tr>`).join('')}</tbody>
        ${totals ? `<tfoot><tr>${totals}</tr></tfoot>` : ''}
      </table>
      ${mode === 'pdf' ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),200));</script>' : ''}
    </body></html>`;
  }

  private exportTotals(rows: ReportRecord[], columns: ExportColumn[]): string {
    const numeric = columns.map((col) => rows.every((row) => typeof col.value(row) === 'number'));
    if (!numeric.some(Boolean)) {
      return '';
    }
    let labelPlaced = false;
    return columns
      .map((col, idx) => {
        if (numeric[idx]) {
          const total = rows.reduce((sum, row) => sum + Number(col.value(row) || 0), 0);
          return `<td class="num">${this.escape(this.moneyValue(total))}</td>`;
        }
        if (!labelPlaced) {
          labelPlaced = true;
          return `<td>${this.escape(this.t('reports.exportTotals', 'Totales'))}</td>`;
        }
        return '<td></td>';
      })
      .join('');
  }

  private exportCell(value: string | number): string {
    if (typeof value === 'number') {
      return `<td class="num">${this.escape(this.moneyValue(value))}</td>`;
    }
    return `<td>${this.escape(value)}</td>`;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private exportFileName(): string {
    return `reporte-${this.activeTab()}-${this.filters.desde}-${this.filters.hasta}`;
  }

  private escape(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private loadReport(): void {
    const tab = this.tabs.find((item) => item.id === this.activeTab()) ?? this.tabs[0];
    this.loading.set(true);
    this.errorMessage.set(null);
    this.expandedRetentionIds.set(new Set());
    this.http
      .get<ReportResponse>(tab.endpoint, { params: this.httpParams() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.response.set(response);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.response.set(null);
          this.loading.set(false);
          this.errorMessage.set(extractApiErrorMessage(err, this.t('reports.loadError', 'No se pudo cargar el reporte.')));
        },
      });
  }

  private httpParams(page = this.filters.page, size = this.filters.size): HttpParams {
    let params = new HttpParams()
      .set('desde', this.filters.desde)
      .set('hasta', this.filters.hasta)
      .set('page', String(page))
      .set('size', String(size));
    for (const key of ['estadoSri', 'identificacion', 'establecimiento', 'puntoEmision'] as const) {
      const value = this.filters[key].trim();
      if (value) {
        params = params.set(key, value);
      }
    }
    return params;
  }

  private navigateWithFilters(patch: Partial<ReportFilters> & { tab?: ReportTab }): void {
    const next = { ...this.filters, ...patch };
    const queryParams: Record<string, string | number> = {
      tab: patch.tab ?? this.activeTab(),
      desde: next.desde,
      hasta: next.hasta,
      page: next.page,
      size: next.size,
    };
    for (const key of ['estadoSri', 'identificacion', 'establecimiento', 'puntoEmision'] as const) {
      if (next[key].trim()) {
        queryParams[key] = next[key].trim();
      }
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  private readQueryParams(params: ParamMap): void {
    const month = rangoMesEnCurso();
    const tab = params.get('tab') as ReportTab | null;
    this.activeTab.set(this.tabs.some((item) => item.id === tab) ? tab as ReportTab : 'ventas');
    this.filters = {
      desde: params.get('desde') || month.desde,
      hasta: params.get('hasta') || month.hasta,
      estadoSri: params.get('estadoSri') || '',
      identificacion: params.get('identificacion') || '',
      establecimiento: params.get('establecimiento') || '',
      puntoEmision: params.get('puntoEmision') || '',
      page: this.parsePositiveInt(params.get('page'), 0),
      size: this.parsePositiveInt(params.get('size'), 20, 1),
    };
  }

  private extractPage(response: ReportResponse | null, tab: ReportTab): SpringPage<ReportRecord> {
    const empty: SpringPage<ReportRecord> = {
      content: [],
      totalElements: 0,
      totalPages: 1,
      size: this.filters.size,
      number: this.filters.page,
      first: this.filters.page === 0,
      last: true,
    };
    if (!response) {
      return empty;
    }
    const page =
      tab === 'guias'
        ? response.guias
        : tab === 'retenciones'
          ? response.retenciones
          : tab === 'liquidaciones'
            ? response.liquidaciones ?? response.documentos
            : response.documentos;
    return page ? { ...empty, ...page, content: page.content ?? [] } : empty;
  }

  private defaultFilters(): ReportFilters {
    const month = rangoMesEnCurso();
    return {
      desde: month.desde,
      hasta: month.hasta,
      estadoSri: '',
      identificacion: '',
      establecimiento: '',
      puntoEmision: '',
      page: 0,
      size: 20,
    };
  }

  private statusLabelFromValue(value: string): string {
    return etiquetaEstadoSri(value, (key) => this.t(key));
  }

  private countByStatus(status: string, fallback: number | null | undefined): number {
    if (fallback != null) {
      return Number(fallback) || 0;
    }
    return this.statusDistribution()
      .filter((item) => item.label === this.statusLabelFromValue(status))
      .reduce((sum, item) => sum + item.value, 0);
  }

  private numberValue(value: number | null | undefined): number {
    return Number(value) || 0;
  }

  private moneyValue(value: number | null | undefined): string {
    return new Intl.NumberFormat(this.locale(), { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
      Number(value) || 0,
    );
  }

  private integer(value: number | null | undefined): string {
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  private parsePositiveInt(value: string | null, fallback: number, min = 0): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
  }

  private locale(): string {
    const lang = this.i18n.language();
    if (lang === 'en') {
      return 'en-US';
    }
    if (lang === 'pt') {
      return 'pt-BR';
    }
    if (lang === 'fr') {
      return 'fr-FR';
    }
    return 'es-EC';
  }
}
