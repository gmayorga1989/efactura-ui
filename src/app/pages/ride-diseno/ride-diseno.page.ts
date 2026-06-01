import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

export type RideDisenoBase = 'moderno' | 'sri_clasico' | 'ejecutivo';
export type RideUbicacionLogo = 'izquierda' | 'centro' | 'derecha';
export type RideUbicacionClave = 'bajo_encabezado' | 'caja_factura';

export interface RidePlantilla {
  colorPrimario: string;
  colorAcento: string;
  colorTexto: string;
  colorFondoEncabezado: string;
  mostrarLogo: boolean;
  mostrarCodigoBarras: boolean;
  mostrarNombreComercial: boolean;
  textoPie: string;
  densidad: 'normal' | 'compact';
  disenoBase: RideDisenoBase;
  ubicacionLogo: RideUbicacionLogo;
  ubicacionClave: RideUbicacionClave;
  mostrarBordes: boolean;
  marcaSinLogo: boolean;
  detalleAdicionalModo: 'en_descripcion' | 'columna';
  mostrarDesgloseIva: boolean;
  colorTextoCajaFactura: string;
  filasTotales: string[];
}

const RIDE_FILAS_TOTALES_OPCIONES: { key: string; labelKey: string }[] = [
  { key: 'SUBTOTAL_SIN_IMPUESTOS', labelKey: 'rideDesign.totalSubtotalNoTax' },
  { key: 'DESCUENTO', labelKey: 'rideDesign.totalDiscount' },
  { key: 'SUBTOTAL_0', labelKey: 'rideDesign.totalSubtotal0' },
  { key: 'SUBTOTAL_GRAVADO', labelKey: 'rideDesign.totalSubtotalTaxed' },
  { key: 'SUBTOTAL_EXENTO', labelKey: 'rideDesign.totalSubtotalExempt' },
  { key: 'SUBTOTAL_NO_OBJETO', labelKey: 'rideDesign.totalSubtotalNoObject' },
  { key: 'SUBTOTAL_TARIFA_5', labelKey: 'rideDesign.totalSubtotal5' },
  { key: 'SUBTOTAL_TARIFA_15', labelKey: 'rideDesign.totalSubtotal15' },
  { key: 'ICE', labelKey: 'rideDesign.totalIce' },
  { key: 'IRBPNR', labelKey: 'rideDesign.totalIrbpnr' },
  { key: 'IVA', labelKey: 'rideDesign.totalIva' },
  { key: 'IVA_DESGLOSE', labelKey: 'rideDesign.totalIvaBreakdown' },
  { key: 'PROPINA', labelKey: 'rideDesign.totalTip' },
  { key: 'VALOR_TOTAL', labelKey: 'rideDesign.totalGrand' },
];

const DEFAULT_RIDE_PLANTILLA: RidePlantilla = {
  colorPrimario: '#1e5b96',
  colorAcento: '#0d9488',
  colorTexto: '#1f2937',
  colorFondoEncabezado: '#eef5fb',
  mostrarLogo: true,
  mostrarCodigoBarras: true,
  mostrarNombreComercial: true,
  textoPie: '',
  densidad: 'normal',
  disenoBase: 'moderno',
  ubicacionLogo: 'izquierda',
  ubicacionClave: 'bajo_encabezado',
  mostrarBordes: false,
  marcaSinLogo: true,
  detalleAdicionalModo: 'en_descripcion',
  mostrarDesgloseIva: true,
  colorTextoCajaFactura: '',
  filasTotales: ['SUBTOTAL_SIN_IMPUESTOS', 'DESCUENTO', 'IVA_DESGLOSE', 'VALOR_TOTAL'],
};

const PRESET_SRI: RidePlantilla = {
  ...DEFAULT_RIDE_PLANTILLA,
  colorPrimario: '#000000',
  colorAcento: '#333333',
  colorTexto: '#111111',
  colorFondoEncabezado: '#ffffff',
  disenoBase: 'sri_clasico',
  ubicacionLogo: 'izquierda',
  ubicacionClave: 'caja_factura',
  mostrarBordes: true,
};

