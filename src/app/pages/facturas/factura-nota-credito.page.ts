import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { fechaHoyIsoLocal } from '../../core/util/fecha-local.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsFacturaLineasTabulatorComponent } from '../../shared/ui/organisms/ts-factura-lineas-tabulator/ts-factura-lineas-tabulator.component';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { ComprobanteCatalogosService } from '../comprobantes/comprobante-catalogos.service';
import { NotasCreditoService } from '../documentos/notas-credito.service';
import { MaestrosService, type ProductoServicio } from '../maestros/maestros.service';
import {
  correoTextoDesdeCustomData,
  FacturasService,
  parseCorreosLista,
  type ComprobanteFactura,
  type FacturaLinea,
  type PuntoEmitir,
} from './facturas.service';

interface LineaFacturaOrigen {
  detalleId: string;
  incluir: boolean;
  linea: FacturaLinea;
}

@Component({
  selector: 'ts-factura-nota-credito-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DecimalPipe,
    TsPageLayoutComponent,
    TsFacturaLineasTabulatorComponent,
  ],
  template: `
    <ts-page-layout
      [title]="t('invoice.creditNoteTitle')"
      [subtitle]="factura()?.numeroComprobante ?? ''"
      [eyebrow]="t('menu.sales')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="['/t', tenant.tenantSlug(), 'facturas', facturaId]">{{
          t('common.back')
        }}</a>
        <button type="button" class="btn btn-primary" (click)="crear(false)" [disabled]="loading() || !factura()">
          {{ loading() ? t('common.loading') : t('invoice.createCreditNote') }}
        </button>
        <button type="button" class="btn btn-success" (click)="crear(true)" [disabled]="loading() || !factura()">
          {{ loading() ? t('common.loading') : t('invoice.creditNoteEmitNow') }}
        </button>
      </div>

      @if (loadingFactura()) {
        <p class="text-muted mb-0">{{ t('common.loading') }}</p>
      } @else if (!factura()) {
        <p class="text-muted mb-0">{{ t('invoice.notFound') }}</p>
      } @else if (factura()!.estadoSri !== 'AUTORIZADO') {
        <p class="text-warning mb-0">{{ t('invoice.creditNoteRequiresAuthorized') }}</p>
      } @else {
        <div class="alert alert-info border-0 mb-3">
          <h2 class="h6 mb-2">{{ t('invoice.creditNoteProcessTitle') }}</h2>
          <ol class="small mb-0 ps-3">
            <li>{{ t('invoice.creditNoteProcessStep1') }}</li>
            <li>{{ t('invoice.creditNoteProcessStep2') }}</li>
            <li>{{ t('invoice.creditNoteProcessStep3') }}</li>
            <li>{{ t('invoice.creditNoteProcessStep4') }}</li>
          </ol>
        </div>

        <form class="border rounded p-3" (ngSubmit)="crear(false)">
          <p class="text-muted small">{{ t('invoice.creditNoteHint') }}</p>

          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label" for="nc-punto">{{ t('documents.emissionPoint') }}</label>
              <select id="nc-punto" class="form-select" [(ngModel)]="puntoEmisionId" name="puntoEmisionId" required>
                @for (p of puntos(); track p.id) {
                  <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }}</option>
                }
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label" for="nc-fecha">{{ t('documents.date') }}</label>
              <input id="nc-fecha" type="date" class="form-control" [(ngModel)]="fechaEmision" name="fechaEmision" />
            </div>
            <div class="col-md-5">
              <label class="form-label" for="nc-motivo">{{ t('invoice.creditNoteReason') }}</label>
              <input id="nc-motivo" class="form-control" [(ngModel)]="motivo" name="motivo" required />
            </div>
            <div class="col-md-5">
              <label class="form-label" for="nc-email">{{ t('invoice.creditNoteReceiverEmail') }}</label>
              <input
                id="nc-email"
                type="text"
                class="form-control"
                [(ngModel)]="emailReceptor"
                name="emailReceptor"
                [placeholder]="t('invoice.resendEmailModalPlaceholder')"
              />
              <p class="form-text mb-0">{{ t('invoice.resendEmailModalHint') }}</p>
            </div>
          </div>

          <dl class="row g-2 mt-2 mb-0 small">
            <div class="col-sm-6">
              <dt class="text-muted">{{ t('documents.receiver') }}</dt>
              <dd class="mb-0">{{ factura()!.razonSocialReceptor }} ({{ factura()!.identificacionReceptor }})</dd>
            </div>
            <div class="col-sm-6">
              <dt class="text-muted">{{ t('invoice.creditNoteInvoiceTotalRef') }}</dt>
              <dd class="mb-0">{{ factura()!.valorTotal | number: '1.2-2' }}</dd>
            </div>
          </dl>

          @if (lineasOrigen().length) {
            <section class="mt-4">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <h3 class="h6 mb-0">{{ t('invoice.creditNoteLinesFromInvoice') }}</h3>
                <div class="d-flex flex-wrap gap-2">
                  <button type="button" class="btn btn-soft-primary btn-sm" (click)="incluirTodasFactura()">
                    {{ t('invoice.creditNoteSelectAll') }}
                  </button>
                  <button type="button" class="btn btn-light btn-sm" (click)="quitarTodasFactura()">
                    {{ t('invoice.creditNoteSelectNone') }}
                  </button>
                </div>
              </div>
              <div class="table-responsive border rounded">
                <table class="table table-sm table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th class="text-center" style="width: 3.5rem">{{ t('invoice.creditNoteSelectLine') }}</th>
                      <th>#</th>
                      <th>{{ t('masters.description') }}</th>
                      <th class="text-end">{{ t('invoice.colQty') }}</th>
                      <th class="text-end">{{ t('invoice.colUnitPrice') }}</th>
                      <th class="text-end">IVA %</th>
                      <th class="text-end">{{ t('documents.total') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (o of lineasOrigen(); track o.detalleId; let i = $index) {
                      <tr [class.table-primary]="o.incluir">
                        <td class="text-center">
                          <input
                            type="checkbox"
                            class="form-check-input"
                            [checked]="o.incluir"
                            (change)="toggleIncluir(o.detalleId, $any($event.target).checked)"
                            [attr.aria-label]="t('invoice.creditNoteSelectLine')"
                          />
                        </td>
                        <td>{{ i + 1 }}</td>
                        <td>{{ o.linea.descripcion }}</td>
                        <td class="text-end">{{ o.linea.cantidad }}</td>
                        <td class="text-end">{{ o.linea.precioUnitario | number: '1.2-2' }}</td>
                        <td class="text-end">{{ o.linea.ivaPorcentaje | number: '1.0-2' }}</td>
                        <td class="text-end">{{ lineaTotal(o.linea) | number: '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }

          <section class="mt-4">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <h3 class="h6 mb-0">{{ t('invoice.creditNoteLinesToEmit') }}</h3>
              <button type="button" class="btn btn-soft-primary btn-sm" (click)="agregarLinea()">
                {{ t('invoice.addLine') }}
              </button>
            </div>
            <p class="text-muted small">{{ t('invoice.creditNoteManualLineHint') }}</p>
            <ts-factura-lineas-tabulator
              [lineas]="lineas()"
              [itemsMaestro]="itemsMaestro()"
              [reloadNonce]="lineasNonce()"
              height="360px"
              (lineasChange)="onLineasGridChange($event)"
              (eliminarLinea)="quitarLinea($event)"
            />
          </section>

          <aside class="card border-0 shadow-sm mt-3">
            <div class="card-body py-3">
              <h3 class="h6 mb-3">{{ t('invoice.sectionTotals') }}</h3>
              <dl class="row g-2 mb-0 small">
                <div class="col-sm-4">
                  <dt class="text-muted">{{ t('invoice.subtotal') }}</dt>
                  <dd class="mb-0 fw-semibold">{{ totales().subtotal | number: '1.2-2' }}</dd>
                </div>
                <div class="col-sm-4">
                  <dt class="text-muted">{{ t('invoice.discountTotal') }}</dt>
                  <dd class="mb-0">{{ totales().descuento | number: '1.2-2' }}</dd>
                </div>
                <div class="col-sm-4">
                  <dt class="text-muted">IVA</dt>
                  <dd class="mb-0">{{ totales().iva | number: '1.2-2' }}</dd>
                </div>
                <div class="col-12 border-top pt-2 mt-1">
                  <dt class="text-muted">{{ t('documents.total') }} NC</dt>
                  <dd class="mb-0 fs-5 fw-bold text-primary">{{ totales().total | number: '1.2-2' }}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </form>
      }
    </ts-page-layout>
  `,
})
export class FacturaNotaCreditoPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facturas = inject(FacturasService);
  private readonly catalogos = inject(ComprobanteCatalogosService);
  private readonly maestros = inject(MaestrosService);
  private readonly notasCredito = inject(NotasCreditoService);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  facturaId = '';
  readonly factura = signal<ComprobanteFactura | null>(null);
  readonly puntos = signal<PuntoEmitir[]>([]);
  readonly itemsMaestro = signal<ProductoServicio[]>([]);
  readonly lineasOrigen = signal<LineaFacturaOrigen[]>([]);
  readonly lineas = signal<FacturaLinea[]>([]);
  readonly lineasNonce = signal(0);
  readonly loadingFactura = signal(true);
  readonly loading = signal(false);

  readonly totales = computed(() => this.facturas.calcularTotales(this.lineasActivas()));

  puntoEmisionId = '';
  fechaEmision = fechaHoyIsoLocal();
  motivo = '';
  emailReceptor = '';

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
    this.cargarItemsMaestro();
    this.facturas.obtenerComprobante(this.facturaId).subscribe({
      next: (c) => this.cargarFactura(c),
      error: () => {
        this.factura.set(null);
        this.loadingFactura.set(false);
      },
    });
  }

  private cargarFactura(c: ComprobanteFactura): void {
    this.factura.set(c);
    this.loadingFactura.set(false);
    const cd = c.customData ?? {};
    if (cd['puntoEmisionId']) {
      this.puntoEmisionId = String(cd['puntoEmisionId']);
    } else {
      const match = this.puntos().find((p) =>
        c.numeroComprobante.startsWith(`${p.establecimientoCodigo}-${p.codigo}-`),
      );
      if (match) {
        this.puntoEmisionId = match.id;
      }
    }
    this.motivo = this.t('invoice.creditNoteDefaultReason', { number: c.numeroComprobante });
    this.emailReceptor = correoTextoDesdeCustomData(cd);
    this.lineas.set([]);
    this.lineasOrigen.set(this.buildLineasOrigen(c));
  }

  private buildLineasOrigen(c: ComprobanteFactura): LineaFacturaOrigen[] {
    if (!c.detalles?.length) {
      return [];
    }
    return c.detalles.map((d, idx) => {
      const detalleId = d.id ?? `line-${idx}`;
      const snapshot: ComprobanteFactura = { ...c, detalles: [d] };
      const linea = this.facturas.comprobanteToLineas(snapshot)[0] ?? this.facturas.nuevaLineaVacia();
      return {
        detalleId,
        incluir: false,
        linea: { ...linea, _origenDetalleId: detalleId },
      };
    });
  }

  private cargarItemsMaestro(): void {
    this.maestros.list<ProductoServicio>('productos', 0, 200).subscribe({
      next: (page) => {
        const productos = page.content;
        this.maestros.list<ProductoServicio>('servicios', 0, 200).subscribe({
          next: (servicios) => this.itemsMaestro.set([...productos, ...servicios.content]),
          error: () => this.itemsMaestro.set(productos),
        });
      },
      error: () => {
        this.maestros.list<ProductoServicio>('servicios', 0, 200).subscribe({
          next: (servicios) => this.itemsMaestro.set(servicios.content),
          error: () => this.itemsMaestro.set([]),
        });
      },
    });
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  lineaTotal(linea: FacturaLinea): number {
    const tot = this.facturas.calcularTotales([linea]);
    return tot.total;
  }

  lineasActivas(): FacturaLinea[] {
    return this.lineas().filter((l) => l.descripcion.trim() && this.lineSubtotal(l) > 0);
  }

  lineSubtotal(linea: FacturaLinea): number {
    const cant = Number(linea.cantidad) || 0;
    const pu = Number(linea.precioUnitario) || 0;
    const desc = Number(linea.descuento) || 0;
    return Math.max(0, cant * pu - desc);
  }

  toggleIncluir(detalleId: string, incluir: boolean): void {
    this.lineasOrigen.update((rows) =>
      rows.map((o) => (o.detalleId === detalleId ? { ...o, incluir } : o)),
    );
    const orig = this.lineasOrigen().find((o) => o.detalleId === detalleId);
    if (!orig) {
      return;
    }
    if (incluir) {
      const ya = this.lineas().some((l) => l._origenDetalleId === detalleId);
      if (!ya) {
        const copy: FacturaLinea = {
          ...structuredClone(orig.linea),
          _rowId: crypto.randomUUID(),
          _origenDetalleId: detalleId,
        };
        this.lineas.update((rows) => [...rows, copy]);
        this.lineasNonce.update((n) => n + 1);
      }
    } else {
      this.lineas.update((rows) => rows.filter((l) => l._origenDetalleId !== detalleId));
      this.lineasNonce.update((n) => n + 1);
    }
  }

  incluirTodasFactura(): void {
    for (const o of this.lineasOrigen()) {
      if (!o.incluir) {
        this.toggleIncluir(o.detalleId, true);
      }
    }
  }

  quitarTodasFactura(): void {
    for (const o of this.lineasOrigen()) {
      if (o.incluir) {
        this.toggleIncluir(o.detalleId, false);
      }
    }
  }

  agregarLinea(): void {
    this.lineas.update((rows) => [...rows, this.facturas.nuevaLineaVacia()]);
    this.lineasNonce.update((n) => n + 1);
  }

  quitarLinea(rowId: string): void {
    const removed = this.lineas().find((r) => r._rowId === rowId);
    this.lineas.update((rows) => rows.filter((r) => r._rowId !== rowId));
    if (removed?._origenDetalleId) {
      this.lineasOrigen.update((rows) =>
        rows.map((o) =>
          o.detalleId === removed._origenDetalleId ? { ...o, incluir: false } : o,
        ),
      );
    }
    this.lineasNonce.update((n) => n + 1);
  }

  onLineasGridChange(next: FacturaLinea[]): void {
    this.lineas.set(next);
  }

  crear(emitir: boolean): void {
    const f = this.factura();
    if (!f || !this.puntoEmisionId || !this.motivo.trim()) {
      this.toast.error(this.t('invoice.creditNoteInvalid'));
      return;
    }
    const activas = this.lineasActivas();
    if (!activas.length) {
      this.toast.error(this.t('invoice.creditNoteLinesRequired'));
      return;
    }
    if (f.estadoSri !== 'AUTORIZADO') {
      this.toast.error(this.t('invoice.creditNoteRequiresAuthorized'));
      return;
    }
    const cd = f.customData ?? {};
    const tipoId = String(cd['tipoIdentificacionReceptor'] ?? '04');
    const items = this.facturas.lineasToPayload(activas);
    const tot = this.facturas.calcularTotales(activas);
    const emails = parseCorreosLista(this.emailReceptor);
    const body = this.notasCredito.fromFacturaPayload(this.facturaId, this.motivo.trim(), {
      puntoEmisionId: this.puntoEmisionId,
      fechaEmision: this.fechaEmision,
      tipoIdentificacionReceptor: tipoId,
      identificacionReceptor: f.identificacionReceptor,
      razonSocialReceptor: f.razonSocialReceptor,
      items,
      customData: {
        claveAccesoFactura: f.claveAcceso,
        numeroFactura: f.numeroComprobante,
        fechaEmisionFacturaModificada: f.fechaEmision,
        tipoComprobanteModificado: 'FACTURA',
        desgloseImpuestos: tot.ivaPorTarifa,
        desgloseSubtotales: {
          general: tot.subtotal,
          exento: tot.subtotalExento,
          gravado: Math.round((tot.subtotal - tot.subtotalExento) * 100) / 100,
        },
        ...(emails[0] ? { emailReceptor: emails[0] } : {}),
        ...(emails.length ? { emailsReceptor: emails } : {}),
        ...(cd['direccionReceptor']
          ? { direccionReceptor: String(cd['direccionReceptor']) }
          : cd['direccionComprador']
            ? { direccionReceptor: String(cd['direccionComprador']) }
            : {}),
      },
    });
    this.loading.set(true);
    this.notasCredito.guardarBorrador(body).subscribe({
      next: (borrador) => {
        if (!emitir) {
          this.loading.set(false);
          this.toast.success(this.t('invoice.creditNoteCreated'));
          void this.router.navigate(['/t', this.tenant.tenantSlug(), 'comprobantes', borrador.id], {
            queryParams: { from: 'ventas/notas-credito' },
          });
          return;
        }
        this.notasCredito.emitirBorrador(borrador.id, crypto.randomUUID()).subscribe({
          next: (emitido) => {
            this.loading.set(false);
            this.toast.success(this.t('invoice.creditNoteEmitted', { status: emitido.estadoSri }));
            void this.router.navigate(['/t', this.tenant.tenantSlug(), 'comprobantes', emitido.id], {
              queryParams: { from: 'ventas/notas-credito' },
            });
          },
          error: () => {
            this.loading.set(false);
            this.toast.error(this.t('invoice.creditNoteEmitError'));
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('invoice.creditNoteError'));
      },
    });
  }
}
