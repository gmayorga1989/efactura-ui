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
import type { ClienteProveedor } from '../maestros/maestros.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import {
  FacturasService,
  type ComprobanteFactura,
  type FacturaItemPayload,
  type PuntoEmitir,
} from '../facturas/facturas.service';
import { DocumentosEmisionService, type GuiaRemisionPayload } from './documentos-emision.service';

@Component({
  selector: 'ts-documento-guia-nueva-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('documents.guideFormTitle')"
      [subtitle]="facturaOrigen()?.numeroComprobante ?? t('documents.guideFormSubtitle')"
      [eyebrow]="t('menu.sales')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="listadoLink">{{ t('common.back') }}</a>
        <button type="button" class="btn btn-soft-primary" (click)="guardar(false)" [disabled]="loading()">
          {{ t('invoice.saveDraft') }}
        </button>
        <button type="button" class="btn btn-success" (click)="guardar(true)" [disabled]="loading()">
          {{ loading() ? t('common.loading') : t('documents.guideEmitNow') }}
        </button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">{{ t('documents.companyRequired') }}</p>
      } @else if (!session.puedeGestionarVentas()) {
        <p class="text-muted mb-0">{{ t('documents.permissionRequired') }}</p>
      } @else {
      <form class="border rounded p-3" (ngSubmit)="guardar(false)">
        <p class="text-muted small mb-3">{{ t('documents.guideFormHint') }}</p>
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label" for="gr-punto">{{ t('documents.emissionPoint') }}</label>
            <select id="gr-punto" class="form-select" [(ngModel)]="puntoEmisionId" name="puntoEmisionId" required>
              @for (p of puntos(); track p.id) {
                <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="gr-fecha">{{ t('documents.date') }}</label>
            <input id="gr-fecha" type="date" class="form-control" [(ngModel)]="fechaEmision" name="fechaEmision" />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="gr-motivo">{{ t('documents.guideTransferReason') }}</label>
            <input id="gr-motivo" class="form-control" [(ngModel)]="motivoTraslado" name="motivoTraslado" required />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="gr-ruta">{{ t('documents.guideRoute') }}</label>
            <input id="gr-ruta" class="form-control" [(ngModel)]="ruta" name="ruta" />
          </div>
          <div class="col-12"><h3 class="h6 mb-0">{{ t('documents.guideTransportSection') }}</h3></div>
          <div class="col-md-6">
            <label class="form-label" for="gr-partida">{{ t('documents.guideDepartureAddress') }}</label>
            <input id="gr-partida" class="form-control" [(ngModel)]="dirPartida" name="dirPartida" required />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="gr-ttid">{{ t('documents.guideCarrierIdType') }}</label>
            <select id="gr-ttid" class="form-select" [(ngModel)]="tipoIdTransportista" name="tipoIdTransportista">
              <option value="04">04 — RUC</option>
              <option value="05">05 — Cedula</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="gr-tid">{{ t('documents.guideCarrierId') }}</label>
            <input id="gr-tid" class="form-control" [(ngModel)]="identificacionTransportista" name="identificacionTransportista" required />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="gr-trs">{{ t('documents.guideCarrierName') }}</label>
            <input id="gr-trs" class="form-control" [(ngModel)]="razonSocialTransportista" name="razonSocialTransportista" required />
          </div>
          <div class="col-md-2">
            <label class="form-label" for="gr-placa">{{ t('documents.guidePlate') }}</label>
            <input id="gr-placa" class="form-control" [(ngModel)]="placa" name="placa" required />
          </div>
          <div class="col-md-3">
            <label class="form-label" for="gr-fini">{{ t('documents.guideTransportStart') }}</label>
            <input id="gr-fini" type="date" class="form-control" [(ngModel)]="fechaIniTransporte" name="fechaIniTransporte" />
          </div>
          <div class="col-md-3">
            <label class="form-label" for="gr-ffin">{{ t('documents.guideTransportEnd') }}</label>
            <input id="gr-ffin" type="date" class="form-control" [(ngModel)]="fechaFinTransporte" name="fechaFinTransporte" />
          </div>
          <div class="col-12"><h3 class="h6 mb-0">{{ t('documents.guideDestinationSection') }}</h3></div>
          <div class="col-md-4">
            <label class="form-label" for="gr-cliente">{{ t('invoice.customerMaster') }}</label>
            <select id="gr-cliente" class="form-select" [value]="selectedClienteId" (change)="onCliente($any($event.target).value)">
              <option value="">{{ t('invoice.selectCustomer') }}</option>
              @for (c of clientes(); track c.id) {
                <option [value]="c.id">{{ c.identificacion }} — {{ c.razonSocial }}</option>
              }
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label" for="gr-dtid">{{ t('documents.receiverIdType') }}</label>
            <select id="gr-dtid" class="form-select" [(ngModel)]="tipoIdDestinatario" name="tipoIdDestinatario">
              <option value="04">04 — RUC</option>
              <option value="05">05 — Cedula</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="gr-did">{{ t('documents.receiverIdentification') }}</label>
            <input id="gr-did" class="form-control" [(ngModel)]="identificacionDestinatario" name="identificacionDestinatario" required />
          </div>
          <div class="col-md-3">
            <label class="form-label" for="gr-drs">{{ t('documents.businessName') }}</label>
            <input id="gr-drs" class="form-control" [(ngModel)]="razonSocialDestinatario" name="razonSocialDestinatario" required />
          </div>
          <div class="col-12">
            <label class="form-label" for="gr-ddir">{{ t('documents.guideDestinationAddress') }}</label>
            <input id="gr-ddir" class="form-control" [(ngModel)]="dirDestinatario" name="dirDestinatario" required />
          </div>
          <div class="col-12">
            <label class="form-label" for="gr-desc">{{ t('documents.guideItemDescription') }}</label>
            <input id="gr-desc" class="form-control" [(ngModel)]="itemDescripcion" name="itemDescripcion" required />
          </div>
          <div class="col-md-3">
            <label class="form-label" for="gr-cant">{{ t('invoice.quantity') }}</label>
            <input id="gr-cant" type="number" min="0.01" step="0.01" class="form-control" [(ngModel)]="itemCantidad" name="itemCantidad" />
          </div>
        </div>
      </form>
      }
    </ts-page-layout>
  `,
})
export class DocumentoGuiaNuevaPage implements OnInit {
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
  readonly clientes = signal<ClienteProveedor[]>([]);
  readonly facturaOrigen = signal<ComprobanteFactura | null>(null);
  readonly loading = signal(false);

  tokenPresent = false;
  tieneEmpresa = false;

  facturaSustentoId: string | undefined;
  listadoLink: (string | number)[] = [];
  selectedClienteId = '';
  puntoEmisionId = '';
  fechaEmision = new Date().toISOString().slice(0, 10);
  dirPartida = '';
  tipoIdTransportista = '04';
  identificacionTransportista = '';
  razonSocialTransportista = '';
  placa = '';
  fechaIniTransporte = fechaHoyIsoLocal();
  fechaFinTransporte = fechaHoyIsoLocal();
  tipoIdDestinatario = '04';
  identificacionDestinatario = '';
  razonSocialDestinatario = '';
  dirDestinatario = '';
  motivoTraslado = '';
  ruta = '';
  itemDescripcion = '';
  itemCantidad = 1;
  borradorId = '';
  readonly modo = signal<'nueva' | 'editar' | 'desdeFactura'>('nueva');

  ngOnInit(): void {
    const slug = this.tenant.tenantSlug();
    this.listadoLink = ['/t', slug, 'ventas', 'guias'];
    const mode = (this.route.snapshot.data['mode'] as string) ?? 'nueva';
    this.modo.set(mode === 'editar' ? 'editar' : mode === 'desdeFactura' ? 'desdeFactura' : 'nueva');
    this.tokenPresent = !!readAccessToken();
    this.tieneEmpresa = !!this.session.profile()?.empresaId;
    if (!this.tokenPresent || !this.tieneEmpresa || !this.session.puedeGestionarVentas()) {
      return;
    }
    const idParam = this.route.snapshot.paramMap.get('id') ?? undefined;
    if (this.modo() === 'editar' && idParam) {
      this.borradorId = idParam;
      this.facturas.obtenerComprobante(idParam).subscribe({
        next: (c) => this.cargarBorrador(c),
        error: () => this.toast.error(this.t('documents.guideFormError')),
      });
    } else if (this.modo() === 'desdeFactura' && idParam) {
      this.facturaSustentoId = idParam;
      this.facturas.obtenerComprobante(idParam).subscribe({
        next: (f) => this.prefillFromFactura(f),
        error: () => this.facturaOrigen.set(null),
      });
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
    this.catalogos.listarClientes().subscribe({
      next: (rows) => this.clientes.set(rows),
    });
    this.motivoTraslado = this.t('documents.guideDefaultReason');
  }

  private cargarBorrador(c: ComprobanteFactura): void {
    if ((c.tipo ?? '').toUpperCase() !== 'GUIA_REMISION' || c.estadoSri !== 'BORRADOR') {
      this.toast.warning(this.t('invoice.editDraftOnly'));
      return;
    }
    const cd = c.customData ?? {};
    if (cd['puntoEmisionId']) {
      this.puntoEmisionId = String(cd['puntoEmisionId']);
    }
    this.fechaEmision = String(c.fechaEmision ?? '').slice(0, 10) || this.fechaEmision;
    this.dirPartida = String(cd['dirPartida'] ?? '');
    this.tipoIdTransportista = String(cd['tipoIdentificacionTransportista'] ?? '04');
    this.identificacionTransportista = String(cd['identificacionTransportista'] ?? '');
    this.razonSocialTransportista = String(cd['razonSocialTransportista'] ?? '');
    this.placa = String(cd['placa'] ?? '');
    this.fechaIniTransporte = String(cd['fechaIniTransporte'] ?? '').slice(0, 10) || this.fechaIniTransporte;
    this.fechaFinTransporte = String(cd['fechaFinTransporte'] ?? '').slice(0, 10) || this.fechaFinTransporte;
    this.tipoIdDestinatario = String(cd['tipoIdentificacionDestinatario'] ?? '04');
    this.identificacionDestinatario = c.identificacionReceptor;
    this.razonSocialDestinatario = c.razonSocialReceptor;
    this.dirDestinatario = String(cd['dirDestinatario'] ?? '');
    this.motivoTraslado = String(cd['motivoTraslado'] ?? '');
    this.ruta = String(cd['ruta'] ?? '');
    if (cd['facturaSustentoId']) {
      this.facturaSustentoId = String(cd['facturaSustentoId']);
    }
    const lineas = this.facturas.comprobanteToLineas(c);
    if (lineas.length) {
      this.itemDescripcion = lineas.map((l) => l.descripcion).join('; ');
      this.itemCantidad = lineas.reduce((s, l) => s + l.cantidad, 0) || 1;
    }
  }

  private prefillFromFactura(f: ComprobanteFactura): void {
    this.facturaOrigen.set(f);
    const cd = f.customData ?? {};
    if (cd['puntoEmisionId']) {
      this.puntoEmisionId = String(cd['puntoEmisionId']);
    }
    this.tipoIdDestinatario = String(cd['tipoIdentificacionReceptor'] ?? '04');
    this.identificacionDestinatario = f.identificacionReceptor;
    this.razonSocialDestinatario = f.razonSocialReceptor;
    this.dirDestinatario = String(cd['direccionReceptor'] ?? '');
    const lineas = this.facturas.comprobanteToLineas(f);
    if (lineas.length) {
      this.itemDescripcion = lineas.map((l) => l.descripcion).join('; ');
      this.itemCantidad = lineas.reduce((s, l) => s + l.cantidad, 0) || 1;
    }
  }

  onCliente(id: string): void {
    this.selectedClienteId = id;
    const c = this.clientes().find((x) => x.id === id);
    if (!c) {
      return;
    }
    this.tipoIdDestinatario = c.tipoIdentificacion ?? '04';
    this.identificacionDestinatario = c.identificacion;
    this.razonSocialDestinatario = c.razonSocial;
    this.dirDestinatario = c.direccion ?? '';
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  guardar(emitir: boolean): void {
    if (!this.validar()) {
      this.toast.error(this.t('documents.guideFormInvalid'));
      return;
    }
    const items: FacturaItemPayload[] = [
      {
        codigoPrincipal: 'TRASLADO',
        descripcion: this.itemDescripcion.trim(),
        cantidad: this.itemCantidad,
        precioUnitario: 0,
        descuento: 0,
        ivaPorcentaje: 0,
        ivaCodigoPorcentaje: '0',
      },
    ];
    const body: GuiaRemisionPayload = {
      puntoEmisionId: this.puntoEmisionId,
      fechaEmision: this.fechaEmision,
      dirPartida: this.dirPartida.trim(),
      tipoIdentificacionTransportista: this.tipoIdTransportista,
      identificacionTransportista: this.identificacionTransportista.trim(),
      razonSocialTransportista: this.razonSocialTransportista.trim(),
      fechaIniTransporte: this.fechaIniTransporte,
      fechaFinTransporte: this.fechaFinTransporte,
      placa: this.placa.trim(),
      tipoIdentificacionDestinatario: this.tipoIdDestinatario,
      identificacionDestinatario: this.identificacionDestinatario.trim(),
      razonSocialDestinatario: this.razonSocialDestinatario.trim(),
      dirDestinatario: this.dirDestinatario.trim(),
      motivoTraslado: this.motivoTraslado.trim(),
      facturaSustentoId: this.facturaSustentoId,
      items,
      customData: this.ruta.trim() ? { ruta: this.ruta.trim() } : undefined,
    };
    this.loading.set(true);
    const req =
      this.borradorId
        ? this.documentos.actualizarBorradorGuia(this.borradorId, body)
        : this.documentos.guardarBorradorGuia(body);
    req.subscribe({
      next: (b) => this.afterBorrador(b.id, emitir),
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('documents.guideFormError'));
      },
    });
  }

  private validar(): boolean {
    return !!(
      this.puntoEmisionId &&
      this.dirPartida.trim() &&
      this.identificacionTransportista.trim() &&
      this.razonSocialTransportista.trim() &&
      this.placa.trim() &&
      this.identificacionDestinatario.trim() &&
      this.razonSocialDestinatario.trim() &&
      this.dirDestinatario.trim() &&
      this.motivoTraslado.trim() &&
      this.itemDescripcion.trim() &&
      this.itemCantidad > 0
    );
  }

  private afterBorrador(id: string, emitir: boolean): void {
    if (!emitir) {
      this.loading.set(false);
      this.toast.success(this.t('documents.guideFormCreated'));
      void this.router.navigate(this.listadoLink);
      return;
    }
    this.documentos.emitirBorrador('guias', id).subscribe({
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
