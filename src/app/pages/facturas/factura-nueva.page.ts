import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { fechaHoyIsoLocal } from '../../core/util/fecha-local.util';
import {
  resolveInvoiceDraftSaveError,
  resolveInvoiceEmitError,
} from '../../core/session/http-error.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsFacturaLineasTabulatorComponent } from '../../shared/ui/organisms/ts-factura-lineas-tabulator/ts-factura-lineas-tabulator.component';
import { TsMaestroRapidoModalsComponent } from '../../shared/ui/organisms/ts-maestro-rapido-modals/ts-maestro-rapido-modals.component';
import { TsRichTextEditorComponent } from '../../shared/ui/molecules/ts-rich-text-editor/ts-rich-text-editor.component';
import { ComprobanteCatalogosService } from '../comprobantes/comprobante-catalogos.service';
import { MaestrosService, type ClienteProveedor, type ProductoServicio } from '../maestros/maestros.service';
import { VendedoresService, type VendedorDto } from '../vendedores/vendedores.service';
import {
  buildDetallesAdicionalesFromHtmlDraft,
  correosDesdeCliente,
  FacturasService,
  ivaPorcentajeDesdeCodigo,
  MAX_INFO_ADICIONAL_CHARS,
  normalizarDetallesAdicionalesHtmlDraft,
  parseCorreosLista,
  type CampoExtraDef,
  type FacturaLinea,
  type PuntoEmitir,
} from './facturas.service';

