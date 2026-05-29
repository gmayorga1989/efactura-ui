import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { resolveSriSyncPeriod } from '../../core/sri/sri-sync-period.util';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

interface EmpresaResponse {
  id: string;
  ruc: string;
  slug: string;
  razonSocial: string;
  nombreComercial?: string | null;
  obligadoContabilidad: boolean;
  contribuyenteEspecial?: string | null;
  exportadorHabitual: boolean;
  calificacionArtesanal: boolean;
  codigoArtesano?: string | null;
  agenteRetencion: boolean;
  ambienteSri: number;
  tipoEmision: number;
  direccionMatriz?: string | null;
  logoUrl?: string | null;
  timezone: string;
  estado: string;
  configExtra: Record<string, unknown>;
}

interface EmpresaLogoResponse {
  empresaId: string;
  logoUrl: string;
  storageKey: string;
}

interface SriPortalCredentialStatusResponse {
  serviceEnabled: boolean;
  provisioned: boolean;
  subscriberId?: string | null;
  configured: boolean;
  portalUsuarioMasked?: string | null;
  vigenteDesde?: string | null;
}

interface SriSyncRunResponse {
  estado: string;
  comprobantesNuevos?: number;
  mensaje?: string;
}

interface CertificadoResponse {
  id: string;
  alias: string;
  archivoStorageKey: string;
  emisor: string;
  serial: string;
  validoDesde: string;
  validoHasta: string;
  activoParaFirma: boolean;
  estado: string;
}

interface EmpresaForm {
  ruc: string;
  slug: string;
  razonSocial: string;
  nombreComercial: string;
  direccionMatriz: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial: string;
  exportadorHabitual: boolean;
  calificacionArtesanal: boolean;
  codigoArtesano: string;
  agenteRetencion: boolean;
  ambienteSri: number;
  tipoEmision: number;
  timezone: string;
  estado: string;
}

const LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEZONE = 'America/Guayaquil';
const COMMON_TIMEZONES = [
  'America/Guayaquil',
  'America/Bogota',
  'America/Lima',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Panama',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'Europe/Madrid',
  'UTC',
];

