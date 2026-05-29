import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { readAccessToken } from '../../core/auth.interceptor';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { gridActionsMenu } from '../../shared/ui/grid-actions.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorLocalGridComponent } from '../../shared/ui/organisms/ts-tabulator-local-grid/ts-tabulator-local-grid.component';
import {
  maestroErrorMessage,
  MaestrosService,
  type ClienteProveedor,
  type ClienteProveedorPayload,
  type ClienteProveedorTipo,
  type ConsultaRucResponse,
  type ImpuestoCatalogoItem,
  type ListaPrecioCreatePayload,
  type ListaPrecioOption,
  type MaestroEntidadTipo,
  type ProductoCategoriaPayload,
  type ProductoCategoriaRow,
  type ProductoServicio,
  type ProductoServicioPayload,
  type ProductoServicioTipo,
  type TerceroDireccion,
} from './maestros.service';

interface MaestroFormConfig {
  title: string;
  subtitle: string;
  eyebrow: string;
  tipo: MaestroEntidadTipo;
  clase: 'cliente' | 'producto';
  defaultTipoProducto?: 'PRODUCTO' | 'SERVICIO';
}

interface PrecioGridRow {
  _rowId: string;
  listaCodigo: string;
  precio: number;
  esPrincipal: boolean;
}

interface ImpuestoPrincipalGridRow {
  _rowId: string;
  rol: 'IVA' | 'ICE' | 'IRBPNR' | 'OTRO';
  catalogoItemId: string;
  porcentaje: number | null;
}

interface ProductoFormRawValues {
  codigoModo: 'MANUAL' | 'AUTO';
  codigoPrincipal: string;
  codigoAuxiliar: string;
  codigoBarra: string;
  descripcion: string;
  tipo: 'PRODUCTO' | 'SERVICIO';
  ivaCodigo: string;
  iceCodigo: string;
  irbpnrCodigo: string;
  categoriaId: string;
  impuestoLineas: {
    fuente: 'catalog' | 'preset' | 'manual';
    catalogoItemId: string;
    presetId: string;
    nombreManual: string;
    porcentaje: number | null;
  }[];
}

interface ImpuestoPreset {
  id: string;
  nombre: string;
  porcentaje: number;
}

interface CategoriaArbolNodo {
  row: ProductoCategoriaRow;
  children: CategoriaArbolNodo[];
}

