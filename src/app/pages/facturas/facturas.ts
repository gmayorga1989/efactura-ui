import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import { ComprobanteArchivosService } from '../../core/comprobante/comprobante-archivos.service';
import { rangoMesEnCurso } from '../../core/util/fecha-local.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { comprobanteGridActionsMenu } from '../../shared/ui/comprobante-grid-actions.util';
import { htmlBadgeEstadoSri } from '../../shared/ui/sri-estado.util';
import {
  escapeHtml,
  TABULATOR_FROZEN_PROPS,
  tabulatorFechaCell,
  tabulatorTextareaCell,
} from '../../shared/ui/tabulator-formatters.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsReenviarCorreoModalComponent } from '../../shared/ui/organisms/ts-reenviar-correo-modal/ts-reenviar-correo-modal.component';
import { TsTabulatorSpringGridComponent } from '../../shared/ui/organisms/ts-tabulator-spring-grid/ts-tabulator-spring-grid.component';
import { correoTextoDesdeCustomData } from './facturas.service';

interface ComprobanteRow {
  id: string;
  numeroComprobante: string;
  fechaEmision: string;
  razonSocialReceptor: string;
  identificacionReceptor: string;
  valorTotal: number;
  estadoSri: string;
  claveAcceso: string;
  ultimoMensajeSri?: string | null;
  customData?: Record<string, unknown>;
}

@Component({
  selector: 'ts-facturas-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TsPageLayoutComponent,
    TsTabulatorSpringGridComponent,
    TsReenviarCorreoModalComponent,
  ],
  template: `
    <ts-page-layout
      [title]="t('invoice.title')"
      [subtitle]="t('invoice.listSubtitle')"
      [eyebrow]="t('invoice.eyebrow')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        @if (session.puedeEmitirFacturas()) {
          <a class="btn btn-primary" [routerLink]="['/t', tenant.tenantSlug(), 'facturas', 'nueva']">
            {{ t('invoice.new') }}
          </a>
        }
        <button type="button" class="btn btn-outline-secondary" (click)="mostrarFiltros.set(!mostrarFiltros())">
          {{ mostrarFiltros() ? t('invoice.hideFilters') : t('invoice.showFilters') }}
        </button>
        <button type="button" class="btn btn-soft-primary" (click)="aplicarFiltros()">{{ t('common.search') }}</button>
        @if (mostrarFiltros()) {
          <button type="button" class="btn btn-outline-secondary" (click)="limpiarFiltros()">{{ t('monitor.clear') }}</button>
        }
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            {{ t('common.noSession') }}
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>.
          } @else {
            {{ t('invoice.companyRequired') }}
          }
        </p>
      } @else if (!session.puedeListarComprobantes()) {
        <p class="text-muted mb-0">{{ t('invoice.listPermissionRequired') }}</p>
      } @else {
        @if (mostrarFiltros()) {
          <form class="factura-filters row g-2 align-items-end mb-3" (ngSubmit)="aplicarFiltros()">
            <div class="col-md-2">
              <label class="form-label" for="ff-desde">{{ t('monitor.from') }}</label>
              <input id="ff-desde" type="date" class="form-control form-control-sm" [(ngModel)]="filtroDesde" name="fechaDesde" />
            </div>
            <div class="col-md-2">
              <label class="form-label" for="ff-hasta">{{ t('monitor.to') }}</label>
              <input id="ff-hasta" type="date" class="form-control form-control-sm" [(ngModel)]="filtroHasta" name="fechaHasta" />
            </div>
            <div class="col-md-3">
              <label class="form-label" for="ff-estado">{{ t('documents.sriStatus') }}</label>
              <select id="ff-estado" class="form-select form-select-sm" [(ngModel)]="filtroEstado" name="estadoSri">
                <option value="">{{ t('common.all') }}</option>
                <option value="BORRADOR">{{ t('invoice.statusDraft') }}</option>
                <option value="AUTORIZADO">{{ t('invoice.statusAuthorized') }}</option>
                <option value="RECIBIDA">{{ t('invoice.statusReceived') }}</option>
                <option value="RECHAZADA">{{ t('invoice.statusRejected') }}</option>
                <option value="PENDIENTE_AUTORIZACION">{{ t('invoice.statusPending') }}</option>
                <option value="DEVUELTO">{{ t('invoice.statusReturned') }}</option>
                <option value="ERROR">{{ t('invoice.statusError') }}</option>
              </select>
            </div>
          </form>
        }

        <ts-tabulator-spring-grid
          ajaxUrl="/api/web/v1/comprobantes"
          [ajaxParams]="gridParams()"
          [pageSize]="15"
          height="min(620px, calc(100vh - 15.5rem))"
          [columns]="comprobantesColumns()"
          [reloadNonce]="gridNonce()"
          emptyContext="documents"
          [frozenColumns]="2"
          (rowAction)="onGridRowAction($event)"
        />
      }
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
      .factura-filters {
        padding: 0.72rem;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 8px;
        background: #fff;
      }
    `,
  ],
})
export class FacturasPage implements OnInit {
  private readonly router = inject(Router);
  private readonly archivos = inject(ComprobanteArchivosService);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly gridNonce = signal(0);
  readonly gridParams = signal<Record<string, string>>({ tipo: 'FACTURA' });
  readonly mostrarFiltros = signal(false);
  readonly reenviarCorreoAbierto = signal(false);
  readonly reenviarCorreoId = signal('');
  readonly reenviarCorreoEmail = signal('');
  readonly reenviarCorreoNumero = signal('');