@Component({
  selector: 'ts-factura-nueva-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DecimalPipe,
    TsPageLayoutComponent,
    TsFacturaLineasTabulatorComponent,
    TsMaestroRapidoModalsComponent,
    TsRichTextEditorComponent,
  ],
  template: `
    <ts-page-layout
      [title]="pageTitle()"
      [subtitle]="t('invoice.formSubtitle')"
      [eyebrow]="t('invoice.eyebrow')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="['/t', tenant.tenantSlug(), 'facturas']">{{ t('common.cancel') }}</a>
        <button type="button" class="btn btn-soft-primary" (click)="guardarBorrador()" [disabled]="loading()">
          {{ t('invoice.saveDraft') }}
        </button>
        <button type="button" class="btn btn-success" (click)="emitir()" [disabled]="loading()">
          {{ loading() ? t('common.loading') : t('invoice.emit') }}
        </button>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">{{ t('invoice.companyRequired') }}</p>
      } @else if (!session.puedeGestionarVentas()) {
        <p class="text-muted mb-0">{{ t('invoice.emitPermissionRequired') }}</p>
      } @else {
        <form class="factura-form" (ngSubmit)="emitir()">
          <section class="factura-section">
            <h2 class="factura-section__title">{{ t('invoice.sectionHeader') }}</h2>
            <div class="row g-3">
              <div class="col-lg-3 col-md-4">
                <label class="form-label" for="fn-punto">{{ t('documents.emissionPoint') }}</label>
                <select id="fn-punto" class="form-select" [(ngModel)]="cabecera.puntoEmisionId" name="puntoEmisionId" required>
                  @for (p of puntos(); track p.id) {
                    <option [value]="p.id">
                      {{ p.establecimientoCodigo }}-{{ p.codigo }}
                      @if (p.nombre) {
                        — {{ p.nombre }}
                      }
                    </option>
                  }
                </select>
              </div>
              <div class="col-lg-2 col-md-3">
                <label class="form-label" for="fn-fecha">{{ t('documents.date') }}</label>
                <input id="fn-fecha" type="date" class="form-control" [(ngModel)]="cabecera.fechaEmision" name="fechaEmision" />
              </div>
              <div class="col-lg-3 col-md-4">
                <label class="form-label" for="fn-vendedor">{{ t('salespeople.label') }}</label>
                @if (vendedorDesdeCotizacion()) {
                  <input
                    id="fn-vendedor"
                    class="form-control bg-light"
                    [value]="vendedorEtiquetaActual()"
                    readonly
                  />
                  <small class="text-muted d-block mt-1">{{ textoVendedorHeredado() }}</small>
                } @else {
                  <select id="fn-vendedor" class="form-select" [(ngModel)]="cabecera.vendedorId" name="vendedorId">
                    <option value="">{{ t('salespeople.selectSeller') }}</option>
                    @for (v of vendedores(); track v.id) {
                      <option [value]="v.id">{{ etiquetaVendedor(v) }}</option>
                    }
                  </select>
                }
              </div>
              <div class="col-lg-4 col-md-5">
                <label class="form-label factura-field-label" for="fn-cliente">
                  <span>{{ t('invoice.customerMaster') }}</span>
                  <button type="button" class="factura-inline-add" (click)="abrirClienteRapido()">
                    + {{ t('invoice.quickNewShort') }}
                  </button>
                </label>
                <select
                  id="fn-cliente"
                  class="form-select"
                  [value]="selectedClienteId()"
                  (change)="onClienteChange($any($event.target).value)"
                >
                  <option value="">{{ t('invoice.selectCustomer') }}</option>
                  @for (c of clientes(); track c.id) {
                    <option [value]="c.id">{{ c.identificacion }} — {{ c.razonSocial }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="row g-3 mt-1">
              @if (!clienteSeleccionado()) {
                <div class="col-md-2">
                  <label class="form-label" for="fn-tid">{{ t('documents.receiverIdType') }}</label>
                  <select
                    id="fn-tid"
                    class="form-select"
                    [(ngModel)]="cabecera.tipoIdentificacionReceptor"
                    name="tipoIdentificacionReceptor"
                  >
                    <option value="04">04 — RUC</option>
                    <option value="05">05 — {{ t('masters.idCard') }}</option>
                    <option value="06">06 — {{ t('masters.passport') }}</option>
                    <option value="07">07 — {{ t('masters.finalConsumer') }}</option>
                  </select>
                </div>
              }
              <div [class]="clienteSeleccionado() ? 'col-md-4' : 'col-md-3'">
                <label class="form-label" for="fn-id">{{ t('documents.receiverIdentification') }}</label>
                <input
                  id="fn-id"
                  class="form-control"
                  [(ngModel)]="cabecera.identificacionReceptor"
                  name="identificacionReceptor"
                  [readonly]="clienteSeleccionado()"
                  [class.bg-light]="clienteSeleccionado()"
                  required
                />
              </div>
              <div [class]="clienteSeleccionado() ? 'col-md-5' : 'col-md-4'">
                <label class="form-label" for="fn-rs">{{ t('documents.businessName') }}</label>
                <input
                  id="fn-rs"
                  class="form-control"
                  [(ngModel)]="cabecera.razonSocialReceptor"
                  name="razonSocialReceptor"
                  [readonly]="clienteSeleccionado()"
                  [class.bg-light]="clienteSeleccionado()"
                  required
                />
              </div>
              <div class="col-md-3">
                <label class="form-label" for="fn-mail-nuevo">{{ t('invoice.receiverEmail') }}</label>
                <div class="factura-correos" aria-live="polite">
                  @for (mail of correosReceptorList(); track mail) {
                    <span class="badge factura-correo-badge">
                      {{ mail }}
                      <button
                        type="button"
                        class="factura-correo-badge__remove"
                        (click)="quitarCorreo(mail)"
                        [attr.aria-label]="t('invoice.removeEmail', { email: mail })"
                      >
                        ×
                      </button>
                    </span>
                  }
                  <div class="factura-correo-add">
                    <input
                      id="fn-mail-nuevo"
                      type="email"
                      class="form-control form-control-sm"
                      [(ngModel)]="nuevoCorreoInput"
                      name="nuevoCorreoReceptor"
                      [placeholder]="t('invoice.addEmailPlaceholder')"
                      (keydown.enter)="agregarCorreo($event)"
                    />
                    <button type="button" class="btn btn-soft-primary btn-sm" (click)="agregarCorreo()">
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="row g-3 mt-0 pt-2 border-top factura-header-extra">
              <div class="col-lg-5 col-md-6">
                <label class="form-label" for="fn-glosa">{{ t('invoice.headerNote') }}</label>
                <div class="factura-textarea-wrap">
                  <textarea
                    id="fn-glosa"
                    class="form-control factura-textarea"
                    rows="2"
                    [maxlength]="maxInfoAdicionalChars"
                    [(ngModel)]="cabecera.glosa"
                    name="glosa"
                    [placeholder]="t('invoice.headerNotePlaceholder')"
                  ></textarea>
                  <span
                    class="factura-char-count"
                    [class.factura-char-count--warn]="cabecera.glosa.length >= maxInfoAdicionalChars - 20"
                  >
                    {{ cabecera.glosa.length }}/{{ maxInfoAdicionalChars }}
                  </span>
                </div>
              </div>
            </div>
            @if (camposExtra().length) {
              <h3 class="factura-section__subtitle">{{ t('invoice.extraFields') }}</h3>
              <div class="row g-3">
                @for (c of camposExtra(); track c.codigo) {
                  <div class="col-md-4">
                    <label class="form-label" [attr.for]="'ex-' + c.codigo">{{ c.etiqueta }}</label>
                    @if (c.tipo === 'number') {
                      <input
                        [id]="'ex-' + c.codigo"
                        type="number"
                        class="form-control"
                        [(ngModel)]="extraValores[c.codigo]"
                        [name]="'ex-' + c.codigo"
                        [required]="c.requerido"
                      />
                    } @else if (c.tipo === 'select' && c.opciones?.length) {
                      <select
                        class="form-select"
                        [id]="'ex-' + c.codigo"
                        [(ngModel)]="extraValores[c.codigo]"
                        [name]="'ex-' + c.codigo"
                        [required]="c.requerido"
                      >
                        <option value="">—</option>
                        @for (op of c.opciones!; track op) {
                          <option [value]="op">{{ op }}</option>
                        }
                      </select>
                    } @else {
                      <input
                        [id]="'ex-' + c.codigo"
                        type="text"
                        class="form-control"
                        [(ngModel)]="extraValores[c.codigo]"
                        [name]="'ex-' + c.codigo"
                        [required]="c.requerido"
                      />
                    }
                  </div>
                }
              </div>
            }
          </section>

          <section class="factura-section">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h2 class="factura-section__title mb-0">{{ t('invoice.sectionLines') }}</h2>
              <div class="factura-section-tools">
                <button type="button" class="factura-inline-add" (click)="abrirItemRapido()">
                  + {{ t('invoice.quickNewItemShort') }}
                </button>
                <button type="button" class="btn btn-soft-primary btn-sm" (click)="agregarLinea()">
                  {{ t('invoice.addLine') }}
                </button>
              </div>
            </div>
            <ts-factura-lineas-tabulator
              [lineas]="lineas()"
              [itemsMaestro]="itemsMaestro()"
              [reloadNonce]="lineasNonce()"
              (lineasChange)="onLineasGridChange($event)"
              (eliminarLinea)="quitarLinea($event)"
              (solicitarDetallesAdicionales)="abrirDetallePanel($event)"
            />
          </section>

          <aside class="factura-totals card border-0 shadow-sm">
            <div class="card-body">
              <h2 class="h6 mb-3">{{ t('invoice.sectionTotals') }}</h2>
              <dl class="factura-totals__list mb-0">
                <div>
                  <dt>{{ t('invoice.subtotal') }}</dt>
                  <dd>{{ totales().subtotal | number: '1.2-2' }}</dd>
                </div>
                <div>
                  <dt>{{ t('invoice.discountTotal') }}</dt>
                  <dd>{{ totales().descuento | number: '1.2-2' }}</dd>
                </div>
              </dl>
              <div class="factura-totals__taxes">
                <p class="factura-totals__taxes-title mb-1">{{ t('invoice.taxBreakdown') }}</p>
                <table class="table table-sm factura-totals__tax-table mb-0">
                  <tbody>
                    @if (totales().subtotalExento > 0) {
                      <tr>
                        <td>{{ t('invoice.subtotalExempt') }}</td>
                        <td class="text-end">{{ totales().subtotalExento | number: '1.2-2' }}</td>
                      </tr>
                    }
                    @for (row of totales().ivaPorTarifa; track row.codigo + '-' + row.porcentaje) {
                      <tr>
                        <td>{{ t('invoice.subtotalTaxed', { rate: row.porcentaje }) }}</td>
                        <td class="text-end">{{ row.subtotal | number: '1.2-2' }}</td>
                      </tr>
                      <tr>
                        <td>{{ t('invoice.ivaTaxed', { rate: row.porcentaje }) }}</td>
                        <td class="text-end">{{ row.iva | number: '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <dl class="factura-totals__list mb-0 mt-2">
                <div class="factura-totals__grand">
                  <dt>{{ t('documents.total') }}</dt>
                  <dd>{{ totales().total | number: '1.2-2' }}</dd>
                </div>
              </dl>
              <p class="text-muted small mb-0 mt-2">{{ t('invoice.paymentHint') }}</p>
            </div>
          </aside>
        </form>

        <ts-maestro-rapido-modals
          [clienteOpen]="clienteRapidoOpen()"
          [itemOpen]="itemRapidoOpen()"
          (clienteOpenChange)="clienteRapidoOpen.set($event)"
          (itemOpenChange)="itemRapidoOpen.set($event)"
          (clienteCreado)="onClienteRapidoCreado($event)"
          (itemCreado)="onItemRapidoCreado($event)"
        />

        @if (detallePanelRowId()) {
          <div
            class="offcanvas-backdrop fade show factura-offcanvas-backdrop"
            (click)="cerrarDetallePanel()"
            aria-hidden="true"
          ></div>
          <aside
            class="offcanvas offcanvas-end show factura-detalle-offcanvas"
            tabindex="-1"
            aria-labelledby="factura-detalle-offcanvas-title"
          >
            <div class="offcanvas-header factura-detalle-offcanvas__header">
              <div>
                <h2 id="factura-detalle-offcanvas-title" class="offcanvas-title h6 mb-0">
                  {{ t('invoice.lineAdditionalDetailsTitle') }}
                </h2>
                <p class="factura-detalle-offcanvas__hint mb-0">{{ t('invoice.lineAdditionalDetailsRichHint') }}</p>
              </div>
              <button
                type="button"
                class="btn-close"
                (click)="cerrarDetallePanel()"
                [attr.aria-label]="t('common.close')"
              ></button>
            </div>
            <div class="offcanvas-body factura-detalle-offcanvas__body">
              @for (idx of detallePanelIndexes; track idx) {
                <div class="factura-detalle-field">
                  <label class="factura-detalle-field__label" [attr.for]="'fn-det-ad-' + idx">
                    {{ t('invoice.lineAdditionalDetailN', { n: idx + 1 }) }}
                  </label>
                  <ts-rich-text-editor
                    [(ngModel)]="detallePanelDraftHtml[idx]"
                    [name]="'detalleAdicional' + idx"
                    [maxLength]="maxInfoAdicionalChars"
                    [placeholder]="t('invoice.lineAdditionalDetailPlaceholder')"
                  />
                </div>
              }
            </div>
            <div class="offcanvas-footer factura-detalle-offcanvas__footer">
              <button type="button" class="btn btn-light btn-sm" (click)="cerrarDetallePanel()">
                {{ t('common.cancel') }}
              </button>
              <button type="button" class="btn btn-primary btn-sm" (click)="guardarDetallePanel()">
                {{ t('common.save') }}
              </button>
            </div>
          </aside>
        }
      }
    </ts-page-layout>
  `,
  styles: [
    `
      .factura-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .factura-section {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 10px;
        padding: 1rem 1.15rem;
        background: var(--card);
        color: var(--text);
      }
      .factura-section__title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.85rem;
        color: var(--text);
      }
      .factura-section__subtitle {
        font-size: 0.9rem;
        font-weight: 600;
        margin: 1rem 0 0.65rem;
      }
      .factura-totals {
        align-self: flex-end;
        min-width: min(100%, 320px);
      }
      .factura-totals__list > div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.2rem 0;
      }
      .factura-totals__list dt {
        margin: 0;
        font-weight: 500;
        color: var(--bs-secondary-color);
      }
      .factura-totals__list dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
      .factura-totals__grand {
        border-top: 1px solid var(--ef-divider, #e2e8f0);
        margin-top: 0.35rem;
        padding-top: 0.5rem !important;
        font-size: 1.05rem;
        font-weight: 600;
      }
      .factura-correos {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        min-height: 2.375rem;
        align-items: center;
        padding: 0.35rem 0.1rem;
      }
      .factura-correo-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.78rem;
        font-weight: 500;
        padding: 0.4em 0.55em 0.4em 0.65em;
        background: rgba(var(--bs-primary-rgb), 0.1);
        color: var(--bs-primary);
        border: 1px solid rgba(var(--bs-primary-rgb), 0.18);
      }
      .factura-correo-badge__remove {
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        line-height: 1;
        font-size: 1rem;
        opacity: 0.65;
        cursor: pointer;
      }
      .factura-correo-badge__remove:hover {
        opacity: 1;
      }
      .factura-correo-add {
        display: flex;
        gap: 0.35rem;
        flex: 1 1 100%;
        min-width: min(100%, 12rem);
      }
      .factura-correo-add .form-control {
        min-width: 0;
      }
      .factura-totals__taxes {
        margin-top: 0.65rem;
        padding-top: 0.55rem;
        border-top: 1px solid var(--ef-divider, #e2e8f0);
      }
      .factura-totals__taxes-title {
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--bs-secondary-color);
        margin: 0;
      }
      .factura-totals__tax-table td {
        padding: 0.15rem 0;
        border: 0;
        font-size: 0.88rem;
      }
      .factura-totals__tax-table td:first-child {
        color: var(--bs-secondary-color);
        padding-right: 0.75rem;
      }
      .factura-totals__tax-table td.text-end {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .factura-header-extra {
        border-color: var(--ef-divider, #e2e8f0) !important;
        margin-top: 0.5rem !important;
      }
      .factura-offcanvas-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1040;
      }
      .factura-detalle-offcanvas {
        position: fixed;
        z-index: 1045;
        width: min(100vw, 26rem);
        visibility: visible;
        border-left: 1px solid var(--ef-surface-border, #cbd5e1);
        box-shadow: -8px 0 32px rgba(17, 24, 39, 0.12);
      }
      .factura-detalle-offcanvas__header {
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1.1rem 1.15rem 0.85rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
      }
      .factura-detalle-offcanvas__hint {
        margin-top: 0.25rem;
        font-size: 0.78rem;
        color: var(--bs-secondary-color);
        line-height: 1.35;
      }
      .factura-detalle-offcanvas__body {
        padding: 1rem 1.15rem 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .factura-detalle-field__label {
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 0.35rem;
        color: rgba(17, 24, 39, 0.82);
      }
      .factura-textarea-wrap {
        position: relative;
      }
      .factura-textarea {
        min-height: 4.5rem;
        padding: 0.65rem 0.75rem 1.85rem;
        border-radius: 0.55rem;
        border-color: var(--ef-input-border-hover, #94a3b8);
        font-size: 0.875rem;
        line-height: 1.45;
        resize: vertical;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .factura-textarea:focus {
        border-color: rgba(var(--bs-primary-rgb), 0.45);
        box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.12);
      }
      .factura-char-count {
        position: absolute;
        right: 0.65rem;
        bottom: 0.5rem;
        font-size: 0.7rem;
        font-variant-numeric: tabular-nums;
        color: var(--bs-secondary-color);
        pointer-events: none;
        background: linear-gradient(90deg, transparent, #fff 28%);
        padding-left: 0.75rem;
      }
      .factura-char-count--warn {
        color: var(--bs-warning);
        font-weight: 600;
      }
      .factura-detalle-offcanvas__footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.5rem;
        padding: 0.85rem 1.15rem;
        border-top: 1px solid var(--ef-divider, #e2e8f0);
        background: #fff;
      }
      .factura-detalle-offcanvas__footer .btn {
        min-width: 5.25rem;
        flex: 0 0 auto;
      }
    `,
  ],
})
export class FacturaNuevaPage implements OnInit {
  private readonly facturas = inject(FacturasService);
  private readonly vendedoresSvc = inject(VendedoresService);
  private readonly maestros = inject(MaestrosService);
  private readonly catalogos = inject(ComprobanteCatalogosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  tokenPresent = false;
  tieneEmpresa = false;
  readonly loading = signal(false);
  readonly puntos = signal<PuntoEmitir[]>([]);
  readonly vendedores = signal<VendedorDto[]>([]);
  readonly clientes = signal<ClienteProveedor[]>([]);
  readonly itemsMaestro = signal<ProductoServicio[]>([]);
  readonly camposExtra = signal<CampoExtraDef[]>([]);
  readonly selectedClienteId = signal('');
  readonly borradorId = signal<string | null>(null);
  readonly vendedorDesdeCotizacion = signal(false);
  readonly cotizacionOrigenNumero = signal<string | null>(null);
  readonly vendedorNombreCargado = signal('');
  readonly lineas = signal<FacturaLinea[]>([this.facturas.nuevaLineaVacia()]);
  readonly lineasNonce = signal(0);
  readonly clienteRapidoOpen = signal(false);
  readonly itemRapidoOpen = signal(false);

  readonly pageTitle = computed(() =>
    this.borradorId() ? this.t('invoice.editDraftTitle') : this.t('invoice.formTitle'),
  );

  readonly clienteSeleccionado = computed(() => !!this.selectedClienteId());

  readonly clienteActual = computed(() => {
    const id = this.selectedClienteId();
    if (!id) {
      return undefined;
    }
    return this.clientes().find((c) => c.id === id);
  });

  readonly correosReceptorList = signal<string[]>([]);
  readonly detallePanelRowId = signal<string | null>(null);
  readonly detallePanelIndexes = [0, 1, 2] as const;
  detallePanelDraftHtml: [string, string, string] = ['', '', ''];
  nuevoCorreoInput = '';

  readonly maxInfoAdicionalChars = MAX_INFO_ADICIONAL_CHARS;

  cabecera = {
    puntoEmisionId: '',
    fechaEmision: fechaHoyIsoLocal(),
    tipoIdentificacionReceptor: '04',
    identificacionReceptor: '',
    razonSocialReceptor: '',
    emailReceptor: '',
    glosa: '',
    direccionReceptor: '',
    vendedorId: '',
  };

  extraValores: Record<string, string | number> = {};
  /** Metadatos del borrador (p. ej. cotizacionId) que deben conservarse al guardar. */
  private borradorCustomData: Record<string, unknown> = {};

  readonly totales = computed(() => this.facturas.calcularTotales(this.lineas()));

  ngOnInit(): void {
    this.tokenPresent = !!readAccessToken();
    this.tieneEmpresa = !!this.session.profile()?.empresaId;
    if (!this.tokenPresent || !this.tieneEmpresa || !this.session.puedeGestionarVentas()) {
      return;
    }
    const editId = this.route.snapshot.paramMap.get('id');
    if (editId) {
      this.borradorId.set(editId);
      this.cargarBorrador(editId);
    } else {
      this.cargarCatalogos();
    }
  }

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  lineSubtotal(linea: FacturaLinea): number {
    const cant = Number(linea.cantidad) || 0;
    const pu = Number(linea.precioUnitario) || 0;
    const desc = Number(linea.descuento) || 0;
    return Math.max(0, cant * pu - desc);
  }

  agregarLinea(): void {
    this.lineas.update((rows) => [...rows, this.facturas.nuevaLineaVacia()]);
    this.lineasNonce.update((n) => n + 1);
  }

  quitarLinea(rowId: string): void {
    this.lineas.update((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r._rowId !== rowId)));
    this.lineasNonce.update((n) => n + 1);
  }