const PRESET_EJECUTIVO: RidePlantilla = {
  ...DEFAULT_RIDE_PLANTILLA,
  colorPrimario: '#1e3a5f',
  colorAcento: '#64748b',
  colorFondoEncabezado: '#f8fafc',
  disenoBase: 'ejecutivo',
  ubicacionLogo: 'centro',
  ubicacionClave: 'bajo_encabezado',
};

const TIPOS_COMPROBANTE = [
  { value: 'FACTURA', labelKey: 'rideDesign.docInvoice' },
  { value: 'NOTA_CREDITO', labelKey: 'rideDesign.docCreditNote' },
  { value: 'NOTA_DEBITO', labelKey: 'rideDesign.docDebitNote' },
  { value: 'GUIA_REMISION', labelKey: 'rideDesign.docGuide' },
  { value: 'RETENCION', labelKey: 'rideDesign.docWithholding' },
  { value: 'LIQUIDACION_COMPRA', labelKey: 'rideDesign.docPurchaseSettlement' },
] as const;

type RideSettingsSection = 'general' | 'colores' | 'disposicion' | 'contenido' | 'visibilidad';

const RIDE_SETTINGS_SECTIONS: { id: RideSettingsSection; labelKey: string }[] = [
  { id: 'general', labelKey: 'rideDesign.sectionGeneral' },
  { id: 'colores', labelKey: 'rideDesign.sectionColors' },
  { id: 'disposicion', labelKey: 'rideDesign.sectionLayout' },
  { id: 'contenido', labelKey: 'rideDesign.sectionContent' },
  { id: 'visibilidad', labelKey: 'rideDesign.sectionVisibility' },
];

const RIDE_DESIGN_PRESETS: { id: RideDisenoBase; labelKey: string }[] = [
  { id: 'moderno', labelKey: 'rideDesign.designModern' },
  { id: 'sri_clasico', labelKey: 'rideDesign.designSriClassic' },
  { id: 'ejecutivo', labelKey: 'rideDesign.designExecutive' },
];