  tokenPresent = false;
  tieneEmpresa = false;

  filtroDesde = '';
  filtroHasta = '';
  filtroEstado = '';

  readonly comprobantesColumns = computed<ColumnDefinition[]>(() => [
    {
      title: '',
      field: 'id',
      width: 72,
      headerSort: false,
      hozAlign: 'center',
      ...TABULATOR_FROZEN_PROPS,
      formatter: (cell: unknown) => {
        const c = cell as { getData: () => ComprobanteRow };
        const d = c.getData();
        return comprobanteGridActionsMenu({
          t: (key) => this.t(key),
          estadoSri: String(d.estadoSri ?? ''),
          includeEdit: true,
          includeCreditNote: this.session.puedeEmitirFacturas(),
          tieneEmailReceptor: !!d.customData?.['emailReceptor'],
        });
      },
    },
    {
      title: this.t('documents.date'),
      field: 'fechaEmision',
      width: 108,
      ...TABULATOR_FROZEN_PROPS,
      formatter: (cell: unknown) => {
        const c = cell as { getValue: () => unknown };
        return tabulatorFechaCell(c.getValue());
      },
    },
    {
      title: this.t('documents.number'),
      field: 'numeroComprobante',
      width: 150,
      formatter: (cell: unknown) => {
        const c = cell as { getValue: () => unknown };
        return tabulatorTextareaCell(c.getValue());
      },
    },
    {
      title: this.t('documents.receiver'),
      field: 'razonSocialReceptor',
      minWidth: 200,
      formatter: (cell: unknown) => {
        const c = cell as { getData: () => ComprobanteRow };
        const d = c.getData();
        const id = d.identificacionReceptor
          ? '<div class="text-muted small ts-cell-textarea">' + escapeHtml(d.identificacionReceptor) + '</div>'
          : '';
        return '<div class="ts-cell-textarea">' + escapeHtml(d.razonSocialReceptor ?? '') + '</div>' + id;
      },
    },
    {
      title: this.t('documents.total'),
      field: 'valorTotal',
      width: 108,
      hozAlign: 'right',
      formatter: (cell: unknown) => {
        const c = cell as { getData: () => ComprobanteRow };
        const v = Number(c.getData().valorTotal);
        return Number.isFinite(v)
          ? v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '';
      },
    },
    {
      title: this.t('documents.sriStatus'),
      field: 'estadoSri',
      minWidth: 180,
      widthGrow: 1,
      formatter: (cell: unknown) => {
        const c = cell as { getData: () => ComprobanteRow };
        const d = c.getData();
        const codigo = String(d.estadoSri ?? '');
        return htmlBadgeEstadoSri(codigo, (key) => this.t(key), d.ultimoMensajeSri);
      },
    },
  ]);

  ngOnInit(): void {
    this.tokenPresent = !!readAccessToken();
    this.tieneEmpresa = !!this.session.profile()?.empresaId;
    const { desde, hasta } = rangoMesEnCurso();
    this.filtroDesde = desde;
    this.filtroHasta = hasta;
    this.aplicarFiltros();
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  aplicarFiltros(): void {
    const params: Record<string, string> = { tipo: 'FACTURA' };
    if (this.filtroDesde.trim()) {
      params['fechaDesde'] = this.filtroDesde.trim();
    }
    if (this.filtroHasta.trim()) {
      params['fechaHasta'] = this.filtroHasta.trim();
    }
    if (this.filtroEstado.trim()) {
      params['estadoSri'] = this.filtroEstado.trim();
    }
    this.gridParams.set(params);
    this.refrescarGrid();
  }

  limpiarFiltros(): void {
    const { desde, hasta } = rangoMesEnCurso();
    this.filtroDesde = desde;
    this.filtroHasta = hasta;
    this.filtroEstado = '';
    this.aplicarFiltros();
  }

  refrescarGrid(): void {
    this.gridNonce.update((n) => n + 1);
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
          this.refrescarGrid();
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

  onGridRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    const id = String(ev.row['id'] ?? '');
    if (!id) {
      return;
    }
    if (ev.action === 'ver') {
      void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', id]);
    } else if (ev.action === 'editar') {
      void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', 'editar', id]);
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
          this.refrescarGrid();
        },
        error: () => this.toast.error(this.t('invoice.resendToSriError')),
      });
    } else if (ev.action === 'reprocesar') {
      this.archivos.reprocesarAutorizacion(id).subscribe({
        next: () => {
          this.toast.success(this.t('invoice.reprocessOk'));
          this.refrescarGrid();
        },
        error: () => this.toast.error(this.t('invoice.reprocessError')),
      });
    } else if (ev.action === 'reenviar-correo') {
      const cd = ev.row['customData'] as Record<string, unknown> | undefined;
      this.reenviarCorreoId.set(id);
      this.reenviarCorreoEmail.set(correoTextoDesdeCustomData(cd));
      this.reenviarCorreoNumero.set(String(ev.row['numeroComprobante'] ?? ''));
      this.reenviarCorreoAbierto.set(true);
    } else if (ev.action === 'nota-credito') {
      void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', id, 'nota-credito']);
    }
  }
}