  onLineasGridChange(next: FacturaLinea[]): void {
    const prev = this.lineas();
    const items = this.itemsMaestro();
    const merged = next.map((linea) => {
      const old = prev.find((p) => p._rowId === linea._rowId);
      if (linea.productoId && linea.productoId !== (old?.productoId ?? '')) {
        const item = items.find((p) => p.id === linea.productoId);
        if (item) {
          this.facturas.aplicarProducto(linea, item);
        }
      }
      const ivaCod = String(linea.ivaCodigoPorcentaje ?? '4');
      if (ivaCod !== String(old?.ivaCodigoPorcentaje ?? '4')) {
        linea.ivaPorcentaje = ivaPorcentajeDesdeCodigo(ivaCod);
      }
      return linea;
    });
    this.lineas.set(merged);
    this.lineasNonce.update((n) => n + 1);
  }

  abrirClienteRapido(): void {
    this.clienteRapidoOpen.set(true);
  }

  abrirItemRapido(): void {
    this.itemRapidoOpen.set(true);
  }

  onClienteRapidoCreado(cliente: ClienteProveedor): void {
    this.clientes.update((rows) => {
      const exists = rows.some((c) => c.id === cliente.id);
      return exists ? rows : [...rows, cliente];
    });
    this.onClienteChange(cliente.id);
  }

