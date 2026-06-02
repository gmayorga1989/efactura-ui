import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

export interface EmailPlantilla {
  disenoBase: EmailDisenoBase;
  colorPrimario: string;
  colorAcento: string;
  asuntoPlantilla: string;
  textoIntro: string;
  textoPie: string;
  mostrarLogo: boolean;
  mostrarResumen: boolean;
}

export type EmailDisenoBase = 'moderno' | 'corporativo';
type EmailSettingsSection = 'general' | 'colores' | 'contenido' | 'visibilidad';

const EMAIL_SETTINGS_SECTIONS: { id: EmailSettingsSection; labelKey: string }[] = [
  { id: 'general', labelKey: 'rideDesign.sectionGeneral' },
  { id: 'colores', labelKey: 'rideDesign.sectionColors' },
  { id: 'contenido', labelKey: 'rideDesign.sectionContent' },
  { id: 'visibilidad', labelKey: 'rideDesign.sectionVisibility' },
];

const EMAIL_DESIGN_PRESETS: { id: EmailDisenoBase; labelKey: string }[] = [
  { id: 'moderno', labelKey: 'emailDesign.designModern' },
  { id: 'corporativo', labelKey: 'emailDesign.designCorporate' },
];

const DEFAULT_EMAIL_PLANTILLA: EmailPlantilla = {
  disenoBase: 'moderno',
  colorPrimario: '#0f766e',
  colorAcento: '#1e5b96',
  asuntoPlantilla: 'Comprobante electrónico {{numero}}',
  textoIntro: '',
  textoPie: '',
  mostrarLogo: true,
  mostrarResumen: true,
};

const PRESET_CORPORATIVO: EmailPlantilla = {
  ...DEFAULT_EMAIL_PLANTILLA,
  disenoBase: 'corporativo',
  colorPrimario: '#1e3a5f',
  colorAcento: '#475569',
};

