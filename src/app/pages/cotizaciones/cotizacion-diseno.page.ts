import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

export interface CotizacionPlantilla {
  colorPrimario: string;
  colorAcento: string;
  colorTexto: string;
  colorFondoEncabezado: string;
  disenoBase: 'moderno' | 'ejecutivo' | 'sri_clasico';
  mostrarLogo: boolean;
  mostrarVendedor: boolean;
  mostrarValidez: boolean;
  mostrarBordes: boolean;
  densidad: 'normal' | 'compact';
  textoPie: string;
  fontFamily: string;
  bannerImageUrl?: string;
}

const DEFAULT: CotizacionPlantilla = {
  colorPrimario: '#1e5b96',
  colorAcento: '#0ea5e9',
  colorTexto: '#0f172a',
  colorFondoEncabezado: '#f8fafc',
  disenoBase: 'moderno',
  mostrarLogo: true,
  mostrarVendedor: true,
  mostrarValidez: true,
  mostrarBordes: true,
  densidad: 'normal',
  textoPie: 'Gracias por su preferencia.',
  fontFamily: 'Inter, Segoe UI, sans-serif',
};

function mergePlantilla(raw: Record<string, unknown>): CotizacionPlantilla {
  const diseno = raw['disenoBase'];
  const densidad = raw['densidad'];
  return {
    colorPrimario: String(raw['colorPrimario'] ?? DEFAULT.colorPrimario),
    colorAcento: String(raw['colorAcento'] ?? DEFAULT.colorAcento),
    colorTexto: String(raw['colorTexto'] ?? DEFAULT.colorTexto),
    colorFondoEncabezado: String(raw['colorFondoEncabezado'] ?? DEFAULT.colorFondoEncabezado),
    disenoBase: diseno === 'ejecutivo' || diseno === 'sri_clasico' ? diseno : 'moderno',
    mostrarLogo: raw['mostrarLogo'] !== false,
    mostrarVendedor: raw['mostrarVendedor'] !== false,
    mostrarValidez: raw['mostrarValidez'] !== false,
    mostrarBordes: raw['mostrarBordes'] !== false,
    densidad: densidad === 'compact' ? 'compact' : 'normal',
    textoPie: String(raw['textoPie'] ?? DEFAULT.textoPie),
    fontFamily: String(raw['fontFamily'] ?? DEFAULT.fontFamily),
    ...(raw['bannerImageUrl'] ? { bannerImageUrl: String(raw['bannerImageUrl']) } : {}),
  };
}