  onItemRapidoCreado(item: ProductoServicio): void {
    this.itemsMaestro.update((rows) => {
      const exists = rows.some((p) => p.id === item.id);
      return exists ? rows : [...rows, item];
    });
    const lineas = this.lineas();
    const vacia = lineas.find((l) => !l.productoId && !String(l.codigoPrincipal ?? '').trim());
    if (vacia) {
      this.facturas.aplicarProducto(vacia, item);
      this.lineas.set([...lineas]);
    } else {
      const nueva = this.facturas.nuevaLineaVacia();
      this.facturas.aplicarProducto(nueva, item);
      this.lineas.update((rows) => [...rows, nueva]);
    }
    this.lineasNonce.update((n) => n + 1);
  }

  onClienteChange(id: string): void {
    this.selectedClienteId.set(id);
    if (!id) {
      return;
    }
    const cliente = this.clientes().find((c) => c.id === id);
    if (cliente) {
      this.facturas.aplicarCliente(this.cabecera, cliente);
      this.correosReceptorList.set(correosDesdeCliente(cliente));
    }
  }

  agregarCorreo(ev?: Event): void {
    ev?.preventDefault();
    const mail = this.nuevoCorreoInput.trim().toLowerCase();
    if (!mail) {
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      this.toast.error(this.t('invoice.emailInvalid'));
      return;
    }
    if (this.correosReceptorList().includes(mail)) {
      this.toast.error(this.t('invoice.emailDuplicate'));
      return;
    }
    this.correosReceptorList.update((list) => [...list, mail]);
    this.nuevoCorreoInput = '';
    this.syncCorreosCabecera();
  }