@Component({
  selector: 'ts-correo-diseno-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('emailDesign.title')"
      [subtitle]="t('emailDesign.subtitle')"
      [eyebrow]="t('emailDesign.eyebrow')"
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
        <div class="row g-3 ts-email-design">
          <div class="col-lg-5">
            <section class="ts-email-settings">
              <header class="ts-email-settings__header">
                <div>
                  <p class="ts-email-settings__eyebrow mb-1">{{ t('rideDesign.settingsPanel') }}</p>
                  <h5 class="ts-email-settings__title mb-0">{{ t('emailDesign.baseDesign') }}</h5>
                </div>
                <div class="ts-email-settings__actions">
                  <button type="button" class="btn btn-light btn-sm" (click)="actualizarVistaPrevia()" [disabled]="previewLoading">
                    {{ t('company.rideTemplatePreview') }}
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="loading" (click)="guardar()">
                    {{ t('company.rideTemplateSave') }}
                  </button>
                </div>
              </header>

              <div class="ts-email-settings__body">
                <nav class="ts-email-settings__nav" [attr.aria-label]="t('rideDesign.settingsPanel')">
                  @for (sec of settingsSections; track sec.id) {
                    <button
                      type="button"
                      class="ts-email-settings__nav-btn"
                      [class.ts-email-settings__nav-btn--active]="activeSection() === sec.id"
                      (click)="setActiveSection(sec.id)"
                    >
                      {{ t(sec.labelKey) }}
                    </button>
                  }
                </nav>

                <form class="ts-email-settings__panel" (ngSubmit)="guardar()">
                  @switch (activeSection()) {
                    @case ('general') {
                      <div class="ts-email-section">
                        <h6 class="ts-email-section__title">{{ t('emailDesign.baseDesign') }}</h6>
                        <div class="ts-email-presets">
                          @for (preset of designPresets; track preset.id) {
                            <button
                              type="button"
                              class="ts-email-preset ts-choice-card"
                              [class.ts-choice-card--active]="plantilla.disenoBase === preset.id"
                              (click)="selectDesignPreset(preset.id)"
                            >
                              <span class="ts-email-preset__label">{{ t(preset.labelKey) }}</span>
                            </button>
                          }
                        </div>
                      </div>
                    }
                    @case ('colores') {
                      <div class="ts-email-section">
                        <h6 class="ts-email-section__title">{{ t('rideDesign.sectionColors') }}</h6>
                        <div class="ts-email-color-grid">
                          <label class="ts-email-color" for="ed-primary">
                            <span class="ts-email-color__swatch" [style.background]="plantilla.colorPrimario"></span>
                            <span class="ts-email-color__meta">
                              <span class="ts-email-color__name">{{ t('company.rideColorPrimary') }}</span>
                              <input id="ed-primary" type="color" class="ts-email-color__input" [(ngModel)]="plantilla.colorPrimario" name="colorPrimario" (ngModelChange)="programarVistaPrevia()" />
                            </span>
                          </label>
                          <label class="ts-email-color" for="ed-accent">
                            <span class="ts-email-color__swatch" [style.background]="plantilla.colorAcento"></span>
                            <span class="ts-email-color__meta">
                              <span class="ts-email-color__name">{{ t('company.rideColorAccent') }}</span>
                              <input id="ed-accent" type="color" class="ts-email-color__input" [(ngModel)]="plantilla.colorAcento" name="colorAcento" (ngModelChange)="programarVistaPrevia()" />
                            </span>
                          </label>
                        </div>
                      </div>
                    }
                    @case ('contenido') {
                      <div class="ts-email-section">
                        <h6 class="ts-email-section__title">{{ t('rideDesign.sectionContent') }}</h6>
                        <div class="ts-email-field mb-3">
                          <label class="form-label" for="ed-asunto">{{ t('emailDesign.subjectTemplate') }}</label>
                          <input id="ed-asunto" class="form-control form-control-sm" [(ngModel)]="plantilla.asuntoPlantilla" name="asuntoPlantilla" (ngModelChange)="programarVistaPrevia()" />
                          <p class="ts-email-field__help">{{ t('emailDesign.subjectHelp') }}</p>
                        </div>
                        <div class="ts-email-field mb-3">
                          <label class="form-label" for="ed-intro">{{ t('emailDesign.introText') }}</label>
                          <textarea id="ed-intro" class="form-control form-control-sm" rows="3" [(ngModel)]="plantilla.textoIntro" name="textoIntro" (ngModelChange)="programarVistaPrevia()"></textarea>
                        </div>
                        <div class="ts-email-field mb-3">
                          <label class="form-label" for="ed-pie">{{ t('company.rideFooterText') }}</label>
                          <input id="ed-pie" class="form-control form-control-sm" [(ngModel)]="plantilla.textoPie" name="textoPie" (ngModelChange)="programarVistaPrevia()" />
                        </div>
                        <p class="ts-email-settings__note">{{ t('emailDesign.attachmentsNote') }}</p>
                      </div>
                    }
                    @case ('visibilidad') {
                      <div class="ts-email-section">
                        <h6 class="ts-email-section__title">{{ t('rideDesign.sectionVisibility') }}</h6>
                        <ul class="ts-email-switch-list">
                          <li>
                            <div class="form-check form-switch">
                              <input id="ed-logo" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarLogo" name="mostrarLogo" (ngModelChange)="programarVistaPrevia()" />
                              <label class="form-check-label" for="ed-logo">{{ t('company.rideShowLogo') }}</label>
                            </div>
                          </li>
                          <li>
                            <div class="form-check form-switch">
                              <input id="ed-resumen" class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarResumen" name="mostrarResumen" (ngModelChange)="programarVistaPrevia()" />
                              <label class="form-check-label" for="ed-resumen">{{ t('emailDesign.showSummary') }}</label>
                            </div>
                          </li>
                        </ul>
                      </div>
                    }
                  }
                </form>
              </div>
            </section>
          </div>
          <div class="col-lg-7">
            <section class="ts-email-panel ts-email-preview">
              <div class="ts-email-preview__head">
                <h5 class="mb-0">{{ t('emailDesign.livePreview') }}</h5>
                @if (previewLoading) {
                  <span class="text-muted small">{{ t('rideDesign.updatingPreview') }}</span>
                }
              </div>
              @if (previewHtml) {
                <iframe class="ts-email-preview__frame" [srcdoc]="previewHtml" title="Vista previa correo"></iframe>
              } @else {
                <div class="ts-email-preview__placeholder text-muted">{{ t('rideDesign.previewPlaceholder') }}</div>
              }
            </section>
          </div>
        </div>
      }
    </ts-page-layout>
  `,
  styles: [
    `
      .ts-email-settings {
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

      .ts-email-settings__header {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 0.75rem 1rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
        background: var(--ef-page-header-bg, linear-gradient(180deg, #fafbfc 0%, #fff 100%));
      }

      .ts-email-settings__eyebrow {
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .ts-email-settings__title {
        font-size: 0.92rem;
        font-weight: 600;
        color: var(--text);
      }

      .ts-email-settings__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .ts-email-settings__body {
        display: grid;
        grid-template-columns: minmax(7.5rem, 9.5rem) minmax(0, 1fr);
        flex: 1;
        min-height: 0;
      }

      .ts-email-settings__nav {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.65rem 0.5rem;
        border-right: 1px solid var(--ef-divider, #e2e8f0);
        background: var(--ef-surface-raised, #f8fafc);
        overflow-y: auto;
      }

      .ts-email-settings__nav-btn {
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

      .ts-email-settings__nav-btn:hover {
        background: rgba(30, 91, 150, 0.08);
        color: #1e5b96;
      }

      .ts-email-settings__nav-btn--active {
        background: color-mix(in srgb, var(--lux-indigo) 12%, var(--card));
        color: var(--lux-primary-strong);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--lux-indigo) 18%, transparent);
      }

      .ts-email-settings__panel {
        padding: 1rem 1.1rem 1.1rem;
        overflow-y: auto;
        min-height: 0;
      }

      .ts-email-section__title {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 0.5rem;
      }

      .ts-email-presets {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .ts-email-preset {
        padding: 0.55rem 0.65rem;
        text-align: left;
      }

      .ts-email-preset__label {
        font-size: 0.78rem;
        font-weight: 500;
        color: var(--text);
        line-height: 1.35;
      }

      .ts-email-color-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .ts-email-color {
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

      .ts-email-color__swatch {
        width: 2rem;
        height: 2rem;
        border-radius: 6px;
        border: 1px solid var(--ef-input-border-hover, #94a3b8);
        flex-shrink: 0;
      }

      .ts-email-color__meta {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
      }

      .ts-email-color__name {
        font-size: 0.72rem;
        font-weight: 500;
        color: #334155;
        line-height: 1.25;
      }

      .ts-email-color__input {
        width: 2.25rem;
        height: 1.5rem;
        padding: 0;
        border: 0;
        background: transparent;
      }

      .ts-email-field__help,
      .ts-email-settings__note {
        margin: 0.35rem 0 0;
        font-size: 0.75rem;
        color: #64748b;
      }

      .ts-email-switch-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .ts-email-switch-list li {
        padding: 0.35rem 0.45rem;
        border-radius: 6px;
        background: #fafbfc;
        border: 1px solid var(--ef-divider, #e2e8f0);
      }

      .ts-email-panel {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        background: var(--card);
        padding: 1.25rem;
        box-shadow: var(--ef-surface-shadow);
        color: var(--text);
      }

      .ts-email-preview {
        display: flex;
        flex-direction: column;
        min-height: min(720px, 75vh);
      }
      .ts-email-preview__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
      }
      .ts-email-preview__frame {
        flex: 1;
        width: 100%;
        min-height: 620px;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 6px;
        background: #f8fafc;
      }
      .ts-email-preview__placeholder {
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
        .ts-email-settings__body {
          grid-template-columns: 1fr;
        }

        .ts-email-settings__nav {
          flex-direction: row;
          flex-wrap: wrap;
          border-right: 0;
          border-bottom: 1px solid var(--ef-divider, #e2e8f0);
        }
      }
    `,
  ],
})
export class CorreoDisenoPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  tokenPresent = false;
  empresaId: string | null = null;
  loading = false;
  previewLoading = false;
  plantilla: EmailPlantilla = { ...DEFAULT_EMAIL_PLANTILLA };
  previewHtml: SafeHtml | null = null;
  readonly settingsSections = EMAIL_SETTINGS_SECTIONS;
  readonly designPresets = EMAIL_DESIGN_PRESETS;
  readonly activeSection = signal<EmailSettingsSection>('general');

  private previewTimer: ReturnType<typeof setTimeout> | null = null;

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

  setActiveSection(section: EmailSettingsSection): void {
    this.activeSection.set(section);
  }

  selectDesignPreset(id: EmailDisenoBase): void {
    this.plantilla.disenoBase = id;
    this.aplicarPreset();
  }

  aplicarPreset(): void {
    if (this.plantilla.disenoBase === 'corporativo') {
      this.plantilla = { ...this.plantilla, ...PRESET_CORPORATIVO };
    } else {
      this.plantilla = { ...this.plantilla, disenoBase: 'moderno' };
    }
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
    this.http
      .put<EmailPlantilla>(`/api/web/v1/empresas/${this.empresaId}/email-plantilla`, this.plantilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading = false;
          this.toast.success(this.t('company.rideTemplateSaved'));
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
    this.http
      .post(`/api/web/v1/empresas/${this.empresaId}/email-plantilla/vista-previa`, this.plantilla, {
        responseType: 'text',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (html) => {
          this.previewLoading = false;
          this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
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
    this.http
      .get<EmailPlantilla>(`/api/web/v1/empresas/${this.empresaId}/email-plantilla`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.plantilla = { ...DEFAULT_EMAIL_PLANTILLA, ...data };
          this.actualizarVistaPrevia();
        },
        error: () => {
          this.plantilla = { ...DEFAULT_EMAIL_PLANTILLA };
          this.actualizarVistaPrevia();
        },
      });
  }
}
