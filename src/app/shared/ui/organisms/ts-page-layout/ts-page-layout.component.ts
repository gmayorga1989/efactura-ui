import { Component, computed, inject, input } from '@angular/core';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';

@Component({
  selector: 'ts-page-layout',
  standalone: true,
  template: `
    <section class="row">
      <div class="col-12">
        <div class="card ts-page-card">
          <div class="ts-page-header">
            <div class="ts-page-heading">
              <div class="ts-page-icon" aria-hidden="true">
                @switch (moduleIcon()) {
                  @case ('admin') {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M4 20V8.2C4 7.08 4 6.52 4.22 6.09C4.41 5.71 4.71 5.41 5.09 5.22C5.52 5 6.08 5 7.2 5H16.8C17.92 5 18.48 5 18.91 5.22C19.29 5.41 19.59 5.71 19.78 6.09C20 6.52 20 7.08 20 8.2V20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                      <path d="M3 20H21M8 10H10M14 10H16M8 14H10M14 14H16M10 20V16.5H14V20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  }
                  @case ('maestros') {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M5 5.5H19M5 12H19M5 18.5H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                      <path d="M16.5 17.5H20M18.25 15.75V19.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  }
                  @case ('empresa') {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M4.5 20V7.5L12 4L19.5 7.5V20" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
                      <path d="M8 20V15H16V20M8 9.5H9.5M11.25 9.5H12.75M14.5 9.5H16M8 12.5H9.5M11.25 12.5H12.75M14.5 12.5H16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  }
                  @case ('usuarios') {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M9.5 11.2C11.16 11.2 12.5 9.86 12.5 8.2C12.5 6.54 11.16 5.2 9.5 5.2C7.84 5.2 6.5 6.54 6.5 8.2C6.5 9.86 7.84 11.2 9.5 11.2Z" stroke="currentColor" stroke-width="1.75" />
                      <path d="M4.5 19C4.5 16.24 6.74 14 9.5 14C12.26 14 14.5 16.24 14.5 19" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                      <path d="M16 7.5H20M18 5.5V9.5M17 14.5H20.5M17 18H20.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                    </svg>
                  }
                  @case ('ventas') {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M5 4.5H19V19.5L16.8 18L14.6 19.5L12.4 18L10.2 19.5L8 18L5 19.5V4.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                      <path d="M8.5 9H15.5M8.5 12.5H14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  }
                  @default {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M4.5 10.5L12 4L19.5 10.5V19C19.5 19.55 19.05 20 18.5 20H5.5C4.95 20 4.5 19.55 4.5 19V10.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                      <path d="M9 20V14.5H15V20" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                    </svg>
                  }
                }
              </div>
              <div class="ts-page-title">
                @if (displayEyebrow()) {
                  <span class="ts-page-eyebrow">{{ displayEyebrow() }}</span>
                }
                <h1>{{ displayTitle() }}</h1>
                @if (displaySubtitle()) {
                  <p>{{ displaySubtitle() }}</p>
                }
              </div>
            </div>
            <div class="ts-page-actions">
              <ng-content select="[page-actions]" />
            </div>
          </div>
          <div class="card-body">
            <ng-content />
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .ts-page-card {
        overflow: hidden;
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: var(--ef-surface-radius, 10px);
        box-shadow: var(--ef-surface-shadow);
        background: #fff;
      }

      .ts-page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.85rem;
        min-height: 4.35rem;
        padding: 0.58rem 1rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
        border-radius: var(--ef-surface-radius, 10px) var(--ef-surface-radius, 10px) 0 0;
        background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      }

      .ts-page-title {
        min-width: 0;
      }

      .ts-page-heading {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 0.7rem;
      }

      .ts-page-icon {
        display: grid;
        place-items: center;
        width: 2.3rem;
        height: 2.3rem;
        flex: 0 0 2.3rem;
        border: 1px solid #dfe7ff;
        border-radius: 8px;
        background: linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
        color: #3a57e8;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }

      .ts-page-eyebrow {
        display: block;
        margin-bottom: 0.16rem;
        color: #64748b;
        font-size: 0.62rem;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .ts-page-title h1 {
        margin: 0;
        color: #1f2937;
        font-size: clamp(0.98rem, 1.1vw, 1.12rem);
        font-weight: 650;
        line-height: 1.18;
      }

      .ts-page-title p {
        margin: 0.16rem 0 0;
        color: #475569;
        font-size: 0.78rem;
        line-height: 1.25;
      }

      .ts-page-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        flex: 0 0 auto;
        gap: 0.5rem;
      }

      .ts-page-actions:empty {
        display: none;
      }

      .ts-page-actions ::ng-deep .btn {
        min-height: 1.95rem;
        padding: 0.32rem 0.72rem;
        border-radius: 6px;
        font-size: 0.84rem;
        font-weight: 600;
      }

      .card-body {
        padding: 0.9rem 1rem 1rem;
      }

      @media (max-width: 767.98px) {
        .ts-page-header {
          flex-direction: column;
          padding: 1rem;
        }

        .ts-page-actions {
          width: 100%;
          justify-content: flex-start;
        }

        .card-body {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class TsPageLayoutComponent {
  private readonly i18n = inject(UiI18nService);
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly eyebrow = input('');
  readonly titleKey = input('');
  readonly subtitleKey = input('');
  readonly eyebrowKey = input('');

  readonly displayTitle = computed(() => this.titleKey() ? this.i18n.t(this.titleKey(), this.title()) : this.title());
  readonly displaySubtitle = computed(() =>
    this.subtitleKey() ? this.i18n.t(this.subtitleKey(), this.subtitle()) : this.subtitle(),
  );
  readonly displayEyebrow = computed(() =>
    this.eyebrowKey() ? this.i18n.t(this.eyebrowKey(), this.eyebrow()) : this.eyebrow(),
  );

  readonly moduleIcon = computed(() => {
    const raw = `${this.displayEyebrow()} ${this.displayTitle()}`.toLowerCase();
    if (
      raw.includes('sucursal') ||
      raw.includes('emision') ||
      raw.includes('emission') ||
      raw.includes('emissao')
    ) {
      return 'admin';
    }
    if (raw.includes('empresa') || raw.includes('company') || raw.includes('entreprise')) {
      return 'empresa';
    }
    if (
      raw.includes('usuario') ||
      raw.includes('user') ||
      raw.includes('utilisateur') ||
      raw.includes('rol') ||
      raw.includes('role') ||
      raw.includes('invitacion') ||
      raw.includes('invitaci') ||
      raw.includes('invitation')
    ) {
      return 'usuarios';
    }
    if (
      raw.includes('maestro') ||
      raw.includes('cliente') ||
      raw.includes('customer') ||
      raw.includes('client') ||
      raw.includes('producto') ||
      raw.includes('product') ||
      raw.includes('produto') ||
      raw.includes('servicio') ||
      raw.includes('service')
    ) {
      return 'maestros';
    }
    if (
      raw.includes('venta') ||
      raw.includes('sales') ||
      raw.includes('vente') ||
      raw.includes('factura') ||
      raw.includes('invoice') ||
      raw.includes('fatura') ||
      raw.includes('comprobante') ||
      raw.includes('document')
    ) {
      return 'ventas';
    }
    return 'default';
  });
}