  quitarCorreo(mail: string): void {
    this.correosReceptorList.update((list) => list.filter((m) => m !== mail));
    this.syncCorreosCabecera();
  }

  private syncCorreosCabecera(): void {
    this.cabecera.emailReceptor = this.correosReceptorList().join(';');
  }

  abrirDetallePanel(rowId: string): void {
    const linea = this.lineas().find((l) => l._rowId === rowId);
    this.detallePanelDraftHtml = normalizarDetallesAdicionalesHtmlDraft(
      linea?.detallesAdicionales,
      linea?.detallesAdicionalesHtml,
    );
    this.detallePanelRowId.set(rowId);
  }

  cerrarDetallePanel(): void {
    this.detallePanelRowId.set(null);
  }

  guardarDetallePanel(): void {
    const rowId = this.detallePanelRowId();
    if (!rowId) {
      return;
    }
    const built = buildDetallesAdicionalesFromHtmlDraft(this.detallePanelDraftHtml);
    this.lineas.update((rows) =>
      rows.map((l) =>
        l._rowId === rowId
          ? {
              ...l,
              detallesAdicionales: built.plain,
              detallesAdicionalesHtml: built.html,
            }
          : l,
      ),
    );
    this.lineasNonce.update((n) => n + 1);
    this.cerrarDetallePanel();
  }

