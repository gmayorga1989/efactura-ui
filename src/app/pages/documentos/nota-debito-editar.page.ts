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
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import {
  FacturasService,
  type ComprobanteFactura,
  type FacturaItemPayload,
  type PuntoEmitir,
} from '../facturas/facturas.service';
import { DocumentosEmisionService } from './documentos-emision.service';

@Component({
  selector: 'ts-nota-debito-editar-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('invoice.debitNoteEditTitle')"
      [subtitle]="borrador()?.numeroComprobante ?? ''"
      [eyebrow]="t('menu.sales')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="listadoLink">{{ t('common.back') }}</a>
        @if (borrador(); as b) {
          @if (b.estadoSri === 'BORRADOR') {
            <button type="button" class="btn btn-soft-primary" (click)="guardar(false)" [disabled]="loading()">
              {{ t('invoice.saveDraft') }}
            </button>
            <button type="button" class="btn btn-success" (click)="guardar(true)" [disabled]="loading()">
              {{ loading() ? t('common.loading') : t('invoice.emit') }}
            </button>
          }
        }
      </div>

      @if (loadingBorrador()) {
        <p class="text-muted mb-0">{{ t('common.loading') }}</p>
      } @else if (!borrador()) {
        <p class="text-muted mb-0">{{ t('invoice.notFound') }}</p>
      } @else if (borrador()!.estadoSri !== 'BORRADOR') {
        <p class="text-warning mb-0">{{ t('invoice.editDraftOnly') }}</p>
      } @else {
        <form class="border rounded p-3" (ngSubmit)="guardar(false)">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label" for="nde-punto">{{ t('documents.emissionPoint') }}</label>
              <select id="nde-punto" class="form-select" [(ngModel)]="puntoEmisionId" name="puntoEmisionId" required>
                @for (p of puntos(); track p.id) {
                  <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }}</option>
                }
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label" for="nde-fecha">{{ t('documents.date') }}</label>
              <input id="nde-fecha" type="date" class="form-control" [(ngModel)]="fechaEmision" name="fechaEmision" />
            </div>
            <div class="col-md-5">
              <label class="form-label" for="nde-motivo">{{ t('invoice.debitNoteReason') }}</label>
              <input id="nde-motivo" class="form-control" [(ngModel)]="motivo" name="motivo" required />
            </div>
            <div class="col-md-3">
              <label class="form-label" for="nde-valor">{{ t('invoice.debitNoteAmount') }}</label>
              <input
                id="nde-valor"
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
          <dl class="row g-2 mt-2 mb-0 small border-top pt-3">
            <div class="col-sm-6">
              <dt class="text-muted">{{ t('invoice.creditNoteModifiedInvoice') }}</dt>
              <dd class="mb-0">{{ numeroFacturaModificada() }}</dd>
            </div>
            <div class="col-sm-6">
              <dt class="text-muted">{{ t('documents.receiver') }}</dt>
              <dd class="mb-0">
                {{ borrador()!.razonSocialReceptor }} ({{ borrador()!.identificacionReceptor }})
              </dd>
            </div>
          </dl>
        </form>
      }
    </ts-page-layout>
  `,
})
export class NotaDebitoEditarPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facturas = inject(FacturasService);
  private readonly catalogos = inject(ComprobanteCatalogosService);
  private readonly documentos = inject(DocumentosEmisionService);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly borrador = signal<ComprobanteFactura | null>(null);
  readonly puntos = signal<PuntoEmitir[]>([]);
  readonly loadingBorrador = signal(true);
  readonly loading = signal(false);

  borradorId = '';
  listadoLink: (string | number)[] = [];
  facturaModificadaId = '';
  numeroFacturaModificada = signal('');
  puntoEmisionId = '';
  fechaEmision = fechaHoyIsoLocal();
  motivo = '';
  valorModificacion = 0;
  tipoIdReceptor = '04';

  ngOnInit(): void {
    const slug = this.tenant.tenantSlug();
    this.listadoLink = ['/t', slug, 'ventas', 'notas-debito'];
    this.borradorId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!readAccessToken() || !this.session.profile()?.empresaId || !this.borradorId) {
      this.loadingBorrador.set(false);
      return;
    }
    this.catalogos.listarPuntos().subscribe({
      next: (p) => {
        this.puntos.set(p);
        if (p.length && !this.puntoEmisionId) {
          this.puntoEmisionId = p[0]?.id ?? '';
        }
      },
    });
    this.facturas.obtenerComprobante(this.borradorId).subscribe({
      next: (c) => this.cargarBorrador(c),
      error: () => {
        this.borrador.set(null);
        this.loadingBorrador.set(false);
      },
    });
  }

  private cargarBorrador(c: ComprobanteFactura): void {
    if ((c.tipo ?? '').toUpperCase() !== 'NOTA_DEBITO') {
      this.borrador.set(null);
      this.loadingBorrador.set(false);
      return;
    }
    this.borrador.set(c);
    const cd = c.customData ?? {};
    if (cd['puntoEmisionId']) {
      this.puntoEmisionId = String(cd['puntoEmisionId']);
    }
    this.motivo = String(cd['motivo'] ?? '');
    this.numeroFacturaModificada.set(String(cd['numeroFactura'] ?? cd['numDocModificado'] ?? ''));
    this.facturaModificadaId = String(cd['facturaModificadaId'] ?? cd['facturaOrigenId'] ?? '');
    this.tipoIdReceptor = String(cd['tipoIdentificacionReceptor'] ?? '04');
    if (c.fechaEmision) {
      this.fechaEmision = String(c.fechaEmision).slice(0, 10);
    }
    const lineas = this.facturas.comprobanteToLineas(c);
    if (lineas.length) {
      this.valorModificacion = lineas[0]?.precioUnitario ?? c.valorTotal ?? 0;
      if (!this.motivo && lineas[0]?.descripcion) {
        this.motivo = lineas[0].descripcion;
      }
    } else {
      this.valorModificacion = c.valorTotal ?? 0;
    }
    this.loadingBorrador.set(false);
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  guardar(emitir: boolean): void {
    const b = this.borrador();
    if (!b || !this.puntoEmisionId || !this.motivo.trim() || this.valorModificacion <= 0) {
      this.toast.error(this.t('invoice.debitNoteInvalid'));
      return;
    }
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
    const body = {
      puntoEmisionId: this.puntoEmisionId,
      fechaEmision: this.fechaEmision,
      tipoIdentificacionReceptor: this.tipoIdReceptor,
      identificacionReceptor: b.identificacionReceptor,
      razonSocialReceptor: b.razonSocialReceptor,
      facturaModificadaId: this.facturaModificadaId || undefined,
      motivo: this.motivo.trim(),
      items,
      customData: {
        ...(b.customData ?? {}),
        motivo: this.motivo.trim(),
        numeroFactura: this.numeroFacturaModificada(),
      },
    };
    this.loading.set(true);
    this.documentos.actualizarBorradorModificado('notas-debito', this.borradorId, body).subscribe({
      next: (actualizado) => this.afterGuardar(actualizado.id, emitir),
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('invoice.debitNoteError'));
      },
    });
  }

  private afterGuardar(id: string, emitir: boolean): void {
    if (!emitir) {
      this.loading.set(false);
      this.toast.success(this.t('invoice.draftSaved'));
      void this.router.navigate(this.listadoLink);
      return;
    }
    this.documentos.emitirBorrador('notas-debito', id).subscribe({
      next: (emitido) => {
        this.loading.set(false);
        this.toast.success(this.t('invoice.debitNoteEmitted', { status: emitido.estadoSri }));
        void this.router.navigate(this.listadoLink);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('invoice.debitNoteEmitError'));
      },
    });
  }
}
