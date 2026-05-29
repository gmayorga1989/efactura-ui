import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { fechaHoyIsoLocal } from '../../core/util/fecha-local.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ComprobanteCatalogosService } from '../comprobantes/comprobante-catalogos.service';
import { DocumentosEmisionService } from '../documentos/documentos-emision.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import {
  FacturasService,
  type ComprobanteFactura,
  type FacturaItemPayload,
  type PuntoEmitir,
} from './facturas.service';

@Component({
  selector: 'ts-factura-nota-debito-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('invoice.debitNoteTitle')"
      [subtitle]="factura()?.numeroComprobante ?? ''"
      [eyebrow]="t('menu.sales')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="['/t', tenant.tenantSlug(), 'facturas', facturaId]">{{ t('common.back') }}</a>
        <button type="button" class="btn btn-primary" (click)="crear(false)" [disabled]="loading() || !factura()">
          {{ loading() ? t('common.loading') : t('invoice.createDebitNote') }}
        </button>
        <button type="button" class="btn btn-success" (click)="crear(true)" [disabled]="loading() || !factura()">
          {{ loading() ? t('common.loading') : t('invoice.debitNoteEmitNow') }}
        </button>
      </div>

      @if (loadingFactura()) {
        <p class="text-muted mb-0">{{ t('common.loading') }}</p>
      } @else if (!factura()) {
        <p class="text-muted mb-0">{{ t('invoice.notFound') }}</p>
      } @else if (factura()!.estadoSri !== 'AUTORIZADO') {
        <p class="text-warning mb-0">{{ t('invoice.debitNoteRequiresAuthorized') }}</p>
      } @else {
        <form class="border rounded p-3" (ngSubmit)="crear(false)">
          <p class="text-muted small">{{ t('invoice.debitNoteHint') }}</p>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label" for="nd-punto">{{ t('documents.emissionPoint') }}</label>
              <select id="nd-punto" class="form-select" [(ngModel)]="puntoEmisionId" name="puntoEmisionId" required>
                @for (p of puntos(); track p.id) {
                  <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }}</option>
                }
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label" for="nd-fecha">{{ t('documents.date') }}</label>
              <input id="nd-fecha" type="date" class="form-control" [(ngModel)]="fechaEmision" name="fechaEmision" />
            </div>
            <div class="col-md-5">
              <label class="form-label" for="nd-motivo">{{ t('invoice.debitNoteReason') }}</label>
              <input id="nd-motivo" class="form-control" [(ngModel)]="motivo" name="motivo" required />
            </div>
            <div class="col-md-3">
              <label class="form-label" for="nd-valor">{{ t('invoice.debitNoteAmount') }}</label>
              <input
                id="nd-valor"
                type="number"
                min="0.01"
                step="0.01"
                class="form-control"
                [(ngModel)]="valorModificacion"
                name="valorModificacion"
                required
              />
            </div>
          </div>
          <dl class="row g-2 mt-2 mb-0 small">
            <div class="col-sm-6">
              <dt class="text-muted">{{ t('documents.receiver') }}</dt>
              <dd class="mb-0">{{ factura()!.razonSocialReceptor }} ({{ factura()!.identificacionReceptor }})</dd>
            </div>
            <div class="col-sm-6">
              <dt class="text-muted">{{ t('invoice.debitNoteInvoiceTotalRef') }}</dt>
              <dd class="mb-0">{{ factura()!.valorTotal | number: '1.2-2' }}</dd>
            </div>
          </dl>
        </form>
      }
    </ts-page-layout>
  `,
})
export class FacturaNotaDebitoPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facturas = inject(FacturasService);
  private readonly catalogos = inject(ComprobanteCatalogosService);
  private readonly documentos = inject(DocumentosEmisionService);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  facturaId = '';
  readonly factura = signal<ComprobanteFactura | null>(null);
  readonly puntos = signal<PuntoEmitir[]>([]);
  readonly loadingFactura = signal(true);
  readonly loading = signal(false);

  puntoEmisionId = '';
  fechaEmision = fechaHoyIsoLocal();
  motivo = '';
  valorModificacion = 0;

  ngOnInit(): void {
    if (!readAccessToken() || !this.session.profile()?.empresaId) {
      this.loadingFactura.set(false);
      return;
    }
    this.facturaId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.facturaId) {
      this.loadingFactura.set(false);
      return;
    }
    this.catalogos.listarPuntos().subscribe({
      next: (p) => {
        this.puntos.set(p);
        if (!p.length) {
          this.toast.error(this.t('invoice.pointsLoadError'));
        } else if (!this.puntoEmisionId) {
          this.puntoEmisionId = p[0]?.id ?? '';
        }
      },
      error: () => {
        this.puntos.set([]);
        this.toast.error(this.t('invoice.pointsLoadError'));
      },
    });
    this.facturas.obtenerComprobante(this.facturaId).subscribe({
      next: (c) => {
        this.factura.set(c);
        this.loadingFactura.set(false);
        const cd = c.customData ?? {};
        if (cd['puntoEmisionId']) {
          this.puntoEmisionId = String(cd['puntoEmisionId']);
        }
        this.motivo = this.t('invoice.debitNoteDefaultReason', { number: c.numeroComprobante });
        this.valorModificacion = c.valorTotal ?? 0;
      },
      error: () => {
        this.factura.set(null);
        this.loadingFactura.set(false);
      },
    });
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  crear(emitir: boolean): void {
    const f = this.factura();
    if (!f || !this.puntoEmisionId || !this.motivo.trim() || this.valorModificacion <= 0) {
      this.toast.error(this.t('invoice.debitNoteInvalid'));
      return;
    }
    if (f.estadoSri !== 'AUTORIZADO') {
      this.toast.error(this.t('invoice.debitNoteRequiresAuthorized'));
      return;
    }
    const cd = f.customData ?? {};
    const tipoId = String(cd['tipoIdentificacionReceptor'] ?? '04');
    const items: FacturaItemPayload[] = [
      {
        codigoPrincipal: 'ND01',
        descripcion: this.motivo.trim(),
        cantidad: 1,
        precioUnitario: this.valorModificacion,
        descuento: 0,
        ivaPorcentaje: 0,
        ivaCodigoPorcentaje: '0',
      },
    ];
    const body = this.documentos.fromFacturaModificado(this.facturaId, this.motivo.trim(), {
      puntoEmisionId: this.puntoEmisionId,
      fechaEmision: this.fechaEmision,
      tipoIdentificacionReceptor: tipoId,
      identificacionReceptor: f.identificacionReceptor,
      razonSocialReceptor: f.razonSocialReceptor,
      items,
      customData: { claveAccesoFactura: f.claveAcceso, numeroFactura: f.numeroComprobante },
    });
    this.loading.set(true);
    this.documentos.guardarBorradorModificado('notas-debito', body).subscribe({
      next: (borrador) => this.afterBorrador(borrador, emitir, 'notas-debito'),
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('invoice.debitNoteError'));
      },
    });
  }

  private afterBorrador(borrador: ComprobanteFactura, emitir: boolean, tipo: 'notas-debito'): void {
    if (!emitir) {
      this.loading.set(false);
      this.toast.success(this.t('invoice.debitNoteCreated'));
      void this.router.navigate(['/t', this.tenant.tenantSlug(), ...this.documentos.listadoPath(tipo)]);
      return;
    }
    this.documentos.emitirBorrador(tipo, borrador.id).subscribe({
      next: (emitido) => {
        this.loading.set(false);
        this.toast.success(this.t('invoice.debitNoteEmitted', { status: emitido.estadoSri }));
        void this.router.navigate(['/t', this.tenant.tenantSlug(), ...this.documentos.listadoPath(tipo)]);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('invoice.debitNoteEmitError'));
      },
    });
  }
}