interface JerarquiaCategoriaFilaVista {
  row: ProductoCategoriaRow;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

type DireccionFormGroup = ReturnType<MaestroFormPage['createDireccionGroup']>;

@Component({
  selector: 'ts-maestro-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, TsPageLayoutComponent, TsTabulatorLocalGridComponent],
  template: `
    <ts-page-layout [title]="pageTitle()" [subtitle]="formSubtitle()" [eyebrow]="t('masters.eyebrow')">
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        @if (config().clase === 'cliente' && clienteForm.controls.tipoIdentificacion.value === '04') {
          <button type="button" class="btn btn-soft-primary btn-sm" (click)="consultarRuc()" [disabled]="loading() || sriLoading()">
            {{ sriLoading() ? t('masters.querying') : t('masters.queryRuc') }}
          </button>
        }
        @if (config().clase === 'cliente' && id()) {
          <button type="button" class="btn btn-soft-primary btn-sm" (click)="nuevo()">{{ t('common.new') }}</button>
        }
        <button type="button" class="btn btn-primary btn-sm" (click)="submit()" [disabled]="loading()">{{ t('common.save') }}</button>
        <a class="btn btn-light btn-sm" [routerLink]="listLink()">{{ t('common.back') }}</a>
      </div>

      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('common.toContinue') }}
          } @else {
            {{ t('masters.companyRequired') }}
          }
        </p>
      } @else {
        @if (config().clase === 'cliente') {
          <form class="maestro-form" [formGroup]="clienteForm" (ngSubmit)="guardarCliente()">
            <section class="form-section">
              <div class="section-title">
                <span class="section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"></path><path d="M8 10h8M8 14h5"></path></svg>
                </span>
                <div>
                  <h3>{{ t('masters.generalData') }}</h3>
                  <p>{{ t('masters.generalDataDesc') }}</p>
                </div>
              </div>
              <div class="form-grid">
                <label>
                  <span>{{ t('masters.identificationType') }}</span>
                  <select class="form-select form-select-sm" formControlName="tipoIdentificacion" [class.readonly-control]="id()" [attr.aria-disabled]="!!id()">
                    <option value="04">04 - RUC</option>
                    <option value="05">05 - {{ t('masters.idCard') }}</option>
                    <option value="06">06 - {{ t('masters.passport') }}</option>
                    <option value="07">07 - {{ t('masters.finalConsumer') }}</option>
                    <option value="08">08 - Exterior</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('masters.identification') }}</span>
                  <input
                    class="form-control form-control-sm"
                    formControlName="identificacion"
                    maxlength="20"
                    [readonly]="!!id()"
                    [class.readonly-control]="id()"
                    (blur)="onIdentificacionBlur()"
                  />
                </label>
                <label>
                  <span>{{ t('masters.thirdPartyType') }}</span>
                  <select class="form-select form-select-sm" formControlName="tipoTercero">
                    <option value="CLIENTE">{{ t('menu.customers') }}</option>
                    <option value="PROVEEDOR">{{ t('menu.providers') }}</option>
                    <option value="AMBOS">{{ t('masters.both') }}</option>
                  </select>
                </label>
                <label class="span-2">
                  <span>{{ razonSocialLabel() }}</span>
                  <input class="form-control form-control-sm" formControlName="razonSocial" maxlength="300" />
                </label>
                <label>
                  <span>{{ nombreComercialLabel() }}</span>
                  <input class="form-control form-control-sm" formControlName="nombreComercial" maxlength="300" />
                </label>
                <label class="span-3">
                  <span>{{ t('masters.mainAddress') }}</span>
                  <input class="form-control form-control-sm" formControlName="direccion" maxlength="500" />
                </label>
              </div>
            </section>

            <section class="form-section">
              <div class="section-title">
                <span class="section-icon section-icon--teal" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"></path><path d="m4 7 8 6 8-6"></path></svg>
                </span>
                <div>
                  <h3>{{ t('masters.contact') }}</h3>
                  <p>{{ t('masters.contactDesc') }}</p>
                </div>
              </div>
              <div class="form-grid">
                <label>
                  <span>{{ t('masters.phone') }}</span>
                  <input class="form-control form-control-sm" formControlName="telefono" />
                </label>
                <label>
                  <span>{{ t('masters.email') }}</span>
                  <input class="form-control form-control-sm" type="email" formControlName="email" />
                </label>
                <label>
                  <span>{{ t('masters.contact') }}</span>
                  <input class="form-control form-control-sm" formControlName="contactoNombre" />
                </label>
                <label>
                  <span>{{ t('masters.contactPhone') }}</span>
                  <input class="form-control form-control-sm" formControlName="contactoTelefono" />
                </label>
                <label>
                  <span>{{ t('masters.contactEmail') }}</span>
                  <input class="form-control form-control-sm" type="email" formControlName="contactoEmail" />
                </label>
              </div>
            </section>

            <section class="form-section">
              <div class="section-title">
                <span class="section-icon section-icon--amber" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M7 3h10v18H7z"></path><path d="M10 7h4M10 11h4M10 15h2"></path></svg>
                </span>
                <div>
                  <h3>{{ t('masters.sriData') }}</h3>
                  <p>{{ t('masters.sriDataDesc') }}</p>
                </div>
              </div>
              <div class="form-grid">
                <label>
                  <span>{{ t('masters.accountingRequired') }}</span>
                  <select class="form-select form-select-sm" formControlName="obligadoContabilidad">
                    <option value="NO">NO</option>
                    <option value="SI">SI</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('masters.specialTaxpayer') }}</span>
                  <input class="form-control form-control-sm" formControlName="contribuyenteEspecial" />
                </label>
                <label>
                  <span>{{ t('masters.regime') }}</span>
                  <input class="form-control form-control-sm" formControlName="regimen" />
                </label>
                <label>
                  <span>{{ t('masters.sriStatus') }}</span>
                  <input class="form-control form-control-sm" formControlName="estadoSri" />
                </label>
                <label class="span-2">
                  <span>{{ t('masters.economicActivity') }}</span>
                  <input class="form-control form-control-sm" formControlName="actividadEconomica" />
                </label>
              </div>
            </section>

            <section class="form-section">
              <div class="section-title section-title--with-action">
                <span class="section-icon section-icon--violet" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
                </span>
                <div class="section-title__text">
                  <div>
                    <h3>{{ t('masters.addresses') }}</h3>
                    <p>{{ t('masters.addressesDesc') }}</p>
                  </div>
                </div>
                <div class="section-title__actions">
                  <button type="button" class="btn btn-soft-primary btn-sm" (click)="abrirDireccion()">{{ t('masters.addAddress') }}</button>
                </div>
              </div>
              <ts-tabulator-local-grid
                [data]="direccionesData()"
                [columns]="direccionColumns()"
                [reloadNonce]="direccionNonce()"
                emptyContext="addresses"
                height="260px"
                (rowAction)="onDireccionAction($event)"
              />
            </section>
          </form>
        } @else {
          <form class="maestro-form" [formGroup]="productoForm" (ngSubmit)="guardarProducto()">
            <section class="form-section producto-hero-section">
              <div class="section-title">
                <span class="section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"></path><path d="M8 10h8M8 14h5"></path></svg>
                </span>
                <div>
                  <h3>{{ t('masters.productCoreSection') }}</h3>
                  <p>{{ t('masters.productCoreDesc') }}</p>
                </div>
              </div>
              <div class="producto-hero-grid">
                <div class="producto-hero-media">
                  <div class="producto-img-box">
                    @if (productoImagenUrl()) {
                      <img [src]="productoImagenUrl()!" alt="" />
                    } @else if (productoImagenPreviewUrl()) {
                      <img [src]="productoImagenPreviewUrl()!" alt="" />
                    } @else {
                      <div class="producto-img-ph">{{ t('masters.noImageYet') }}</div>
                    }
                  </div>
                  <label class="btn btn-soft-primary btn-sm mb-0">
                    {{ t('masters.uploadImage') }}
                    <input type="file" class="d-none" accept="image/png,image/jpeg,image/webp" (change)="onProductoImagen($event)" />
                  </label>
                  <p class="text-muted small mb-0">{{ t('masters.imageConstraints') }}</p>
                </div>
                <div class="producto-hero-fields">
                  <div class="form-grid">
                    <fieldset class="span-3 codigo-modo-fieldset">
                      <legend class="form-legend">{{ t('masters.codeGenerationMode') }}</legend>
                      <div class="d-flex flex-wrap gap-3">
                        <label class="d-inline-flex align-items-center gap-2 mb-0">
                          <input type="radio" formControlName="codigoModo" value="MANUAL" />
                          <span>{{ t('masters.codeManual') }}</span>
                        </label>
                        <label class="d-inline-flex align-items-center gap-2 mb-0">
                          <input type="radio" formControlName="codigoModo" value="AUTO" />
                          <span>{{ t('masters.codeAutomatic') }}</span>
                        </label>
                      </div>
                    </fieldset>
                    <label>
                      <span>{{ t('masters.mainCode') }}</span>
                      <input
                        class="form-control form-control-sm"
                        formControlName="codigoPrincipal"
                        maxlength="50"
                      />
                      @if (productoForm.controls.codigoModo.value === 'AUTO') {
                        <span class="small text-muted">{{ t('masters.codeAutoHelp') }}</span>
                      }
                    </label>
                    <label>
                      <span>{{ t('masters.auxCode') }}</span>
                      <input class="form-control form-control-sm" formControlName="codigoAuxiliar" />
                    </label>
                    <label>
                      <span>{{ t('masters.barcode') }}</span>
                      <input class="form-control form-control-sm" formControlName="codigoBarra" maxlength="80" />
                    </label>
                    <div class="producto-tipo-cat-row span-3">
                      <label class="mb-0">
                        <span>{{ t('masters.type') }}</span>
                        <select class="form-select form-select-sm" formControlName="tipo">
                          <option value="PRODUCTO">{{ t('menu.products') }}</option>
                          <option value="SERVICIO">{{ t('menu.services') }}</option>
                        </select>
                      </label>
                      <label class="mb-0 producto-categoria-line">
                        <span>{{ t('masters.productCategory') }}</span>
                        <div class="categoria-select-row">
                          <select class="form-select form-select-sm" formControlName="categoriaId">
                            <option value="">{{ t('masters.noCategory') }}</option>
                            @for (c of categoriasProducto(); track c.id) {
                              <option [value]="c.id">{{ c.ruta }}</option>
                            }
                          </select>
                          <button type="button" class="btn btn-light btn-sm flex-shrink-0" (click)="abrirCategoriasModal()">
                            {{ t('masters.manageCategories') }}
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                  <label class="descripcion-field producto-descripcion-alineada">
                    <span>{{ t('masters.description') }}</span>
                    <div class="textarea-counter-wrap">
                      <textarea
                        class="form-control form-control-sm"
                        formControlName="descripcion"
                        rows="4"
                        maxlength="300"
                      ></textarea>
                      <span class="textarea-counter">{{ productoForm.controls.descripcion.value?.length ?? 0 }} / 300</span>
                    </div>
                  </label>
                </div>
              </div>
            </section>

            <div class="producto-precios-tributos-row">
              <section class="form-section form-section--nested producto-precios-tributos-row__col">
                <div class="section-title section-title--with-action">
                  <span class="section-icon section-icon--teal" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18v12H3z"></path><path d="M7 10h10M7 14h6"></path></svg>
                  </span>
                  <div class="section-title__text">
                    <div class="section-title-heading">
                      <h3>{{ t('masters.pricesByListSection') }}</h3>
                      <button
                        type="button"
                        class="section-help-btn"
                        [attr.title]="t('masters.pricesByListDesc')"
                        [attr.aria-label]="t('masters.pricesByListDesc')"
                      >
                        ?
                      </button>
                    </div>
                  </div>
                  <div class="section-title__actions">
                    <button type="button" class="btn btn-soft-primary btn-sm" (click)="addPrecioGridRow()">
                      {{ t('masters.addPriceRow') }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-icon-soft btn-sm"
                      (click)="abrirListaPrecioModal()"
                      [attr.title]="t('masters.managePriceLists')"
                      [attr.aria-label]="t('masters.managePriceLists')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1.5v2.2m0 16.6v2.2M4.5 4.5l1.55 1.55m12.9 12.9 1.55 1.55M1.5 12h2.2m16.6 0h2.2M4.5 19.5l1.55-1.55M18.95 5.05l1.55-1.55"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <ts-tabulator-local-grid
                  [data]="preciosGridTabData()"
                  [columns]="preciosGridColumns()"
                  [reloadNonce]="preciosGridNonce()"
                  emptyContext="prices"
                  height="220px"
                  (dataChange)="onPreciosGridDataChange($event)"
                  (rowAction)="onPreciosGridRowAction($event)"
                />
              </section>

              <section class="form-section form-section--nested producto-precios-tributos-row__col">
                <div class="section-title section-title--with-action">
                  <span class="section-icon section-icon--amber" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M7 3h10v18H7z"></path><path d="M10 7h4M10 11h4M10 15h2"></path></svg>
                  </span>
                  <div class="section-title__text">
                    <div class="section-title-heading">
                      <h3>{{ t('masters.mainTaxesSection') }}</h3>
                      <button
                        type="button"
                        class="section-help-btn"
                        [attr.title]="t('masters.mainTaxesDesc')"
                        [attr.aria-label]="t('masters.mainTaxesDesc')"
                      >
                        ?
                      </button>
                    </div>
                  </div>
                  <div class="section-title__actions">
                    <button type="button" class="btn btn-soft-primary btn-sm" (click)="addImpuestoPrincipalGridRow()">
                      {{ t('masters.addTaxRow') }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-icon-soft btn-sm"
                      (click)="abrirImpuestoCatalogoModal()"
                      [attr.title]="t('masters.manageTaxCatalog')"
                      [attr.aria-label]="t('masters.manageTaxCatalog')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1.5v2.2m0 16.6v2.2M4.5 4.5l1.55 1.55m12.9 12.9 1.55 1.55M1.5 12h2.2m16.6 0h2.2M4.5 19.5l1.55-1.55M18.95 5.05l1.55-1.55"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <ts-tabulator-local-grid
                  [data]="impuestosPrincipalesGridTabData()"
                  [columns]="impuestosPrincipalesGridColumns()"
                  [reloadNonce]="impuestosPrincipalesGridNonce()"
                  emptyContext="taxes"
                  height="220px"
                  (dataChange)="onPrincipalesGridDataChange($event)"
                  (rowAction)="onPrincipalesGridRowAction($event)"
                />
              </section>
            </div>

            <section class="form-section form-section--nested">
              <div class="section-title section-title--with-action">
                <span class="section-icon section-icon--amber" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 4h16v4H4zM4 10h16v10H4z"></path></svg>
                </span>
                <div class="section-title__text">
                  <div class="section-title-heading">
                    <h3>{{ t('masters.taxPresetsSection') }}</h3>
                    <button
                      type="button"
                      class="section-help-btn"
                      [attr.title]="t('masters.taxPresetsDesc')"
                      [attr.aria-label]="t('masters.taxPresetsDesc')"
                    >
                      ?
                    </button>
                  </div>
                </div>
              </div>
              <div class="form-grid mb-2">
                <label>
                  <span>{{ t('masters.taxPresetName') }}</span>
                  <input class="form-control form-control-sm" [(ngModel)]="nuevoPresetNombre" [ngModelOptions]="{ standalone: true }" maxlength="200" />
                </label>
                <label>
                  <span>{{ t('masters.taxPresetPercent') }}</span>
                  <input type="number" class="form-control form-control-sm" [(ngModel)]="nuevoPresetPorcentaje" [ngModelOptions]="{ standalone: true }" step="0.01" min="0" max="100" />
                </label>
                <div class="extra-rows__actions">
                  <button type="button" class="btn btn-soft-primary btn-sm" (click)="agregarImpuestoPreset()">{{ t('masters.addTaxPreset') }}</button>
                </div>
              </div>
              @if (impuestoPresets().length) {
                <ul class="list-unstyled small mb-3 impuesto-preset-list">
                  @for (p of impuestoPresets(); track p.id) {
                    <li class="d-flex justify-content-between align-items-center gap-2 py-1 border-bottom border-light">
                      <span>{{ p.nombre }} — {{ p.porcentaje }}%</span>
                      <button type="button" class="btn btn-link btn-sm text-danger p-0" (click)="eliminarImpuestoPreset(p.id)">{{ t('common.delete') }}</button>
                    </li>
                  }
                </ul>
              }
              <div class="section-title section-title--with-action pt-2 border-top border-light">
                <div class="section-title__text">
                  <div class="section-title-heading">
                    <h3 class="h6 mb-0">{{ t('masters.catalogTaxesSection') }}</h3>
                    <button
                      type="button"
                      class="section-help-btn"
                      [attr.title]="t('masters.catalogTaxesDesc')"
                      [attr.aria-label]="t('masters.catalogTaxesDesc')"
                    >
                      ?
                    </button>
                  </div>
                </div>
                <div class="section-title__actions">
                  <button type="button" class="btn btn-soft-primary btn-sm" (click)="addImpuestoLineRow()">
                    {{ t('masters.addTaxRow') }}
                  </button>
                </div>
              </div>
              <div formArrayName="impuestoLineas" class="extra-rows">
                @for (row of impuestoLineasArray.controls; track $index; let i = $index) {
                  <div class="form-grid" [formGroupName]="i">
                    <label>
                      <span>{{ t('masters.taxLineSource') }}</span>
                      <select class="form-select form-select-sm" formControlName="fuente">
                        <option value="catalog">{{ t('masters.taxFromCatalog') }}</option>
                        <option value="preset">{{ t('masters.taxFromPreset') }}</option>
                        <option value="manual">{{ t('masters.taxManualEntry') }}</option>
                      </select>
                    </label>
                    @if (row.get('fuente')?.value === 'catalog') {
                      <label class="span-2">
                        <span>{{ t('masters.catalogTax') }}</span>
                        <select class="form-select form-select-sm" formControlName="catalogoItemId">
                          <option value="">{{ t('masters.selectCatalogTax') }}</option>
                          @for (cat of impuestosCatalogo(); track cat.id) {
                            <option [value]="cat.id">{{ cat.codigo }} — {{ cat.nombre }}</option>
                          }
                        </select>
                      </label>
                      <label>
                        <span>{{ t('masters.taxPercentOptional') }}</span>
                        <input type="number" step="0.01" min="0" class="form-control form-control-sm" formControlName="porcentaje" />
                      </label>
                    }
                    @if (row.get('fuente')?.value === 'preset') {
                      <label class="span-2">
                        <span>{{ t('masters.selectTaxPreset') }}</span>
                        <select class="form-select form-select-sm" formControlName="presetId">
                          <option value="">{{ t('masters.selectTaxPreset') }}</option>
                          @for (p of impuestoPresets(); track p.id) {
                            <option [value]="p.id">{{ p.nombre }} ({{ p.porcentaje }}%)</option>
                          }
                        </select>
                      </label>
                    }
                    @if (row.get('fuente')?.value === 'manual') {
                      <label>
                        <span>{{ t('masters.taxManualName') }}</span>
                        <input class="form-control form-control-sm" formControlName="nombreManual" maxlength="200" />
                      </label>
                      <label>
                        <span>{{ t('masters.taxPresetPercent') }}</span>
                        <input type="number" step="0.01" min="0" max="100" class="form-control form-control-sm" formControlName="porcentaje" />
                      </label>
                    }
                    <div class="extra-rows__actions">
                      <button type="button" class="btn btn-light btn-sm" (click)="removeImpuestoLineRow(i)">{{ t('masters.removeRow') }}</button>
                    </div>
                  </div>
                }
              </div>
            </section>
          </form>
        }
      }
    </ts-page-layout>

    @if (direccionModalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarDireccionModal()"></div>
      <section class="ts-form-modal" role="dialog" aria-modal="true" aria-labelledby="direccion-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
          </div>
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('masters.addresses') }}</p>
            <h3 id="direccion-modal-title" class="mb-0">{{ editingDireccionIndex() >= 0 ? t('masters.editAddress') : t('masters.newAddress') }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarDireccionModal()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
          </button>
        </header>
        <form class="ts-form-modal__body" [formGroup]="direccionModalForm" (ngSubmit)="guardarDireccionModal()">
          <div class="form-grid">
            <label>
              <span>{{ t('masters.type') }}</span>
              <input class="form-control form-control-sm" formControlName="tipo" placeholder="MATRIZ" />
            </label>
            <label class="span-2">
              <span>{{ t('branches.address') }}</span>
              <input class="form-control form-control-sm" formControlName="direccion" />
            </label>
            <label>
              <span>{{ t('profile.province') }}</span>
              <input class="form-control form-control-sm" formControlName="provincia" />
            </label>
            <label>
              <span>{{ t('profile.canton') }}</span>
              <input class="form-control form-control-sm" formControlName="canton" />
            </label>
            <label>
              <span>{{ t('profile.parish') }}</span>
              <input class="form-control form-control-sm" formControlName="parroquia" />
            </label>
            <label class="span-3">
              <span>{{ t('masters.reference') }}</span>
              <input class="form-control form-control-sm" formControlName="referencia" />
            </label>
            <label class="principal-check span-3">
              <input type="checkbox" formControlName="principal" />
              {{ t('masters.main') }}
            </label>
          </div>
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarDireccionModal()">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary btn-sm">{{ t('masters.saveAddress') }}</button>
          </footer>
        </form>
      </section>
    }

    @if (impuestoCatalogoModalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarImpuestoCatalogoModal()"></div>
      <section class="ts-form-modal ts-form-modal--wide" role="dialog" aria-modal="true" aria-labelledby="imp-cat-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 3h10v18H7z"></path><path d="M10 7h4M10 11h4M10 15h2"></path></svg>
          </div>
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('masters.mainTaxesSection') }}</p>
            <h3 id="imp-cat-modal-title" class="mb-0">{{ t('masters.manageTaxCatalog') }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarImpuestoCatalogoModal()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
          </button>
        </header>
        <div class="ts-form-modal__body ts-imp-cat-modal-body">
          <div class="form-grid ts-imp-cat-modal-grid">
            <label>
              <span>{{ t('masters.taxPrincipalRol') }}</span>
              <select class="form-select form-select-sm" [(ngModel)]="catNuevoTipo" [ngModelOptions]="{ standalone: true }">
                <option value="IVA">IVA</option>
                <option value="ICE">ICE</option>
                <option value="IRBPNR">IRBPNR</option>
                <option value="OTRO">OTRO</option>
              </select>
            </label>
            <label>
              <span>{{ t('masters.categoryCode') }}</span>
              <input class="form-control form-control-sm" [(ngModel)]="catNuevoCodigo" [ngModelOptions]="{ standalone: true }" maxlength="50" />
            </label>
            <label>
              <span>{{ t('masters.taxPresetPercent') }}</span>
              <input type="number" class="form-control form-control-sm" [(ngModel)]="catNuevoPorc" [ngModelOptions]="{ standalone: true }" step="0.01" />
            </label>
            <label class="span-3">
              <span>{{ t('masters.categoryName') }}</span>
              <input class="form-control form-control-sm" [(ngModel)]="catNuevoNombre" [ngModelOptions]="{ standalone: true }" maxlength="200" />
            </label>
            <div class="span-3 ts-imp-cat-modal-actions">
              <button type="button" class="btn btn-primary btn-sm" [disabled]="loading()" (click)="crearImpuestoCatalogoDesdeModal()">
                {{ t('masters.catalogTaxCreate') }}
              </button>
            </div>
          </div>
          <div class="ts-imp-cat-modal-list">
            <div class="ts-imp-cat-modal-list__head">
              <h4 class="ts-imp-cat-modal-list__title">{{ t('masters.catalogTaxOwnList') }}</h4>
              <button
                type="button"
                class="section-help-btn"
                [attr.title]="t('masters.catalogTaxModalHint')"
                [attr.aria-label]="t('masters.catalogTaxModalHint')"
              >
                ?
              </button>
            </div>
            <ul class="list-unstyled small mb-0 ts-imp-cat-own-list">
            @for (c of impuestosCatalogoEmpresa(); track c.id) {
              <li class="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom border-light">
                <span class="text-break">{{ c.tipo }} / {{ c.codigo }} — {{ c.nombre }}</span>
                <button type="button" class="btn btn-link btn-sm text-danger p-0" [disabled]="loading()" (click)="eliminarItemCatalogoEmpresa(c.id)">
                  {{ t('common.delete') }}
                </button>
              </li>
            } @empty {
              <li class="text-muted">{{ t('masters.catalogTaxOwnEmpty') }}</li>
            }
          </ul>
          </div>
        </div>
        <footer class="ts-form-modal__footer">
          <button type="button" class="btn btn-light" (click)="cerrarImpuestoCatalogoModal()">{{ t('common.close') }}</button>
        </footer>
      </section>
    }

    @if (listaPrecioModalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarListaPrecioModal()"></div>
      <section class="ts-form-modal ts-form-modal--compact" role="dialog" aria-modal="true" aria-labelledby="lp-modal-title">
        <header class="ts-form-modal__header ts-form-modal__header--compact">
          <div class="ts-form-modal__head-text">
            <h3 id="lp-modal-title" class="mb-0">{{ t('masters.newPriceListTitle') }}</h3>
            <p class="ts-form-modal__subtitle mb-0">{{ t('masters.priceListModalHint') }}</p>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarListaPrecioModal()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
          </button>
        </header>
        <form class="ts-form-modal__body ts-lp-quick-form" (ngSubmit)="crearListaPrecioDesdeModal()">
          <label class="ts-lp-quick-form__label">
            <span>{{ t('masters.priceListName') }}</span>
            <div class="ts-lp-quick-form__row">
              <input
                class="form-control form-control-sm"
                [(ngModel)]="lpNuevoNombre"
                [ngModelOptions]="{ standalone: true }"
                maxlength="200"
                [placeholder]="t('masters.priceListNamePlaceholder')"
                [disabled]="loading()"
              />
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="loading() || !lpNuevoNombre.trim()">
                {{ loading() ? t('common.loading') : t('masters.priceListCreate') }}
              </button>
            </div>
          </label>
        </form>
      </section>
    }

    @if (categoriasModalOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarCategoriasModal()"></div>
      <section class="ts-form-modal ts-form-modal--wide" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"></path><path d="M8 10h8M8 14h5"></path></svg>
          </div>
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('masters.productCategory') }}</p>
            <h3 id="cat-modal-title" class="mb-0">{{ t('masters.categoriesModalTitle') }}</h3>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarCategoriasModal()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
          </button>
        </header>
        <nav class="ts-cat-modal-tabs" role="tablist" [attr.aria-label]="t('masters.categoriesModalTitle')">
          <button
            type="button"
            class="ts-cat-modal-tab"
            role="tab"
            [attr.aria-selected]="categoriasModalTab() === 'form'"
            (click)="categoriasModalTab.set('form')"
          >
            {{ t('masters.categoriesModalTabForm') }}
          </button>
          <button
            type="button"
            class="ts-cat-modal-tab"
            role="tab"
            [attr.aria-selected]="categoriasModalTab() === 'list'"
            (click)="categoriasModalTab.set('list')"
          >
            {{ t('masters.categoriesModalTabList') }}
            @if (categoriasProducto().length) {
              <span class="ts-cat-modal-tab__badge">{{ categoriasProducto().length }}</span>
            }
          </button>
        </nav>
        <div class="ts-form-modal__body ts-cat-modal-body">
          @if (categoriasModalTab() === 'form') {
            <form [formGroup]="categoriaAltaForm" (ngSubmit)="guardarCategoriaNueva()">
              <p class="small text-muted mb-2">{{ t('masters.newCategoryHint') }}</p>
              <div class="form-grid">
                <label>
                  <span>{{ t('masters.categoryCode') }}</span>
                  <input class="form-control form-control-sm" formControlName="codigo" maxlength="50" />
                </label>
                <label class="span-2">
                  <span>{{ t('masters.categoryName') }}</span>
                  <input class="form-control form-control-sm" formControlName="nombre" maxlength="200" />
                </label>
                <label class="span-3">
                  <span>{{ t('masters.parentCategory') }}</span>
                  <select class="form-select form-select-sm" formControlName="parentId">
                    <option value="">{{ t('masters.rootCategory') }}</option>
                    @for (c of categoriasProducto(); track c.id) {
                      <option [value]="c.id">{{ c.ruta }}</option>
                    }
                  </select>
                </label>
              </div>
              <div class="d-flex justify-content-end gap-2 mt-2">
                <button type="button" class="btn btn-light btn-sm" (click)="categoriaAltaForm.reset({ codigo: '', nombre: '', parentId: '' })">
                  {{ t('common.clear') }}
                </button>
                <button type="submit" class="btn btn-primary btn-sm" [disabled]="loading()">{{ t('masters.addCategory') }}</button>
              </div>
            </form>
          } @else {
            <div class="ts-cat-jerarquia">
              <p class="ts-cat-jerarquia-hint">{{ t('masters.categoriesListHint') }}</p>
              <div class="ts-cat-jerarquia-controls">
                <label class="ts-cat-jerarquia-search-wrap">
                  <span class="ts-cat-jerarquia-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20l-3.5-3.5" />
                    </svg>
                  </span>
                  <input
                    type="search"
                    class="ts-cat-jerarquia-search-input"
                    [value]="categoriaJerarquiaBusqueda()"
                    (input)="actualizarJerarquiaBusqueda($event)"
                    [attr.placeholder]="t('masters.categoryJerarquiaSearchPlaceholder')"
                    [attr.aria-label]="t('masters.categoryJerarquiaSearchPlaceholder')"
                  />
                </label>
                @if (categoriasProducto().length > 0 && !categoriaJerarquiaBusqueda().trim()) {
                  <div class="ts-cat-jerarquia-bulk" role="toolbar">
                    <button type="button" class="ts-cat-jerarquia-bulk__btn" (click)="jerarquiaExpandirTodo()">
                      {{ t('masters.categoryJerarquiaExpandAll') }}
                    </button>
                    <button type="button" class="ts-cat-jerarquia-bulk__btn" (click)="jerarquiaContraerTodo()">
                      {{ t('masters.categoryJerarquiaCollapseAll') }}
                    </button>
                  </div>
                }
              </div>
              @if (categoriasProducto().length === 0) {
                <p class="ts-cat-jerarquia-empty">{{ t('masters.categoryJerarquiaNoData') }}</p>
              } @else if (jerarquiaCategoriaFilas().length === 0) {
                <p class="ts-cat-jerarquia-empty">{{ t('masters.categoryJerarquiaEmpty') }}</p>
              } @else {
                <ul class="list-unstyled mb-0 ts-cat-jerarquia-list">
                  @for (fila of jerarquiaCategoriaFilas(); track fila.row.id) {
                    <li class="ts-cat-jerarquia-row" [style.--cat-depth]="fila.depth">
                      <div class="ts-cat-jerarquia-row__treecell">
                        @if (fila.hasChildren) {
                          <button
                            type="button"
                            class="ts-cat-jerarquia-row__toggle"
                            (click)="toggleJerarquiaExpand(fila.row.id)"
                            [attr.aria-expanded]="fila.expanded"
                            [attr.aria-label]="t('masters.categoryJerarquiaToggleBranch')"
                          >
                            <svg
                              class="ts-cat-jerarquia-row__chev"
                              [class.ts-cat-jerarquia-row__chev--open]="fila.expanded"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              aria-hidden="true"
                            >
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </button>
                        } @else {
                          <span class="ts-cat-jerarquia-row__toggle-spacer" aria-hidden="true"></span>
                        }
                        <div class="ts-cat-jerarquia-row__main">
                          @if (fila.row.codigo.trim()) {
                            <span class="ts-cat-jerarquia-row__code">{{ fila.row.codigo }}</span>
                          }
                          <span class="ts-cat-jerarquia-row__name" [attr.title]="fila.row.ruta">{{ fila.row.nombre }}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="ts-cat-jerarquia-row__delete"
                        (click)="solicitarEliminarCategoria(fila.row)"
                        [attr.title]="t('common.delete')"
                        [attr.aria-label]="t('common.delete')"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                          <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </div>
      </section>
    }

    @if (categoriaEliminarConfirm(); as catDel) {
      <div class="ts-modal-backdrop ts-modal-backdrop--stack" (click)="cerrarConfirmEliminarCategoria()"></div>
      <section class="ts-confirm-modal ts-confirm-modal--stack" role="alertdialog" aria-modal="true" aria-labelledby="cat-del-title">
        <h3 id="cat-del-title" class="mb-2">{{ t('masters.deleteCategoryTitle') }}</h3>
        <p class="mb-2">{{ t('masters.deleteCategoryConfirm') }}</p>
        <p class="small text-secondary mb-3 fw-semibold text-break">{{ catDel.ruta }}</p>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-light btn-sm" (click)="cerrarConfirmEliminarCategoria()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-danger btn-sm" (click)="confirmarEliminarCategoria()">{{ t('common.delete') }}</button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .maestro-form {
        display: grid;
        gap: 0.85rem;
      }
      .form-section {
        padding: 0.9rem;
        background: #fff;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 14px;
        box-shadow: var(--ef-surface-shadow);
      }
      .readonly-control {
        color: #475569;
        background: #f8fafc;
        border-color: #cbd5e1;
        pointer-events: none;
      }
      .section-title {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        margin-bottom: 0.85rem;
      }
      .section-title--with-action {
        align-items: flex-start;
      }
      .section-title__text {
        flex: 1;
        min-width: 0;
      }
      .section-title-heading {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .section-title-heading h3,
      .section-title-heading .h6 {
        margin: 0;
      }
      .section-title__actions {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
        margin-left: auto;
      }
      .section-help-btn {
        flex-shrink: 0;
        display: inline-grid;
        place-items: center;
        width: 1.42rem;
        height: 1.42rem;
        padding: 0;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: #fff;
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 800;
        line-height: 1;
        cursor: help;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
      }
      .section-help-btn:hover {
        border-color: #94a3b8;
        color: #0f172a;
        background: #f8fafc;
      }
      .section-help-btn:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .btn-icon-soft {
        display: inline-grid;
        place-items: center;
        width: 2.05rem;
        height: 2.05rem;
        padding: 0;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #fff;
        color: #64748b;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
      }
      .btn-icon-soft:hover {
        background: #f8fafc;
        color: #334155;
        border-color: #cbd5e1;
      }
      .btn-icon-soft:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .btn-icon-soft svg {
        width: 1.05rem;
        height: 1.05rem;
      }
      .btn-icon-soft circle {
        fill: none;
      }
      .section-title h3 {
        margin: 0;
        color: #0f172a;
        font-size: 0.98rem;
        font-weight: 800;
      }
      .section-title p {
        margin: 0.1rem 0 0;
        color: #64748b;
        font-size: 0.78rem;
      }
      .section-icon {
        display: grid;
        place-items: center;
        flex: 0 0 38px;
        width: 38px;
        height: 38px;
        color: #2563eb;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
      }
      .section-icon--teal {
        color: #0f766e;
        background: #f0fdfa;
        border-color: #99f6e4;
      }
      .section-icon--amber {
        color: #b45309;
        background: #fffbeb;
        border-color: #fde68a;
      }
      .section-icon--violet {
        color: #7c3aed;
        background: #f5f3ff;
        border-color: #ddd6fe;
      }
      .section-icon svg {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.7rem;
      }
      label {
        display: grid;
        gap: 0.28rem;
        margin: 0;
      }
      label span {
        color: #475569;
        font-size: 0.76rem;
        font-weight: 750;
      }
      .span-2 {
        grid-column: span 2;
      }
      .span-3 {
        grid-column: span 3;
      }
      .principal-check {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: #334155;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .ts-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1090;
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(3px);
      }
      .ts-form-modal {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(720px, calc(100vw - 2rem));
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      .ts-form-modal__header {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid rgba(226, 232, 240, 0.95);
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .ts-form-modal__icon {
        display: grid;
        place-items: center;
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        color: #7c3aed;
        background: #f5f3ff;
        border: 1px solid #ddd6fe;
        border-radius: 12px;
      }
      .ts-form-modal__icon svg {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .ts-form-modal__icon--teal {
        color: #0f766e;
        background: #f0fdfa;
        border-color: #99f6e4;
      }
      .ts-form-modal__eyebrow {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ts-form-modal__header h3 {
        color: #0f172a;
        font-size: 1rem;
        font-weight: 700;
      }
      .ts-form-modal__head-text {
        flex: 1;
        min-width: 0;
      }
      .ts-form-modal__close {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        margin-left: auto;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid rgba(203, 213, 225, 0.95);
        border-radius: 10px;
        color: #64748b;
        background: #fff;
        line-height: 0;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
      }
      .ts-form-modal__close:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
        color: #0f172a;
      }
      .ts-form-modal__close:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .ts-form-modal__close svg {
        display: block;
        width: 17px;
        height: 17px;
      }
      .ts-form-modal__body {
        display: grid;
        gap: 0.8rem;
        padding: 1rem 1.1rem 1.1rem;
      }
      .ts-form-modal__footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.5rem;
        padding: 0.85rem 1.1rem 1.05rem;
        border-top: 1px solid rgba(226, 232, 240, 0.95);
        background: linear-gradient(180deg, #fafbfc 0%, #f1f5f9 100%);
      }
      .ts-form-modal--wide {
        width: min(860px, calc(100vw - 2rem));
      }
      .ts-form-modal--compact {
        width: min(440px, calc(100vw - 2rem));
      }
      .ts-form-modal__header--compact {
        padding: 0.9rem 1rem;
        gap: 0.65rem;
      }
      .ts-form-modal__subtitle {
        margin-top: 0.2rem;
        color: #64748b;
        font-size: 0.78rem;
        line-height: 1.35;
      }
      .ts-lp-quick-form {
        padding: 0.85rem 1rem 1.1rem !important;
        gap: 0 !important;
      }
      .ts-lp-quick-form__label {
        display: grid;
        gap: 0.4rem;
        margin: 0;
      }
      .ts-lp-quick-form__label > span {
        color: #475569;
        font-size: 0.76rem;
        font-weight: 750;
      }
      .ts-lp-quick-form__row {
        display: flex;
        align-items: stretch;
        gap: 0.5rem;
      }
      .ts-lp-quick-form__row .form-control {
        flex: 1;
        min-width: 0;
      }
      .ts-lp-quick-form__row .btn {
        flex-shrink: 0;
        align-self: stretch;
        padding-left: 1rem;
        padding-right: 1rem;
      }
      .ts-imp-cat-modal-body {
        gap: 1.1rem;
      }
      .ts-imp-cat-modal-actions {
        display: flex;
        justify-content: flex-end;
        align-items: flex-end;
      }
      .ts-imp-cat-modal-list {
        display: grid;
        gap: 0.45rem;
      }
      .ts-imp-cat-modal-list__head {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
      .ts-imp-cat-modal-list__title {
        margin: 0;
        font-size: 0.84rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.01em;
        flex: 1;
        min-width: 0;
      }
      .ts-imp-cat-own-list {
        max-height: 240px;
        overflow: auto;
        margin: 0;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.25rem 0.55rem;
        background: #f8fafc;
      }
      .ts-modal-backdrop--stack {
        z-index: 1110;
      }
      .ts-confirm-modal {
        position: fixed;
        z-index: 1120;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(430px, calc(100vw - 2rem));
        padding: 1.1rem;
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      }
      .ts-confirm-modal h3 {
        margin: 0 0 0.35rem;
        color: #0f172a;
        font-size: 1rem;
        font-weight: 700;
      }
      .ts-confirm-modal p {
        margin: 0;
        color: #475569;
        font-size: 0.9rem;
      }
      .ts-cat-modal-tabs {
        display: flex;
        gap: 0.35rem;
        padding: 0.55rem 1rem 0;
        border-bottom: 1px solid rgba(226, 232, 240, 0.95);
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .ts-cat-modal-tab {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        border: 1px solid transparent;
        border-bottom: 0;
        border-radius: 10px 10px 0 0;
        padding: 0.48rem 0.6rem;
        font-size: 0.8rem;
        font-weight: 750;
        color: #64748b;
        background: transparent;
        cursor: pointer;
      }
      .ts-cat-modal-tab:hover {
        color: #334155;
        background: rgba(248, 250, 252, 0.7);
      }
      .ts-cat-modal-tab[aria-selected='true'] {
        color: #1d4ed8;
        background: #fff;
        border-color: #e2e8f0;
        border-bottom-color: #fff;
        margin-bottom: -1px;
        position: relative;
        z-index: 1;
      }
      .ts-cat-modal-tab__badge {
        min-width: 1.25rem;
        padding: 0.08rem 0.38rem;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 800;
        color: #1e40af;
        background: #dbeafe;
      }
      .ts-cat-modal-body {
        min-height: 14rem;
      }
      .ts-cat-jerarquia {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .ts-cat-jerarquia-hint {
        margin: 0;
        font-size: 0.78rem;
        line-height: 1.45;
        color: #64748b;
        padding: 0.5rem 0.7rem;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1px solid #e2e8f0;
        border-radius: 10px;
      }
      .ts-cat-jerarquia-controls {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.6rem;
        padding: 0.65rem 0.7rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      @media (min-width: 520px) {
        .ts-cat-jerarquia-controls {
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
        }
        .ts-cat-jerarquia-search-wrap {
          flex: 1 1 12rem;
          min-width: 0;
        }
        .ts-cat-jerarquia-bulk {
          flex: 0 0 auto;
          margin-left: auto;
        }
      }
      .ts-cat-jerarquia-search-wrap {
        position: relative;
        display: flex;
        align-items: center;
        margin: 0;
      }
      .ts-cat-jerarquia-search-icon {
        position: absolute;
        left: 0.65rem;
        display: flex;
        color: #94a3b8;
        pointer-events: none;
      }
      .ts-cat-jerarquia-search-icon svg {
        width: 1rem;
        height: 1rem;
      }
      .ts-cat-jerarquia-search-input {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.48rem 0.65rem 0.48rem 2.35rem;
        font-size: 0.85rem;
        color: #0f172a;
        background: #f8fafc;
        transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
      }
      .ts-cat-jerarquia-search-input::placeholder {
        color: #94a3b8;
      }
      .ts-cat-jerarquia-search-input:focus {
        outline: none;
        border-color: #3b82f6;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
      }
      .ts-cat-jerarquia-bulk {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
      }
      .ts-cat-jerarquia-bulk__btn {
        font-size: 0.74rem;
        font-weight: 700;
        color: #475569;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.38rem 0.6rem;
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      .ts-cat-jerarquia-bulk__btn:hover {
        background: #e2e8f0;
        color: #1e293b;
        border-color: #cbd5e1;
      }
      .ts-cat-jerarquia-bulk__btn:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .ts-cat-jerarquia-empty {
        margin: 0;
        padding: 1.75rem 1rem;
        text-align: center;
        font-size: 0.85rem;
        color: #64748b;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
      }
      .ts-cat-jerarquia-list {
        max-height: min(52vh, 420px);
        overflow: auto;
        padding: 0.15rem 0.2rem 0.35rem 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 #f1f5f9;
      }
      .ts-cat-jerarquia-list::-webkit-scrollbar {
        width: 8px;
      }
      .ts-cat-jerarquia-list::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 8px;
      }
      .ts-cat-jerarquia-list::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 8px;
      }
      .ts-cat-jerarquia-list::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      .ts-cat-jerarquia-row {
        --cat-depth: 0;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.6rem 0.65rem 0.6rem calc(0.55rem + min(var(--cat-depth), 10) * 0.85rem);
        background: #fff;
        border: 1px solid #e8edf3;
        border-radius: 12px;
        border-left: 3px solid #6366f1;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035);
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .ts-cat-jerarquia-row__treecell {
        display: flex;
        align-items: flex-start;
        gap: 0.35rem;
        flex: 1;
        min-width: 0;
      }
      .ts-cat-jerarquia-row__toggle {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        margin-top: 0.02rem;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: #f1f5f9;
        color: #475569;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      .ts-cat-jerarquia-row__toggle:hover {
        background: #e2e8f0;
        color: #1e293b;
      }
      .ts-cat-jerarquia-row__toggle:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .ts-cat-jerarquia-row__chev {
        width: 1rem;
        height: 1rem;
        transition: transform 0.18s ease;
      }
      .ts-cat-jerarquia-row__chev--open {
        transform: rotate(90deg);
      }
      .ts-cat-jerarquia-row__toggle-spacer {
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
      }
      .ts-cat-jerarquia-row:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07);
      }
      .ts-cat-jerarquia-row__main {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .ts-cat-jerarquia-row__code {
        align-self: flex-start;
        font-size: 0.68rem;
        font-weight: 750;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #4338ca;
        background: #eef2ff;
        padding: 0.14rem 0.42rem;
        border-radius: 6px;
        border: 1px solid rgba(99, 102, 241, 0.22);
      }
      .ts-cat-jerarquia-row__name {
        font-size: 0.88rem;
        font-weight: 650;
        line-height: 1.4;
        color: #0f172a;
        word-break: break-word;
      }
      .ts-cat-jerarquia-row__delete {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.1rem;
        height: 2.1rem;
        margin-top: 0.05rem;
        padding: 0;
        border: none;
        border-radius: 10px;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }
      .ts-cat-jerarquia-row__delete svg {
        width: 1.05rem;
        height: 1.05rem;
      }
      .ts-cat-jerarquia-row__delete:hover {
        color: #dc2626;
        background: #fef2f2;
      }
      .ts-cat-jerarquia-row__delete:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .form-section--nested {
        margin-top: 0.75rem;
        padding: 0.75rem 0.85rem;
        background: #f8fafc;
        border-style: dashed;
      }
      .extra-rows {
        display: grid;
        gap: 0.65rem;
      }
      .extra-rows .form-grid {
        align-items: end;
      }
      .extra-rows__actions {
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
      }
      .producto-media-section .text-muted.small {
        max-width: 52rem;
      }
      .producto-media-layout {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: flex-start;
      }
      .producto-img-box {
        flex: 0 0 200px;
        min-height: 140px;
        border-radius: 12px;
        border: 1px dashed #cbd5e1;
        background: #f8fafc;
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .producto-img-ph {
        color: #64748b;
        font-size: 0.82rem;
        text-align: center;
        padding: 1rem;
      }
      .producto-img-box img {
        display: block;
        width: 100%;
        max-height: 180px;
        object-fit: contain;
      }
      .producto-media-actions {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .producto-hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
        gap: 1.15rem;
        align-items: start;
      }
      .producto-hero-media {
        display: grid;
        gap: 0.5rem;
      }
      .producto-hero-fields {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 0;
      }
      .producto-tipo-cat-row {
        display: grid;
        grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
        gap: 0.7rem;
        align-items: end;
      }
      .producto-tipo-cat-row label {
        display: grid;
        gap: 0.28rem;
        margin: 0;
      }
      .producto-precios-tributos-row {
        display: grid;
        gap: 0.85rem;
      }
      @media (min-width: 1000px) {
        .producto-precios-tributos-row {
          grid-template-columns: 1fr 1fr;
          align-items: start;
        }
      }
      .producto-precios-tributos-row__col {
        min-width: 0;
      }
      .categoria-select-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }
      .categoria-select-row .form-select {
        flex: 1;
        min-width: 0;
      }
      .producto-descripcion-alineada {
        margin-top: 0;
        width: 100%;
      }
      .codigo-modo-fieldset {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.5rem 0.75rem;
        margin: 0 0 0.35rem;
      }
      .form-legend {
        float: none;
        width: auto;
        padding: 0;
        margin-bottom: 0.35rem;
        font-size: 0.76rem;
        font-weight: 750;
        color: #475569;
      }
      .descripcion-field {
        display: grid;
        gap: 0.35rem;
      }
      .textarea-counter-wrap {
        position: relative;
      }
      .textarea-counter-wrap textarea {
        padding-bottom: 1.55rem;
        min-height: 6.5rem;
        resize: vertical;
      }
      .textarea-counter {
        position: absolute;
        right: 0.55rem;
        bottom: 0.45rem;
        font-size: 0.68rem;
        font-weight: 700;
        color: #64748b;
        pointer-events: none;
        background: linear-gradient(0deg, #fff 55%, transparent);
        padding: 0.15rem 0.2rem;
        border-radius: 6px;
      }
      .precio-lista-row .principal-radio span {
        display: block;
        margin-bottom: 0.25rem;
      }
      .impuesto-preset-list {
        max-height: 160px;
        overflow: auto;
      }
      @media (max-width: 900px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
        .span-2,
        .span-3 {
          grid-column: auto;
        }
        .section-title--with-action {
          flex-wrap: wrap;
        }
        .section-title__actions {
          width: 100%;
          margin-left: 0;
          justify-content: flex-end;
        }
        .producto-hero-grid {
          grid-template-columns: 1fr;
        }
        .producto-precios-tributos-row {
          grid-template-columns: 1fr;
        }
        .producto-tipo-cat-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class MaestroFormPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly maestros = inject(MaestrosService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);
  private readonly toast = inject(UiToastService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;
  readonly loading = signal(false);
  readonly sriLoading = signal(false);
  readonly id = signal<string | null>(null);
  readonly direccionNonce = signal(0);
  readonly direccionModalOpen = signal(false);
  readonly editingDireccionIndex = signal(-1);
  private lastLookupIdentificacion = '';
  readonly config = signal<MaestroFormConfig>({
    title: 'Maestro',
    subtitle: '',
    eyebrow: 'Maestros',
    tipo: 'clientes',
    clase: 'cliente',
  });
  readonly pageTitle = computed(() =>
    this.i18n.t(this.id() ? 'masters.editTitle' : 'masters.createTitle', { name: this.entityName().toLowerCase() }),
  );

  readonly clienteForm = this.fb.nonNullable.group({
    tipoIdentificacion: ['04', [Validators.required]],
    identificacion: ['', [Validators.required]],
    razonSocial: ['', [Validators.required, Validators.maxLength(300)]],
    nombreComercial: [''],
    tipoTercero: ['CLIENTE' as 'CLIENTE' | 'PROVEEDOR' | 'AMBOS'],
    direccion: [''],
    telefono: [''],
    email: ['', [Validators.email]],
    contactoNombre: [''],
    contactoTelefono: [''],
    contactoEmail: ['', [Validators.email]],
    obligadoContabilidad: ['NO' as 'SI' | 'NO'],
    contribuyenteEspecial: ['NO'],
    regimen: ['GENERAL'],
    estadoSri: [''],
    actividadEconomica: [''],
    fuenteDatos: [''],
    direcciones: this.fb.array<DireccionFormGroup>([]),
  });

  readonly productoForm = this.fb.group({
    codigoModo: this.fb.nonNullable.control<'MANUAL' | 'AUTO'>('MANUAL'),
    codigoPrincipal: ['', [Validators.required, Validators.maxLength(50)]],
    codigoAuxiliar: [''],
    codigoBarra: ['', [Validators.maxLength(80)]],
    descripcion: ['', [Validators.required, Validators.maxLength(300)]],
    tipo: ['PRODUCTO' as 'PRODUCTO' | 'SERVICIO'],
    ivaCodigo: [''],
    iceCodigo: [''],
    irbpnrCodigo: [''],
    categoriaId: [''],
    impuestoLineas: this.fb.array<FormGroup>([]),
  });

  readonly listasPrecio = signal<ListaPrecioOption[]>([]);
  readonly preciosGridRows = signal<PrecioGridRow[]>([]);
  readonly preciosGridNonce = signal(0);
  readonly impuestosPrincipalesGridRows = signal<ImpuestoPrincipalGridRow[]>([]);
  readonly impuestosPrincipalesGridNonce = signal(0);
  readonly impuestoCatalogoModalOpen = signal(false);
  readonly listaPrecioModalOpen = signal(false);
  readonly productoImagenUrl = signal<string | null>(null);
  readonly impuestosCatalogo = signal<ImpuestoCatalogoItem[]>([]);
  readonly impuestosCatalogoEmpresa = computed(() => this.impuestosCatalogo().filter((x) => !!x.empresaId));

  /** Referencias estables para Tabulator: evitar `.map()` en cada ciclo de CD (congelaba la pantalla). */
  readonly preciosGridTabData = computed(() =>
    this.preciosGridRows().map((r) => ({
      _rowId: r._rowId,
      listaCodigo: r.listaCodigo,
      precio: r.precio,
      esPrincipal: r.esPrincipal,
    })),
  );

  readonly impuestosPrincipalesGridTabData = computed(() =>
    this.impuestosPrincipalesGridRows().map((r) => ({
      _rowId: r._rowId,
      rol: r.rol,
      catalogoItemId: r.catalogoItemId,
      porcentaje: r.porcentaje,
    })),
  );

  readonly preciosGridColumns = computed((): ColumnDefinition[] => {
    this.i18n.language();
    const listas = this.listasPrecio();
    const listaValues: Record<string, string> = {};
    for (const lp of listas) {
      listaValues[lp.codigo] = `${lp.codigo} — ${lp.nombre}`;
    }
    return [
      {
        title: this.t('masters.mainPriceList'),
        field: 'esPrincipal',
        width: 110,
        hozAlign: 'center',
        formatter: 'tickCross',
        editor: 'tickCross',
      },
      {
        title: this.t('masters.otherList'),
        field: 'listaCodigo',
        editor: 'list',
        editorParams: { values: listaValues },
        minWidth: 160,
      },
      {
        title: this.t('masters.unitPrice'),
        field: 'precio',
        editor: 'number',
        editorParams: { min: 0, step: 0.000001 },
        hozAlign: 'right',
      },
      {
        title: '',
        width: 72,
        hozAlign: 'center',
        headerSort: false,
        formatter: () =>
          gridActionsMenu(
            [{ action: 'eliminar', label: this.t('masters.removeRow'), icon: 'delete', danger: true }],
            this.t('common.actions'),
          ),
      },
    ];
  });

  readonly impuestosPrincipalesGridColumns = computed((): ColumnDefinition[] => {
    this.i18n.language();
    const cat = this.impuestosCatalogo();
    const rolValues: Record<string, string> = { IVA: 'IVA', ICE: 'ICE', IRBPNR: 'IRBPNR', OTRO: 'OTRO' };
    return [
      {
        title: this.t('masters.taxPrincipalRol'),
        field: 'rol',
        width: 110,
        editor: 'list',
        editorParams: { values: rolValues },
      },
      {
        title: this.t('masters.taxCatalogItem'),
        field: 'catalogoItemId',
        minWidth: 200,
        formatter: (cell) => {
          const id = String((cell as { getValue: () => unknown }).getValue() ?? '').trim();
          if (!id) {
            return '—';
          }
          const item = cat.find((x) => x.id === id);
          return item ? `${item.codigo} — ${item.nombre}` : id;
        },
        editor: 'list',
        editorParams: (cell: { getData: () => { rol?: string } }) => {
          const rol = String(cell.getData().rol ?? 'IVA').toUpperCase();
          const values: Record<string, string> = {};
          for (const x of cat) {
            if (rol === 'OTRO' || String(x.tipo).toUpperCase() === rol) {
              values[x.id] = MaestroFormPage.catalogoImpuestoLabel(x);
            }
          }
          return { values };
        },
      },
      {
        title: this.t('masters.taxPresetPercent'),
        field: 'porcentaje',
        hozAlign: 'right',
        width: 120,
        formatter: (cell) => {
          const v = (cell as { getValue: () => unknown }).getValue();
          if (v === null || v === undefined || v === '') {
            return '—';
          }
          const n = Number(v);
          return Number.isFinite(n) ? `${n}%` : '—';
        },
        editable: (cell) => {
          const row = (cell as { getRow: () => { getData: () => { catalogoItemId?: string } } }).getRow().getData();
          const catId = String(row.catalogoItemId ?? '').trim();
          if (!catId) {
            return false;
          }
          const item = cat.find((x) => x.id === catId);
          return !item || item.porcentajeDefault == null;
        },
        editor: 'number',
        editorParams: { min: 0, max: 100, step: 0.01 },
      },
      {
        title: '',
        width: 72,
        headerSort: false,
        formatter: () =>
          gridActionsMenu(
            [{ action: 'eliminar', label: this.t('masters.removeRow'), icon: 'delete', danger: true }],
            this.t('common.actions'),
          ),
      },
    ];
  });

  readonly categoriasProducto = signal<ProductoCategoriaRow[]>([]);
  readonly categoriasModalOpen = signal(false);
  readonly categoriasModalTab = signal<'form' | 'list'>('form');
  readonly categoriaEliminarConfirm = signal<{ id: string; ruta: string } | null>(null);
  readonly categoriaJerarquiaBusqueda = signal('');
  private readonly jerarquiaExpandedIds = signal<ReadonlySet<string>>(new Set());

  readonly jerarquiaCategoriaFiltradas = computed(() => {
    const rows = this.categoriasProducto();
    const q = this.categoriaJerarquiaBusqueda().trim().toLowerCase();
    if (!q) {
      return rows;
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const matches = (c: ProductoCategoriaRow) =>
      (c.ruta ?? '').toLowerCase().includes(q) ||
      String(c.codigo ?? '')
        .toLowerCase()
        .includes(q) ||
      String(c.nombre ?? '')
        .toLowerCase()
        .includes(q);
    const matched = new Set<string>();
    for (const r of rows) {
      if (matches(r)) {
        matched.add(r.id);
      }
    }
    const keep = new Set<string>(matched);
    for (const id of matched) {
      let cur = byId.get(id);
      while (cur?.parentId) {
        const p = byId.get(cur.parentId);
        if (!p) {
          break;
        }
        keep.add(p.id);
        cur = p;
      }
    }
    return rows.filter((r) => keep.has(r.id));
  });

  readonly jerarquiaCategoriaArbol = computed(() => MaestroFormPage.buildCategoriaArbol(this.jerarquiaCategoriaFiltradas()));

  readonly jerarquiaCategoriaFilas = computed(() => {
    const q = this.categoriaJerarquiaBusqueda().trim();
    const forceExpand = q.length > 0;
    return MaestroFormPage.flattenCategoriaArbol(
      this.jerarquiaCategoriaArbol(),
      0,
      this.jerarquiaExpandedIds(),
      forceExpand,
    );
  });
  readonly impuestoPresets = signal<ImpuestoPreset[]>([]);
  readonly productoImagenPreviewUrl = signal<string | null>(null);
  readonly productoImagenPendiente = signal<File | null>(null);
  private productoImagenObjectUrl: string | null = null;
  nuevoPresetNombre = '';
  nuevoPresetPorcentaje: number | null = null;
  catNuevoTipo = 'IVA';
  catNuevoCodigo = '';
  catNuevoNombre = '';
  catNuevoPorc: number | null = null;
  lpNuevoNombre = '';

  readonly direccionModalForm = this.createDireccionGroup();

  readonly categoriaAltaForm = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(50)]],
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    parentId: [''],
  });

  readonly direccionColumns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    return [
      {
        title: '',
        width: 72,
        hozAlign: 'center',
        headerSort: false,
        formatter: () =>
          gridActionsMenu(
            [
              { action: 'editar', label: this.t('common.edit'), icon: 'edit' },
              { action: 'eliminar', label: this.t('masters.remove'), icon: 'delete', danger: true },
            ],
            this.t('common.actions'),
          ),
      },
      { title: this.t('masters.type'), field: 'tipo', width: 105, formatter: 'textarea' },
      { title: this.t('branches.address'), field: 'direccion', minWidth: 260, formatter: 'textarea' },
      { title: this.t('profile.province'), field: 'provincia', minWidth: 130, formatter: 'textarea' },
      { title: this.t('profile.canton'), field: 'canton', minWidth: 130, formatter: 'textarea' },
      {
        title: this.t('masters.main'),
        field: 'principal',
        width: 110,
        formatter: (cell: unknown) =>
          (cell as { getValue: () => unknown }).getValue()
            ? '<span class="badge bg-soft-success text-success">SI</span>'
            : '<span class="badge bg-light text-muted">NO</span>',
      },
    ];
  });

  get direcciones(): FormArray<DireccionFormGroup> {
    return this.clienteForm.controls.direcciones;
  }

  get impuestoLineasArray(): FormArray<FormGroup> {
    return this.productoForm.get('impuestoLineas') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.reloadImpuestoPresetsFromStorage();
    this.productoForm.controls.codigoModo.valueChanges.subscribe(() => this.applyCodigoModo());
    this.applyCodigoModo();
    this.route.data.subscribe((data) => {
      const config = data as MaestroFormConfig;
      this.config.set(config);
      this.productoForm.controls.tipo.setValue(config.defaultTipoProducto ?? 'PRODUCTO');
      if (config.clase === 'cliente') {
        this.clienteForm.controls.tipoTercero.setValue(this.defaultTipoTercero());
      }
      if (config.clase === 'producto' && this.tieneEmpresa) {
        this.loadListasPrecio();
        this.loadImpuestosCatalogo();
        this.loadCategoriasProducto();
      }
    });
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.id.set(id);
      if (id) {
        this.cargar(id);
      } else if (this.config().clase === 'cliente') {
        this.resetClienteForm();
      } else if (this.config().clase === 'producto') {
        this.resetProductoForm();
      }
    });
  }

  ngOnDestroy(): void {
    this.limpiarPreviewProductoImagen();
  }

  listLink(): string[] {
    return ['/t', this.tenant.tenantSlug(), this.config().tipo];
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  formSubtitle(): string {
    const keys: Partial<Record<MaestroEntidadTipo, string>> = {
      clientes: 'masters.customersSubtitle',
      proveedores: 'masters.providersSubtitle',
      productos: 'masters.productsSubtitle',
      servicios: 'masters.servicesSubtitle',
    };
    return this.t(keys[this.config().tipo] ?? 'masters.customersSubtitle');
  }

  entityName(): string {
    const keys: Partial<Record<MaestroEntidadTipo, string>> = {
      clientes: 'masters.customersTitle',
      proveedores: 'masters.providersTitle',
      productos: 'masters.productsTitle',
      servicios: 'masters.servicesTitle',
    };
    return this.t(keys[this.config().tipo] ?? 'masters.customersTitle');
  }

  submit(): void {
    if (this.config().clase === 'cliente') {
      this.guardarCliente();
    } else {
      this.guardarProducto();
    }
  }

  nuevo(): void {
    void this.router.navigate(['/t', this.tenant.tenantSlug(), this.config().tipo, 'nuevo']);
  }

  private newGridRowId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  onPreciosGridDataChange(rows: Record<string, unknown>[]): void {
    const mapped: PrecioGridRow[] = rows.map((raw) => ({
      _rowId: String(raw['_rowId'] ?? this.newGridRowId()),
      listaCodigo: String(raw['listaCodigo'] ?? '').trim().toUpperCase(),
      precio: Number(raw['precio'] ?? 0),
      esPrincipal: !!raw['esPrincipal'],
    }));
    const anyPrincipal = mapped.some((r) => r.esPrincipal);
    const fixed =
      anyPrincipal || !mapped.length ? mapped : mapped.map((r, i) => (i === 0 ? { ...r, esPrincipal: true } : r));
    this.preciosGridRows.set(fixed);
  }

  onPreciosGridRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    if (ev.action !== 'eliminar') {
      return;
    }
    const id = String(ev.row['_rowId'] ?? '');
    const rest = this.preciosGridRows().filter((r) => r._rowId !== id);
    if (!rest.length) {
      return;
    }
    if (!rest.some((r) => r.esPrincipal)) {
      rest[0] = { ...rest[0], esPrincipal: true };
    }
    this.preciosGridRows.set(rest);
    this.preciosGridNonce.update((n) => n + 1);
  }

  addPrecioGridRow(): void {
    this.preciosGridRows.update((rows) => [...rows, { _rowId: this.newGridRowId(), listaCodigo: '', precio: 0, esPrincipal: false }]);
    this.preciosGridNonce.update((n) => n + 1);
  }

  onPrincipalesGridDataChange(rows: Record<string, unknown>[]): void {
    const cat = this.impuestosCatalogo();
    const mapped: ImpuestoPrincipalGridRow[] = rows.map((raw) => {
      const rRaw = String(raw['rol'] ?? 'IVA').toUpperCase();
      const safeRol: 'IVA' | 'ICE' | 'IRBPNR' | 'OTRO' =
        rRaw === 'ICE' || rRaw === 'IRBPNR' || rRaw === 'OTRO' ? rRaw : 'IVA';
      let catalogoItemId = String(raw['catalogoItemId'] ?? '').trim();
      if (catalogoItemId) {
        const def = cat.find((c) => c.id === catalogoItemId);
        if (!def || (safeRol !== 'OTRO' && String(def.tipo).toUpperCase() !== safeRol)) {
          catalogoItemId = '';
        }
      }
      let porcentaje: number | null = null;
      if (catalogoItemId) {
        const fromCat = MaestroFormPage.porcentajeDesdeCatalogo(cat, catalogoItemId);
        if (fromCat != null) {
          porcentaje = fromCat;
        } else {
          const manual =
            raw['porcentaje'] === null || raw['porcentaje'] === undefined || String(raw['porcentaje']).trim() === ''
              ? null
              : Number(raw['porcentaje']);
          porcentaje = Number.isFinite(manual as number) ? manual : null;
        }
      }
      return {
        _rowId: String(raw['_rowId'] ?? this.newGridRowId()),
        rol: safeRol,
        catalogoItemId,
        porcentaje,
      };
    });
    this.impuestosPrincipalesGridRows.set(mapped);
    this.syncTaxCodesFromPrincipalesGrid();
  }

  onPrincipalesGridRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    if (ev.action !== 'eliminar') {
      return;
    }
    const id = String(ev.row['_rowId'] ?? '');
    const rest = this.impuestosPrincipalesGridRows().filter((r) => r._rowId !== id);
    this.impuestosPrincipalesGridRows.set(rest.length ? rest : [this.defaultImpuestoPrincipalRow('IVA')]);
    this.impuestosPrincipalesGridNonce.update((n) => n + 1);
    this.syncTaxCodesFromPrincipalesGrid();
  }

  addImpuestoPrincipalGridRow(): void {
    this.impuestosPrincipalesGridRows.update((rows) => [...rows, this.defaultImpuestoPrincipalRow('IVA')]);
    this.impuestosPrincipalesGridNonce.update((n) => n + 1);
  }

  private defaultImpuestoPrincipalRow(rol: 'IVA' | 'ICE' | 'IRBPNR' | 'OTRO'): ImpuestoPrincipalGridRow {
    return { _rowId: this.newGridRowId(), rol, catalogoItemId: '', porcentaje: null };
  }

  private syncTaxCodesFromPrincipalesGrid(): void {
    const cat = this.impuestosCatalogo();
    const firstCodigo = (rol: 'IVA' | 'ICE' | 'IRBPNR'): string => {
      const row = this.impuestosPrincipalesGridRows().find((r) => r.rol === rol && r.catalogoItemId);
      if (!row) {
        return '';
      }
      const c = cat.find((x) => x.id === row.catalogoItemId);
      return c?.codigo ?? '';
    };
    this.productoForm.patchValue({
      ivaCodigo: firstCodigo('IVA'),
      iceCodigo: firstCodigo('ICE'),
      irbpnrCodigo: firstCodigo('IRBPNR'),
    });
  }

  private extraImpuestosCatalogoFromPrincipales(): { catalogoItemId: string; porcentaje?: number }[] {
    const rows = this.impuestosPrincipalesGridRows();
    const byRol = new Map<'IVA' | 'ICE' | 'IRBPNR' | 'OTRO', ImpuestoPrincipalGridRow[]>();
    for (const r of rows) {
      const list = byRol.get(r.rol) ?? [];
      list.push(r);
      byRol.set(r.rol, list);
    }
    const out: { catalogoItemId: string; porcentaje?: number }[] = [];
    for (const rol of ['IVA', 'ICE', 'IRBPNR', 'OTRO'] as const) {
      const list = byRol.get(rol) ?? [];
      for (const r of list.slice(1)) {
        if (r.catalogoItemId) {
          const pct = r.porcentaje != null && Number.isFinite(r.porcentaje) ? r.porcentaje : undefined;
          out.push({ catalogoItemId: r.catalogoItemId, porcentaje: pct });
        }
      }
    }
    return out;
  }

  addImpuestoLineRow(): void {
    this.impuestoLineasArray.push(this.createImpuestoLineGroup());
  }

  removeImpuestoLineRow(index: number): void {
    this.impuestoLineasArray.removeAt(index);
  }

  applyCodigoModo(): void {
    if (this.config().clase !== 'producto') {
      return;
    }
    const manual = this.productoForm.controls.codigoModo.getRawValue() === 'MANUAL';
    const c = this.productoForm.controls.codigoPrincipal;
    if (manual) {
      c.setValidators([Validators.required, Validators.maxLength(50)]);
      c.enable({ emitEvent: false });
    } else {
      c.clearValidators();
      c.setValidators([Validators.maxLength(50)]);
      c.setValue('', { emitEvent: false });
      c.disable({ emitEvent: false });
    }
    c.updateValueAndValidity({ emitEvent: false });
  }

  agregarImpuestoPreset(): void {
    const nombre = this.nuevoPresetNombre.trim();
    const p = Number(this.nuevoPresetPorcentaje);
    if (!nombre || !Number.isFinite(p) || p < 0 || p > 100) {
      this.showMsg(this.t('masters.taxPresetInvalid'), false);
      return;
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p-${Date.now()}`;
    this.impuestoPresets.update((list) => [...list, { id, nombre, porcentaje: p }]);
    this.persistImpuestoPresets();
    this.nuevoPresetNombre = '';
    this.nuevoPresetPorcentaje = null;
  }

  eliminarImpuestoPreset(id: string): void {
    this.impuestoPresets.update((list) => list.filter((x) => x.id !== id));
    this.persistImpuestoPresets();
  }

  onProductoImagen(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const sid = this.id();
    if (!sid) {
      this.limpiarPreviewProductoImagen();
      this.productoImagenPendiente.set(file);
      const url = URL.createObjectURL(file);
      this.productoImagenObjectUrl = url;
      this.productoImagenPreviewUrl.set(url);
      input.value = '';
      return;
    }
    const tipo = this.config().tipo as ProductoServicioTipo;
    this.loading.set(true);
    this.maestros.uploadProductoImagen(tipo, sid, file).subscribe({
      next: (p) => {
        this.loading.set(false);
        this.limpiarPreviewProductoImagen();
        this.productoImagenPendiente.set(null);
        this.patchProducto(p);
        this.showMsg(this.t('masters.imageUploaded'), true);
        input.value = '';
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.imageUploadError')), false);
        input.value = '';
      },
    });
  }

  razonSocialLabel(): string {
    return this.clienteForm.controls.tipoIdentificacion.value === '04' ? this.t('masters.businessName') : this.t('masters.namesAndLastNames');
  }

  nombreComercialLabel(): string {
    return this.clienteForm.controls.tipoIdentificacion.value === '04' ? this.t('masters.tradeName') : this.t('masters.tradeNameAlias');
  }

  direccionesData(): Record<string, unknown>[] {
    return this.direcciones.getRawValue().map((d, index) => ({ ...d, index }));
  }

  abrirDireccion(index = -1): void {
    this.editingDireccionIndex.set(index);
    const value = index >= 0 ? this.direcciones.at(index).getRawValue() : { tipo: 'MATRIZ', principal: this.direcciones.length === 0 };
    this.direccionModalForm.reset(value);
    this.direccionModalOpen.set(true);
  }

  cerrarDireccionModal(): void {
    this.direccionModalOpen.set(false);
  }

  guardarDireccionModal(): void {
    const value = this.direccionModalForm.getRawValue();
    if (!value.direccion.trim()) {
      this.showMsg(this.t('masters.addressRequired'), false);
      return;
    }
    const index = this.editingDireccionIndex();
    if (index >= 0) {
      this.direcciones.at(index).patchValue(value);
      if (value.principal) {
        this.setPrincipal(index);
      }
    } else {
      this.addDireccion(value);
    }
    this.syncDireccionPrincipal();
    this.direccionNonce.update((n) => n + 1);
    this.cerrarDireccionModal();
  }

  onDireccionAction(ev: { action: string; row: Record<string, unknown> }): void {
    const index = Number(ev.row['index']);
    if (!Number.isInteger(index) || index < 0) {
      return;
    }
    if (ev.action === 'editar') {
      this.abrirDireccion(index);
      return;
    }
    if (ev.action === 'eliminar') {
      this.removeDireccion(index);
    }
  }

  onIdentificacionBlur(): void {
    if (this.id() || this.config().clase !== 'cliente') {
      return;
    }
    const tipo = this.clienteForm.controls.tipoIdentificacion.value;
    const identificacion = this.clienteForm.controls.identificacion.value.trim();
    if (!this.identificacionCompleta(tipo, identificacion) || this.lastLookupIdentificacion === `${tipo}:${identificacion}`) {
      return;
    }
    this.lastLookupIdentificacion = `${tipo}:${identificacion}`;
    this.validarExistenteOConsultarSri(tipo, identificacion);
  }

  addDireccion(value: TerceroDireccion = {}): void {
    const shouldBePrincipal = this.direcciones.length === 0 || value.principal === true;
    this.direcciones.push(this.createDireccionGroup({ ...value, principal: shouldBePrincipal }));
    if (shouldBePrincipal) {
      this.setPrincipal(this.direcciones.length - 1);
    }
    this.syncDireccionPrincipal();
    this.direccionNonce.update((n) => n + 1);
  }

  removeDireccion(index: number): void {
    this.direcciones.removeAt(index);
    if (this.direcciones.length > 0 && !this.direcciones.controls.some((c) => c.controls.principal.value)) {
      this.direcciones.at(0).controls.principal.setValue(true);
    }
    this.syncDireccionPrincipal();
    this.direccionNonce.update((n) => n + 1);
  }

  setPrincipal(index: number): void {
    this.direcciones.controls.forEach((control, i) => {
      control.controls.principal.setValue(i === index, { emitEvent: false });
    });
    this.syncDireccionPrincipal();
    this.direccionNonce.update((n) => n + 1);
  }

  consultarRuc(): void {
    const ruc = this.clienteForm.controls.identificacion.value.trim();
    if (!/^\d{13}$/.test(ruc)) {
      this.showMsg(this.t('masters.rucInvalid'), false);
      return;
    }
    this.consultarRucPorNumero(ruc);
  }

  private consultarRucPorNumero(ruc: string): void {
    this.sriLoading.set(true);
    this.maestros.consultaRuc(this.config().tipo as ClienteProveedorTipo, ruc).subscribe({
      next: (res) => {
        this.sriLoading.set(false);
        if (!res.encontrado) {
          this.showMsg(this.t('masters.rucNotFound'), false);
          return;
        }
        this.applySriResponse(res);
        this.showMsg(this.t('masters.sriLoaded'), true);
      },
      error: (err: unknown) => {
        this.sriLoading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.rucLookupError')), false);
      },
    });
  }

  guardarCliente(): void {
    if (!this.validarCliente()) {
      return;
    }
    const raw = this.clienteForm.getRawValue();
    const direcciones = this.direcciones.getRawValue()
      .map((d) => this.cleanDireccion(d))
      .filter((d) => !!d.direccion || !!d.provincia || !!d.canton || !!d.parroquia || !!d.referencia);
    const payload: ClienteProveedorPayload = {
      tipoIdentificacion: raw.tipoIdentificacion,
      identificacion: raw.identificacion.trim(),
      razonSocial: raw.razonSocial.trim(),
      nombreComercial: raw.nombreComercial.trim() || undefined,
      tipoTercero: raw.tipoTercero,
      direccion: raw.direccion.trim() || undefined,
      telefono: raw.telefono.trim() || undefined,
      email: raw.email.trim() || undefined,
      contactoNombre: raw.contactoNombre.trim() || undefined,
      contactoTelefono: raw.contactoTelefono.trim() || undefined,
      contactoEmail: raw.contactoEmail.trim() || undefined,
      obligadoContabilidad: raw.obligadoContabilidad,
      contribuyenteEspecial: raw.contribuyenteEspecial.trim() || undefined,
      regimen: raw.regimen.trim() || undefined,
      estadoSri: raw.estadoSri.trim() || undefined,
      actividadEconomica: raw.actividadEconomica.trim() || undefined,
      fuenteDatos: raw.fuenteDatos.trim() || undefined,
      direcciones,
      customData: {},
    };
    this.guardar(payload);
  }

  guardarProducto(): void {
    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      this.showMsg(this.t('masters.productRequired'), false);
      return;
    }
    const raw = this.productoForm.getRawValue() as ProductoFormRawValues;

    let codigoPrincipal = String(raw.codigoPrincipal ?? '').trim();
    if (raw.codigoModo === 'AUTO') {
      codigoPrincipal = this.generarCodigoProducto();
    }
    if (!codigoPrincipal) {
      this.showMsg(this.t('masters.productRequired'), false);
      return;
    }
    if (!String(raw.descripcion ?? '').trim()) {
      this.showMsg(this.t('masters.productRequired'), false);
      return;
    }

    const rows = this.preciosGridRows();
    if (!rows.length) {
      this.showMsg(this.t('masters.pricePrincipalRequired'), false);
      return;
    }
    const principalIdx = rows.findIndex((r) => r.esPrincipal);
    if (principalIdx < 0) {
      this.showMsg(this.t('masters.pricePrincipalRequired'), false);
      return;
    }
    const byLista = new Map<string, number>();
    for (const row of rows) {
      const cod = String(row.listaCodigo ?? '').trim().toUpperCase();
      const p = Number(row.precio);
      if (!cod) {
        this.showMsg(this.t('masters.priceListRowIncomplete'), false);
        return;
      }
      if (!Number.isFinite(p) || p < 0) {
        this.showMsg(this.t('masters.priceListRowIncomplete'), false);
        return;
      }
      if (byLista.has(cod)) {
        this.showMsg(this.t('masters.priceDuplicateList'), false);
        return;
      }
      byLista.set(cod, p);
    }
    const principal = rows[principalIdx];
    const principalPrecio = Number(principal.precio);
    byLista.set('BASE', principalPrecio);

    const preciosListas = [...byLista.entries()].map(([listaCodigo, precio]) => ({ listaCodigo, precio }));

    const impuestosCatalogo: NonNullable<ProductoServicioPayload['impuestosCatalogo']> = [...this.extraImpuestosCatalogoFromPrincipales()];
    const catalogIdsUsados = new Set(impuestosCatalogo.map((x) => x.catalogoItemId));
    const impuestosManuales: NonNullable<ProductoServicioPayload['impuestosManuales']> = [];
    const presets = this.impuestoPresets();

    for (const row of raw.impuestoLineas ?? []) {
      const fuente = row.fuente;
      if (fuente === 'catalog') {
        const cid = String(row.catalogoItemId ?? '').trim();
        const porcRaw = row.porcentaje;
        const porcentaje =
          porcRaw === null || porcRaw === undefined || String(porcRaw).trim() === ''
            ? undefined
            : Number(porcRaw);
        if (!cid) {
          continue;
        }
        if (catalogIdsUsados.has(cid)) {
          continue;
        }
        catalogIdsUsados.add(cid);
        if (porcentaje !== undefined && (!Number.isFinite(porcentaje) || porcentaje < 0)) {
          this.showMsg(this.t('masters.taxPercentInvalid'), false);
          return;
        }
        impuestosCatalogo.push({ catalogoItemId: cid, porcentaje });
      } else if (fuente === 'preset') {
        const pid = String(row.presetId ?? '').trim();
        if (!pid) {
          continue;
        }
        const preset = presets.find((x) => x.id === pid);
        if (!preset) {
          this.showMsg(this.t('masters.impuestoLineInvalid'), false);
          return;
        }
        impuestosManuales.push({ nombre: preset.nombre, porcentaje: preset.porcentaje });
      } else if (fuente === 'manual') {
        const nombre = String(row.nombreManual ?? '').trim();
        const pct = Number(row.porcentaje);
        if (!nombre) {
          continue;
        }
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          this.showMsg(this.t('masters.taxPercentInvalid'), false);
          return;
        }
        impuestosManuales.push({ nombre, porcentaje: pct });
      }
    }

