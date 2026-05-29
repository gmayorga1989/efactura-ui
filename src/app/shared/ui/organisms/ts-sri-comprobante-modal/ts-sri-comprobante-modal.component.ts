import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { formatMoney, formatFechaDdMmYyyy } from '../../tabulator-formatters.util';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';
import { extractApiErrorMessage } from '../../../../core/session/http-error.util';

export interface SriComprobanteDetalle {
  id: string;
  claveAcceso: string;
  tipoComprobante?: string;
  rucEmisor?: string;
  razonSocialEmisor?: string;
  fechaEmision?: string;
  valorTotal?: number;
  xmlStorageKey?: string;
  estado?: string;
}

@Component({
  selector: 'ts-sri-comprobante-modal',
  standalone: true,
  imports: [],
  template: `
    @if (open()) {
      <div class="ts-modal-backdrop" (click)="cerrar()"></div>
      <section
        class="ts-form-modal ts-form-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sri-comp-modal-title"
      >
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.5L17 6.5V19a2 2 0 0 1-2 2Z"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('sriDownload.tabReceived') }}</p>
            <h3 id="sri-comp-modal-title" class="mb-0">{{ t('sriDownload.detailTitle') }}</h3>
            @if (detalle()?.claveAcceso) {
              <p class="ts-form-modal__subtitle mb-0">{{ detalle()!.claveAcceso }}</p>
            }
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrar()">
            &times;
          </button>
        </header>
        @if (detalle(); as d) {
          <div class="ts-form-modal__body">
            <div class="ts-detail-kv">
              <div class="ts-detail-kv__row">
                <span>{{ t('sriDownload.colIssuer') }}</span>
                <strong>{{ d.razonSocialEmisor || '—' }}</strong>
              </div>
              <div class="ts-detail-kv__row">
                <span>RUC</span>
                <strong>{{ d.rucEmisor || '—' }}</strong>
              </div>
              <div class="ts-detail-kv__row">
                <span>{{ t('sriDownload.colDate') }}</span>
                <strong>{{ formatFecha(d.fechaEmision) }}</strong>
              </div>
              <div class="ts-detail-kv__row">
                <span>{{ t('sriDownload.colTotal') }}</span>
                <strong>{{ formatValorTotal(d.valorTotal) }}</strong>
              </div>
              <div class="ts-detail-kv__row">
                <span>{{ t('common.status') }}</span>
                <strong>{{ d.estado || '—' }}</strong>
              </div>
              <div class="ts-detail-kv__row ts-detail-kv__row--stack">
                <span>{{ t('sriDownload.colAccessKey') }}</span>
                <strong class="font-monospace">{{ d.claveAcceso }}</strong>
              </div>
            </div>
          </div>
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrar()">{{ t('common.close') }}</button>
            <button type="button" class="btn btn-primary btn-sm" (click)="descargarXml()" [disabled]="descargando()">
              {{ t('sriDownload.downloadXml') }}
            </button>
          </footer>
        }
      </section>
    }
  `,
})
export class TsSriComprobanteModalComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);

  readonly open = input(false);
  readonly detalle = input<SriComprobanteDetalle | null>(null);
  readonly platformParams = input<HttpParams>(new HttpParams());
  readonly closed = output<void>();

  readonly descargando = signal(false);

  t(key: string): string {
    return this.i18n.t(key);
  }

  formatValorTotal(value: unknown): string {
    return formatMoney(value);
  }

  formatFecha(value: unknown): string {
    const f = formatFechaDdMmYyyy(value);
    return f || '—';
  }

  cerrar(): void {
    this.closed.emit();
  }

  descargarXml(): void {
    const d = this.detalle();
    if (!d?.id || this.descargando()) {
      return;
    }
    this.descargando.set(true);
    this.http
      .get(`/api/web/v1/sri-descarga/comprobantes/${d.id}/xml`, {
        params: this.platformParams(),
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          this.descargando.set(false);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${d.claveAcceso || d.id}.xml`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.descargando.set(false);
          const msg =
            err instanceof HttpErrorResponse
              ? extractApiErrorMessage(err, this.t('sriDownload.xmlDownloadError'))
              : this.t('sriDownload.xmlDownloadError');
          this.toast.error(msg);
        },
      });
  }
}
