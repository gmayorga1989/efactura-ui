import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ComprobanteArchivosService } from '../../core/comprobante/comprobante-archivos.service';
import { formatFechaDdMmYyyy } from '../../shared/ui/tabulator-formatters.util';
import { badgeClaseEstadoSri, etiquetaEstadoSri } from '../../shared/ui/sri-estado.util';
import { readAccessToken } from '../../core/auth.interceptor';
import { resolveInvoiceEmitError } from '../../core/session/http-error.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import {
  TsComprobanteDetallesGridComponent,
  type ComprobanteDetalleGridRow,
} from '../../shared/ui/organisms/ts-comprobante-detalles-grid/ts-comprobante-detalles-grid.component';
import {
  DocumentosEmisionService,
  type TipoDocumentoEmision,
} from '../documentos/documentos-emision.service';
import { textoPagosDesdeCustomData } from '../../shared/utils/forma-pago-sri.util';
import {
  FacturasService,
  leerDesgloseIva,
  textoDetalleAdicionalLinea,
  type ComprobanteFactura,
  type ComprobanteRelacionadoResumen,
} from '../facturas/facturas.service';

@Component({
  selector: 'ts-comprobante-detalle-page',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, TsPageLayoutComponent, TsComprobanteDetallesGridComponent],
  template: `
    <ts-page-layout [title]="pageTitle()" [subtitle]="comprobante()?.numeroComprobante ?? ''" [eyebrow]="pageEyebrow()">
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="backLink()">{{ t('common.back') }}</a>
        @if (comprobante(); as c) {
          @if (c.estadoSri === 'BORRADOR') {
            @if (esFactura()) {
              <a class="btn btn-soft-primary" [routerLink]="['/t', tenant.tenantSlug(), 'facturas', 'editar', c.id]">
                {{ t('invoice.editDraft') }}
              </a>
            }
            <button type="button" class="btn btn-success" (click)="emitirBorrador(c.id)" [disabled]="emitiendo()">
              {{ emitiendo() ? t('common.loading') : t('invoice.emit') }}
            </button>
          } @else {
            <div class="dropdown" [class.show]="menuDocumentosAbierto()">
              <button
                type="button"
                class="btn btn-soft-primary dropdown-toggle"
                (click)="toggleMenuDocumentos()"
                [attr.aria-expanded]="menuDocumentosAbierto()"
              >
                {{ t('invoice.actionsDocuments') }}
              </button>
              <ul class="dropdown-menu" [class.show]="menuDocumentosAbierto()">
                <li>
                  <button type="button" class="dropdown-item" (click)="descargarRide(c.id)">RIDE</button>
                </li>
                <li>
                  <button type="button" class="dropdown-item" (click)="descargarXml(c.id)">XML</button>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <button type="button" class="dropdown-item" (click)="descargarTodo(c)">
                    {{ t('invoice.downloadAll') }}
                  </button>
                </li>
              </ul>
            </div>
            @if (esFactura() && c.estadoSri === 'AUTORIZADO') {
              <div class="dropdown" [class.show]="menuRelacionadosAbierto()">
                <button
                  type="button"
                  class="btn btn-soft-primary dropdown-toggle"
                  (click)="toggleMenuRelacionados()"
                  [attr.aria-expanded]="menuRelacionadosAbierto()"
                >
                  {{ t('invoice.actionsRelated') }}
                </button>
                <ul class="dropdown-menu" [class.show]="menuRelacionadosAbierto()">
                  <li>
                    <a
                      class="dropdown-item"
                      [routerLink]="['/t', tenant.tenantSlug(), 'facturas', c.id, 'nota-credito']"
                      (click)="cerrarMenus()"
                    >
                      {{ t('invoice.createCreditNote') }}
                    </a>
                  </li>
                  <li>
                    <a
                      class="dropdown-item"
                      [routerLink]="['/t', tenant.tenantSlug(), 'facturas', c.id, 'nota-debito']"
                      (click)="cerrarMenus()"
                    >
                      {{ t('invoice.createDebitNote') }}
                    </a>
                  </li>
                  <li>
                    <a
                      class="dropdown-item"
                      [routerLink]="['/t', tenant.tenantSlug(), 'facturas', c.id, 'guia']"
                      (click)="cerrarMenus()"
                    >
                      {{ t('documents.guideFromInvoice') }}
                    </a>
                  </li>
                </ul>
              </div>
            }
          }
        }
      </div>

      @if (loading()) {
        <p class="text-muted mb-0">{{ t('common.loading') }}</p>
      } @else if (!comprobante()) {
        <p class="text-muted mb-0">{{ t('invoice.notFound') }}</p>
      } @else {
        @if (comprobante(); as c) {
          @if (mensajeSriAlerta(); as sriMsg) {
            <div class="alert alert-warning mb-3" role="alert">
              <strong>{{ t('invoice.sriLastMessage') }}:</strong> {{ sriMsg }}
            </div>
          }
          <div class="row g-3 mb-4">
            <div class="col-md-8">
              <div class="comprobante-detail-card">
                <h2 class="h6 mb-3">{{ t('invoice.sectionHeader') }}</h2>
                <dl class="comprobante-detail-dl">
                  @if (tipoLabel()) {
                    <div>
                      <dt>{{ t('monitor.type') }}</dt>
                      <dd>{{ tipoLabel() }}</dd>
                    </div>
                  }
                  <div>
                    <dt>{{ t('documents.date') }}</dt>
                    <dd>{{ formatFecha(c.fechaEmision) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('documents.receiver') }}</dt>
                    <dd>
                      {{ c.razonSocialReceptor }}<br /><span class="text-muted">{{ c.identificacionReceptor }}</span>
                    </dd>
                  </div>
                  @if (direccionReceptor()) {
                    <div>
                      <dt>{{ t('invoice.receiverAddress') }}</dt>
                      <dd>{{ direccionReceptor() }}</dd>
                    </div>
                  }
                  @if (vendedorNombre()) {
                    <div>
                      <dt>{{ t('salespeople.label') }}</dt>
                      <dd>{{ vendedorNombre() }}</dd>
                    </div>
                  }
                  @if (glosa()) {
                    <div class="span-2">
                      <dt>{{ t('invoice.headerNoteLabel') }}</dt>
                      <dd class="small">{{ glosa() }}</dd>
                    </div>
                  }
                  @if (formaPagoTexto()) {
                    <div class="span-2">
                      <dt>{{ t('invoice.paymentMethodSri') }}</dt>
                      <dd class="small">{{ formaPagoTexto() }}</dd>
                    </div>
                  }
                  <div>
                    <dt>{{ t('documents.sriStatus') }}</dt>
                    <dd>
                      <span [class]="badgeClaseEstadoSri(c.estadoSri)">
                        <span class="ts-sri-badge__dot" aria-hidden="true"></span>
                        {{ etiquetaEstado(c.estadoSri) }}
                      </span>
                    </dd>
                  </div>
                  @if (c.numeroAutorizacion) {
                    <div>
                      <dt>{{ t('invoice.authorization') }}</dt>
                      <dd class="small">{{ c.numeroAutorizacion }}</dd>
                    </div>
                  }
                  @if (c.fechaAutorizacion) {
                    <div>
                      <dt>{{ t('invoice.authorizationDate') }}</dt>
                      <dd class="small">{{ c.fechaAutorizacion | date: 'dd/MM/yyyy HH:mm' }}</dd>
                    </div>
                  }
                  @if (esFactura() && relacionados().length) {
                    <div class="span-2">
                      <dt>{{ t('invoice.relatedDocuments') }}</dt>
                      <dd class="mb-0">
                        <ul class="list-unstyled small mb-0 comprobante-relacionados">
                          @for (rel of relacionados(); track rel.id) {
                            <li>
                              <a [routerLink]="linkComprobante(rel)">{{ etiquetaRelacionado(rel) }}</a>
                              <span [class]="badgeClaseEstadoSri(rel.estadoSri) + ' ms-1'">
                                <span class="ts-sri-badge__dot" aria-hidden="true"></span>
                                {{ etiquetaEstado(rel.estadoSri) }}
                              </span>
                              @if (rel.fechaAutorizacion) {
                                <span class="text-muted"> · {{ rel.fechaAutorizacion | date: 'dd/MM/yyyy HH:mm' }}</span>
                              }
                            </li>
                          }
                        </ul>
                      </dd>
                    </div>
                  } @else if (esFactura() && relacionadosCargados() && !relacionados().length) {
                    <div class="span-2">
                      <dt>{{ t('invoice.relatedDocuments') }}</dt>
                      <dd class="small text-muted mb-0">{{ t('invoice.noRelatedDocuments') }}</dd>
                    </div>
                  }
                  @if (facturaModificadaId(); as fid) {
                    <div class="span-2">
                      <dt>{{ t('invoice.creditNoteModifiedInvoice') }}</dt>
                      <dd>
                        <a [routerLink]="['/t', tenant.tenantSlug(), 'facturas', fid]">{{ facturaModificadaNumero() }}</a>
                      </dd>
                    </div>
                  }
                  <div class="span-2">
                    <dt>{{ t('monitor.accessKey') }}</dt>
                    <dd class="small font-monospace">{{ c.claveAcceso }}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div class="col-md-4">
              <div class="comprobante-detail-card comprobante-detail-totals">
                <h2 class="h6 mb-3">{{ t('invoice.sectionTotals') }}</h2>
                <dl class="comprobante-totals-read mb-0">
                  <div>
                    <dt>{{ t('invoice.subtotal') }}</dt>
                    <dd>{{ c.subtotalSinImpuestos | number: '1.2-2' }}</dd>
                  </div>
                  @if (c.descuentoTotal > 0) {
                    <div>
                      <dt>{{ t('invoice.discountTotal') }}</dt>
                      <dd>{{ c.descuentoTotal | number: '1.2-2' }}</dd>
                    </div>
                  }
                  @if (desgloseIva().length) {
                    @for (row of desgloseIva(); track row.codigo + row.porcentaje) {
                      <div>
                        <dt>IVA {{ row.porcentaje }}%</dt>
                        <dd>{{ row.iva | number: '1.2-2' }}</dd>
                      </div>
                    }
                  } @else {
                    <div>
                      <dt>IVA</dt>
                      <dd>{{ c.ivaTotal | number: '1.2-2' }}</dd>
                    </div>
                  }
                  <div class="grand">
                    <dt>{{ t('documents.total') }}</dt>
                    <dd>{{ c.valorTotal | number: '1.2-2' }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div class="comprobante-detail-card">
            <h2 class="h6 mb-3">{{ t('invoice.sectionLines') }}</h2>
            <ts-comprobante-detalles-grid
              [detalles]="lineasGrid()"
              [mostrarDetalleAdicional]="tieneDetalleAdicional()"
              [reloadNonce]="detallesNonce()"
              height="360px"
            />
          </div>
        }
      }
    </ts-page-layout>
  `,
  styles: [
    `
      .comprobante-detail-card {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        padding: 1rem 1.15rem;
        background: var(--card);
        box-shadow: var(--ef-surface-shadow);
        height: 100%;
        color: var(--text);
      }
      .comprobante-detail-dl {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem 1.25rem;
        margin: 0;
      }
      .comprobante-detail-dl .span-2 {
        grid-column: 1 / -1;
      }
      .comprobante-detail-dl dt {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--ef-label, #334155);
      }
      .comprobante-detail-dl dd {
        margin: 0;
        color: var(--text);
      }
      .comprobante-totals-read > div {
        display: flex;
        justify-content: space-between;
        padding: 0.15rem 0;
      }
      .comprobante-totals-read dt {
        margin: 0;
        font-weight: 600;
        color: var(--ef-label, #334155);
      }
      .comprobante-totals-read dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
      .comprobante-totals-read .grand {
        border-top: 1px solid var(--ef-divider, #e2e8f0);
        margin-top: 0.35rem;
        padding-top: 0.45rem;
        font-weight: 600;
      }
    `,
  ],
})
export class ComprobanteDetallePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly facturas = inject(FacturasService);
  private readonly documentos = inject(DocumentosEmisionService);
  private readonly archivos = inject(ComprobanteArchivosService);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly loading = signal(true);
  readonly emitiendo = signal(false);
  readonly menuDocumentosAbierto = signal(false);
  readonly menuRelacionadosAbierto = signal(false);
  readonly detallesNonce = signal(0);
  readonly comprobante = signal<(ComprobanteFactura & { tipo?: string }) | null>(null);
  readonly relacionados = signal<ComprobanteRelacionadoResumen[]>([]);
  readonly relacionadosCargados = signal(false);

  readonly lineasGrid = computed<ComprobanteDetalleGridRow[]>(() => {
    const c = this.comprobante();
    if (!c?.detalles?.length) {
      return [];
    }
    return c.detalles.map((d) => ({
      id: d.id,
      linea: d.linea,
      codigoPrincipal: d.codigoPrincipal,
      codigoAuxiliar: d.codigoAuxiliar,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
      descuento: d.descuento,
      precioTotalSinImpuesto: d.precioTotalSinImpuesto,
      detalleAdicional: textoDetalleAdicionalLinea(d.customData),
    }));
  });

  readonly glosa = computed(() => {
    const cd = this.comprobante()?.customData;
    return String(cd?.['glosa'] ?? '').trim();
  });

  readonly mensajeSriAlerta = computed(() => {
    const c = this.comprobante();
    if (!c) {
      return '';
    }
    const msg = c.ultimoMensajeSri?.trim();
    if (!msg) {
      return '';
    }
    const est = String(c.estadoSri ?? '').toUpperCase();
    if (est === 'AUTORIZADO') {
      return '';
    }
    return msg;
  });

  readonly direccionReceptor = computed(() => {
    const cd = this.comprobante()?.customData;
    return String(cd?.['direccionReceptor'] ?? cd?.['direccionComprador'] ?? '').trim();
  });

  readonly vendedorNombre = computed(() => {
    const c = this.comprobante();
    if (!c) {
      return '';
    }
    const direct = c.vendedorNombre?.trim();
    if (direct) {
      return direct;
    }
    return '';
  });

  readonly formaPagoTexto = computed(() => textoPagosDesdeCustomData(this.comprobante()?.customData));

  readonly desgloseIva = computed(() => leerDesgloseIva(this.comprobante()?.customData));

  readonly tieneDetalleAdicional = computed(() =>
    this.lineasGrid().some((l) => !!String(l.detalleAdicional ?? '').trim()),
  );

  readonly esFactura = computed(() => {
    const t = (this.comprobante()?.tipo ?? '').toUpperCase();
    return !t || t === 'FACTURA';
  });

  readonly facturaModificadaId = computed(() => {
    const t = (this.comprobante()?.tipo ?? '').toUpperCase();
    if (t !== 'NOTA_CREDITO' && t !== 'NOTA_DEBITO') {
      return null;
    }
    const cd = this.comprobante()?.customData ?? {};
    const raw = cd['facturaModificadaId'] ?? cd['facturaOrigenId'];
    return raw ? String(raw) : null;
  });

  readonly facturaModificadaNumero = computed(() => {
    const cd = this.comprobante()?.customData ?? {};
    const n = String(cd['numeroFactura'] ?? '').trim();
    return n || this.t('invoice.viewInvoice');
  });

  readonly tipoLabel = computed(() => {
    const t = (this.comprobante()?.tipo ?? '').toUpperCase();
    if (!t || t === 'FACTURA') {
      return '';
    }
    const map: Record<string, string> = {
      NOTA_CREDITO: this.t('menu.creditNotes'),
      NOTA_DEBITO: this.t('menu.debitNotes'),
      GUIA_REMISION: this.t('menu.guides'),
      GUIA: this.t('menu.guides'),
      RETENCION: this.t('menu.withholdings'),
      LIQUIDACION_COMPRA: this.t('menu.purchaseSettlements'),
      LIQUIDACION: this.t('menu.purchaseSettlements'),
    };
    return map[t] ?? t;
  });

  ngOnInit(): void {
    if (!readAccessToken() || !this.session.profile()?.empresaId) {
      this.loading.set(false);
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.facturas.obtenerComprobante(id).subscribe({
      next: (c) => {
        this.comprobante.set(c);
        this.detallesNonce.update((n) => n + 1);
        this.loading.set(false);
        const tipo = (c.tipo ?? '').toUpperCase();
        if (!tipo || tipo === 'FACTURA') {
          this.cargarRelacionados(id);
        }
      },
      error: () => {
        this.comprobante.set(null);
        this.loading.set(false);
        this.toast.error(this.t('invoice.notFound'));
      },
    });
  }

  cargarRelacionados(facturaId: string): void {
    this.relacionadosCargados.set(false);
    this.facturas.listarRelacionados(facturaId).subscribe({
      next: (list) => {
        this.relacionados.set(list);
        this.relacionadosCargados.set(true);
      },
      error: () => {
        this.relacionados.set([]);
        this.relacionadosCargados.set(true);
      },
    });
  }

  linkComprobante(rel: ComprobanteRelacionadoResumen): (string | number)[] {
    const t = (rel.tipo ?? '').toUpperCase();
    const base = ['/t', this.tenant.tenantSlug()];
    if (t === 'NOTA_CREDITO') {
      return [...base, 'comprobantes', rel.id];
    }
    if (t === 'NOTA_DEBITO') {
      return [...base, 'comprobantes', rel.id];
    }
    return [...base, 'comprobantes', rel.id];
  }

  etiquetaRelacionado(rel: ComprobanteRelacionadoResumen): string {
    const t = (rel.tipo ?? '').toUpperCase();
    const tipo =
      t === 'NOTA_CREDITO'
        ? this.t('menu.creditNotes')
        : t === 'NOTA_DEBITO'
          ? this.t('menu.debitNotes')
          : t === 'GUIA_REMISION'
            ? this.t('menu.guides')
            : rel.tipo;
    return `${tipo} ${rel.numeroComprobante}`;
  }

  pageTitle(): string {
    return this.esFactura() ? this.t('invoice.detailTitle') : this.t('documents.voucherDetailTitle');
  }

  pageEyebrow(): string {
    const t = (this.comprobante()?.tipo ?? '').toUpperCase();
    if (t.includes('RETENCION') || t.includes('LIQUIDACION')) {
      return this.t('menu.suppliers');
    }
    return this.t('menu.sales');
  }

  backLink(): (string | number)[] {
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from) {
      return ['/t', this.tenant.tenantSlug(), ...from.split('/').filter(Boolean)];
    }
    if (this.esFactura()) {
      return ['/t', this.tenant.tenantSlug(), 'facturas'];
    }
    return ['/t', this.tenant.tenantSlug(), 'comprobantes-electronicos'];
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  emitirBorrador(id: string): void {
    this.emitiendo.set(true);
    const tipoEmision = this.tipoEmisionDesdeComprobante();
    if (tipoEmision) {
      this.documentos.emitirBorrador(tipoEmision, id).subscribe({
        next: (c) => this.onEmitido(c),
        error: (err) => this.onEmitirError(err),
      });
      return;
    }
    this.facturas.emitirBorrador(id, crypto.randomUUID()).subscribe({
      next: (c) => this.onEmitido(c),
      error: (err) => this.onEmitirError(err),
    });
  }

  private tipoEmisionDesdeComprobante(): TipoDocumentoEmision | null {
    const t = (this.comprobante()?.tipo ?? '').toUpperCase();
    if (t === 'NOTA_CREDITO') {
      return 'notas-credito';
    }
    if (t === 'NOTA_DEBITO') {
      return 'notas-debito';
    }
    if (t === 'GUIA_REMISION' || t === 'GUIA') {
      return 'guias';
    }
    if (t === 'RETENCION') {
      return 'retenciones';
    }
    if (t === 'LIQUIDACION_COMPRA' || t === 'LIQUIDACION') {
      return 'liquidaciones';
    }
    return null;
  }

  private onEmitido(c: ComprobanteFactura): void {
    this.emitiendo.set(false);
    this.comprobante.set(c);
    this.toast.success(this.t('invoice.issued', { number: c.numeroComprobante, status: c.estadoSri }));
  }

  private onEmitirError(err?: unknown): void {
    this.emitiendo.set(false);
    this.toast.error(resolveInvoiceEmitError(err, (k) => this.t(k)));
  }

  formatFecha(value: string | null | undefined): string {
    return formatFechaDdMmYyyy(value);
  }

  readonly badgeClaseEstadoSri = badgeClaseEstadoSri;

  etiquetaEstado(codigo: string | null | undefined): string {
    return etiquetaEstadoSri(codigo, (key) => this.t(key));
  }

  toggleMenuDocumentos(): void {
    this.menuDocumentosAbierto.update((v) => !v);
    this.menuRelacionadosAbierto.set(false);
  }

  toggleMenuRelacionados(): void {
    this.menuRelacionadosAbierto.update((v) => !v);
    this.menuDocumentosAbierto.set(false);
  }

  cerrarMenus(): void {
    this.menuDocumentosAbierto.set(false);
    this.menuRelacionadosAbierto.set(false);
  }

  descargarRide(id: string): void {
    this.cerrarMenus();
    this.archivos.abrirRide(id);
  }

  descargarXml(id: string): void {
    this.cerrarMenus();
    this.archivos.abrirXmlAutorizado(id);
  }

  descargarTodo(c: ComprobanteFactura): void {
    this.cerrarMenus();
    const numero = c.numeroComprobante || c.id;
    this.archivos.descargarTodo(c.id, numero);
  }
}