    const customData: Record<string, unknown> = {};
    const codBar = String(raw.codigoBarra ?? '').trim();
    if (codBar) {
      customData['codigoBarra'] = codBar;
    }

    const payload: ProductoServicioPayload = {
      codigoPrincipal,
      codigoAuxiliar: raw.codigoAuxiliar.trim() || undefined,
      descripcion: raw.descripcion.trim(),
      tipo: raw.tipo,
      precioUnitario: principalPrecio,
      categoriaId: raw.categoriaId?.trim() ? raw.categoriaId.trim() : undefined,
      ivaCodigo: raw.ivaCodigo.trim() || undefined,
      iceCodigo: raw.iceCodigo.trim() || undefined,
      irbpnrCodigo: raw.irbpnrCodigo.trim() || undefined,
      customData: Object.keys(customData).length ? customData : {},
      preciosListas,
      impuestosCatalogo,
      impuestosManuales,
    };
    this.guardar(payload);
  }

  createDireccionGroup(value: TerceroDireccion = {}) {
    return this.fb.nonNullable.group({
      tipo: [value.tipo ?? 'MATRIZ'],
      direccion: [value.direccion ?? ''],
      provincia: [value.provincia ?? ''],
      canton: [value.canton ?? ''],
      parroquia: [value.parroquia ?? ''],
      referencia: [value.referencia ?? ''],
      principal: [value.principal === true],
    });
  }

  private cargar(id: string): void {
    this.loading.set(true);
    this.maestros.get(this.config().tipo, id).subscribe({
      next: (row) => {
        this.loading.set(false);
        if (this.config().clase === 'cliente') {
          this.patchCliente(row as ClienteProveedor);
        } else {
          this.patchProducto(row as ProductoServicio);
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.loadRecordError')), false);
      },
    });
  }

  private guardar(payload: ClienteProveedorPayload | ProductoServicioPayload): void {
    this.loading.set(true);
    const currentId = this.id();
    const tipoEntidad = this.config().tipo;
    const request = currentId
      ? this.maestros.update(tipoEntidad, currentId, payload)
      : this.maestros.create(tipoEntidad, payload);
    request.subscribe({
      next: (row) => {
        const file = this.productoImagenPendiente();
        const savedId =
          this.config().clase === 'producto' && row && typeof row === 'object' && 'id' in row
            ? (row as ProductoServicio).id
            : null;
        if (this.config().clase === 'producto' && file && savedId) {
          const tipo = tipoEntidad as ProductoServicioTipo;
          this.maestros.uploadProductoImagen(tipo, savedId, file).subscribe({
            next: () => {
              this.loading.set(false);
              this.productoImagenPendiente.set(null);
              this.limpiarPreviewProductoImagen();
              void this.router.navigate(this.listLink());
            },
            error: (err: unknown) => {
              this.loading.set(false);
              this.productoImagenPendiente.set(null);
              this.limpiarPreviewProductoImagen();
              this.showMsg(maestroErrorMessage(err, this.t('masters.imageUploadError')), false);
              void this.router.navigate(this.listLink());
            },
          });
          return;
        }
        this.loading.set(false);
        void this.router.navigate(this.listLink());
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.saveRecordError')), false);
      },
    });
  }

  private validarCliente(): boolean {
    const raw = this.clienteForm.getRawValue();
    if (this.clienteForm.invalid) {
      this.clienteForm.markAllAsTouched();
      this.showMsg(this.t('masters.thirdPartyRequired'), false);
      return false;
    }
    const identificacion = raw.identificacion.trim();
    if (raw.tipoIdentificacion === '04' && !/^\d{13}$/.test(identificacion)) {
      this.showMsg(this.t('masters.rucDigitsError'), false);
      return false;
    }
    if (raw.tipoIdentificacion === '05' && !/^\d{10}$/.test(identificacion)) {
      this.showMsg(this.t('masters.idCardDigitsError'), false);
      return false;
    }
    if (raw.tipoIdentificacion === '06' && (identificacion.length < 3 || identificacion.length > 20)) {
      this.showMsg(this.t('masters.passportLengthError'), false);
      return false;
    }
    if (this.direcciones.length > 0 && !this.direcciones.controls.some((c) => c.controls.principal.value)) {
      this.showMsg(this.t('masters.mainAddressRequired'), false);
      return false;
    }
    return true;
  }

  private applySriResponse(res: ConsultaRucResponse): void {
    this.clienteForm.patchValue({
      identificacion: res.numeroRuc ?? this.clienteForm.controls.identificacion.value,
      razonSocial: res.razonSocial ?? '',
      nombreComercial: res.nombreComercial ?? res.razonSocial ?? '',
      obligadoContabilidad: this.siNo(res.obligadoLlevarContabilidad),
      contribuyenteEspecial: res.contribuyenteEspecial ?? 'NO',
      regimen: res.regimen ?? 'GENERAL',
      estadoSri: res.estadoContribuyenteRuc ?? '',
      actividadEconomica: res.actividadEconomicaPrincipal ?? '',
      fuenteDatos: 'SRI',
    });
    this.direcciones.clear();
    for (const dir of res.direcciones ?? []) {
      this.addDireccion(dir);
    }
    const principal = this.direcciones.at(0)?.getRawValue();
    if (principal?.direccion) {
      this.clienteForm.controls.direccion.setValue(principal.direccion);
    }
    this.direccionNonce.update((n) => n + 1);
  }

  private patchCliente(r: ClienteProveedor): void {
    this.clienteForm.patchValue({
      tipoIdentificacion: r.tipoIdentificacion ?? '04',
      identificacion: r.identificacion ?? '',
      razonSocial: r.razonSocial ?? '',
      nombreComercial: r.nombreComercial ?? '',
      tipoTercero: (r.tipoTercero as 'CLIENTE' | 'PROVEEDOR' | 'AMBOS') ?? this.defaultTipoTercero(),
      direccion: r.direccion ?? '',
      telefono: r.telefono ?? '',
      email: r.email ?? '',
      contactoNombre: r.contactoNombre ?? '',
      contactoTelefono: r.contactoTelefono ?? '',
      contactoEmail: r.contactoEmail ?? '',
      obligadoContabilidad: this.siNo(r.obligadoContabilidad),
      contribuyenteEspecial: r.contribuyenteEspecial ?? '',
      regimen: r.regimen ?? '',
      estadoSri: r.estadoSri ?? '',
      actividadEconomica: r.actividadEconomica ?? '',
      fuenteDatos: r.fuenteDatos ?? '',
    });
    this.direcciones.clear();
    for (const dir of r.direcciones ?? []) {
      this.addDireccion(dir);
    }
    this.direccionNonce.update((n) => n + 1);
  }

  private buildPreciosGridDesdeProducto(r: ProductoServicio): PrecioGridRow[] {
    const pls = r.preciosListas ?? [];
    const baseRow = pls.find((p) => String(p.listaCodigo ?? '').toUpperCase() === 'BASE');
    if (pls.length === 0) {
      return [{ _rowId: this.newGridRowId(), listaCodigo: 'BASE', precio: Number(r.precioUnitario ?? 0), esPrincipal: true }];
    }
    const out: PrecioGridRow[] = [];
    for (const pl of pls) {
      const cod = String(pl.listaCodigo ?? '').trim().toUpperCase();
      if (!cod) {
        continue;
      }
      const isPrincipal = baseRow ? cod === String(baseRow.listaCodigo).trim().toUpperCase() : cod === 'BASE';
      out.push({
        _rowId: this.newGridRowId(),
        listaCodigo: pl.listaCodigo ?? '',
        precio: Number(pl.precio ?? 0),
        esPrincipal: !!isPrincipal,
      });
    }
    if (!out.some((x) => x.esPrincipal) && out.length) {
      out[0] = { ...out[0], esPrincipal: true };
    }
    return out;
  }

  private buildImpuestosPrincipalesDesdeProducto(r: ProductoServicio): ImpuestoPrincipalGridRow[] {
    const cat = this.impuestosCatalogo();
    const findId = (cod: string | null | undefined, tipo: string): string => {
      const c = cod?.trim();
      if (!c) {
        return '';
      }
      const row = cat.find((x) => String(x.tipo).toUpperCase() === tipo.toUpperCase() && x.codigo === c);
      return row?.id ?? '';
    };
    const row = (rol: 'IVA' | 'ICE' | 'IRBPNR', cod: string | null | undefined): ImpuestoPrincipalGridRow => {
      const catalogoItemId = findId(cod, rol);
      const def = catalogoItemId ? cat.find((x) => x.id === catalogoItemId) : undefined;
      const porcentaje =
        def?.porcentajeDefault != null && def.porcentajeDefault !== undefined ? Number(def.porcentajeDefault) : null;
      return { _rowId: this.newGridRowId(), rol, catalogoItemId, porcentaje };
    };
    return [
      row('IVA', r.ivaCodigo),
      row('ICE', r.iceCodigo),
      row('IRBPNR', r.irbpnrCodigo),
    ];
  }

  private patchProducto(r: ProductoServicio): void {
    this.limpiarPreviewProductoImagen();
    this.productoImagenPendiente.set(null);
    this.productoImagenUrl.set(r.imagenUrl?.trim() ? r.imagenUrl.trim() : null);
    this.impuestoLineasArray.clear();
    this.preciosGridRows.set(this.buildPreciosGridDesdeProducto(r));
    this.preciosGridNonce.update((n) => n + 1);
    for (const imp of r.impuestosAdicionales ?? []) {
      const cid = String(imp.catalogoItemId ?? '').trim();
      if (cid) {
        this.impuestoLineasArray.push(
          this.createImpuestoLineGroup({
            fuente: 'catalog',
            catalogoItemId: cid,
            porcentaje: imp.porcentaje != null ? Number(imp.porcentaje) : null,
          }),
        );
      } else {
        const nombre = String(imp.nombre ?? imp.tipo ?? '').trim();
        if (nombre) {
          this.impuestoLineasArray.push(
            this.createImpuestoLineGroup({
              fuente: 'manual',
              nombreManual: nombre,
              porcentaje: imp.porcentaje != null ? Number(imp.porcentaje) : 0,
            }),
          );
        }
      }
    }
    const cd = (r.customData ?? {}) as Record<string, unknown>;
    const codBar = String(cd['codigoBarra'] ?? cd['barcode'] ?? '').trim();
    this.productoForm.patchValue({
      codigoModo: 'MANUAL',
      codigoPrincipal: r.codigoPrincipal ?? '',
      codigoAuxiliar: r.codigoAuxiliar ?? '',
      codigoBarra: codBar,
      descripcion: r.descripcion ?? '',
      tipo: (r.tipo === 'SERVICIO' ? 'SERVICIO' : 'PRODUCTO') as 'PRODUCTO' | 'SERVICIO',
      categoriaId: r.categoriaId ?? '',
      ivaCodigo: r.ivaCodigo ?? '',
      iceCodigo: r.iceCodigo ?? '',
      irbpnrCodigo: r.irbpnrCodigo ?? '',
    });
    this.impuestosPrincipalesGridRows.set(this.buildImpuestosPrincipalesDesdeProducto(r));
    this.impuestosPrincipalesGridNonce.update((n) => n + 1);
    this.applyCodigoModo();
  }

  private cleanDireccion(raw: ReturnType<DireccionFormGroup['getRawValue']>): TerceroDireccion {
    return {
      tipo: raw.tipo.trim() || undefined,
      direccion: raw.direccion.trim() || undefined,
      provincia: raw.provincia.trim() || undefined,
      canton: raw.canton.trim() || undefined,
      parroquia: raw.parroquia.trim() || undefined,
      referencia: raw.referencia.trim() || undefined,
      principal: raw.principal,
    };
  }

  private validarExistenteOConsultarSri(tipo: string, identificacion: string): void {
    this.sriLoading.set(true);
    this.maestros
      .list<ClienteProveedor>(this.config().tipo, 0, 5, {
        q: identificacion,
        estado: '',
        tipoTercero: '',
      })
      .subscribe({
        next: (page) => {
          const existente = page.content.find(
            (c) =>
              c.tipoIdentificacion === tipo &&
              String(c.identificacion ?? '').trim().toUpperCase() === identificacion.toUpperCase(),
          );
          if (existente) {
            this.sriLoading.set(false);
            this.id.set(existente.id);
            this.patchCliente(existente);
            this.showMsg(
              this.t('masters.duplicateLoaded'),
              true,
            );
            return;
          }
          if (tipo === '04') {
            this.consultarRucPorNumero(identificacion);
            return;
          }
          this.sriLoading.set(false);
        },
        error: () => {
          if (tipo === '04') {
            this.consultarRucPorNumero(identificacion);
            return;
          }
          this.sriLoading.set(false);
        },
      });
  }

  private identificacionCompleta(tipo: string, identificacion: string): boolean {
    if (tipo === '04') {
      return /^\d{13}$/.test(identificacion);
    }
    if (tipo === '05') {
      return /^\d{10}$/.test(identificacion);
    }
    if (tipo === '06') {
      return identificacion.length >= 3 && identificacion.length <= 20;
    }
    return identificacion.length > 0;
  }

  private syncDireccionPrincipal(): void {
    const principal = this.direcciones.getRawValue().find((d) => d.principal);
    if (principal?.direccion) {
      this.clienteForm.controls.direccion.setValue(principal.direccion);
    }
  }

  private resetClienteForm(): void {
    this.clienteForm.reset({
      tipoIdentificacion: '04',
      identificacion: '',
      razonSocial: '',
      nombreComercial: '',
      tipoTercero: this.defaultTipoTercero(),
      direccion: '',
      telefono: '',
      email: '',
      contactoNombre: '',
      contactoTelefono: '',
      contactoEmail: '',
      obligadoContabilidad: 'NO',
      contribuyenteEspecial: 'NO',
      regimen: 'GENERAL',
      estadoSri: '',
      actividadEconomica: '',
      fuenteDatos: '',
    });
    this.direcciones.clear();
    this.lastLookupIdentificacion = '';
    this.direccionNonce.update((n) => n + 1);
  }

  private defaultTipoTercero(): 'CLIENTE' | 'PROVEEDOR' {
    return this.config().tipo === 'proveedores' ? 'PROVEEDOR' : 'CLIENTE';
  }

  abrirListaPrecioModal(): void {
    this.lpNuevoNombre = '';
    this.listaPrecioModalOpen.set(true);
    this.loadListasPrecio();
  }

  cerrarListaPrecioModal(): void {
    this.listaPrecioModalOpen.set(false);
  }

  crearListaPrecioDesdeModal(): void {
    const nombre = this.lpNuevoNombre.trim();
    if (!nombre) {
      this.showMsg(this.t('masters.priceListNameRequired'), false);
      return;
    }
    const codigo = this.generarCodigoListaPrecio(nombre);
    const tipoEnt = this.config().tipo as ProductoServicioTipo;
    const body: ListaPrecioCreatePayload = { codigo, nombre, esDefault: false };
    this.loading.set(true);
    this.maestros.crearListaPrecio(tipoEnt, body).subscribe({
      next: () => {
        this.loading.set(false);
        this.loadListasPrecio();
        this.lpNuevoNombre = '';
        this.preciosGridNonce.update((n) => n + 1);
        this.cerrarListaPrecioModal();
        this.showMsg(this.t('masters.priceListCreated'), true);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.priceListCreateError')), false);
      },
    });
  }

  private generarCodigoListaPrecio(nombre: string): string {
    const baseRaw = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    let base = baseRaw || `L_${Date.now().toString(36).slice(-5).toUpperCase()}`;
    if (base === 'BASE') {
      base = `L_${Date.now().toString(36).slice(-5).toUpperCase()}`;
    }
    const existentes = new Set(this.listasPrecio().map((l) => l.codigo.toUpperCase()));
    let codigo = base;
    let n = 2;
    while (existentes.has(codigo)) {
      const suffix = `_${n}`;
      codigo = `${base.slice(0, Math.max(1, 50 - suffix.length))}${suffix}`;
      n += 1;
    }
    return codigo.slice(0, 50);
  }

  abrirImpuestoCatalogoModal(): void {
    this.catNuevoTipo = 'IVA';
    this.catNuevoCodigo = '';
    this.catNuevoNombre = '';
    this.catNuevoPorc = null;
    this.impuestoCatalogoModalOpen.set(true);
  }

  cerrarImpuestoCatalogoModal(): void {
    this.impuestoCatalogoModalOpen.set(false);
  }

  crearImpuestoCatalogoDesdeModal(): void {
    const tipoEnt = this.config().tipo as ProductoServicioTipo;
    const tipo = this.catNuevoTipo.trim().toUpperCase();
    const codigo = this.catNuevoCodigo.trim().toUpperCase();
    const nombre = this.catNuevoNombre.trim();
    if (!tipo || !codigo || !nombre) {
      this.showMsg(this.t('masters.catalogTaxFieldsRequired'), false);
      return;
    }
    this.loading.set(true);
    this.maestros
      .crearImpuestoCatalogo(tipoEnt, {
        tipo,
        codigo,
        nombre,
        porcentajeDefault: this.catNuevoPorc ?? undefined,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.loadImpuestosCatalogo();
          this.impuestosPrincipalesGridNonce.update((n) => n + 1);
          this.showMsg(this.t('masters.catalogTaxCreated'), true);
          this.catNuevoCodigo = '';
          this.catNuevoNombre = '';
          this.catNuevoPorc = null;
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.showMsg(maestroErrorMessage(err, this.t('masters.catalogTaxCreateError')), false);
        },
      });
  }

  eliminarItemCatalogoEmpresa(id: string): void {
    const tipoEnt = this.config().tipo as ProductoServicioTipo;
    this.loading.set(true);
    this.maestros.eliminarImpuestoCatalogo(tipoEnt, id).subscribe({
      next: () => {
        this.loading.set(false);
        this.loadImpuestosCatalogo();
        this.impuestosPrincipalesGridRows.update((rows) =>
          rows.map((r) => (r.catalogoItemId === id ? { ...r, catalogoItemId: '', porcentaje: null } : r)),
        );
        this.impuestosPrincipalesGridNonce.update((n) => n + 1);
        this.syncTaxCodesFromPrincipalesGrid();
        this.showMsg(this.t('masters.catalogTaxDeleted'), true);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.catalogTaxDeleteError')), false);
      },
    });
  }

  private loadListasPrecio(): void {
    if (!this.tieneEmpresa) {
      return;
    }
    const tipo = this.config().tipo as ProductoServicioTipo;
    this.maestros.listasPrecio(tipo).subscribe({
      next: (rows) => this.listasPrecio.set(rows),
      error: () => this.listasPrecio.set([]),
    });
  }

  private loadImpuestosCatalogo(): void {
    if (!this.tieneEmpresa) {
      return;
    }
    const tipo = this.config().tipo as ProductoServicioTipo;
    this.maestros.impuestosCatalogo(tipo).subscribe({
      next: (rows) => this.impuestosCatalogo.set(rows),
      error: () => this.impuestosCatalogo.set([]),
    });
  }

  private loadCategoriasProducto(): void {
    if (!this.tieneEmpresa) {
      return;
    }
    const tipo = this.config().tipo as ProductoServicioTipo;
    this.maestros.categoriasProducto(tipo).subscribe({
      next: (rows) => this.categoriasProducto.set(rows),
      error: () => this.categoriasProducto.set([]),
    });
  }

  abrirCategoriasModal(): void {
    this.categoriaAltaForm.reset({ codigo: '', nombre: '', parentId: '' });
    this.categoriasModalTab.set('form');
    this.categoriaEliminarConfirm.set(null);
    this.categoriaJerarquiaBusqueda.set('');
    this.jerarquiaExpandedIds.set(new Set());
    this.loadCategoriasProducto();
    this.categoriasModalOpen.set(true);
  }

  cerrarCategoriasModal(): void {
    this.categoriaEliminarConfirm.set(null);
    this.categoriasModalOpen.set(false);
  }

  solicitarEliminarCategoria(c: ProductoCategoriaRow): void {
    this.categoriaEliminarConfirm.set({ id: c.id, ruta: c.ruta });
  }

  cerrarConfirmEliminarCategoria(): void {
    this.categoriaEliminarConfirm.set(null);
  }

  confirmarEliminarCategoria(): void {
    const s = this.categoriaEliminarConfirm();
    if (!s) {
      return;
    }
    this.categoriaEliminarConfirm.set(null);
    this.ejecutarEliminarCategoria(s.id);
  }

  actualizarJerarquiaBusqueda(ev: Event): void {
    const el = ev.target as HTMLInputElement | null;
    this.categoriaJerarquiaBusqueda.set(el?.value ?? '');
  }

  toggleJerarquiaExpand(id: string): void {
    this.jerarquiaExpandedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  jerarquiaExpandirTodo(): void {
    const ids = MaestroFormPage.collectIdsConHijos(this.jerarquiaCategoriaArbol());
    this.jerarquiaExpandedIds.set(new Set(ids));
  }

  jerarquiaContraerTodo(): void {
    this.jerarquiaExpandedIds.set(new Set());
  }

  private static ordenCategoriasArbol(a: ProductoCategoriaRow, b: ProductoCategoriaRow): number {
    const oa = a.orden ?? 0;
    const ob = b.orden ?? 0;
    if (oa !== ob) {
      return oa - ob;
    }
    return (a.nombre ?? '').localeCompare(b.nombre ?? '', undefined, { sensitivity: 'base' });
  }

  private static catalogoImpuestoLabel(c: ImpuestoCatalogoItem): string {
    const pct = c.porcentajeDefault;
    if (pct != null && Number.isFinite(Number(pct))) {
      return `${c.codigo} — ${c.nombre} (${Number(pct)}%)`;
    }
    return `${c.codigo} — ${c.nombre}`;
  }

  private static porcentajeDesdeCatalogo(cat: ImpuestoCatalogoItem[], catalogoItemId: string): number | null {
    const def = cat.find((c) => c.id === catalogoItemId);
    if (def?.porcentajeDefault == null) {
      return null;
    }
    const n = Number(def.porcentajeDefault);
    return Number.isFinite(n) ? n : null;
  }

  private static buildCategoriaArbol(rows: ProductoCategoriaRow[]): CategoriaArbolNodo[] {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const childrenOf = new Map<string | null, ProductoCategoriaRow[]>();
    for (const r of rows) {
      let p: string | null = r.parentId;
      if (p && !byId.has(p)) {
        p = null;
      }
      const arr = childrenOf.get(p) ?? [];
      arr.push(r);
      childrenOf.set(p, arr);
    }
    for (const [, arr] of childrenOf) {
      arr.sort(MaestroFormPage.ordenCategoriasArbol);
    }
    const build = (parentId: string | null): CategoriaArbolNodo[] => {
      const list = childrenOf.get(parentId) ?? [];
      return list.map((row) => ({
        row,
        children: build(row.id),
      }));
    };
    return build(null);
  }

  private static flattenCategoriaArbol(
    nodes: CategoriaArbolNodo[],
    depth: number,
    expanded: ReadonlySet<string>,
    forceExpandAll: boolean,
  ): JerarquiaCategoriaFilaVista[] {
    const out: JerarquiaCategoriaFilaVista[] = [];
    for (const n of nodes) {
      const hasCh = n.children.length > 0;
      const expandedNode = forceExpandAll || expanded.has(n.row.id);
      out.push({ row: n.row, depth, hasChildren: hasCh, expanded: expandedNode });
      if (hasCh && expandedNode) {
        out.push(...MaestroFormPage.flattenCategoriaArbol(n.children, depth + 1, expanded, forceExpandAll));
      }
    }
    return out;
  }

  private static collectIdsConHijos(nodes: CategoriaArbolNodo[]): string[] {
    const acc: string[] = [];
    const walk = (list: CategoriaArbolNodo[]) => {
      for (const n of list) {
        if (n.children.length > 0) {
          acc.push(n.row.id);
          walk(n.children);
        }
      }
    };
    walk(nodes);
    return acc;
  }

  guardarCategoriaNueva(): void {
    if (this.categoriaAltaForm.invalid) {
      this.categoriaAltaForm.markAllAsTouched();
      return;
    }
    const v = this.categoriaAltaForm.getRawValue();
    const tipo = this.config().tipo as ProductoServicioTipo;
    const body: ProductoCategoriaPayload = {
      codigo: v.codigo.trim(),
      nombre: v.nombre.trim(),
      parentId: v.parentId?.trim() ? v.parentId.trim() : undefined,
    };
    this.loading.set(true);
    this.maestros.crearCategoriaProducto(tipo, body).subscribe({
      next: () => {
        this.loading.set(false);
        this.categoriaAltaForm.reset({ codigo: '', nombre: '', parentId: '' });
        this.loadCategoriasProducto();
        this.categoriasModalTab.set('list');
        this.showMsg(this.t('masters.categoryCreated'), true);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.categorySaveError')), false);
      },
    });
  }

  private ejecutarEliminarCategoria(id: string): void {
    const tipo = this.config().tipo as ProductoServicioTipo;
    this.loading.set(true);
    this.maestros.eliminarCategoriaProducto(tipo, id).subscribe({
      next: () => {
        this.loading.set(false);
        if (String(this.productoForm.get('categoriaId')?.value ?? '') === id) {
          this.productoForm.get('categoriaId')?.setValue('');
        }
        this.loadCategoriasProducto();
        this.showMsg(this.t('masters.categoryDeleted'), true);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.showMsg(maestroErrorMessage(err, this.t('masters.categoryDeleteError')), false);
      },
    });
  }

  private resetProductoForm(): void {
    this.limpiarPreviewProductoImagen();
    this.productoImagenPendiente.set(null);
    this.productoImagenUrl.set(null);
    this.impuestoLineasArray.clear();
    this.preciosGridRows.set([{ _rowId: this.newGridRowId(), listaCodigo: 'BASE', precio: 0, esPrincipal: true }]);
    this.preciosGridNonce.update((n) => n + 1);
    this.impuestosPrincipalesGridRows.set([
      this.defaultImpuestoPrincipalRow('IVA'),
      this.defaultImpuestoPrincipalRow('ICE'),
      this.defaultImpuestoPrincipalRow('IRBPNR'),
    ]);
    this.impuestosPrincipalesGridNonce.update((n) => n + 1);
    this.productoForm.reset({
      codigoModo: 'MANUAL',
      codigoPrincipal: '',
      codigoAuxiliar: '',
      codigoBarra: '',
      descripcion: '',
      tipo: this.config().defaultTipoProducto ?? 'PRODUCTO',
      categoriaId: '',
      ivaCodigo: '',
      iceCodigo: '',
      irbpnrCodigo: '',
    });
    this.productoForm.controls.codigoModo.setValue('MANUAL');
    this.applyCodigoModo();
  }

  private createImpuestoLineGroup(
    v: Partial<{
      fuente: 'catalog' | 'preset' | 'manual';
      catalogoItemId: string;
      presetId: string;
      nombreManual: string;
      porcentaje: number | null;
    }> = {},
  ): FormGroup {
    return this.fb.group({
      fuente: [v.fuente ?? 'catalog'],
      catalogoItemId: [v.catalogoItemId ?? ''],
      presetId: [v.presetId ?? ''],
      nombreManual: [v.nombreManual ?? '', [Validators.maxLength(200)]],
      porcentaje: [v.porcentaje ?? null],
    });
  }

  private generarCodigoProducto(): string {
    const prefix = this.config().tipo === 'servicios' ? 'SRV' : 'PRD';
    let suffix: string;
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    } else {
      suffix = String(Date.now());
    }
    return `${prefix}-${suffix}`.slice(0, 50);
  }

  private limpiarPreviewProductoImagen(): void {
    if (this.productoImagenObjectUrl) {
      URL.revokeObjectURL(this.productoImagenObjectUrl);
      this.productoImagenObjectUrl = null;
    }
    this.productoImagenPreviewUrl.set(null);
  }

  private impuestoPresetsStorageKey(): string {
    return `efactura_impuesto_presets_v1_${this.tenant.tenantSlug()}`;
  }

  private reloadImpuestoPresetsFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.impuestoPresetsStorageKey());
      const parsed = raw ? (JSON.parse(raw) as ImpuestoPreset[]) : [];
      this.impuestoPresets.set(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.impuestoPresets.set([]);
    }
  }

  private persistImpuestoPresets(): void {
    localStorage.setItem(this.impuestoPresetsStorageKey(), JSON.stringify(this.impuestoPresets()));
  }

  private siNo(value: unknown): 'SI' | 'NO' {
    return String(value ?? '').trim().toUpperCase() === 'SI' ? 'SI' : 'NO';
  }

  private showMsg(text: string, ok: boolean): void {
    if (ok) {
      this.toast.success(text);
    } else {
      this.toast.error(text);
    }
  }
}
