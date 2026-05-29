import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FacturasService, type ComprobanteFactura } from '../facturas/facturas.service';
import type { RetencionImpuestoPayload } from './documentos-emision.service';
import { readAccessToken } from '../../core/auth.interceptor';
import { fechaHoyIsoLocal } from '../../core/util/fecha-local.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ComprobanteCatalogosService } from '../comprobantes/comprobante-catalogos.service';
import type { ClienteProveedor } from '../maestros/maestros.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import type { PuntoEmitir } from '../facturas/facturas.service';
import { DocumentosEmisionService, type RetencionPayload } from './documentos-emision.service';

@Component({
  selector: 'ts-documento-retencion-nueva-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('documents.withholdingFormTitle')"
      [subtitle]="t('documents.withholdingFormSubtitle')"
      [eyebrow]="t('menu.suppliers')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="listadoLink">{{ t('common.back') }}</a>
        <button type="button" class="btn btn-soft-primary" (click)="guardar(false)" [disabled]="loading()">
          {{ t('invoice.saveDraft') }}
        </button>
        <button type="button" class="btn btn-success" (click)="guardar(true)" [disabled]="loading()">
          {{ loading() ? t('common.loading') : t('documents.withholdingEmitNow') }}
        </button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">{{ t('documents.companyRequired') }}</p>
      } @else if (!session.puedeGestionarProveedores()) {
        <p class="text-muted mb-0">{{ t('documents.permissionRequired') }}</p>
      } @else {
      <form class="border rounded p-3" (ngSubmit)="guardar(false)">
        <p class="text-muted small mb-3">{{ t('documents.withholdingFormHint') }}</p>
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label" for="ret-punto">{{ t('documents.emissionPoint') }}</label>
            <select id="ret-punto" class="form-select" [(ngModel)]="puntoEmisionId" name="puntoEmisionId" required>
              @for (p of puntos(); track p.id) {
                <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="ret-fecha">{{ t('documents.date') }}</label>
            <input id="ret-fecha" type="date" class="form-control" [(ngModel)]="fechaEmision" name="fechaEmision" />
          </div>
          <div class="col-md-3">
            <label class="form-label" for="ret-periodo">{{ t('documents.withholdingFiscalPeriod') }}</label>
            <input id="ret-periodo" class="form-control" [(ngModel)]="periodoFiscal" name="periodoFiscal" placeholder="MM/AAAA" required />
          </div>
          <div class="col-md-3">
            <label class="form-label" for="ret-prov">{{ t('documents.withholdingSupplier') }}</label>
            <select id="ret-prov" class="form-select" [value]="selectedProveedorId" (change)="onProveedor($any($event.target).value)">
              <option value="">{{ t('documents.selectReceiver') }}</option>
              @for (p of proveedores(); track p.id) {
                <option [value]="p.id">{{ p.identificacion }} — {{ p.razonSocial }}</option>
              }
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="ret-tid">{{ t('documents.receiverIdType') }}</label>
            <select id="ret-tid" class="form-select" [(ngModel)]="tipoIdSujeto" name="tipoIdSujeto">
              <option value="04">04 — RUC</option>
              <option value="05">05 — Cedula</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="ret-id">{{ t('documents.receiverIdentification') }}</label>
            <input id="ret-id" class="form-control" [(ngModel)]="identificacionSujeto" name="identificacionSujeto" required />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="ret-rs">{{ t('documents.businessName') }}</label>
            <input id="ret-rs" class="form-control" [(ngModel)]="razonSocialSujeto" name="razonSocialSujeto" required />
          </div>
          <div class="col-12 d-flex justify-content-between align-items-center">
            <h3 class="h6 mb-0">{{ t('documents.withholdingTaxSection') }}</h3>
            <button type="button" class="btn btn-sm btn-soft-primary" (click)="agregarLinea()">{{ t('documents.withholdingAddLine') }}</button>
          </div>
          @for (linea of impuestos; track $index; let i = $index) {
            <div class="col-12 border-top pt-2">
              <div class="row g-2 align-items-end">
                <div class="col-md-1"><label class="form-label">{{ t('documents.withholdingTaxCode') }}</label><input class="form-control" [(ngModel)]="linea.codigo" [name]="'cod'+i" /></div>
                <div class="col-md-2"><label class="form-label">{{ t('documents.withholdingRetentionCode') }}</label><input class="form-control" [(ngModel)]="linea.codigoRetencion" [name]="'cret'+i" /></div>
                <div class="col-md-2"><label class="form-label">{{ t('documents.withholdingTaxBase') }}</label><input type="number" class="form-control" [(ngModel)]="linea.baseImponible" [name]="'base'+i" (ngModelChange)="recalcularLinea(i)" /></div>
                <div class="col-md-2"><label class="form-label">{{ t('documents.withholdingPercent') }}</label><input type="number" class="form-control" [(ngModel)]="linea.porcentajeRetener" [name]="'pct'+i" (ngModelChange)="recalcularLinea(i)" /></div>
                <div class="col-md-2"><label class="form-label">{{ t('documents.withholdingAmount') }}</label><input type="number" class="form-control" [(ngModel)]="linea.valorRetenido" [name]="'val'+i" /></div>
                <div class="col-md-2"><label class="form-label">{{ t('documents.withholdingSupportDoc') }}</label><input class="form-control" [(ngModel)]="linea.numDocSustento" [name]="'doc'+i" /></div>
                @if (impuestos.length > 1) { <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger w-100" (click)="quitarLinea(i)">×</button></div> }
              </div>
            </div>
          }
        </div>
      </form>
      }
    </ts-page-layout>
  `,
})
export class DocumentoRetencionNuevaPage implements OnInit {
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

  listadoLink: (string | number)[] = [];
  borradorId = '';
  selectedProveedorId = '';
  puntoEmisionId = '';
  fechaEmision = fechaHoyIsoLocal();
  periodoFiscal = '';
  tipoIdSujeto = '04';
  identificacionSujeto = '';
  razonSocialSujeto = '';
  impCodigo = '1';
  impCodigoRetencion = '303';
  impBase = 0;
  impPorcentaje = 1;
  impValor = 0;
  numDocSustento = '';
  impuestos: RetencionImpuestoPayload[] = [this.nuevaLineaRetencion()];

  ngOnInit(): void {
    const slug = this.tenant.tenantSlug();
    this.listadoLink = ['/t', slug, 'proveedores', 'retenciones'];
    const mode = this.route.snapshot.data['mode'] as string;
    const idParam = this.route.snapshot.paramMap.get('id');
    if (mode === 'editar' && idParam) {
      this.borradorId = idParam;
    }
    const now = new Date();
    this.periodoFiscal = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
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
    if (this.borradorId) {
      this.facturas.obtenerComprobante(this.borradorId).subscribe({
        next: (c) => this.cargarBorrador(c),
        error: () => this.toast.error(this.t('documents.withholdingFormError')),
      });
    }
  }

  private nuevaLineaRetencion(): RetencionImpuestoPayload {
    return {
      codigo: '1',
      codigoRetencion: '303',
      baseImponible: 0,
      porcentajeRetener: 1,
      valorRetenido: 0,
      numDocSustento: '',
    };
  }

  agregarLinea(): void {
    this.impuestos = [...this.impuestos, this.nuevaLineaRetencion()];
  }

  quitarLinea(index: number): void {
    if (this.impuestos.length <= 1) {
      return;
    }
    this.impuestos = this.impuestos.filter((_, i) => i !== index);
  }

  private cargarBorrador(c: ComprobanteFactura): void {
    if ((c.tipo ?? '').toUpperCase() !== 'RETENCION' || c.estadoSri !== 'BORRADOR') {
      this.toast.warning(this.t('invoice.editDraftOnly'));
      return;
    }
    const cd = c.customData ?? {};
    if (cd['puntoEmisionId']) {
      this.puntoEmisionId = String(cd['puntoEmisionId']);
    }
    this.periodoFiscal = String(cd['periodoFiscal'] ?? this.periodoFiscal);
    this.tipoIdSujeto = String(cd['tipoIdentificacionSujetoRetenido'] ?? '04');
    this.identificacionSujeto = c.identificacionReceptor;
    this.razonSocialSujeto = c.razonSocialReceptor;
    if (c.fechaEmision) {
      this.fechaEmision = String(c.fechaEmision).slice(0, 10);
    }
    const raw = cd['impuestos'];
    if (Array.isArray(raw) && raw.length) {
      this.impuestos = raw.map((row) => ({
        codigo: String((row as Record<string, unknown>)['codigo'] ?? '1'),
        codigoRetencion: String((row as Record<string, unknown>)['codigoRetencion'] ?? ''),
        baseImponible: Number((row as Record<string, unknown>)['baseImponible'] ?? 0),
        porcentajeRetener: Number((row as Record<string, unknown>)['porcentajeRetener'] ?? 0),
        valorRetenido: Number((row as Record<string, unknown>)['valorRetenido'] ?? 0),
        numDocSustento: String((row as Record<string, unknown>)['numDocSustento'] ?? ''),
      }));
    }
  }

  onProveedor(id: string): void {
    this.selectedProveedorId = id;
    const p = this.proveedores().find((x) => x.id === id);
    if (!p) {
      return;
    }
    this.tipoIdSujeto = p.tipoIdentificacion ?? '04';
    this.identificacionSujeto = p.identificacion;
    this.razonSocialSujeto = p.razonSocial;
  }

  recalcular(): void {
    this.recalcularLinea(0);
  }

  recalcularLinea(index: number): void {
    const linea = this.impuestos[index];
    if (!linea) {
      return;
    }
    linea.valorRetenido = Math.round(linea.baseImponible * (linea.porcentajeRetener / 100) * 100) / 100;
    this.impuestos = [...this.impuestos];
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  guardar(emitir: boolean): void {
    if (!this.validar()) {
      this.toast.error(this.t('documents.withholdingFormInvalid'));
      return;
    }
    const body: RetencionPayload = {
      puntoEmisionId: this.puntoEmisionId,
      fechaEmision: this.fechaEmision,
      periodoFiscal: this.periodoFiscal.trim(),
      tipoIdentificacionSujetoRetenido: this.tipoIdSujeto,
      identificacionSujetoRetenido: this.identificacionSujeto.trim(),
      razonSocialSujetoRetenido: this.razonSocialSujeto.trim(),
      impuestos: this.impuestos.map((l) => ({
        codigo: l.codigo.trim(),
        codigoRetencion: l.codigoRetencion.trim(),
        baseImponible: l.baseImponible,
        porcentajeRetener: l.porcentajeRetener,
        valorRetenido: l.valorRetenido,
        numDocSustento: l.numDocSustento?.trim() || undefined,
      })),
    };
    this.loading.set(true);
    const req = this.borradorId
      ? this.documentos.actualizarBorradorRetencion(this.borradorId, body)
      : this.documentos.guardarBorradorRetencion(body);
    req.subscribe({
      next: (b) => this.afterBorrador(b.id, emitir),
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('documents.withholdingFormError'));
      },
    });
  }

  private validar(): boolean {
    if (
      !this.puntoEmisionId ||
      !/^\d{2}\/\d{4}$/.test(this.periodoFiscal.trim()) ||
      !this.identificacionSujeto.trim() ||
      !this.razonSocialSujeto.trim()
    ) {
      return false;
    }
    return this.impuestos.every(
      (l) =>
        l.codigo.trim() &&
        l.codigoRetencion.trim() &&
        l.baseImponible >= 0 &&
        l.valorRetenido >= 0,
    );
  }

  private afterBorrador(id: string, emitir: boolean): void {
    if (!emitir) {
      this.loading.set(false);
      this.toast.success(this.t('documents.withholdingFormCreated'));
      void this.router.navigate(this.listadoLink);
      return;
    }
    this.documentos.emitirBorrador('retenciones', id).subscribe({
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
