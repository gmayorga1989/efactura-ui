import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import { fechaHoyIsoLocal } from '../../core/util/fecha-local.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MaestrosService, type ClienteProveedor } from '../maestros/maestros.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorSpringGridComponent } from '../../shared/ui/organisms/ts-tabulator-spring-grid/ts-tabulator-spring-grid.component';
import { comprobanteGridActionsMenu } from '../../shared/ui/comprobante-grid-actions.util';
import { htmlBadgeEstadoSri } from '../../shared/ui/sri-estado.util';
import { DocumentosEmisionService } from './documentos-emision.service';

interface DocumentoConfig {
  titleKey?: string;
  subtitleKey?: string;
  eyebrowKey?: string;
  /** Texto literal legacy si no hay claves i18n */
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  endpoint: string;
  permiso: 'ventas' | 'proveedores';
  /** Segmentos de ruta bajo /t/:tenant (ej. ventas, guias, nueva) */
  guidedRoute?: string[];
}

interface PuntoEmitir {
  id: string;
  establecimientoCodigo: string;
  codigo: string;
  nombre: string | null;
}

interface DocumentoForm {
  puntoEmisionId: string;
  fechaEmision: string;
  tipoIdentificacionReceptor: string;
  identificacionReceptor: string;
  razonSocialReceptor: string;
  subtotalSinImpuestos: number;
  descuentoTotal: number;
  ivaTotal: number;
  valorTotal: number;
  customData: string;
}