@Component({
  selector: 'ts-ride-diseno-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('rideDesign.title')"
      [subtitle]="t('rideDesign.subtitle')"
      [eyebrow]="t('rideDesign.eyebrow')"
    >
      @if (!tokenPresent || !empresaId) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            {{ t('common.noSession') }}
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>.
          } @else {
            {{ t('invoice.companyRequired') }}
          }
        </p>
      } @else if (!session.puedeConfiguracionTributaria()) {
        <p class="text-muted mb-0">{{ t('company.adminOnly') }}</p>
      } @else {
        <div class="row g-3 ts-ride-design">
          <div class="col-lg-5">
            <section class="ts-ride-settings">
              <header class="ts-ride-settings__header">
                <div>
                  <p class="ts-ride-settings__eyebrow mb-1">{{ t('rideDesign.settingsPanel') }}</p>
                  <label class="form-label mb-1" for="ride-doc-tipo">{{ t('rideDesign.documentType') }}</label>
                  <select
                    id="ride-doc-tipo"
                    class="form-select form-select-sm"
                    [(ngModel)]="tipoComprobante"
                    name="tipoComprobante"
                    (ngModelChange)="onTipoChange()"
                  >
                    @for (opt of tiposComprobante; track opt.value) {
                      <option [value]="opt.value">{{ t(opt.labelKey) }}</option>
                    }
                  </select>
                </div>
                <div class="ts-ride-settings__actions">
                  <button
                    type="button"
                    class="btn btn-light btn-sm"
                    (click)="actualizarVistaPrevia()"
                    [disabled]="previewLoading"
                  >
                    {{ t('company.rideTemplatePreview') }}
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="loading" (click)="guardar()">
                    {{ t('company.rideTemplateSave') }}
                  </button>
                </div>
              </header>

              <div class="ts-ride-settings__body">
                <nav class="ts-ride-settings__nav" [attr.aria-label]="t('rideDesign.settingsPanel')">
                  @for (sec of settingsSections; track sec.id) {
                    <button
                      type="button"
                      class="ts-ride-settings__nav-btn"
                      [class.ts-ride-settings__nav-btn--active]="activeSection() === sec.id"
                      (click)="setActiveSection(sec.id)"
                    >
                      {{ t(sec.labelKey) }}
                    </button>
                  }
                </nav>

                <form class="ts-ride-settings__panel" (ngSubmit)="guardar()">
                                  @switch (activeSection()) {
                    @case ('general') {
                      <div class="ts-ride-section">
                        <h6 class="ts-ride-section__title">{{ t('rideDesign.baseDesign') }}</h6>
                        <p class="ts-ride-section__hint">{{ t('rideDesign.baseDesignHelp') }}</p>
                        <div class="ts-ride-presets">
                          @for (preset of designPresets; track preset.id) {
                            <button
                              type="button"
                              class="ts-ride-preset ts-choice-card"
                              [class.ts-choice-card--active]="plantilla.disenoBase === preset.id"
                              (click)="selectDesignPreset(preset.id)"
                            >
                              <span class="ts-ride-preset__label">{{ t(preset.labelKey) }}</span>
                            </button>
                          }
                        </div>
                      </div>
                    }
                    @case ('colores') {
                      <div class="ts-ride-section">
                        <h6 class="ts-ride-section__title">{{ t('rideDesign.sectionColors') }}</h6>
                        <div class="ts-ride-color-grid">
                          <label class="ts-ride-color" for="rd-primary">
                            <span class="ts-ride-color__swatch" [style.background]="plantilla.colorPrimario"></span>
                            <span class="ts-ride-color__meta">
                              <span class="ts-ride-color__name">{{ t('company.rideColorPrimary') }}</span>
                              <input id="rd-primary" type="color" class="ts-ride-color__input" [(ngModel)]="plantilla.colorPrimario" name="colorPrimario" (ngModelChange)="programarVistaPrevia()" />
                            </span>
                          </label>
                          <label class="ts-ride-color" for="rd-accent">
                            <span class="ts-ride-color__swatch" [style.background]="plantilla.colorAcento"></span>
                            <span class="ts-ride-color__meta">
                              <span class="ts-ride-color__name">{{ t('company.rideColorAccent') }}</span>
                              <input id="rd-accent" type="color" class="ts-ride-color__input" [(ngModel)]="plantilla.colorAcento" name="colorAcento" (ngModelChange)="programarVistaPrevia()" />
                            </span>
                          </label>
                          <label class="ts-ride-color" for="rd-text">
                            <span class="ts-ride-color__swatch" [style.background]="plantilla.colorTexto"></span>
                            <span class="ts-ride-color__meta">
                              <span class="ts-ride-color__name">{{ t('company.rideColorText') }}</span>
                              <input id="rd-text" type="color" class="ts-ride-color__input" [(ngModel)]="plantilla.colorTexto" name="colorTexto" (ngModelChange)="programarVistaPrevia()" />
                            </span>
                          </label>
                          <label class="ts-ride-color" for="rd-bg">
                            <span class="ts-ride-color__swatch" [style.background]="plantilla.colorFondoEncabezado"></span>
                            <span class="ts-ride-color__meta">
                              <span class="ts-ride-color__name">{{ t('company.rideColorHeaderBg') }}</span>
                              <input id="rd-bg" type="color" class="ts-ride-color__input" [(ngModel)]="plantilla.colorFondoEncabezado" name="colorFondo" (ngModelChange)="programarVistaPrevia()" />
                            </span>
                          </label>
                          <label class="ts-ride-color ts-ride-color--wide" for="rd-caja-text">
                            <span class="ts-ride-color__swatch" [style.background]="plantilla.colorTextoCajaFactura || plantilla.colorPrimario"></span>
                            <span class="ts-ride-color__meta">
                              <span class="ts-ride-color__name">{{ t('rideDesign.invoiceBoxTextColor') }}</span>
                              <input id="rd-caja-text" type="color" class="ts-ride-color__input" [(ngModel)]="plantilla.colorTextoCajaFactura" name="colorTextoCajaFactura" (ngModelChange)="programarVistaPrevia()" />
                              <span class="ts-ride-color__help">{{ t('rideDesign.invoiceBoxTextColorHelp') }}</span>
                            </span>
                          </label>
                        </div>
                      </div>
                    }
                    @case ('disposicion') {
                      <div class="ts-ride-section">
                        <h6 class="ts-ride-section__title">{{ t('rideDesign.sectionLayout') }}</h6>
                        <div class="ts-ride-field-grid">
                          <div class="ts-ride-field">
                            <label class="form-label" for="rd-logo-pos">{{ t('rideDesign.logoPosition') }}</label>
                            <select id="rd-logo-pos" class="form-select form-select-sm" [(ngModel)]="plantilla.ubicacionLogo" name="ubicacionLogo" (ngModelChange)="programarVistaPrevia()">
                              <option value="izquierda">{{ t('rideDesign.posLeft') }}</option>
                              <option value="centro">{{ t('rideDesign.posCenter') }}</option>
                              <option value="derecha">{{ t('rideDesign.posRight') }}</option>
                            </select>
                          </div>
                          <div class="ts-ride-field">
                            <label class="form-label" for="rd-clave-pos">{{ t('rideDesign.accessKeyPosition') }}</label>
                            <select id="rd-clave-pos" class="form-select form-select-sm" [(ngModel)]="plantilla.ubicacionClave" name="ubicacionClave" (ngModelChange)="programarVistaPrevia()">
                              <option value="bajo_encabezado">{{ t('rideDesign.keyBelowHeader') }}</option>
                              <option value="caja_factura">{{ t('rideDesign.keyInInvoiceBox') }}</option>
                            </select>
                          </div>
                          <div class="ts-ride-field">
                            <label class="form-label" for="rd-density">{{ t('company.rideDensity') }}</label>
                            <select id="rd-density" class="form-select form-select-sm" [(ngModel)]="plantilla.densidad" name="densidad" (ngModelChange)="programarVistaPrevia()">
                              <option value="normal">{{ t('company.rideDensityNormal') }}</option>
                              <option value="compact">{{ t('company.rideDensityCompact') }}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    }
                    @case ('contenido') {
                      <div class="ts-ride-section">
                        <h6 class="ts-ride-section__title">{{ t('rideDesign.sectionContent') }}</h6>
                        <div class="ts-ride-field mb-3">
                          <label class="form-label" for="rd-det-adic">{{ t('rideDesign.additionalDetailMode') }}</label>
                          <select id="rd-det-adic" class="form-select form-select-sm" [(ngModel)]="plantilla.detalleAdicionalModo" name="detalleAdicionalModo" (ngModelChange)="programarVistaPrevia()">
                            <option value="en_descripcion">{{ t('rideDesign.additionalInDescription') }}</option>
                            <option value="columna">{{ t('rideDesign.additionalInColumn') }}</option>
                          </select>
                        </div>
                        <div class="form-check form-switch mb-3">
                          <input id="rd-iva-breakdown" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarDesgloseIva" name="mostrarDesgloseIva" (ngModelChange)="programarVistaPrevia()" />
                          <label class="form-check-label" for="rd-iva-breakdown">{{ t('rideDesign.ivaBreakdown') }}</label>
                        </div>
                        <div class="ts-ride-field mb-3">
                          <label class="form-label" for="rd-footer">{{ t('company.rideFooterText') }}</label>
                          <input id="rd-footer" class="form-control form-control-sm" [(ngModel)]="plantilla.textoPie" name="textoPie" [placeholder]="t('company.rideFooterPlaceholder')" (ngModelChange)="programarVistaPrevia()" />
                        </div>
                        <div class="ts-ride-totals">
                          <div class="ts-ride-totals__head">
                            <label class="form-label mb-0">{{ t('rideDesign.totalsRows') }}</label>
                            <div class="ts-ride-totals__actions">
                              <button type="button" class="btn btn-link btn-sm p-0" (click)="seleccionarTodasFilasTotales()">{{ t('rideDesign.selectAllTotals') }}</button>
                              <span class="text-muted">·</span>
                              <button type="button" class="btn btn-link btn-sm p-0" (click)="limpiarFilasTotales()">{{ t('rideDesign.clearTotals') }}</button>
                            </div>
                          </div>
                          <div class="ts-ride-totals__list">
                            @for (opt of filasTotalesOpciones; track opt.key) {
                              <label class="ts-ride-totals__item" [for]="'rd-total-' + opt.key">
                                <input class="form-check-input" type="checkbox" [id]="'rd-total-' + opt.key" [checked]="filaTotalActiva(opt.key)" (change)="toggleFilaTotal(opt.key, $any($event.target).checked)" />
                                <span>{{ t(opt.labelKey) }}</span>
                              </label>
                            }
                          </div>
                        </div>
                      </div>
                    }
                    @case ('visibilidad') {
                      <div class="ts-ride-section">
                        <h6 class="ts-ride-section__title">{{ t('rideDesign.sectionVisibility') }}</h6>
                        <ul class="ts-ride-switch-list">
                          <li><div class="form-check form-switch"><input id="rd-logo" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarLogo" name="mostrarLogo" (ngModelChange)="programarVistaPrevia()" /><label class="form-check-label" for="rd-logo">{{ t('company.rideShowLogo') }}</label></div></li>
                          <li><div class="form-check form-switch"><input id="rd-barcode" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarCodigoBarras" name="mostrarBarcode" (ngModelChange)="programarVistaPrevia()" /><label class="form-check-label" for="rd-barcode">{{ t('company.rideShowBarcode') }}</label></div></li>
                          <li><div class="form-check form-switch"><input id="rd-trade" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarNombreComercial" name="mostrarNc" (ngModelChange)="programarVistaPrevia()" /><label class="form-check-label" for="rd-trade">{{ t('company.rideShowTradeName') }}</label></div></li>
                          <li><div class="form-check form-switch"><input id="rd-sin-logo" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.marcaSinLogo" name="marcaSinLogo" (ngModelChange)="programarVistaPrevia()" /><label class="form-check-label" for="rd-sin-logo">{{ t('rideDesign.showNoLogoMark') }}</label></div></li>
                          <li><div class="form-check form-switch"><input id="rd-bordes" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarBordes" name="mostrarBordes" (ngModelChange)="programarVistaPrevia()" /><label class="form-check-label" for="rd-bordes">{{ t('rideDesign.showBorders') }}</label></div></li>
                        </ul>
                      </div>
                    }
                  }
                  <p class="ts-ride-settings__note">{{ t('company.rideTemplateLegalNote') }}</p>
                </form>
              </div>
            </section>
          </div>

          <div class="col-lg-7">
            <section class="ts-ride-panel ts-ride-preview">
              <div class="ts-ride-preview__head">
                <h5 class="mb-0">{{ t('rideDesign.livePreview') }}</h5>
                @if (previewLoading) {
                  <span class="text-muted small">{{ t('rideDesign.updatingPreview') }}</span>
                }
              </div>
              @if (previewUrl) {
                <iframe class="ts-ride-preview__frame" [src]="previewUrl" title="Vista previa RIDE"></iframe>
              } @else {
                <div class="ts-ride-preview__placeholder text-muted">{{ t('rideDesign.previewPlaceholder') }}</div>
              }
            </section>
          </div>
        </div>
      }
    </ts-page-layout>
  `,
  styles: [
    `
      .ts-ride-settings {
        display: flex;
        flex-direction: column;
        min-height: min(720px, 75vh);
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        background: var(--card);
        box-shadow: var(--ef-surface-shadow);
        overflow: hidden;
        color: var(--text);
      }

      .ts-ride-settings__header {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 0.75rem 1rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
        background: var(--ef-page-header-bg, linear-gradient(180deg, #fafbfc 0%, #fff 100%));
      }

      .ts-ride-settings__eyebrow {
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .ts-ride-settings__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .ts-ride-settings__body {
        display: grid;
        grid-template-columns: minmax(7.5rem, 9.5rem) minmax(0, 1fr);
        flex: 1;
        min-height: 0;
      }

      .ts-ride-settings__nav {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.65rem 0.5rem;
        border-right: 1px solid var(--ef-divider, #e2e8f0);
        background: var(--ef-surface-raised, #f8fafc);
        overflow-y: auto;
      }

      .ts-ride-settings__nav-btn {
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 500;
        text-align: left;
        padding: 0.45rem 0.55rem;
        transition: background 0.15s ease, color 0.15s ease;
      }

      .ts-ride-settings__nav-btn:hover {
        background: rgba(30, 91, 150, 0.08);
        color: #1e5b96;
      }

      .ts-ride-settings__nav-btn--active {
        background: color-mix(in srgb, var(--lux-indigo) 12%, var(--card));
        color: var(--lux-primary-strong);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--lux-indigo) 18%, transparent);
      }

      .ts-ride-settings__panel {
        padding: 1rem 1.1rem 1.1rem;
        overflow-y: auto;
        min-height: 0;
      }

      .ts-ride-settings__note {
        margin: 1rem 0 0;
        font-size: 0.75rem;
        color: #64748b;
      }

      .ts-ride-section__title {
        font-size: 0.82rem;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 0.35rem;
      }

      .ts-ride-section__hint {
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 0.75rem;
      }

      .ts-ride-presets {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .ts-ride-preset {
        padding: 0.55rem 0.65rem;
        text-align: left;
      }

      .ts-ride-preset__label {
        font-size: 0.78rem;
        font-weight: 500;
        color: #1e293b;
        line-height: 1.35;
      }

      .ts-ride-color-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .ts-ride-color {
        display: flex;
        align-items: flex-start;
        gap: 0.55rem;
        margin: 0;
        padding: 0.55rem;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 8px;
        background: #fafbfc;
        cursor: pointer;
      }

      .ts-ride-color--wide {
        grid-column: 1 / -1;
      }

      .ts-ride-color__swatch {
        width: 2rem;
        height: 2rem;
        border-radius: 6px;
        border: 1px solid var(--ef-input-border-hover, #94a3b8);
        flex-shrink: 0;
      }

      .ts-ride-color__meta {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
      }

      .ts-ride-color__name {
        font-size: 0.72rem;
        font-weight: 500;
        color: #334155;
        line-height: 1.25;
      }

      .ts-ride-color__input {
        width: 2.25rem;
        height: 1.5rem;
        padding: 0;
        border: 0;
        background: transparent;
      }

      .ts-ride-color__help {
        font-size: 0.68rem;
        color: #64748b;
        line-height: 1.35;
      }

      .ts-ride-field-grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .ts-ride-totals__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.45rem;
      }

      .ts-ride-totals__actions {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.75rem;
      }

      .ts-ride-totals__list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.25rem 0.65rem;
        max-height: 11rem;
        overflow-y: auto;
        padding: 0.55rem;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 8px;
        background: #fafbfc;
      }

      .ts-ride-totals__item {
        display: flex;
        align-items: flex-start;
        gap: 0.35rem;
        margin: 0;
        font-size: 0.72rem;
        color: #334155;
        cursor: pointer;
      }

      .ts-ride-switch-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .ts-ride-switch-list li {
        padding: 0.35rem 0.45rem;
        border-radius: 6px;
        background: #fafbfc;
        border: 1px solid var(--ef-divider, #e2e8f0);
      }

      .ts-ride-panel {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        background: var(--card);
        padding: 1.25rem;
        box-shadow: var(--ef-surface-shadow);
        color: var(--text);
      }

      .ts-ride-preview {
        display: flex;
        flex-direction: column;
        min-height: min(720px, 75vh);
      }

      .ts-ride-preview__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
      }

      .ts-ride-preview__frame {
        flex: 1;
        width: 100%;
        min-height: 620px;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 6px;
        background: #f8fafc;
      }

      .ts-ride-preview__placeholder {
        flex: 1;
        display: grid;
        place-items: center;
        min-height: 620px;
        border: 1px dashed rgba(17, 24, 39, 0.16);
        border-radius: 6px;
        background: #f8fafc;
        font-size: 0.9rem;
      }

      @media (max-width: 991.98px) {
        .ts-ride-settings__body {
          grid-template-columns: 1fr;
        }

        .ts-ride-settings__nav {
          flex-direction: row;
          flex-wrap: wrap;
          border-right: 0;
          border-bottom: 1px solid var(--ef-divider, #e2e8f0);
        }
      }
    `,
  ],
})
export class RideDisenoPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tiposComprobante = TIPOS_COMPROBANTE;
  readonly filasTotalesOpciones = RIDE_FILAS_TOTALES_OPCIONES;
  readonly settingsSections = RIDE_SETTINGS_SECTIONS;
  readonly designPresets = RIDE_DESIGN_PRESETS;
  readonly activeSection = signal<RideSettingsSection>('general');

  tokenPresent = false;
  empresaId: string | null = null;
  loading = false;
  previewLoading = false;
  tipoComprobante = 'FACTURA';
  plantilla: RidePlantilla = { ...DEFAULT_RIDE_PLANTILLA };
  previewUrl: SafeResourceUrl | null = null;

  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewObjectUrl: string | null = null;

  ngOnInit(): void {
    this.tokenPresent = !!readAccessToken();
    this.empresaId = this.session.profile()?.empresaId ?? null;
    if (this.tokenPresent && this.empresaId && this.session.puedeConfiguracionTributaria()) {
      this.cargarPlantilla();
    }
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  onTipoChange(): void {
    this.cargarPlantilla();
  }

  setActiveSection(section: RideSettingsSection): void {
    this.activeSection.set(section);
  }

  selectDesignPreset(id: RideDisenoBase): void {
    this.plantilla.disenoBase = id;
    this.aplicarPresetDiseno();
  }

  seleccionarTodasFilasTotales(): void {
    const keys = this.filasTotalesOpciones.map((o) => o.key);
    this.plantilla = { ...this.plantilla, filasTotales: keys };
    this.programarVistaPrevia();
  }

  limpiarFilasTotales(): void {
    this.plantilla = { ...this.plantilla, filasTotales: ['VALOR_TOTAL'] };
    this.programarVistaPrevia();
  }

  aplicarPresetDiseno(): void {
    const base = this.plantilla.disenoBase;
    if (base === 'sri_clasico') {
      this.plantilla = { ...this.plantilla, ...PRESET_SRI };
    } else if (base === 'ejecutivo') {
      this.plantilla = { ...this.plantilla, ...PRESET_EJECUTIVO };
    }
    this.programarVistaPrevia();
  }

  filaTotalActiva(key: string): boolean {
    return this.plantilla.filasTotales?.includes(key) ?? false;
  }

  toggleFilaTotal(key: string, checked: boolean): void {
    const set = new Set(this.plantilla.filasTotales ?? []);
    if (checked) {
      set.add(key);
    } else if (key !== 'VALOR_TOTAL') {
      set.delete(key);
    }
    if (!set.has('VALOR_TOTAL')) {
      set.add('VALOR_TOTAL');
    }
    this.plantilla = { ...this.plantilla, filasTotales: [...set] };
    this.programarVistaPrevia();
  }

  programarVistaPrevia(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
    }
    this.previewTimer = setTimeout(() => this.actualizarVistaPrevia(), 650);
  }

  guardar(): void {
    if (!this.empresaId) {
      return;
    }
    this.loading = true;
    const params = new HttpParams().set('tipo', this.tipoComprobante);
    this.http
      .put<RidePlantilla>(`/api/web/v1/empresas/${this.empresaId}/ride-plantilla`, this.plantilla, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.loading = false;
          this.plantilla = this.normalizarPlantilla(saved);
          this.toast.success(this.t('company.rideTemplateSaved'));
          this.actualizarVistaPrevia();
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.toast.error(extractApiErrorMessage(err, this.t('company.rideTemplateSaveError')));
        },
      });
  }

  actualizarVistaPrevia(): void {
    if (!this.empresaId) {
      return;
    }
    this.previewLoading = true;
    const params = new HttpParams().set('tipo', this.tipoComprobante);
    this.http
      .post(`/api/web/v1/empresas/${this.empresaId}/ride-plantilla/vista-previa`, this.plantilla, {
        params,
        responseType: 'blob',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.previewLoading = false;
          this.asignarPreview(blob);
        },
        error: (err: HttpErrorResponse) => {
          this.previewLoading = false;
          this.toast.error(extractApiErrorMessage(err, this.t('company.rideTemplatePreviewError')));
        },
      });
  }

  private cargarPlantilla(): void {
    if (!this.empresaId) {
      return;
    }
    const params = new HttpParams().set('tipo', this.tipoComprobante);
    this.http
      .get<RidePlantilla>(`/api/web/v1/empresas/${this.empresaId}/ride-plantilla`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.plantilla = this.normalizarPlantilla(data);
          this.actualizarVistaPrevia();
        },
        error: () => {
          this.plantilla = { ...DEFAULT_RIDE_PLANTILLA };
          this.actualizarVistaPrevia();
        },
      });
  }

  private normalizarPlantilla(raw: RidePlantilla): RidePlantilla {
    return {
      ...DEFAULT_RIDE_PLANTILLA,
      ...raw,
      disenoBase: raw.disenoBase ?? DEFAULT_RIDE_PLANTILLA.disenoBase,
      ubicacionLogo: raw.ubicacionLogo ?? DEFAULT_RIDE_PLANTILLA.ubicacionLogo,
      ubicacionClave: raw.ubicacionClave ?? DEFAULT_RIDE_PLANTILLA.ubicacionClave,
      marcaSinLogo: raw.marcaSinLogo ?? DEFAULT_RIDE_PLANTILLA.marcaSinLogo,
      mostrarBordes: raw.mostrarBordes ?? DEFAULT_RIDE_PLANTILLA.mostrarBordes,
      detalleAdicionalModo:
        raw.detalleAdicionalModo === 'columna' ? 'columna' : DEFAULT_RIDE_PLANTILLA.detalleAdicionalModo,
      mostrarDesgloseIva: raw.mostrarDesgloseIva ?? DEFAULT_RIDE_PLANTILLA.mostrarDesgloseIva,
      colorTextoCajaFactura: raw.colorTextoCajaFactura ?? DEFAULT_RIDE_PLANTILLA.colorTextoCajaFactura,
      filasTotales:
        raw.filasTotales?.length ? [...raw.filasTotales] : [...DEFAULT_RIDE_PLANTILLA.filasTotales],
    };
  }

  private asignarPreview(blob: Blob): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
    }
    this.previewObjectUrl = URL.createObjectURL(blob);
    this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl);
  }
}
