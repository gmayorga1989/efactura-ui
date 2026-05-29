import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import { ComprobanteArchivosService } from '../../core/comprobante/comprobante-archivos.service';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { rangoMesEnCurso } from '../../core/util/fecha-local.util';
import { comprobanteGridActionsMenu } from '../../shared/ui/comprobante-grid-actions.util';
import {
  badgeClaseEstadoSri,
  etiquetaEstadoSri,
  htmlBadgeEstadoEnvioCorreo,
  htmlBadgeEstadoSri,
} from '../../shared/ui/sri-estado.util';
import {
  escapeHtml,
  TABULATOR_FROZEN_PROPS,
  tabulatorFechaCell,
  tabulatorTextareaCell,
} from '../../shared/ui/tabulator-formatters.util';
import { TsHistorialElectronicoModalComponent } from '../../shared/ui/organisms/ts-historial-electronico-modal/ts-historial-electronico-modal.component';
import { TsReenviarCorreoModalComponent } from '../../shared/ui/organisms/ts-reenviar-correo-modal/ts-reenviar-correo-modal.component';
import { correoTextoDesdeCustomData } from '../facturas/facturas.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorSpringGridComponent } from '../../shared/ui/organisms/ts-tabulator-spring-grid/ts-tabulator-spring-grid.component';

interface MonitorFilters {
  tipoComprobante: string;
  estadoSri: string;
  fechaDesde: string;
  fechaHasta: string;
  establecimiento: string;
  puntoEmision: string;
  identificacion: string;
  claveAcceso: string;
  secuencial: string;
}

interface ComprobanteMonitorRow {
  id: string;
  tipo: string;
  numeroComprobante: string;
  claveAcceso: string;
  fechaEmision: string;
  identificacionReceptor: string;
  razonSocialReceptor: string;
  valorTotal: number;
  estadoSri: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ultimoMensajeSri?: string | null;
  emailReceptor?: string | null;
  estadoEnvioCorreo?: string | null;
}

interface ResumenTipoEstadoRow {
  tipoComprobante: string;
  estadoSri: string;
  total: number;
}

interface ResumenTipoGrupo {
  tipoComprobante: string;
  estados: { estadoSri: string; total: number }[];
}

