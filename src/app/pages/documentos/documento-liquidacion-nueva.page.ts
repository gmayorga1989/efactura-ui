import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FacturasService, type ComprobanteFactura } from '../facturas/facturas.service';
import { readAccessToken } from '../../core/auth.interceptor';
import { fechaHoyIsoLocal } from '../../core/util/fecha-local.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ComprobanteCatalogosService } from '../comprobantes/comprobante-catalogos.service';
import type { ClienteProveedor } from '../maestros/maestros.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import type { FacturaEmitPayload, FacturaItemPayload, PuntoEmitir } from '../facturas/facturas.service';
import { DocumentosEmisionService } from './documentos-emision.service';

@Component({
  selector: 'ts-documento-liquidacion-nueva-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('documents.settlementFormTitle')"
      [subtitle]="t('documents.settlementFormSubtitle')"
      [eyebrow]="t('menu.suppliers')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="listadoLink">{{ t('common.back') }}</a>
        <button type="button" class="btn btn-soft-primary" (click)="guardar(false)" [disabled]="loading()">
          {{ t('invoice.saveDraft') }}
        </button>
        <button type="button" class="btn btn-success" (click)="guardar(true)" [disabled]="loading()">
          {{ loading() ? t('common.loading') : t('documents.settlementEmitNow') }}
        </button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">{{ t('documents.companyRequired') }}</p>
      } @else if (!session.puedeGestionarProveedores()) {
        <p class="text-muted mb-0">{{ t('documents.permissionRequired') }}</p>
      } @else {
      <form class="border rounded p-3" (ngSubmit)="guardar(false)">
        <p class="text-muted small mb-3">{{ t('documents.settlementFormHint') }}</p>
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label" for="liq-punto">{{ t('documents.emissionPoint') }}</label>
            <select id="liq-punto" class="form-select" [(ngModel)]="puntoEmisionId" name="puntoEmisionId" required>
              @for (p of puntos(); track p.id) {
                <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="liq-fecha">{{ t('documents.date') }}</label>
            <input id="liq-fecha" type="date" class="form-control" [(ngModel)]="fechaEmision" name="fechaEmision" />
          </div>
          <div class="col-md-6">
            <label class="form-label" for="liq-prov">{{ t('documents.settlementSupplier') }}</label>
            <select id="liq-prov" class="form-select" [value]="selectedProveedorId" (change)="onProveedor($any($event.target).value)">
              <option value="">{{ t('documents.selectReceiver') }}</option>
              @for (p of proveedores(); track p.id) {
                <option [value]="p.id">{{ p.identificacion }} — {{ p.razonSocial }}</option>
              }
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="liq-tid">{{ t('documents.receiverIdType') }}</label>
            <select id="liq-tid" class="form-select" [(ngModel)]="tipoIdReceptor" name="tipoIdReceptor">
              <option value="04">04 — RUC</option>
              <option value="05">05 — Cedula</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="liq-id">{{ t('documents.receiverIdentification') }}</label>
            <input id="liq-id" class="form-control" [(ngModel)]="identificacionReceptor" name="identificacionReceptor" required />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="liq-rs">{{ t('documents.businessName') }}</label>
            <input id="liq-rs" class="form-control" [(ngModel)]="razonSocialReceptor" name="razonSocialReceptor" required />
          </div>
          <div class="col-12"><h3 class="h6 mb-0">{{ t('documents.settlementLineSection') }}</h3></div>
          <div class="col-md-4">
            <label class="form-label" for="liq-desc">{{ t('masters.description') }}</label>
            <input id="liq-desc" class="form-control" [(ngModel)]="lineaDescripcion" name="lineaDescripcion" required />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="liq-cant">{{ t('invoice.quantity') }}</label>
            <input id="liq-cant" type="number" min="0.01" step="0.01" class="form-control" [(ngModel)]="lineaCantidad" name="lineaCantidad" (ngModelChange)="recalcular()" />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="liq-precio">{{ t('invoice.unitPriceShort') }}</label>
            <input id="liq-precio" type="number" min="0" step="0.01" class="form-control" [(ngModel)]="lineaPrecio" name="lineaPrecio" (ngModelChange)="recalcular()" />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="liq-iva">IVA %</label>
            <select id="liq-iva" class="form-select" [(ngModel)]="lineaIva" name="lineaIva" (ngModelChange)="recalcular()">
              <option [ngValue]="0">0%</option>
              <option [ngValue]="12">12%</option>
              <option [ngValue]="15">15%</option>
            </select>
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <p class="mb-0 small text-muted">
              {{ t('documents.total') }}: <strong>{{ total() | number: '1.2-2' }}</strong>
            </p>
          </div>
        </div>
      </form>
      }
    </ts-page-layout>
  `,
})
export class DocumentoLiquidacionNuevaPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facturas = inject(FacturasService);
  private readonly catalogos = inject(ComprobanteCatalogosService);
  private readonly documentos = inject(DocumentosEmisionService);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly puntos = signal<PuntoEmitir[]>([]);
  readonly proveedores = signal<ClienteProveedor[]>([]);
  readonly loading = signal(false);

  tokenPresent = false;
  tieneEmpresa = false;

  readonly total = computed(() => {
    const base = this.lineaCantidad * this.lineaPrecio;
    return base + base * (this.lineaIva / 100);
  });

  listadoLink: (string | number)[] = [];
  borradorId = '';
  selectedProveedorId = '';
  puntoEmisionId = '';
  fechaEmision = fechaHoyIsoLocal();
  tipoIdReceptor = '04';
  identificacionReceptor = '';
  razonSocialReceptor = '';
  lineaDescripcion = '';
  lineaCantidad = 1;
  lineaPrecio = 0;
  lineaIva = 15;

  ngOnInit(): void {
    const slug = this.tenant.tenantSlug();
    this.listadoLink = ['/t', slug, 'proveedores', 'liquidaciones'];
    this.tokenPresent = !!readAccessToken();
    this.tieneEmpresa = !!this.session.profile()?.empresaId;
    if (!this.tokenPresent || !this.tieneEmpresa || !this.session.puedeGestionarProveedores()) {
      return;
    }
    this.catalogos.listarPuntos().subscribe({
      next: (p) => {
        this.puntos.set(p);
        if (!p.length) {
          this.toast.error(this.t('invoice.pointsLoadError'));
        } else {
          this.puntoEmisionId = p[0]?.id ?? '';
        }
      },
      error: () => {
        this.puntos.set([]);
        this.toast.error(this.t('invoice.pointsLoadError'));
      },
    });
    this.catalogos.listarProveedores().subscribe({
      next: (rows) => this.proveedores.set(rows),
    });
    const mode = this.route.snapshot.data['mode'] as string;
    const idParam = this.route.snapshot.paramMap.get('id');
    if (mode === 'editar' && idParam) {
      this.borradorId = idParam;
      this.facturas.obtenerComprobante(idParam).subscribe({
        next: (c) => this.cargarBorrador(c),
        error: () => this.toast.error(this.t('documents.settlementFormError')),
      });
    }
  }

  private cargarBorrador(c: ComprobanteFactura): void {
    if ((c.tipo ?? '').toUpperCase() !== 'LIQUIDACION_COMPRA' || c.estadoSri !== 'BORRADOR') {
      this.toast.warning(this.t('invoice.editDraftOnly'));
      return;
    }
    const cd = c.customData ?? {};
    if (cd['puntoEmisionId']) {
      this.puntoEmisionId = String(cd['puntoEmisionId']);
    }
    this.tipoIdReceptor = String(cd['tipoIdentificacionReceptor'] ?? '04');
    this.identificacionReceptor = c.identificacionReceptor;
    this.razonSocialReceptor = c.razonSocialReceptor;
    if (c.fechaEmision) {
      this.fechaEmision = String(c.fechaEmision).slice(0, 10);
    }
    const lineas = this.facturas.comprobanteToLineas(c);
    if (lineas.length) {
      const l = lineas[0];
      this.lineaDescripcion = l.descripcion;
      this.lineaCantidad = l.cantidad;
      this.lineaPrecio = l.precioUnitario;
      this.lineaIva = l.ivaPorcentaje ?? 15;
    }
  }

  onProveedor(id: string): void {
    this.selectedProveedorId = id;
    const p = this.proveedores().find((x) => x.id === id);
    if (!p) {
      return;
    }
    this.tipoIdReceptor = p.tipoIdentificacion ?? '04';
    this.identificacionReceptor = p.identificacion;
    this.razonSocialReceptor = p.razonSocial;
  }

  recalcular(): void {
    /* total via computed */
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  guardar(emitir: boolean): void {
    if (!this.validar()) {
      this.toast.error(this.t('documents.settlementFormInvalid'));
      return;
    }
    const ivaCodigo = this.lineaIva === 0 ? '0' : this.lineaIva === 12 ? '2' : '4';
    const items: FacturaItemPayload[] = [
      {
        codigoPrincipal: 'LIQ',
        descripcion: this.lineaDescripcion.trim(),
        cantidad: this.lineaCantidad,
        precioUnitario: this.lineaPrecio,
        descuento: 0,
        ivaPorcentaje: this.lineaIva,
        ivaCodigoPorcentaje: ivaCodigo,
      },
    ];
    const body: FacturaEmitPayload = {
      puntoEmisionId: this.puntoEmisionId,
      fechaEmision: this.fechaEmision,
      tipoIdentificacionReceptor: this.tipoIdReceptor,
      identificacionReceptor: this.identificacionReceptor.trim(),
      razonSocialReceptor: this.razonSocialReceptor.trim(),
      items,
    };
    this.loading.set(true);
    const req = this.borradorId
      ? this.documentos.actualizarBorradorLiquidacion(this.borradorId, body)
      : this.documentos.guardarBorradorLiquidacion(body);
    req.subscribe({
      next: (b) => this.afterBorrador(b.id, emitir),
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('documents.settlementFormError'));
      },
    });
  }

  private validar(): boolean {
    return !!(
      this.puntoEmisionId &&
      this.identificacionReceptor.trim() &&
      this.razonSocialReceptor.trim() &&
      this.lineaDescripcion.trim() &&
      this.lineaCantidad > 0 &&
      this.lineaPrecio >= 0
    );
  }

  private afterBorrador(id: string, emitir: boolean): void {
    if (!emitir) {
      this.loading.set(false);
      this.toast.success(this.t('documents.settlementFormCreated'));
      void this.router.navigate(this.listadoLink);
      return;
    }
    this.documentos.emitirBorrador('liquidaciones', id).subscribe({
      next: (e) => {
        this.loading.set(false);
        this.toast.success(this.t('documents.emittedToSri', { status: e.estadoSri }));
        void this.router.navigate(this.listadoLink);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('documents.emitToSriError'));
      },
    });
  }
}