@Component({
  selector: 'ts-cotizacion-diseno-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout [title]="t('quotation.designPageTitle')" [subtitle]="t('quotation.designPageSubtitle')" [eyebrow]="t('menu.sales')">
      <div page-actions class="d-flex gap-2">
        <a class="btn btn-light" [routerLink]="['/t', tenant.tenantSlug(), 'ventas', 'cotizaciones']">{{ t('quotation.title') }}</a>
        <button type="button" class="btn btn-primary" (click)="guardar()" [disabled]="loading()">{{ t('common.save') }}</button>
      </div>
      <div class="row g-4">
        <div class="col-lg-5">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h2 class="h6">{{ t('quotation.design') }}</h2>
              <div class="mb-2">
                <label class="form-label small">{{ t('quotation.designStyle') }}</label>
                <select class="form-select form-select-sm" [(ngModel)]="plantilla.disenoBase" name="diseno" (ngModelChange)="programarPreview()">
                  <option value="moderno">{{ t('quotation.styleModern') }}</option>
                  <option value="ejecutivo">{{ t('quotation.styleExecutive') }}</option>
                </select>
              </div>
              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label small">{{ t('quotation.colorPrimary') }}</label>
                  <input type="color" class="form-control form-control-color w-100" [(ngModel)]="plantilla.colorPrimario" (ngModelChange)="programarPreview()" />
                </div>
                <div class="col-6">
                  <label class="form-label small">{{ t('quotation.colorAccent') }}</label>
                  <input type="color" class="form-control form-control-color w-100" [(ngModel)]="plantilla.colorAcento" (ngModelChange)="programarPreview()" />
                </div>
              </div>
              <div class="mb-2">
                <label class="form-label small">{{ t('quotation.font') }}</label>
                <select class="form-select form-select-sm" [(ngModel)]="plantilla.fontFamily" (ngModelChange)="programarPreview()">
                  <option value="Inter, Segoe UI, sans-serif">Inter</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Segoe UI', sans-serif">Segoe UI</option>
                </select>
              </div>
              <div class="mb-2">
                <label class="form-label small">{{ t('quotation.footerText') }}</label>
                <input class="form-control form-control-sm" [(ngModel)]="plantilla.textoPie" (ngModelChange)="programarPreview()" />
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarBordes" (ngModelChange)="programarPreview()" id="sw-bordes" />
                <label class="form-check-label" for="sw-bordes">{{ t('quotation.showBorders') }}</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" [(ngModel)]="plantilla.mostrarVendedor" (ngModelChange)="programarPreview()" id="sw-vend" />
                <label class="form-check-label" for="sw-vend">{{ t('quotation.showSeller') }}</label>
              </div>
              <hr />
              <label class="form-label small">{{ t('quotation.bannerImage') }}</label>
              <input type="file" class="form-control form-control-sm" accept="image/*" (change)="subirBanner($event)" />
            </div>
          </div>
        </div>
        <div class="col-lg-7">
          <div class="card border-0 shadow-sm">
            <div class="card-body p-0">
              @if (previewUrl()) {
                <iframe class="w-100" style="height: min(70vh, 720px); border: 0" [src]="previewUrl()" [title]="t('quotation.preview')"></iframe>
              } @else {
                <p class="text-muted p-4 mb-0">{{ t('common.loading') }}</p>
              }
            </div>
          </div>
        </div>
      </div>
    </ts-page-layout>
  `,
})
export class CotizacionDisenoPage implements OnInit {
  readonly tenant = inject(TenantContextService);
  readonly i18n = inject(UiI18nService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(UiToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  plantilla: CotizacionPlantilla = { ...DEFAULT };
  readonly loading = signal(false);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewBlobUrl: string | null = null;

  ngOnInit(): void {
    this.http
      .get<Record<string, unknown>>('/api/web/v1/ventas/cotizaciones/plantilla-empresa')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.plantilla = mergePlantilla(p);
          this.programarPreview();
        },
        error: () => this.programarPreview(),
      });
  }

  programarPreview(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
    }
    this.previewTimer = setTimeout(() => this.actualizarPreview(), 500);
  }

  guardar(): void {
    this.loading.set(true);
    this.http
      .put<Record<string, unknown>>('/api/web/v1/ventas/cotizaciones/plantilla-empresa', this.plantilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.toast.success(this.t('quotation.designSaved'));
        },
        error: () => {
          this.loading.set(false);
          this.toast.error(this.t('quotation.saveError'));
        },
      });
  }

  subirBanner(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    const fd = new FormData();
    fd.append('archivo', file);
    this.http
      .post<{ bannerImageUrl: string }>('/api/web/v1/ventas/cotizaciones/plantilla-empresa/banner', fd)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.plantilla.bannerImageUrl = r.bannerImageUrl;
          this.programarPreview();
        },
        error: () => this.toast.error(this.t('quotation.bannerError')),
      });
  }

  private actualizarPreview(): void {
    this.http
      .post('/api/web/v1/ventas/cotizaciones/plantilla-empresa/vista-previa', this.plantilla, {
        responseType: 'blob',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          if (this.previewBlobUrl) {
            URL.revokeObjectURL(this.previewBlobUrl);
          }
          this.previewBlobUrl = URL.createObjectURL(blob);
          this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewBlobUrl));
        },
      });
  }

  t(key: string): string {
    return this.i18n.t(key);
  }
}