@Component({
  selector: 'ts-comprobantes-electronicos-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TsPageLayoutComponent,
    TsTabulatorSpringGridComponent,
    TsHistorialElectronicoModalComponent,
    TsReenviarCorreoModalComponent,
  ],
  template: `
    <ts-page-layout
      [title]="t('monitor.title')"
      [subtitle]="t('monitor.subtitle')"
      [eyebrow]="t('monitor.eyebrow')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-outline-secondary" (click)="abrirHistorialEmpresa()">
          {{ t('monitor.historyMenuAll') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" (click)="mostrarFiltros.set(!mostrarFiltros())">
          {{ mostrarFiltros() ? t('monitor.hideFilters') : t('monitor.showFilters') }}
        </button>
        <button type="button" class="btn btn-soft-primary" (click)="aplicarFiltros()">{{ t('common.search') }}</button>
        @if (mostrarFiltros()) {
          <button type="button" class="btn btn-outline-secondary" (click)="limpiarFiltros()">{{ t('monitor.clear') }}</button>
        }
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('common.toContinue') }}
          } @else {
            {{ t('monitor.companyRequired') }}
          }
        </p>
      } @else if (!session.puedeListarComprobantes()) {
        <p class="text-muted mb-0">{{ t('monitor.permissionRequired') }}</p>
      } @else {
        @if (mostrarFiltros()) {
        <form class="row g-2 align-items-end mb-3" (ngSubmit)="aplicarFiltros()">
          <div class="col-md-2">
            <label class="form-label" for="ce-tipo">{{ t('monitor.type') }}</label>
            <select id="ce-tipo" class="form-select" name="tipoComprobante" [(ngModel)]="filters.tipoComprobante">
              <option value="">{{ t('common.all') }}</option>
              <option value="FACTURA">{{ t('menu.invoices') }}</option>
              <option value="NOTA_CREDITO">{{ t('menu.creditNotes') }}</option>
              <option value="NOTA_DEBITO">{{ t('menu.debitNotes') }}</option>
              <option value="GUIA_REMISION">{{ t('menu.guides') }}</option>
              <option value="RETENCION">{{ t('menu.withholdings') }}</option>
              <option value="LIQUIDACION_COMPRA">{{ t('menu.purchaseSettlements') }}</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="ce-estado">{{ t('documents.sriStatus') }}</label>
            <select id="ce-estado" class="form-select" name="estadoSri" [(ngModel)]="filters.estadoSri">
              <option value="">{{ t('common.all') }}</option>
              <option value="BORRADOR">{{ t('invoice.statusDraft') }}</option>
              <option value="AUTORIZADO">{{ t('invoice.statusAuthorized') }}</option>
              <option value="PENDIENTE_AUTORIZACION">{{ t('invoice.statusPending') }}</option>
              <option value="ERROR">{{ t('invoice.statusError') }}</option>
              <option value="DEVUELTO">{{ t('invoice.statusReturned') }}</option>
              <option value="NO AUTORIZADO">{{ t('invoice.statusRejected') }}</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="ce-desde">{{ t('monitor.from') }}</label>
            <input id="ce-desde" type="date" class="form-control" name="fechaDesde" [(ngModel)]="filters.fechaDesde" />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="ce-hasta">{{ t('monitor.to') }}</label>
            <input id="ce-hasta" type="date" class="form-control" name="fechaHasta" [(ngModel)]="filters.fechaHasta" />
          </div>
          <div class="col-md-1">
            <label class="form-label" for="ce-est">{{ t('monitor.establishmentShort') }}</label>
            <input id="ce-est" class="form-control" name="establecimiento" [(ngModel)]="filters.establecimiento" />
          </div>
          <div class="col-md-1">
            <label class="form-label" for="ce-pem">{{ t('monitor.emissionPointShort') }}</label>
            <input id="ce-pem" class="form-control" name="puntoEmision" [(ngModel)]="filters.puntoEmision" />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="ce-id">{{ t('masters.identification') }}</label>
            <input id="ce-id" class="form-control" name="identificacion" [(ngModel)]="filters.identificacion" />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="ce-clave">{{ t('monitor.accessKey') }}</label>
            <input id="ce-clave" class="form-control" name="claveAcceso" [(ngModel)]="filters.claveAcceso" />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="ce-sec">{{ t('monitor.sequence') }}</label>
            <input id="ce-sec" class="form-control" name="secuencial" [(ngModel)]="filters.secuencial" />
          </div>
          <div class="col-md-2">
            <button type="submit" class="btn btn-primary w-100">{{ t('monitor.apply') }}</button>
          </div>
        </form>
        }

        <ts-tabulator-spring-grid
          ajaxUrl="/api/web/v1/comprobantes-electronicos"
          [ajaxParams]="activeFilters()"
          [columns]="columns()"
          [reloadNonce]="gridNonce()"
          emptyContext="documents"
          [frozenColumns]="2"
          height="min(620px, calc(100vh - 15.5rem))"
          (rowAction)="onGridRowAction($event)"
        />

        @if (resumenGrupos().length) {
          <div class="ce-resumen mt-3">
            <h3 class="h6 mb-2">{{ t('monitor.statusSummary') }}</h3>
            @for (grupo of resumenGrupos(); track grupo.tipoComprobante) {
              <div class="ce-resumen-grupo mb-2">
                <strong>{{ etiquetaTipo(grupo.tipoComprobante) }}:</strong>
                <div class="ce-resumen-badges">
                  @for (e of grupo.estados; track e.estadoSri) {
                    <span [class]="badgeClaseEstadoSri(e.estadoSri)">
                      <span class="ts-sri-badge__dot" aria-hidden="true"></span>
                      {{ etiquetaEstado(e.estadoSri) }}: {{ e.total }}
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        }
      }

      <ts-historial-electronico-modal
        [open]="historialAbierto()"
        [modo]="historialModo()"
        [comprobanteId]="historialComprobanteId()"
        [numeroComprobante]="historialNumero()"
        [fechaDesde]="filters.fechaDesde"
        [fechaHasta]="filters.fechaHasta"
        (closed)="cerrarHistorial()"
      />
      <ts-reenviar-correo-modal
        [open]="reenviarCorreoAbierto()"
        [emailInicial]="reenviarCorreoEmail()"
        [numeroComprobante]="reenviarCorreoNumero()"
        (closed)="cerrarReenviarCorreo()"
        (confirmed)="confirmarReenviarCorreo($event)"
      />
    </ts-page-layout>
  `,
  styles: [
    `
      .ce-resumen-grupo {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 8px;
        background: #fff;
        box-shadow: var(--ef-surface-shadow);
      }
    `,
  ],
})
export class ComprobantesElectronicosPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly archivos = inject(ComprobanteArchivosService);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly gridNonce = signal(0);
  readonly activeFilters = signal<Record<string, string>>({});
  readonly mostrarFiltros = signal(false);
  readonly resumenPorTipo = signal<ResumenTipoEstadoRow[]>([]);
  readonly historialAbierto = signal(false);
  readonly historialModo = signal<'comprobante' | 'empresa'>('comprobante');
  readonly historialComprobanteId = signal<string | null>(null);
  readonly historialNumero = signal<string | null>(null);
  readonly reenviarCorreoAbierto = signal(false);
  readonly reenviarCorreoId = signal('');
  readonly reenviarCorreoEmail = signal('');
  readonly reenviarCorreoNumero = signal('');

  readonly resumenGrupos = computed<ResumenTipoGrupo[]>(() => {
    const map = new Map<string, { estadoSri: string; total: number }[]>();
    for (const row of this.resumenPorTipo()) {
      const tipo = row.tipoComprobante || '—';
      const list = map.get(tipo) ?? [];
      list.push({ estadoSri: row.estadoSri, total: row.total });
      map.set(tipo, list);
    }
    return [...map.entries()].map(([tipoComprobante, estados]) => ({
      tipoComprobante,
      estados: estados.sort((a, b) => b.total - a.total),
    }));
  });

  filters: MonitorFilters = this.emptyFiltersWithMonth();

  readonly columns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    return [
      {
        title: '',
        field: 'id',
        width: 72,
        headerSort: false,
        hozAlign: 'center',
        ...TABULATOR_FROZEN_PROPS,
        formatter: (cell: unknown) => {
          const c = cell as { getData: () => ComprobanteMonitorRow };
          const d = c.getData();
          return comprobanteGridActionsMenu({
            t: (key) => this.t(key),
            estadoSri: String(d.estadoSri ?? ''),
          });
        },
      },
      {
        title: this.t('documents.sriStatus'),
        field: 'estadoSri',
        minWidth: 180,
        widthGrow: 1,
        ...TABULATOR_FROZEN_PROPS,
        formatter: (cell: unknown) => {
          const c = cell as { getData: () => ComprobanteMonitorRow };
          const d = c.getData();
          const codigo = String(d.estadoSri ?? '');
          return htmlBadgeEstadoSri(codigo, (key) => this.t(key), d.ultimoMensajeSri, 72);
        },
      },
      {
        title: this.t('documents.issueDate'),
        field: 'fechaEmision',
        width: 110,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorFechaCell(c.getValue());
        },
      },
      {
        title: this.t('monitor.type'),
        field: 'tipo',
        width: 120,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('documents.number'),
        field: 'numeroComprobante',
        minWidth: 150,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('monitor.accessKey'),
        field: 'claveAcceso',
        minWidth: 220,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return '<code class="ts-cell-textarea">' + escapeHtml(String(c.getValue() ?? '')) + '</code>';
        },
      },
      {
        title: this.t('masters.identification'),
        field: 'identificacionReceptor',
        minWidth: 130,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('masters.businessName'),
        field: 'razonSocialReceptor',
        minWidth: 200,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('salespeople.label'),
        field: 'vendedorNombre',
        minWidth: 140,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('documents.total'),
        field: 'valorTotal',
        hozAlign: 'right',
        width: 110,
      },
      {
        title: this.t('monitor.receiverEmail'),
        field: 'emailReceptor',
        minWidth: 180,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('monitor.emailStatus'),
        field: 'estadoEnvioCorreo',
        width: 120,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return htmlBadgeEstadoEnvioCorreo(c.getValue() as string, (key) => this.t(key));
        },
      },
      {
        title: this.t('monitor.authorization'),
        field: 'numeroAutorizacion',
        minWidth: 160,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(c.getValue());
        },
      },
      {
        title: this.t('monitor.authorizationDate'),
        field: 'fechaAutorizacion',
        minWidth: 130,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorFechaCell(c.getValue());
        },
      },
    ];
  });

  t(key: string): string {
    return this.i18n.t(key);
  }

  readonly badgeClaseEstadoSri = badgeClaseEstadoSri;

  etiquetaEstado(codigo: string | null | undefined): string {
    return etiquetaEstadoSri(codigo, (key) => this.t(key));
  }

  etiquetaTipo(tipo: string): string {
    const key = `monitor.tipo.${tipo}`;
    const label = this.t(key);
    return label === key ? tipo.replaceAll('_', ' ') : label;
  }

  abrirHistorialEmpresa(): void {
    this.historialModo.set('empresa');
    this.historialComprobanteId.set(null);
    this.historialNumero.set(null);
    this.historialAbierto.set(true);
  }

  abrirHistorialComprobante(row: ComprobanteMonitorRow): void {
    this.historialModo.set('comprobante');
    this.historialComprobanteId.set(row.id);
    this.historialNumero.set(row.numeroComprobante);
    this.historialAbierto.set(true);
  }

  cerrarHistorial(): void {
    this.historialAbierto.set(false);
  }

  ngOnInit(): void {
    this.filters = this.emptyFiltersWithMonth();
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.filters)) {
      if (value.trim()) {
        params[key] = value.trim();
      }
    }
    this.activeFilters.set(params);
    this.gridNonce.update((n) => n + 1);
    this.cargarResumenPorTipo(params);
  }

  limpiarFiltros(): void {
    this.filters = this.emptyFiltersWithMonth();
    this.aplicarFiltros();
  }

  private cargarResumenPorTipo(params: Record<string, string>): void {
    const desde = params['fechaDesde'];
    const hasta = params['fechaHasta'];
    if (!desde || !hasta) {
      this.resumenPorTipo.set([]);
      return;
    }
    let hp = new HttpParams().set('fechaDesde', desde).set('fechaHasta', hasta);
    if (params['tipoComprobante']) {
      hp = hp.set('tipoComprobante', params['tipoComprobante']);
    }
    this.http
      .get<ResumenTipoEstadoRow[]>('/api/web/v1/comprobantes-electronicos/resumen-por-tipo', { params: hp })
      .subscribe({
        next: (rows) =>
          this.resumenPorTipo.set(
            rows.map((r) => ({
              tipoComprobante: r.tipoComprobante,
              estadoSri: r.estadoSri,
              total: Number(r.total),
            })),
          ),
        error: () => this.resumenPorTipo.set([]),
      });
  }

  onGridRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    const id = String(ev.row['id'] ?? '');
    if (!id) {
      return;
    }
    if (ev.action === 'historial') {
      this.abrirHistorialComprobante(ev.row as unknown as ComprobanteMonitorRow);
    } else if (ev.action === 'ver') {
      const tipo = String(ev.row['tipo'] ?? 'FACTURA');
      const slug = this.tenant.tenantSlug();
      if (tipo === 'FACTURA') {
        void this.router.navigate(['/t', slug, 'facturas', id]);
      } else {
        void this.router.navigate(['/t', slug, 'comprobantes', id]);
      }
    } else if (ev.action === 'ride') {
      this.archivos.abrirRide(id);
    } else if (ev.action === 'xml') {
      this.archivos.abrirXmlAutorizado(id);
    } else if (ev.action === 'ride-xml') {
      const numero = String(ev.row['numeroComprobante'] ?? id);
      this.archivos.descargarTodo(id, numero);
    } else if (ev.action === 'reemitir') {
      this.archivos.reemitirAlSri(id).subscribe({
        next: () => {
          this.toast.success(this.t('invoice.resendToSriOk'));
          this.gridNonce.update((n) => n + 1);
        },
        error: () => this.toast.error(this.t('invoice.resendToSriError')),
      });
    } else if (ev.action === 'reprocesar') {
      this.archivos.reprocesarAutorizacion(id).subscribe({
        next: () => {
          this.toast.success(this.t('invoice.reprocessOk'));
          this.gridNonce.update((n) => n + 1);
        },
        error: () => this.toast.error(this.t('invoice.reprocessError')),
      });
    } else if (ev.action === 'reenviar-correo') {
      const email =
        String(ev.row['emailReceptor'] ?? '').trim() ||
        correoTextoDesdeCustomData(ev.row as Record<string, unknown>);
      this.reenviarCorreoId.set(id);
      this.reenviarCorreoEmail.set(email);
      this.reenviarCorreoNumero.set(String(ev.row['numeroComprobante'] ?? ''));
      this.reenviarCorreoAbierto.set(true);
    }
  }

  cerrarReenviarCorreo(): void {
    this.reenviarCorreoAbierto.set(false);
    this.reenviarCorreoId.set('');
    this.reenviarCorreoEmail.set('');
    this.reenviarCorreoNumero.set('');
  }

  confirmarReenviarCorreo(email: string): void {
    const id = this.reenviarCorreoId();
    if (!id) {
      return;
    }
    this.reenviarCorreoAbierto.set(false);
    this.archivos.reenviarCorreo(id, email).subscribe({
      next: (r) => {
        this.cerrarReenviarCorreo();
        if (r.enviado) {
          this.toast.success(this.t('invoice.resendEmailOk'));
          this.gridNonce.update((n) => n + 1);
        } else {
          this.toast.warning(this.t('invoice.resendEmailSkipped'));
        }
      },
      error: () => {
        this.cerrarReenviarCorreo();
        this.toast.error(this.t('invoice.resendEmailError'));
      },
    });
  }

  private emptyFiltersWithMonth(): MonitorFilters {
    const { desde, hasta } = rangoMesEnCurso();
    return {
      tipoComprobante: '',
      estadoSri: '',
      fechaDesde: desde,
      fechaHasta: hasta,
      establecimiento: '',
      puntoEmision: '',
      identificacion: '',
      claveAcceso: '',
      secuencial: '',
    };
  }
}