  private cargarCorreosDesdeCabecera(raw?: unknown): void {
    if (Array.isArray(raw)) {
      const mails = raw
        .map((v) => String(v).trim().toLowerCase())
        .filter((m) => m && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m));
      this.correosReceptorList.set([...new Set(mails)]);
    } else {
      this.correosReceptorList.set(parseCorreosLista(String(raw ?? '')));
    }
    this.syncCorreosCabecera();
  }

  private sincronizarClienteMaestro(): void {
    const id = this.clientes().find((c) => c.identificacion === this.cabecera.identificacionReceptor)?.id ?? '';
    this.selectedClienteId.set(id);
  }

  onProductoLinea(linea: FacturaLinea, id: string): void {
    const item = this.itemsMaestro().find((p) => p.id === id);
    if (item) {
      this.facturas.aplicarProducto(linea, item);
      this.lineas.update((rows) => [...rows]);
    }
  }

  onIvaCodigoLinea(linea: FacturaLinea, codigo: string): void {
    linea.ivaCodigoPorcentaje = codigo;
    linea.ivaPorcentaje = ivaPorcentajeDesdeCodigo(codigo);
    this.lineas.update((rows) => [...rows]);
  }

  guardarBorrador(): void {
    const payload = this.armarPayload();
    if (!payload) {
      return;
    }
    this.loading.set(true);
    const id = this.borradorId();
    const req = id ? this.facturas.actualizarBorrador(id, payload) : this.facturas.guardarBorrador(payload);
    req.subscribe({
      next: (c) => {
        this.loading.set(false);
        this.borradorId.set(c.id);
        this.toast.success(this.t('invoice.draftSaved'));
        void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', 'editar', c.id], { replaceUrl: true });
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(resolveInvoiceDraftSaveError(err, (k) => this.t(k)));
      },
    });
  }

  emitir(): void {
    const payload = this.armarPayload();
    if (!payload) {
      return;
    }
    this.loading.set(true);
    const id = this.borradorId();
    const req = id
      ? this.facturas.emitirBorrador(id, crypto.randomUUID())
      : this.facturas.emitir(payload, crypto.randomUUID());
    req.subscribe({
      next: (c) => {
        this.loading.set(false);
        this.toast.success(this.t('invoice.issued', { number: c.numeroComprobante, status: c.estadoSri }));
        void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', c.id]);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(resolveInvoiceEmitError(err, (k) => this.t(k)));
      },
    });
  }

  etiquetaVendedor(v: VendedorDto): string {
    const codigo = v.codigoInterno?.trim();
    return codigo ? `${codigo} — ${v.nombreCompleto}` : v.nombreCompleto;
  }

  vendedorEtiquetaActual(): string {
    const id = this.cabecera.vendedorId;
    if (!id) {
      return this.t('common.none');
    }
    const nombre = this.vendedorNombreCargado();
    if (nombre) {
      const v = this.vendedores().find((x) => x.id === id);
      const codigo = v?.codigoInterno?.trim();
      return codigo ? `${codigo} — ${nombre}` : nombre;
    }
    const v = this.vendedores().find((x) => x.id === id);
    return v ? this.etiquetaVendedor(v) : this.t('common.none');
  }

  textoVendedorHeredado(): string {
    const numero = this.cotizacionOrigenNumero();
    return numero
      ? this.t('salespeople.inheritedFromQuotation', { numero })
      : this.t('salespeople.inheritedFromQuotationNoNumber');
  }

  private armarPayload() {
    this.syncCorreosCabecera();
    if (!this.cabecera.puntoEmisionId) {
      this.toast.error(this.t('invoice.selectPoint'));
      return null;
    }
    if (!this.cabecera.identificacionReceptor.trim() || !this.cabecera.razonSocialReceptor.trim()) {
      this.toast.error(this.t('invoice.receiverRequired'));
      return null;
    }
    for (const c of this.camposExtra()) {
      if (!c.requerido) {
        continue;
      }
      const v = this.extraValores[c.codigo];
      if (v === '' || v === undefined || v === null) {
        this.toast.error(this.t('invoice.completeField', { field: c.etiqueta }));
        return null;
      }
    }
    const items = this.facturas.lineasToPayload(this.lineas());
    for (const it of items) {
      if (!it.codigoPrincipal || !it.descripcion || !it.cantidad || it.cantidad <= 0) {
        this.toast.error(this.t('invoice.lineInvalid'));
        return null;
      }
    }
    const payload = this.facturas.buildPayload(
      this.cabecera,
      this.lineas(),
      this.extraValores,
      this.camposExtra(),
      this.totales().total,
    );
    return this.fusionarCustomDataBorrador(payload);
  }

  private fusionarCustomDataBorrador(payload: ReturnType<FacturasService['buildPayload']>) {
    if (!this.borradorId()) {
      return payload;
    }
    const cd: Record<string, unknown> = { ...(payload.customData ?? {}) };
    for (const key of ['cotizacionId', 'cotizacionNumero'] as const) {
      const val = this.borradorCustomData[key];
      if (val != null && String(val).trim() !== '') {
        cd[key] = val;
      }
    }
    return { ...payload, customData: Object.keys(cd).length ? cd : payload.customData };
  }

  private cargarBorrador(id: string): void {
    this.facturas.obtenerComprobante(id).subscribe({
      next: (c) => {
        if (c.estadoSri !== 'BORRADOR') {
          this.toast.error(this.t('invoice.notDraft'));
          void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', id]);
          return;
        }
        const cd = c.customData ?? {};
        this.borradorCustomData = { ...cd };
        const cotId = cd['cotizacionId'];
        const desdeCotizacion = cotId != null && String(cotId).trim() !== '';
        this.vendedorDesdeCotizacion.set(desdeCotizacion);
        this.cotizacionOrigenNumero.set(
          cd['cotizacionNumero'] != null && String(cd['cotizacionNumero']).trim()
            ? String(cd['cotizacionNumero'])
            : null,
        );
        this.cabecera.puntoEmisionId = String(cd['puntoEmisionId'] ?? '');
        this.cabecera.fechaEmision = c.fechaEmision?.slice(0, 10) ?? this.cabecera.fechaEmision;
        this.cabecera.tipoIdentificacionReceptor = String(cd['tipoIdentificacionReceptor'] ?? '04');
        this.cabecera.identificacionReceptor = c.identificacionReceptor ?? '';
        this.cabecera.razonSocialReceptor = c.razonSocialReceptor ?? '';
        this.cabecera.glosa = String(cd['glosa'] ?? '').slice(0, MAX_INFO_ADICIONAL_CHARS);
        this.cabecera.direccionReceptor = String(cd['direccionReceptor'] ?? cd['direccionComprador'] ?? '');
        const vend = c.vendedorId ?? cd['vendedorId'];
        this.cabecera.vendedorId = vend != null && vend !== '' ? String(vend) : '';
        this.vendedorNombreCargado.set(c.vendedorNombre?.trim() ?? '');
        this.cargarCorreosDesdeCabecera(cd['emailsReceptor'] ?? cd['emailReceptor'] ?? '');
        this.lineas.set(this.facturas.comprobanteToLineas(c));
        this.lineasNonce.update((n) => n + 1);
        this.cargarCatalogos(() => this.aplicarExtrasDesdeComprobante(cd));
      },
      error: () => {
        this.toast.error(this.t('invoice.notFound'));
        void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas']);
      },
    });
  }

  private aplicarExtrasDesdeComprobante(cd: Record<string, unknown>): void {
    for (const campo of this.camposExtra()) {
      const raw = cd[campo.codigo];
      if (raw !== undefined && raw !== null) {
        this.extraValores[campo.codigo] = campo.tipo === 'number' ? Number(raw) : String(raw);
      }
    }
  }

  private cargarCatalogos(after?: () => void): void {
    this.vendedoresSvc.activos().subscribe({
      next: (v) => this.vendedores.set(v),
      error: () => this.vendedores.set([]),
    });
    this.catalogos.listarPuntos().subscribe({
      next: (p) => {
        this.puntos.set(p);
        if (!p.length) {
          this.toast.error(this.t('invoice.pointsLoadError'));
        } else if (!this.cabecera.puntoEmisionId) {
          this.cabecera.puntoEmisionId = p[0].id;
        }
      },
      error: () => this.toast.error(this.t('invoice.pointsLoadError')),
    });
    this.facturas.listarCamposExtra().subscribe({
      next: (rows) => {
        this.camposExtra.set(rows);
        const next: Record<string, string | number> = {};
        for (const c of rows) {
          next[c.codigo] = c.tipo === 'number' ? 0 : '';
        }
        this.extraValores = next;
      },
      error: () => this.camposExtra.set([]),
    });
    this.catalogos.listarClientes().subscribe({
      next: (rows) => {
        this.clientes.set(rows);
        this.sincronizarClienteMaestro();
      },
    });
    this.maestros.list<ProductoServicio>('productos', 0, 200).subscribe({
      next: (page) => {
        const productos = page.content;
        this.maestros.list<ProductoServicio>('servicios', 0, 200).subscribe({
          next: (servicios) => {
            this.itemsMaestro.set([...productos, ...servicios.content]);
            after?.();
          },
          error: () => {
            this.itemsMaestro.set(productos);
            after?.();
          },
        });
      },
      error: () => {
        this.maestros.list<ProductoServicio>('servicios', 0, 200).subscribe({
          next: (servicios) => {
            this.itemsMaestro.set(servicios.content);
            after?.();
          },
          error: () => {
            this.itemsMaestro.set([]);
            after?.();
          },
        });
      },
    });
  }
}
