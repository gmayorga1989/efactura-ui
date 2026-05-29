import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fechaHoyIsoLocal } from '../../core/util/fecha-local.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsFacturaLineasTabulatorComponent } from '../../shared/ui/organisms/ts-factura-lineas-tabulator/ts-factura-lineas-tabulator.component';
import { TsRichTextEditorComponent } from '../../shared/ui/molecules/ts-rich-text-editor/ts-rich-text-editor.component';
import { TsCotizacionAdjuntosComponent } from '../../shared/ui/organisms/ts-cotizacion-adjuntos/ts-cotizacion-adjuntos.component';
import { badgeClaseEstadoCotizacion, etiquetaEstadoCotizacion } from '../../shared/ui/cotizacion-estado.util';
import { type FacturaLinea, type PuntoEmitir } from '../facturas/facturas.service';
import { ComprobanteCatalogosService } from '../comprobantes/comprobante-catalogos.service';
import { MaestrosService, type ProductoServicio } from '../maestros/maestros.service';
import { VendedoresService, type VendedorDto } from '../vendedores/vendedores.service';
import {
  CotizacionesService,
  type CotizacionAdjuntoDto,
  type CotizacionPayload,
} from './cotizaciones.service';

@Component({
  selector: 'ts-cotizacion-form-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TsPageLayoutComponent,
    TsFacturaLineasTabulatorComponent,
    TsRichTextEditorComponent,
    TsCotizacionAdjuntosComponent,
  ],
  template: `
    <ts-page-layout [title]="pageTitle()" [subtitle]="t('quotation.formSubtitle')" [eyebrow]="t('menu.sales')">
      <div page-actions class="d-flex flex-wrap align-items-center gap-2">
        @if (cotizacionId()) {
          <span [class]="badgeEstado(estado()) + ' me-1'">
            <span class="ts-sri-badge__dot" aria-hidden="true"></span>
            {{ etiquetaEstado(estado()) }}
          </span>
        }
        <a class="btn btn-light" [routerLink]="listLink">{{ t('common.cancel') }}</a>
        <a class="btn btn-outline-secondary" [routerLink]="['/t', tenant.tenantSlug(), 'ventas', 'cotizaciones', 'diseno']">
          {{ t('quotation.design') }}
        </a>
        @if (cotizacionId() && estado() !== 'CONVERTIDA') {
          <a class="btn btn-outline-secondary" [href]="previewHref()" target="_blank" rel="noopener">{{ t('quotation.preview') }}</a>
        }
        <button type="button" class="btn btn-soft-primary" (click)="guardar()" [disabled]="loading()">{{ t('common.save') }}</button>
        @if (cotizacionId() && estado() !== 'CONVERTIDA' && estado() !== 'ANULADA') {
          @if (puedeAceptar()) {
            <button type="button" class="btn btn-outline-success" (click)="aceptar()" [disabled]="loading()">
              {{ t('quotation.accept') }}
            </button>
          }
          @if (puedeRechazar()) {
            <button type="button" class="btn btn-outline-danger" (click)="rechazar()" [disabled]="loading()">
              {{ t('quotation.reject') }}
            </button>
          }
          <button type="button" class="btn btn-success" (click)="abrirConvertir()" [disabled]="loading()">
            {{ t('quotation.convertInvoice') }}
          </button>
          <button type="button" class="btn btn-primary" (click)="abrirEnviar()" [disabled]="loading()">
            {{ t('quotation.sendEmail') }}
          </button>
        }
      </div>

      <form class="row g-4" (ngSubmit)="guardar()">
        <div class="col-lg-8">
          <section class="card border-0 shadow-sm">
            <div class="card-body">
              <h2 class="h6 mb-3">{{ t('invoice.sectionHeader') }}</h2>
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label">{{ t('documents.date') }}</label>
                  <input type="date" class="form-control" [(ngModel)]="cabecera.fechaEmision" name="fecha" required />
                </div>
                <div class="col-md-4">
                  <label class="form-label">{{ t('quotation.validityDays') }}</label>
                  <input type="number" min="1" class="form-control" [(ngModel)]="cabecera.validezDias" name="validez" />
                </div>
                <div class="col-md-4">
                  <label class="form-label">{{ t('salespeople.label') }}</label>
                  <select class="form-select" [(ngModel)]="cabecera.vendedorId" name="vendedor">
                    <option value="">{{ t('common.none') }}</option>
                    @for (v of vendedores(); track v.id) {
                      <option [value]="v.id">{{ etiquetaVendedor(v) }}</option>
                    }
                  </select>
                  <small class="text-muted">{{ t('quotation.sellerHint') }}</small>
                </div>
                <div class="col-md-3">
                  <label class="form-label">{{ t('documents.idType') }}</label>
                  <select class="form-select" [(ngModel)]="cabecera.tipoId" name="tipoId" required>
                    <option value="04">RUC</option>
                    <option value="05">Cédula</option>
                    <option value="06">Pasaporte</option>
                    <option value="07">Consumidor final</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="form-label">{{ t('documents.idNumber') }}</label>
                  <input class="form-control" [(ngModel)]="cabecera.identificacion" name="identificacion" required />
                </div>
                <div class="col-md-6">
                  <label class="form-label">{{ t('documents.receiver') }}</label>
                  <input class="form-control" [(ngModel)]="cabecera.razonSocial" name="razonSocial" required />
                </div>
                <div class="col-md-6">
                  <label class="form-label">{{ t('documents.email') }}</label>
                  <input type="email" class="form-control" [(ngModel)]="cabecera.email" name="email" />
                </div>
              </div>
            </div>
          </section>

          <section class="card border-0 shadow-sm mt-3">
            <div class="card-body">
              <h2 class="h6 mb-3">{{ t('quotation.lines') }}</h2>
              <ts-factura-lineas-tabulator
                [lineas]="lineas()"
                [itemsMaestro]="productos()"
                (lineasChange)="lineas.set($event)"
              />
            </div>
          </section>

          <section class="card border-0 shadow-sm mt-3">
            <div class="card-body">
              <h2 class="h6 mb-3">{{ t('quotation.intro') }}</h2>
              <ts-rich-text-editor [(ngModel)]="introHtml" name="intro" />
              <h2 class="h6 mt-4 mb-3">{{ t('quotation.conditions') }}</h2>
              <ts-rich-text-editor [(ngModel)]="condicionesHtml" name="condiciones" />
            </div>
          </section>
        </div>

        <div class="col-lg-4">
          <section class="card border-0 shadow-sm">
            <div class="card-body">
              <h2 class="h6 mb-3">{{ t('quotation.attachments') }}</h2>
              <ts-cotizacion-adjuntos
                [cotizacionId]="cotizacionId()"
                [adjuntos]="adjuntosList()"
                (adjuntosChange)="adjuntosList.set($event)"
                (uploaded)="onAdjuntoSubido($event)"
              />
            </div>
          </section>
        </div>
      </form>

      @if (modalConvertir()) {
        <div class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.45)">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">{{ t('quotation.convertInvoice') }}</h5>
                <button type="button" class="btn-close" (click)="modalConvertir.set(false)"></button>
              </div>
              <div class="modal-body">
                <label class="form-label">{{ t('documents.emissionPoint') }}</label>
                <select class="form-select" [(ngModel)]="puntoEmisionId" name="puntoConv">
                  @for (p of puntos(); track p.id) {
                    <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }}</option>
                  }
                </select>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" (click)="modalConvertir.set(false)">{{ t('common.cancel') }}</button>
                <button type="button" class="btn btn-success" (click)="convertir()">{{ t('quotation.convertInvoice') }}</button>
              </div>
            </div>
          </div>
        </div>
      }

      @if (modalCorreo()) {
        <div class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.45)">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">{{ t('quotation.sendEmail') }}</h5>
                <button type="button" class="btn-close" (click)="modalCorreo.set(false)"></button>
              </div>
              <div class="modal-body">
                <label class="form-label">{{ t('documents.email') }}</label>
                <input class="form-control" [(ngModel)]="correoDestino" name="correoDest" />
                <label class="form-label mt-2">{{ t('quotation.emailNote') }}</label>
                <textarea class="form-control" rows="3" [(ngModel)]="correoNota" name="correoNota"></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" (click)="modalCorreo.set(false)">{{ t('common.cancel') }}</button>
                <button type="button" class="btn btn-primary" (click)="enviarCorreo()">{{ t('quotation.sendEmail') }}</button>
              </div>
            </div>
          </div>
        </div>
      }
    </ts-page-layout>
  `,
})
export class CotizacionFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly tenant = inject(TenantContextService);
  readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  private readonly cotizaciones = inject(CotizacionesService);
  private readonly catalogos = inject(ComprobanteCatalogosService);
  private readonly maestros = inject(MaestrosService);
  private readonly vendedoresSvc = inject(VendedoresService);

  readonly cotizacionId = signal<string | null>(null);
  readonly estado = signal<string>('BORRADOR');
  readonly loading = signal(false);
  readonly vendedores = signal<VendedorDto[]>([]);
  readonly productos = signal<ProductoServicio[]>([]);
  readonly puntos = signal<PuntoEmitir[]>([]);
  readonly modalConvertir = signal(false);
  readonly modalCorreo = signal(false);

  readonly listLink = ['/t', this.tenant.tenantSlug(), 'ventas', 'cotizaciones'];

  cabecera = {
    fechaEmision: fechaHoyIsoLocal(),
    validezDias: 15,
    vendedorId: '',
    tipoId: '04',
    identificacion: '',
    razonSocial: '',
    email: '',
  };

  lineas = signal<FacturaLinea[]>([]);
  introHtml = '';
  condicionesHtml = '';
  readonly adjuntosList = signal<CotizacionAdjuntoDto[]>([]);
  puntoEmisionId = '';
  correoDestino = '';
  correoNota = '';

  readonly pageTitle = computed(() =>
    this.cotizacionId() ? this.t('quotation.editTitle') : this.t('quotation.newTitle'),
  );

  readonly puedeAceptar = computed(() => {
    const e = this.estado();
    return e === 'BORRADOR' || e === 'ENVIADA';
  });

  readonly puedeRechazar = computed(() => {
    const e = this.estado();
    return e === 'BORRADOR' || e === 'ENVIADA' || e === 'ACEPTADA';
  });

  ngOnInit(): void {
    this.i18n.initializeFromProfileOnce();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cotizacionId.set(id);
      this.cargar(id);
    } else {
      this.lineas.set([this.nuevaLinea()]);
    }
    this.vendedoresSvc.activos().subscribe({ next: (v) => this.vendedores.set(v) });
    this.maestros.list<ProductoServicio>('productos', 0, 200).subscribe({
      next: (page) => {
        const productos = page.content ?? [];
        this.maestros.list<ProductoServicio>('servicios', 0, 200).subscribe({
          next: (serv) => this.productos.set([...productos, ...(serv.content ?? [])]),
          error: () => this.productos.set(productos),
        });
      },
      error: () => this.productos.set([]),
    });
    this.catalogos.listarPuntos().subscribe({
      next: (p) => {
        this.puntos.set(p);
        if (p.length && !this.puntoEmisionId) {
          this.puntoEmisionId = p[0].id;
        }
      },
    });
  }

  private cargar(id: string): void {
    this.cotizaciones.obtener(id).subscribe({
      next: (c) => {
        this.estado.set(c.estado);
        this.cabecera = {
          fechaEmision: c.fechaEmision,
          validezDias: c.validezDias,
          vendedorId: c.vendedorId ?? '',
          tipoId: c.tipoIdentificacionReceptor ?? '04',
          identificacion: c.identificacionReceptor,
          razonSocial: c.razonSocialReceptor,
          email: c.emailReceptor ?? '',
        };
        this.introHtml = c.introduccionHtml ?? '';
        this.condicionesHtml = c.condicionesHtml ?? '';
        this.adjuntosList.set([...(c.adjuntos ?? [])]);
        this.correoDestino = c.emailReceptor ?? '';
        this.lineas.set(
          (c.items ?? []).map((it, i) => ({
            _rowId: `l-${i}`,
            productoId: '',
            codigoPrincipal: it.codigoPrincipal ?? 'ITEM',
            codigoAuxiliar: it.codigoAuxiliar ?? '',
            descripcion: it.descripcion,
            cantidad: Number(it.cantidad),
            precioUnitario: Number(it.precioUnitario),
            descuento: Number(it.descuento) || 0,
            ivaPorcentaje: Number(it.ivaPorcentaje) || 0,
            ivaCodigoPorcentaje: '4',
          })),
        );
        if (this.lineas().length === 0) {
          this.lineas.set([this.nuevaLinea()]);
        }
      },
      error: () => this.toast.error(this.t('quotation.loadError')),
    });
  }

  onAdjuntoSubido(adj: CotizacionAdjuntoDto): void {
    this.adjuntosList.update((list) => [...list, adj]);
  }

  guardar(): void {
    const payload = this.buildPayload();
    if (!payload.items.length) {
      this.toast.warning(this.t('quotation.linesRequired'));
      return;
    }
    this.loading.set(true);
    const req = this.cotizacionId()
      ? this.cotizaciones.actualizar(this.cotizacionId()!, payload)
      : this.cotizaciones.crear(payload);
    req.subscribe({
      next: (c) => {
        this.loading.set(false);
        this.toast.success(this.t('common.saved'));
        if (!this.cotizacionId()) {
          void this.router.navigate(['/t', this.tenant.tenantSlug(), 'ventas', 'cotizaciones', 'editar', c.id]);
        } else {
          this.estado.set(c.estado);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('quotation.saveError'));
      },
    });
  }

  abrirConvertir(): void {
    this.modalConvertir.set(true);
  }

  convertir(): void {
    const id = this.cotizacionId();
    if (!id || !this.puntoEmisionId) {
      return;
    }
    this.loading.set(true);
    this.cotizaciones.convertirFactura(id, this.puntoEmisionId).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.modalConvertir.set(false);
        this.toast.success(this.t('quotation.convertedOk'));
        void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', 'editar', r.id]);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('quotation.convertError'));
      },
    });
  }

  abrirEnviar(): void {
    this.modalCorreo.set(true);
  }

  aceptar(): void {
    const id = this.cotizacionId();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.cotizaciones.aceptar(id).subscribe({
      next: (c) => {
        this.loading.set(false);
        this.estado.set(c.estado);
        this.toast.success(this.t('quotation.acceptedOk'));
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('quotation.statusChangeError'));
      },
    });
  }

  rechazar(): void {
    const id = this.cotizacionId();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.cotizaciones.rechazar(id).subscribe({
      next: (c) => {
        this.loading.set(false);
        this.estado.set(c.estado);
        this.toast.success(this.t('quotation.rejectedOk'));
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('quotation.statusChangeError'));
      },
    });
  }

  enviarCorreo(): void {
    const id = this.cotizacionId();
    if (!id || !this.correoDestino.trim()) {
      return;
    }
    this.cotizaciones.enviarCorreo(id, [this.correoDestino.trim()], undefined, this.correoNota).subscribe({
      next: (r) => {
        this.modalCorreo.set(false);
        this.toast.success(r.enviado ? this.t('quotation.emailSent') : this.t('quotation.emailSkipped'));
        if (r.enviado) {
          this.estado.set('ENVIADA');
        }
      },
      error: () => this.toast.error(this.t('quotation.emailError')),
    });
  }

  previewHref(): string {
    const id = this.cotizacionId();
    return id ? this.cotizaciones.previewUrl(id) : '#';
  }

  private buildPayload(): CotizacionPayload {
    const adjuntos = this.adjuntosList()
      .filter((a) => a.url?.trim())
      // Importante: al guardar/actualizar, solo mandamos ENLACES.
      // Los adjuntos ARCHIVO se gestionan por endpoint dedicado (subir/eliminar) para no duplicarlos.
      .filter((a) => !(a.tipo === 'ARCHIVO' || !!a.nombreArchivo));
    return {
      fechaEmision: this.cabecera.fechaEmision,
      validezDias: this.cabecera.validezDias,
      vendedorId: this.cabecera.vendedorId || null,
      tipoIdentificacionReceptor: this.cabecera.tipoId,
      identificacionReceptor: this.cabecera.identificacion.trim(),
      razonSocialReceptor: this.cabecera.razonSocial.trim(),
      emailReceptor: this.cabecera.email?.trim() || undefined,
      items: this.cotizaciones.lineasToPayload(this.lineas()),
      adjuntos,
      introduccionHtml: this.introHtml,
      condicionesHtml: this.condicionesHtml,
      plantillaJson: {},
    };
  }

  private nuevaLinea(): FacturaLinea {
    return {
      _rowId: crypto.randomUUID(),
      productoId: '',
      codigoPrincipal: '',
      codigoAuxiliar: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0,
      descuento: 0,
      ivaPorcentaje: 15,
      ivaCodigoPorcentaje: '4',
    };
  }

  etiquetaVendedor(v: VendedorDto): string {
    const codigo = v.codigoInterno?.trim();
    return codigo ? `${codigo} — ${v.nombreCompleto}` : v.nombreCompleto;
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  badgeEstado(estado: string): string {
    return badgeClaseEstadoCotizacion(estado);
  }

  etiquetaEstado(estado: string): string {
    return etiquetaEstadoCotizacion(estado, (k) => this.t(k));
  }
}