@Component({
  selector: 'ts-configuracion-empresa-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('company.title')"
      [subtitle]="t('company.subtitle')"
      [eyebrow]="t('company.eyebrow')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-soft-primary" (click)="reload()" [disabled]="loading">
          {{ t('common.refresh') }}
        </button>
      </div>

      @if (!tokenPresent || !empresaId) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>.
          } @else {
            {{ t('company.selectCompany') }}
          }
        </p>
      } @else if (!session.puedeConfiguracionTributaria()) {
        <p class="text-muted mb-0">{{ t('company.adminOnly') }}</p>
      } @else {
        <section class="ts-company-summary mb-3">
          <div class="ts-logo-frame">
            @if (empresa?.logoUrl; as logoUrl) {
              <img [src]="logoUrl" alt="" />
            } @else {
              <span>{{ companyInitials() }}</span>
            }
          </div>
          <div class="min-w-0">
            <p class="text-muted small mb-1">{{ t('company.selectedCompany') }}</p>
            <h4 class="mb-1 text-truncate">{{ form.nombreComercial || form.razonSocial || t('company.title') }}</h4>
            <div class="d-flex flex-wrap gap-2 align-items-center">
              <span class="badge bg-light text-dark">RUC {{ form.ruc || '-' }}</span>
              <span class="badge bg-soft-success text-success">{{ form.estado || t('company.noStatus') }}</span>
              <span class="badge bg-light text-dark">{{ ambienteLabel() }}</span>
            </div>
          </div>
        </section>

        <div class="row g-3 align-items-start">
          <div class="col-xl-8">
            <section class="ts-panel">
              <div class="ts-panel-header">
                <div>
                  <h5>{{ t('company.dataTitle') }}</h5>
                  <p>{{ t('company.dataSubtitle') }}</p>
                </div>
                <button type="button" class="btn btn-primary" (click)="guardarEmpresa()" [disabled]="loading">
                  {{ t('company.saveChanges') }}
                </button>
              </div>

              <form class="ts-form-grid">
                <label class="ts-field ts-field-sm" for="emp-ruc">
                  <span>RUC</span>
                  <input id="emp-ruc" class="form-control" name="ruc" [(ngModel)]="form.ruc" maxlength="13" inputmode="numeric" />
                </label>

                <label class="ts-field ts-field-sm" for="emp-slug">
                  <span>Slug</span>
                  <input id="emp-slug" class="form-control" name="slug" [(ngModel)]="form.slug" readonly />
                </label>

                <label class="ts-field ts-field-sm" for="emp-estado">
                  <span>{{ t('common.status') }}</span>
                  <input id="emp-estado" class="form-control" name="estado" [(ngModel)]="form.estado" readonly />
                </label>

                <label class="ts-field ts-field-wide" for="emp-rs">
                  <span>{{ t('company.businessName') }}</span>
                  <input id="emp-rs" class="form-control" name="razonSocial" [(ngModel)]="form.razonSocial" />
                </label>

                <label class="ts-field" for="emp-nc">
                  <span>{{ t('company.tradeName') }}</span>
                  <input id="emp-nc" class="form-control" name="nombreComercial" [(ngModel)]="form.nombreComercial" />
                </label>

                <label class="ts-field ts-field-wide" for="emp-dir">
                  <span>{{ t('company.matrixAddress') }}</span>
                  <input id="emp-dir" class="form-control" name="direccionMatriz" [(ngModel)]="form.direccionMatriz" />
                </label>

                <label class="ts-field" for="emp-tz">
                  <span>{{ t('company.timezone') }}</span>
                  <select id="emp-tz" class="form-select" name="timezone" [(ngModel)]="form.timezone">
                    @for (tz of timezoneOptions; track tz) {
                      <option [value]="tz">{{ timezoneLabel(tz) }}</option>
                    }
                  </select>
                </label>

                <label class="ts-field ts-field-sm" for="emp-amb">
                  <span>{{ t('company.sriEnvironment') }}</span>
                  <select id="emp-amb" class="form-select" name="ambienteSri" [(ngModel)]="form.ambienteSri">
                    <option [ngValue]="1">1 - {{ t('company.test') }}</option>
                    <option [ngValue]="2">2 - {{ t('company.production') }}</option>
                  </select>
                </label>

                <label class="ts-field ts-field-sm" for="emp-em">
                  <span>{{ t('company.emissionType') }}</span>
                  <select id="emp-em" class="form-select" name="tipoEmision" [(ngModel)]="form.tipoEmision">
                    <option [ngValue]="1">1 - {{ t('company.normal') }}</option>
                  </select>
                </label>

                <label class="ts-field" for="emp-ce">
                  <span>{{ t('company.specialTaxpayer') }}</span>
                  <input id="emp-ce" class="form-control" name="contribuyenteEspecial" [(ngModel)]="form.contribuyenteEspecial" />
                </label>

                <div class="ts-check-field">
                  <input
                    id="emp-cont"
                    type="checkbox"
                    class="form-check-input"
                    name="obligadoContabilidad"
                    [(ngModel)]="form.obligadoContabilidad"
                  />
                  <label for="emp-cont">{{ t('company.accountingRequired') }}</label>
                </div>

                <div class="ts-check-field">
                  <input
                    id="emp-exportador"
                    type="checkbox"
                    class="form-check-input"
                    name="exportadorHabitual"
                    [(ngModel)]="form.exportadorHabitual"
                  />
                  <label for="emp-exportador">{{ t('company.frequentExporter') }}</label>
                </div>

                <div class="ts-check-field">
                  <input
                    id="emp-artesanal"
                    type="checkbox"
                    class="form-check-input"
                    name="calificacionArtesanal"
                    [(ngModel)]="form.calificacionArtesanal"
                    (ngModelChange)="onCalificacionArtesanalChange($event)"
                  />
                  <label for="emp-artesanal">{{ t('company.artisanQualification') }}</label>
                </div>

                @if (form.calificacionArtesanal) {
                  <label class="ts-field ts-field-sm" for="emp-codigo-artesano">
                    <span>{{ t('company.artisanCode') }}</span>
                    <input id="emp-codigo-artesano" class="form-control" name="codigoArtesano" [(ngModel)]="form.codigoArtesano" />
                  </label>
                }

                <div class="ts-check-field">
                  <input
                    id="emp-agente-retencion"
                    type="checkbox"
                    class="form-check-input"
                    name="agenteRetencion"
                    [(ngModel)]="form.agenteRetencion"
                  />
                  <label for="emp-agente-retencion">{{ t('company.withholdingAgent') }}</label>
                </div>
              </form>

              <div class="ts-panel-footer">
                <span>{{ t('company.currentContextInfo') }}</span>
              </div>
            </section>
          </div>

          <div class="col-xl-4">
            <section class="ts-panel mb-3">
              <div class="ts-panel-header compact">
                <div>
                  <h5>Logo</h5>
                  <p>{{ t('company.logoRules') }}</p>
                </div>
              </div>

              <div class="ts-upload-preview">
                @if (empresa?.logoUrl; as logoUrl) {
                  <img [src]="logoUrl" alt="" />
                } @else {
                  <span>{{ companyInitials() }}</span>
                }
              </div>

              <div class="ts-file-row">
                <input
                  id="logo-file"
                  type="file"
                  class="form-control"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  (change)="onLogoSelected($event)"
                />
                <button type="button" class="btn btn-soft-primary" (click)="subirLogo()" [disabled]="loading || !logoFile">
                  {{ t('company.uploadLogo') }}
                </button>
              </div>
              @if (logoFile) {
                <p class="text-muted small mt-2 mb-0 text-truncate">{{ logoFile.name }}</p>
              }
            </section>

            <section class="ts-panel">
              <div class="ts-panel-header compact">
                <div>
                  <h5>{{ t('company.certificate') }}</h5>
                  <p>{{ t('company.certificateRules') }}</p>
                </div>
              </div>

              <div class="ts-stack">
                <label class="ts-field" for="cert-file">
                  <span>{{ t('company.file') }}</span>
                  <input id="cert-file" type="file" class="form-control" accept=".p12,.pfx" (change)="onCertSelected($event)" />
                </label>

                <label class="ts-field" for="cert-password">
                  <span>{{ t('company.password') }}</span>
                  <input
                    id="cert-password"
                    type="password"
                    class="form-control"
                    name="certPassword"
                    [(ngModel)]="certPassword"
                    autocomplete="new-password"
                  />
                </label>

                <label class="ts-field" for="cert-alias">
                  <span>{{ t('company.optionalAlias') }}</span>
                  <input id="cert-alias" class="form-control" name="certAlias" [(ngModel)]="certAlias" />
                </label>
              </div>

              <div class="d-flex justify-content-end mt-3">
                <button type="button" class="btn btn-primary" (click)="subirCertificado()" [disabled]="loading || !certFile">
                  {{ t('company.uploadCertificate') }}
                </button>
              </div>
            </section>
          </div>
        </div>

        <section class="ts-panel mt-3">
          <div class="ts-panel-header">
            <div>
              <h5>{{ t('company.loadedCertificates') }}</h5>
              <p>{{ t('company.loadedCertificatesHelp') }}</p>
            </div>
          </div>

          @if (certificados.length === 0) {
            <div class="ts-empty-state">
              <p class="mb-0">{{ t('company.noCertificates') }}</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0 ts-cert-table">
                <thead>
                  <tr>
                    <th>Alias</th>
                    <th>{{ t('company.issuer') }}</th>
                    <th>Serial</th>
                    <th>{{ t('company.validity') }}</th>
                    <th>{{ t('company.signature') }}</th>
                    <th>{{ t('common.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of certificados; track c.id) {
                    <tr>
                      <td class="fw-semibold">{{ c.alias }}</td>
                      <td class="small">{{ c.emisor }}</td>
                      <td class="small">{{ c.serial }}</td>
                      <td class="small text-nowrap">
                        {{ c.validoDesde | date: 'yyyy-MM-dd' }} / {{ c.validoHasta | date: 'yyyy-MM-dd' }}
                      </td>
                      <td>
                        @if (c.activoParaFirma) {
                          <span class="badge bg-soft-success text-success">{{ t('common.active') }}</span>
                        } @else {
                          <span class="badge bg-light text-muted">{{ t('company.notActive') }}</span>
                        }
                      </td>
                      <td><span class="badge bg-light text-dark">{{ c.estado }}</span></td>
                      <td class="text-end">
                        <button
                          type="button"
                          class="btn btn-soft-primary btn-sm"
                          (click)="activarCertificado(c)"
                          [disabled]="loading || c.activoParaFirma"
                        >
                          {{ t('common.activate') }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="ts-panel mt-3">
          <div class="ts-panel-header">
            <div>
              <h5>{{ t('company.sriDownloadTitle') }}</h5>
              <p>{{ t('company.sriDownloadSubtitle') }}</p>
            </div>
            @if (sriCredentialConfigured) {
              <span class="badge bg-soft-success text-success">{{ t('company.sriPortalConfigured') }}</span>
            } @else {
              <span class="badge bg-light text-muted">{{ t('company.sriPortalNotConfigured') }}</span>
            }
          </div>

          @if (!sriDownloadServiceEnabled) {
            <div class="ts-empty-state">
              <p class="mb-0">{{ t('company.sriPortalServiceDisabled') }}</p>
            </div>
          } @else {
            @if (sriCredentialConfigured && sriPortalUsuarioMasked) {
              <p class="small text-muted mb-3">
                {{ t('company.sriPortalMaskedUser') }}: <strong>{{ sriPortalUsuarioMasked }}</strong>
                @if (sriCredentialVigenteDesde) {
                  · {{ sriCredentialVigenteDesde | date: 'yyyy-MM-dd HH:mm' }}
                }
              </p>
            }

            <div class="ts-stack">
              <label class="ts-field" for="sri-portal-usuario">
                <span>{{ t('company.sriPortalUser') }}</span>
                <input
                  id="sri-portal-usuario"
                  class="form-control"
                  name="sriPortalUsuario"
                  [(ngModel)]="sriPortalUsuario"
                  autocomplete="username"
                />
              </label>

              <label class="ts-field" for="sri-portal-clave">
                <span>{{ t('company.sriPortalPassword') }}</span>
                <input
                  id="sri-portal-clave"
                  type="password"
                  class="form-control"
                  name="sriPortalClave"
                  [(ngModel)]="sriPortalClave"
                  autocomplete="new-password"
                  [placeholder]="sriCredentialConfigured ? t('company.sriPortalPasswordKeep') : ''"
                />
              </label>
            </div>

            <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
              @if (sriCredentialConfigured) {
                <button type="button" class="btn btn-outline-primary" (click)="sincronizarSriAhora()" [disabled]="loading || sriSyncInProgress">
                  {{ sriSyncInProgress ? t('company.sriPortalSyncRunning') : t('company.sriPortalSyncNow') }}
                </button>
                <button type="button" class="btn btn-outline-danger" (click)="eliminarCredencialesSri()" [disabled]="loading || sriSyncInProgress">
                  {{ t('company.sriPortalRemove') }}
                </button>
              }
              <button type="button" class="btn btn-primary" (click)="guardarCredencialesSri()" [disabled]="loading || sriSyncInProgress">
                {{ t('company.sriPortalSave') }}
              </button>
            </div>
          }
        </section>
      }
    </ts-page-layout>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ts-company-summary,
      .ts-panel {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        background: #fff;
        box-shadow: var(--ef-surface-shadow);
      }

      .ts-company-summary {
        display: flex;
        gap: 1rem;
        align-items: center;
        padding: 1rem 1.25rem;
      }

      .ts-logo-frame,
      .ts-upload-preview {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        overflow: hidden;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 8px;
        background: #f8fafc;
        color: #334155;
        font-weight: 700;
      }

      .ts-logo-frame {
        width: 64px;
        height: 64px;
      }

      .ts-logo-frame img,
      .ts-upload-preview img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .ts-panel {
        padding: 1.25rem;
      }

      .ts-panel-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
      }

      .ts-panel-header.compact {
        margin-bottom: 0.875rem;
        padding-bottom: 0;
        border-bottom: 0;
      }

      .ts-panel-header h5 {
        margin: 0;
        font-size: 1rem;
      }

      .ts-panel-header p,
      .ts-panel-footer,
      .ts-empty-state {
        margin: 0.25rem 0 0;
        color: #64748b;
        font-size: 0.875rem;
      }

      .ts-form-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 1rem;
      }

      .ts-field {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 0.375rem;
        grid-column: span 3;
      }

      .ts-field-sm {
        grid-column: span 2;
      }

      .ts-field-wide {
        grid-column: span 4;
      }

      .ts-field span {
        color: #475569;
        font-size: 0.8125rem;
        font-weight: 600;
      }

      .ts-field .form-control,
      .ts-field .form-select {
        min-height: 42px;
        border-radius: 8px;
      }

      .ts-field .form-control[readonly] {
        background: #f8fafc;
        color: #0f172a;
      }

      .ts-check-field {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        min-height: 42px;
        grid-column: span 2;
        padding: 0.625rem 0.75rem;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        background: #f8fafc;
      }

      .ts-check-field label {
        margin: 0;
        color: #475569;
        font-weight: 600;
      }

      .ts-panel-footer {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--ef-divider, #e2e8f0);
      }

      .ts-upload-preview {
        width: 100%;
        height: 132px;
        margin-bottom: 1rem;
        padding: 1rem;
      }

      .ts-upload-preview span {
        font-size: 1.5rem;
      }

      .ts-file-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.75rem;
        align-items: center;
      }

      .ts-stack {
        display: grid;
        gap: 0.875rem;
      }

      .ts-empty-state {
        padding: 1.25rem;
        border: 1px dashed var(--ef-input-border-hover, #94a3b8);
        border-radius: 8px;
        background: #f8fafc;
        text-align: center;
      }

      .ts-cert-table th {
        color: #475569;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      @media (max-width: 991.98px) {
        .ts-form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .ts-field,
        .ts-field-sm,
        .ts-field-wide,
        .ts-check-field {
          grid-column: span 2;
        }
      }

      @media (max-width: 575.98px) {
        .ts-company-summary,
        .ts-panel-header,
        .ts-file-row {
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }

        .ts-form-grid {
          grid-template-columns: 1fr;
        }

        .ts-field,
        .ts-field-sm,
        .ts-field-wide,
        .ts-check-field {
          grid-column: span 1;
        }
      }
    `,
  ],
})
export class ConfiguracionEmpresaPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  tokenPresent = false;
  empresaId: string | null = null;
  loading = false;
  empresa: EmpresaResponse | null = null;
  certificados: CertificadoResponse[] = [];
  logoFile: File | null = null;
  certFile: File | null = null;
  certAlias = '';
  certPassword = '';
  sriPortalUsuario = '';
  sriPortalClave = '';
  sriCredentialConfigured = false;
  sriPortalUsuarioMasked: string | null = null;
  sriCredentialVigenteDesde: string | null = null;
  sriDownloadServiceEnabled = true;
  sriSyncInProgress = false;
  readonly browserTimezone = this.detectBrowserTimezone();
  readonly timezoneOptions = this.buildTimezoneOptions();
  form: EmpresaForm = this.emptyForm();

  ngOnInit(): void {
    this.tokenPresent = !!readAccessToken();
    this.empresaId = this.session.profile()?.empresaId ?? null;
    if (this.tokenPresent && this.empresaId && this.session.puedeConfiguracionTributaria()) {
      this.reload();
    }
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  reload(): void {
    if (!this.empresaId) {
      return;
    }
    this.loading = true;
    this.http.get<EmpresaResponse>(`/api/web/v1/empresas/${this.empresaId}`).subscribe({
      next: (empresa) => {
        this.loading = false;
        this.empresa = empresa;
        this.form = this.formFromEmpresa(empresa);
        this.loadCerts();
        this.loadSriPortalCredentials();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.showMsg(this.httpError(err, this.t('company.loadError')), false);
      },
    });
  }

  guardarEmpresa(): void {
    if (!this.empresaId) {
      return;
    }
    const ruc = this.form.ruc.trim();
    if (!/^\d{13}$/.test(ruc)) {
      this.showMsg(this.t('company.rucInvalid'), false);
      return;
    }
    if (!this.form.razonSocial.trim()) {
      this.showMsg(this.t('company.businessNameRequired'), false);
      return;
    }
    if (this.form.calificacionArtesanal && !this.form.codigoArtesano.trim()) {
      this.showMsg(this.t('company.artisanCodeRequired'), false);
      return;
    }

    const body = {
      ruc,
      razonSocial: this.form.razonSocial.trim(),
      nombreComercial: this.form.nombreComercial.trim() || null,
      obligadoContabilidad: this.form.obligadoContabilidad,
      contribuyenteEspecial: this.form.contribuyenteEspecial.trim() || null,
      exportadorHabitual: this.form.exportadorHabitual,
      calificacionArtesanal: this.form.calificacionArtesanal,
      codigoArtesano: this.form.calificacionArtesanal ? this.form.codigoArtesano.trim() : null,
      agenteRetencion: this.form.agenteRetencion,
      direccionMatriz: this.form.direccionMatriz.trim() || null,
      timezone: this.form.timezone.trim() || DEFAULT_TIMEZONE,
      ambienteSri: Number(this.form.ambienteSri) || 1,
      tipoEmision: Number(this.form.tipoEmision) || 1,
    };

    this.loading = true;
    this.http.patch<EmpresaResponse>(`/api/web/v1/empresas/${this.empresaId}`, body).subscribe({
      next: (empresa) => {
        this.loading = false;
        this.empresa = empresa;
        this.form = this.formFromEmpresa(empresa);
        this.showMsg(this.t('company.updated'), true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.showMsg(this.httpError(err, this.t('company.updateError')), false);
      },
    });
  }

  onCalificacionArtesanalChange(active: boolean): void {
    if (!active) {
      this.form.codigoArtesano = '';
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoFile = input.files?.[0] ?? null;
  }

  subirLogo(): void {
    if (!this.empresaId || !this.logoFile) {
      return;
    }
    if (!LOGO_MIME_TYPES.has(this.logoFile.type)) {
      this.showMsg(this.t('company.logoTypeError'), false);
      return;
    }
    if (this.logoFile.size > LOGO_MAX_BYTES) {
      this.showMsg(this.t('company.logoSizeError'), false);
      return;
    }
    const fd = new FormData();
    fd.append('archivo', this.logoFile);
    this.loading = true;
    this.http.post<EmpresaLogoResponse>(`/api/web/v1/empresas/${this.empresaId}/logo`, fd).subscribe({
      next: (res) => {
        this.loading = false;
        this.logoFile = null;
        if (this.empresa) {
          this.empresa = { ...this.empresa, logoUrl: res.logoUrl };
        }
        this.showMsg(this.t('company.logoUploaded'), true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.showMsg(this.httpError(err, this.t('company.logoUploadError')), false);
      },
    });
  }

  onCertSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.certFile = input.files?.[0] ?? null;
  }

  subirCertificado(): void {
    if (!this.certFile) {
      this.showMsg(this.t('company.selectCertificateFile'), false);
      return;
    }
    const lowerName = this.certFile.name.toLowerCase();
    if (!lowerName.endsWith('.p12') && !lowerName.endsWith('.pfx')) {
      this.showMsg(this.t('company.certificateExtensionError'), false);
      return;
    }
    if (!this.certPassword.trim()) {
      this.showMsg(this.t('company.certificatePasswordRequired'), false);
      return;
    }

    const fd = new FormData();
    fd.append('archivo', this.certFile);
    fd.append('password', this.certPassword);
    if (this.certAlias.trim()) {
      fd.append('alias', this.certAlias.trim());
    }

    this.loading = true;
    this.http.post<CertificadoResponse>('/api/web/v1/tributario/certificados', fd, { params: this.platformParams() }).subscribe({
      next: () => {
        this.loading = false;
        this.certFile = null;
        this.certPassword = '';
        this.certAlias = '';
        this.showMsg(this.t('company.certificateUploaded'), true);
        this.loadCerts();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.showMsg(this.httpError(err, this.t('company.certificateUploadError')), false);
      },
    });
  }

  activarCertificado(certificado: CertificadoResponse): void {
    this.loading = true;
    this.http
      .post<CertificadoResponse>(`/api/web/v1/tributario/certificados/${certificado.id}/activar`, {}, { params: this.platformParams() })
      .subscribe({
        next: () => {
          this.loading = false;
          this.showMsg(this.t('company.certificateActivated'), true);
          this.loadCerts();
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.showMsg(this.httpError(err, this.t('company.certificateActivateError')), false);
        },
      });
  }

  companyInitials(): string {
    const source = (this.form.nombreComercial || this.form.razonSocial || 'EC').trim();
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.slice(0, 1).toUpperCase())
      .join('');
  }

  ambienteLabel(): string {
    if (this.form.ambienteSri === 2) {
      return this.t('company.production');
    }
    if (this.form.ambienteSri === 1) {
      return this.t('company.test');
    }
    return this.t('company.sriEnvironment');
  }

  timezoneLabel(timezone: string): string {
    return timezone === this.browserTimezone ? `${timezone} (${this.t('company.suggested')})` : timezone;
  }

  guardarCredencialesSri(): void {
    const usuario = this.sriPortalUsuario.trim();
    if (!usuario) {
      this.showMsg(this.t('company.sriPortalUserRequired'), false);
      return;
    }
    if (!this.sriCredentialConfigured && !this.sriPortalClave.trim()) {
      this.showMsg(this.t('company.sriPortalPasswordRequired'), false);
      return;
    }
    if (!this.sriPortalClave.trim()) {
      this.showMsg(this.t('company.sriPortalPasswordRequired'), false);
      return;
    }

    const body = { portalUsuario: usuario, portalClave: this.sriPortalClave };
    this.loading = true;
    this.http
      .put<SriPortalCredentialStatusResponse>('/api/web/v1/sri-descarga/portal-credentials', body, {
        params: this.platformParams(),
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.applySriPortalStatus(res);
          this.sriPortalClave = '';
          this.showMsg(this.t('company.sriPortalSaved'), true);
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.showMsg(this.httpError(err, this.t('company.sriPortalSaveError')), false);
        },
      });
  }

  sincronizarSriAhora(): void {
    if (this.sriSyncInProgress) {
      return;
    }
    if (!this.sriCredentialConfigured) {
      this.showMsg(this.t('company.sriPortalSyncNeedsCredentials'), false);
      return;
    }
    this.sriSyncInProgress = true;
    const range = resolveSriSyncPeriod('current_month');
    this.http
      .post<SriSyncRunResponse>(
        '/api/web/v1/sri-descarga/sync',
        { fechaDesde: range.fechaDesde, fechaHasta: range.fechaHasta },
        { params: this.platformParams() },
      )
      .subscribe({
        next: (res) => {
          if (res.estado === 'EN_PROGRESO') {
            this.showMsg(this.t('company.sriPortalSyncStarted'), true);
            this.pollSyncStatus(0);
            return;
          }
          this.finalizarSyncUi(res);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.showMsg(this.t('company.sriPortalSyncStarted'), true);
            this.pollSyncStatus(0);
            return;
          }
          this.sriSyncInProgress = false;
          this.showMsg(this.httpError(err, this.t('company.sriPortalSyncError')), false);
        },
      });
  }

  private pollSyncStatus(intento: number): void {
    const maxIntentos = 120;
    if (intento >= maxIntentos) {
      this.sriSyncInProgress = false;
      this.showMsg(this.t('company.sriPortalSyncTimeout'), false);
      return;
    }
    setTimeout(() => {
      this.http
        .get<SriSyncRunResponse>('/api/web/v1/sri-descarga/sync/status', { params: this.platformParams() })
        .subscribe({
          next: (res) => {
            if (res.estado === 'EN_PROGRESO') {
              this.pollSyncStatus(intento + 1);
              return;
            }
            this.finalizarSyncUi(res);
          },
          error: () => this.pollSyncStatus(intento + 1),
        });
    }, 3000);
  }

  private finalizarSyncUi(res: SriSyncRunResponse): void {
    this.sriSyncInProgress = false;
    if (res.estado === 'ERROR') {
      this.showMsg(res.mensaje || this.t('company.sriPortalSyncError'), false);
      return;
    }
    const nuevos = res.comprobantesNuevos ?? 0;
    this.showMsg(this.t('company.sriPortalSyncDone').replace('{n}', String(nuevos)), true);
  }

  eliminarCredencialesSri(): void {
    this.loading = true;
    this.http
      .delete<void>('/api/web/v1/sri-descarga/portal-credentials', { params: this.platformParams() })
      .subscribe({
        next: () => {
          this.loading = false;
          this.sriCredentialConfigured = false;
          this.sriPortalUsuarioMasked = null;
          this.sriCredentialVigenteDesde = null;
          this.sriPortalUsuario = '';
          this.sriPortalClave = '';
          this.showMsg(this.t('company.sriPortalRemoved'), true);
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.showMsg(this.httpError(err, this.t('company.sriPortalRemoveError')), false);
        },
      });
  }

  private loadSriPortalCredentials(): void {
    this.http
      .get<SriPortalCredentialStatusResponse>('/api/web/v1/sri-descarga/portal-credentials', {
        params: this.platformParams(),
      })
      .subscribe({
        next: (res) => this.applySriPortalStatus(res),
        error: (err: HttpErrorResponse) => {
          this.sriDownloadServiceEnabled = false;
          this.showMsg(this.httpError(err, this.t('company.sriPortalLoadError')), false);
        },
      });
  }

  private applySriPortalStatus(res: SriPortalCredentialStatusResponse): void {
    this.sriDownloadServiceEnabled = res.serviceEnabled;
    this.sriCredentialConfigured = res.configured;
    this.sriPortalUsuarioMasked = res.portalUsuarioMasked ?? null;
    this.sriCredentialVigenteDesde = res.vigenteDesde ?? null;
    if (res.configured && res.portalUsuarioMasked) {
      this.sriPortalUsuario = '';
    }
  }

  private loadCerts(): void {
    this.http.get<CertificadoResponse[]>('/api/web/v1/tributario/certificados', { params: this.platformParams() }).subscribe({
      next: (c) => (this.certificados = c),
      error: (err: HttpErrorResponse) => {
        this.certificados = [];
        this.showMsg(this.httpError(err, this.t('company.certificatesLoadError')), false);
      },
    });
  }

  private platformParams(): HttpParams {
    const isPlatformAdmin = this.session.hasAnyAuthority('PLATFORM_ADMIN');
    if (isPlatformAdmin && this.empresaId) {
      return new HttpParams().set('empresaId', this.empresaId);
    }
    return new HttpParams();
  }

  private formFromEmpresa(empresa: EmpresaResponse): EmpresaForm {
    return {
      ruc: empresa.ruc ?? '',
      slug: empresa.slug ?? '',
      razonSocial: empresa.razonSocial ?? '',
      nombreComercial: empresa.nombreComercial ?? '',
      direccionMatriz: empresa.direccionMatriz ?? '',
      obligadoContabilidad: empresa.obligadoContabilidad ?? false,
      contribuyenteEspecial: empresa.contribuyenteEspecial ?? '',
      exportadorHabitual: empresa.exportadorHabitual ?? false,
      calificacionArtesanal: empresa.calificacionArtesanal ?? false,
      codigoArtesano: empresa.codigoArtesano ?? '',
      agenteRetencion: empresa.agenteRetencion ?? false,
      ambienteSri: empresa.ambienteSri ?? 1,
      tipoEmision: empresa.tipoEmision ?? 1,
      timezone: empresa.timezone || this.browserTimezone || DEFAULT_TIMEZONE,
      estado: empresa.estado ?? '',
    };
  }

  private emptyForm(): EmpresaForm {
    return {
      ruc: '',
      slug: '',
      razonSocial: '',
      nombreComercial: '',
      direccionMatriz: '',
      obligadoContabilidad: false,
      contribuyenteEspecial: '',
      exportadorHabitual: false,
      calificacionArtesanal: false,
      codigoArtesano: '',
      agenteRetencion: false,
      ambienteSri: 1,
      tipoEmision: 1,
      timezone: this.browserTimezone || DEFAULT_TIMEZONE,
      estado: '',
    };
  }

  private detectBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  }

  private buildTimezoneOptions(): string[] {
    const values = [this.browserTimezone, DEFAULT_TIMEZONE, ...COMMON_TIMEZONES].filter((v) => !!v);
    return Array.from(new Set(values));
  }

  private httpError(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 404) {
      return this.t('company.notFoundOrEndpointError');
    }
    if (err.status === 405) {
      return this.t('company.patchUnsupportedError');
    }
    if (err.status === 400) {
      return extractApiErrorMessage(err, this.t('company.invalidDataError'));
    }
    return extractApiErrorMessage(err, fallback);
  }

  private showMsg(text: string, ok: boolean): void {
    if (ok) {
      this.toast.success(text);
    } else {
      this.toast.error(text);
    }
  }
}