@Component({
  selector: 'ts-documento-borrador-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorSpringGridComponent],
  template: `
    <ts-page-layout [title]="pageTitle()" [subtitle]="pageSubtitle()" [eyebrow]="pageEyebrow()">
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        @if (guidedLink(); as gl) {
          <a class="btn btn-primary" [routerLink]="gl">{{ t('documents.guidedForm') }}</a>
        }
        <button type="button" class="btn btn-soft-primary" (click)="toggleForm()">
          {{ showForm() ? t('documents.closeForm') : t('documents.newDraft') }}
        </button>
        <button type="button" class="btn btn-soft-primary" (click)="refrescar()">{{ t('common.refresh') }}</button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('common.toContinue') }}
          } @else {
            {{ t('documents.companyRequired') }}
          }
        </p>
      } @else if (!puedeUsar()) {
        <p class="text-muted mb-0">{{ t('documents.permissionRequired') }}</p>
      } @else {
        @if (showForm()) {
          <form class="border rounded p-3 mb-3" (ngSubmit)="crear()">
            <div class="row g-2">
              <div class="col-md-4">
                <label class="form-label" for="doc-receptor-maestro">{{ t('documents.masterReceiver') }}</label>
                <select id="doc-receptor-maestro" class="form-select" [value]="selectedReceptorId" (change)="seleccionarReceptor($any($event.target).value)">
                  <option value="">{{ t('documents.selectReceiver') }}</option>
                  @for (r of receptores(); track r.id) {
                    <option [value]="r.id">{{ r.identificacion }} - {{ r.razonSocial }}</option>
                  }
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="doc-punto">{{ t('documents.emissionPoint') }}</label>
                <select id="doc-punto" class="form-select" name="puntoEmisionId" [(ngModel)]="form.puntoEmisionId" required>
                  @for (p of puntos(); track p.id) {
                    <option [value]="p.id">{{ p.establecimientoCodigo }}-{{ p.codigo }} {{ p.nombre || '' }}</option>
                  }
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label" for="doc-fecha">{{ t('documents.issueDate') }}</label>
                <input id="doc-fecha" type="date" class="form-control" name="fechaEmision" [(ngModel)]="form.fechaEmision" required />
              </div>
              <div class="col-md-2">
                <label class="form-label" for="doc-tid">{{ t('documents.receiverIdType') }}</label>
                <select id="doc-tid" class="form-select" name="tipoIdentificacionReceptor" [(ngModel)]="form.tipoIdentificacionReceptor">
                  <option value="04">04 - RUC</option>
                  <option value="05">05 - {{ t('masters.idCard') }}</option>
                  <option value="06">06 - {{ t('masters.passport') }}</option>
                  <option value="07">07 - {{ t('masters.finalConsumer') }}</option>
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label" for="doc-id">{{ t('documents.receiverIdentification') }}</label>
                <input id="doc-id" class="form-control" name="identificacionReceptor" [(ngModel)]="form.identificacionReceptor" required />
              </div>
              <div class="col-md-3">
                <label class="form-label" for="doc-rs">{{ t('documents.businessName') }}</label>
                <input id="doc-rs" class="form-control" name="razonSocialReceptor" [(ngModel)]="form.razonSocialReceptor" required />
              </div>
              <div class="col-md-2">
                <label class="form-label" for="doc-sub">{{ t('documents.subtotal') }}</label>
                <input id="doc-sub" type="number" step="0.01" class="form-control" name="subtotalSinImpuestos" [(ngModel)]="form.subtotalSinImpuestos" />
              </div>
              <div class="col-md-2">
                <label class="form-label" for="doc-desc">{{ t('documents.discount') }}</label>
                <input id="doc-desc" type="number" step="0.01" class="form-control" name="descuentoTotal" [(ngModel)]="form.descuentoTotal" />
              </div>
              <div class="col-md-2">
                <label class="form-label" for="doc-iva">{{ t('documents.vat') }}</label>
                <input id="doc-iva" type="number" step="0.01" class="form-control" name="ivaTotal" [(ngModel)]="form.ivaTotal" />
              </div>
              <div class="col-md-2">
                <label class="form-label" for="doc-total">{{ t('documents.total') }}</label>
                <input id="doc-total" type="number" step="0.01" class="form-control" name="valorTotal" [(ngModel)]="form.valorTotal" />
              </div>
              <div class="col-md-4">
                <label class="form-label" for="doc-custom">{{ t('documents.customData') }}</label>
                <input id="doc-custom" class="form-control" name="customData" [(ngModel)]="form.customData" placeholder='{"origen":"manual"}' />
              </div>
              <div class="col-12">
                <button type="submit" class="btn btn-primary" [disabled]="loading()">{{ t('documents.createDraft') }}</button>
              </div>
            </div>
          </form>
        }

        <ts-tabulator-spring-grid
          [ajaxUrl]="config.endpoint"
          [columns]="columns()"
          [reloadNonce]="gridNonce()"
          emptyContext="documents"
          height="min(620px, calc(100vh - 15.5rem))"
          (rowAction)="onGridRowAction($event)"
        />
      }
    </ts-page-layout>
  `,
})
export class DocumentoBorradorPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly maestros = inject(MaestrosService);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  private readonly documentosEmision = inject(DocumentosEmisionService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly showForm = signal(false);
  readonly loading = signal(false);
  readonly puntos = signal<PuntoEmitir[]>([]);
  readonly receptores = signal<ClienteProveedor[]>([]);
  readonly gridNonce = signal(0);
  readonly emitiendo = signal(false);
  selectedReceptorId = '';

  readonly guidedLink = computed(() => {
    const segments = this.config.guidedRoute ?? [];
    if (!segments.length) {
      return null;
    }
    return ['/t', this.tenant.tenantSlug(), ...segments];
  });

  config: DocumentoConfig = {
    titleKey: 'documents.routes.genericTitle',
    subtitleKey: '',
    eyebrowKey: '',
    title: 'Documento',
    subtitle: '',
    eyebrow: '',
    endpoint: '/api/web/v1/ventas/notas-credito',
    permiso: 'ventas',
  };

  form: DocumentoForm = this.emptyForm();

  readonly columns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const base: ColumnDefinition[] = [
      {
        title: '',
        field: 'id',
        width: 72,
        headerSort: false,
        hozAlign: 'center',
        formatter: (cell: unknown) => {
          const c = cell as { getData: () => { estadoSri?: string } };
          return comprobanteGridActionsMenu({
            t: (key) => this.t(key),
            estadoSri: String(c.getData().estadoSri ?? ''),
            includeEdit: this.soportaEmisionSri(),
            includeEmit: this.soportaEmisionSri(),
          });
        },
      },
      { title: this.t('documents.number'), field: 'numeroComprobante', minWidth: 170 },
      { title: this.t('documents.date'), field: 'fechaEmision', width: 120 },
      { title: this.t('documents.receiverIdentification'), field: 'identificacionReceptor', minWidth: 150 },
      { title: this.t('documents.businessName'), field: 'razonSocialReceptor', minWidth: 220 },
      { title: this.t('documents.total'), field: 'valorTotal', hozAlign: 'right', width: 120 },
      {
        title: this.t('documents.sriStatus'),
        field: 'estadoSri',
        minWidth: 140,
        formatter: (cell: unknown) => {
          const c = cell as { getData: () => { estadoSri?: string } };
          return htmlBadgeEstadoSri(String(c.getData().estadoSri ?? ''), (key) => this.t(key));
        },
      },
    ];
    return base;
  });

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  pageTitle(): string {
    this.i18n.language();
    const key = String(
      this.route.snapshot.data['titleKey'] ?? this.config.titleKey ?? '',
    ).trim();
    if (key) {
      return this.t(key);
    }
    if (this.config.title) {
      return this.config.title;
    }
    return this.t('documents.routes.genericTitle');
  }

  pageSubtitle(): string {
    this.i18n.language();
    const key = String(
      this.route.snapshot.data['subtitleKey'] ?? this.config.subtitleKey ?? '',
    ).trim();
    if (key) {
      return this.t(key);
    }
    return this.config.subtitle ?? '';
  }

  pageEyebrow(): string {
    this.i18n.language();
    const key = String(
      this.route.snapshot.data['eyebrowKey'] ?? this.config.eyebrowKey ?? '',
    ).trim();
    if (key) {
      return this.t(key);
    }
    return this.config.eyebrow ?? '';
  }

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.config = data as DocumentoConfig;
      this.form = this.emptyForm();
    });
    if (this.tokenPresent && this.tieneEmpresa) {
      this.cargarPuntos();
      this.cargarReceptores();
    }
  }

  puedeUsar(): boolean {
    return this.config.permiso === 'proveedores'
      ? this.session.puedeGestionarProveedores()
      : this.session.puedeGestionarVentas();
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
  }

  refrescar(): void {
    this.gridNonce.update((n) => n + 1);
  }

  soportaEmisionSri(): boolean {
    return this.documentosEmision.soportaEmisionSri(this.config.endpoint);
  }

  onGridRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    const id = String(ev.row['id'] ?? '');
    if (!id) {
      return;
    }
    if (ev.action === 'ver') {
      void this.router.navigate(['/t', this.tenant.tenantSlug(), 'comprobantes', id], {
        queryParams: { from: this.listadoFromPath() },
      });
      return;
    }
    if (!this.soportaEmisionSri()) {
      return;
    }
    if (ev.action === 'editar') {
      this.editarBorrador(id);
    } else if (ev.action === 'emitir') {
      this.emitirBorrador(id);
    } else if (ev.action === 'ride') {
      this.descargarRide(id);
    } else if (ev.action === 'xml') {
      this.descargarXmlAutorizado(id);
    }
  }

  descargarRide(id: string): void {
    this.http.get(`/api/web/v1/comprobantes/${id}/ride`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      },
      error: () => this.toast.error(this.t('invoice.rideError')),
    });
  }

  descargarXmlAutorizado(id: string): void {
    this.http.get(`/api/web/v1/comprobantes/${id}/xml-autorizado`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      },
      error: () => this.toast.error(this.t('invoice.xmlError')),
    });
  }

  emitirBorrador(id: string): void {
    if (this.emitiendo()) {
      return;
    }
    this.emitiendo.set(true);
    const tipo = this.documentosEmision.tipoDesdeEndpoint(this.config.endpoint);
    if (!tipo) {
      this.emitiendo.set(false);
      return;
    }
    this.documentosEmision.emitirBorrador(tipo, id).subscribe({
      next: (c: { estadoSri: string }) => {
        this.emitiendo.set(false);
        this.toast.success(this.t('documents.emittedToSri', { status: c.estadoSri }));
        this.refrescar();
      },
      error: () => {
        this.emitiendo.set(false);
        this.toast.error(this.t('documents.emitToSriError'));
      },
    });
  }

  seleccionarReceptor(id: string): void {
    this.selectedReceptorId = id;
    const receptor = this.receptores().find((r) => r.id === id);
    if (!receptor) {
      return;
    }
    this.form.tipoIdentificacionReceptor = receptor.tipoIdentificacion;
    this.form.identificacionReceptor = receptor.identificacion;
    this.form.razonSocialReceptor = receptor.razonSocial;
  }

  crear(): void {
    this.loading.set(true);
    let customData: unknown = {};
    if (this.form.customData.trim()) {
      try {
        customData = JSON.parse(this.form.customData);
      } catch {
        this.loading.set(false);
        this.showMsg(this.t('documents.invalidJson'), false);
        return;
      }
    }
    const body = {
      puntoEmisionId: this.form.puntoEmisionId,
      fechaEmision: this.form.fechaEmision,
      tipoIdentificacionReceptor: this.form.tipoIdentificacionReceptor,
      identificacionReceptor: this.form.identificacionReceptor,
      razonSocialReceptor: this.form.razonSocialReceptor,
      subtotalSinImpuestos: Number(this.form.subtotalSinImpuestos) || 0,
      descuentoTotal: Number(this.form.descuentoTotal) || 0,
      ivaTotal: Number(this.form.ivaTotal) || 0,
      valorTotal: Number(this.form.valorTotal) || 0,
      customData,
    };
    this.http.post(this.config.endpoint, body).subscribe({
      next: () => {
        this.loading.set(false);
        this.form = this.emptyForm();
        this.showMsg(this.t('documents.draftCreated'), true);
        this.refrescar();
      },
      error: () => {
        this.loading.set(false);
        this.showMsg(this.t('documents.createDraftError'), false);
      },
    });
  }

  private cargarPuntos(): void {
    this.http.get<PuntoEmitir[]>('/api/web/v1/facturas/puntos-emision').subscribe({
      next: (rows) => {
        this.puntos.set(rows);
        if (rows.length && !this.form.puntoEmisionId) {
          this.form.puntoEmisionId = rows[0].id;
        }
      },
      error: () => this.puntos.set([]),
    });
  }

  private cargarReceptores(): void {
    const tipo = this.config.permiso === 'proveedores' ? 'proveedores' : 'clientes';
    this.maestros.list<ClienteProveedor>(tipo, 0, 50).subscribe({
      next: (page) => this.receptores.set(page.content),
      error: () => this.receptores.set([]),
    });
  }

  private emptyForm(): DocumentoForm {
    return {
      puntoEmisionId: this.puntos()[0]?.id ?? '',
      fechaEmision: fechaHoyIsoLocal(),
      tipoIdentificacionReceptor: '04',
      identificacionReceptor: '',
      razonSocialReceptor: '',
      subtotalSinImpuestos: 0,
      descuentoTotal: 0,
      ivaTotal: 0,
      valorTotal: 0,
      customData: '{}',
    };
  }

  editarBorrador(id: string): void {
    const tipo = this.documentosEmision.tipoDesdeEndpoint(this.config.endpoint);
    const slug = this.tenant.tenantSlug();
    if (!tipo) {
      return;
    }
    const path: (string | number)[] = ['/t', slug];
    switch (tipo) {
      case 'notas-debito':
        path.push('ventas', 'notas-debito', 'editar', id);
        break;
      case 'guias':
        path.push('ventas', 'guias', 'editar', id);
        break;
      case 'retenciones':
        path.push('proveedores', 'retenciones', 'editar', id);
        break;
      case 'liquidaciones':
        path.push('proveedores', 'liquidaciones', 'editar', id);
        break;
      default:
        return;
    }
    void this.router.navigate(path);
  }

  private listadoFromPath(): string {
    const url = this.router.url.split('?')[0] ?? '';
    const m = url.match(/\/t\/[^/]+\/(.+)$/);
    return m?.[1] ?? 'comprobantes-electronicos';
  }

  private showMsg(text: string, ok: boolean): void {
    if (ok) {
      this.toast.success(text);
    } else {
      this.toast.error(text);
    }
  }
}
