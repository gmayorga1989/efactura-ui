import { Component, inject } from '@angular/core';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService, type ToastVariant } from '../../../../core/ui/ui-toast.service';

@Component({
  selector: 'ts-toast-stack',
  standalone: true,
  template: `
    <div class="ts-toast-host" aria-live="polite" aria-relevant="additions">
      @for (item of toast.toasts(); track item.id) {
        <div
          class="ts-toast"
          [class.ts-toast--success]="item.variant === 'success'"
          [class.ts-toast--error]="item.variant === 'error'"
          [class.ts-toast--info]="item.variant === 'info'"
          [class.ts-toast--warning]="item.variant === 'warning'"
          [class.ts-toast--loading]="item.variant === 'loading'"
          role="status"
          [attr.aria-busy]="item.variant === 'loading' ? 'true' : null"
        >
          <div class="ts-toast__accent" aria-hidden="true"></div>

          <div class="ts-toast__icon" aria-hidden="true">
            @if (item.variant === 'loading') {
              <span class="ts-toast__spinner"></span>
            } @else {
              <svg viewBox="0 0 24 24" focusable="false">
                <path [attr.d]="iconPath(item.variant)" fill="currentColor" />
              </svg>
            }
          </div>

          <div class="ts-toast__content">
            <span class="ts-toast__kicker">{{ etiqueta(item.variant) }}</span>
            <p class="ts-toast__message">{{ item.message }}</p>
          </div>

          <button
            type="button"
            class="ts-toast__dismiss"
            [attr.aria-label]="t('common.close')"
            (click)="cerrar($event, item.id)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M6.4 5.4a1 1 0 0 1 1.4 0L12 9.6l4.2-4.2a1 1 0 1 1 1.4 1.4L13.4 11l4.2 4.2a1 1 0 0 1-1.4 1.4L12 12.4l-4.2 4.2a1 1 0 0 1-1.4-1.4L10.6 11 6.4 6.8a1 1 0 0 1 0-1.4Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ts-toast-host {
        position: fixed;
        z-index: 10800;
        top: 1.25rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.65rem;
        pointer-events: none;
        width: min(440px, calc(100vw - 2rem));
        filter: drop-shadow(0 10px 28px rgba(15, 23, 42, 0.22));
      }

      .ts-toast {
        pointer-events: auto;
        position: relative;
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-rows: auto;
        align-items: start;
        gap: 0.75rem 0.85rem;
        padding: 0.95rem 0.85rem 0.95rem 0;
        border-radius: 14px;
        border: 1px solid var(--ts-toast-border, #cbd5e1);
        background: var(--ts-toast-surface, #ffffff);
        color: #0f172a;
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.95) inset,
          0 2px 4px rgba(15, 23, 42, 0.08),
          0 12px 32px rgba(15, 23, 42, 0.16);
        overflow: hidden;
        isolation: isolate;
        animation: ts-toast-enter 0.38s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .ts-toast::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        box-shadow: 0 0 0 1px var(--ts-toast-ring, rgba(58, 87, 232, 0.22));
        z-index: 1;
      }

      .ts-toast__accent {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        border-radius: 14px 0 0 14px;
        background: var(--ts-toast-accent, #3a57e8);
      }

      .ts-toast__icon {
        grid-column: 1;
        margin-left: 1rem;
        width: 2.25rem;
        height: 2.25rem;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: var(--ts-toast-icon-bg, #eef2ff);
        color: var(--ts-toast-icon-fg, #3a57e8);
        flex-shrink: 0;
      }

      .ts-toast__icon svg {
        width: 1.2rem;
        height: 1.2rem;
      }

      .ts-toast__spinner {
        width: 1.15rem;
        height: 1.15rem;
        border: 2px solid rgba(58, 87, 232, 0.2);
        border-top-color: #3a57e8;
        border-radius: 50%;
        animation: ts-toast-spin 0.75s linear infinite;
      }

      .ts-toast__content {
        grid-column: 2;
        min-width: 0;
        padding-top: 0.1rem;
        position: relative;
        z-index: 2;
      }

      .ts-toast__icon,
      .ts-toast__dismiss,
      .ts-toast__accent {
        z-index: 2;
      }

      .ts-toast__kicker {
        display: block;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ts-toast-kicker, #64748b);
        margin-bottom: 0.2rem;
      }

      .ts-toast__message {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 500;
        line-height: 1.45;
        color: #0f172a;
        letter-spacing: -0.01em;
      }

      .ts-toast__dismiss {
        grid-column: 3;
        align-self: start;
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        margin-top: 0.05rem;
        margin-right: 0.15rem;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .ts-toast__dismiss:hover {
        background: rgba(15, 23, 42, 0.06);
        color: #475569;
      }

      .ts-toast__dismiss:focus-visible {
        outline: 2px solid #3a57e8;
        outline-offset: 2px;
      }

      .ts-toast--success {
        --ts-toast-accent: #10b981;
        --ts-toast-surface: #f0fdf8;
        --ts-toast-border: #86efac;
        --ts-toast-ring: rgba(16, 185, 129, 0.35);
        --ts-toast-icon-bg: #d1fae5;
        --ts-toast-icon-fg: #059669;
        --ts-toast-kicker: #047857;
      }

      .ts-toast--error {
        --ts-toast-accent: #ef4444;
        --ts-toast-surface: #fff5f5;
        --ts-toast-border: #fca5a5;
        --ts-toast-ring: rgba(239, 68, 68, 0.32);
        --ts-toast-icon-bg: #fee2e2;
        --ts-toast-icon-fg: #dc2626;
        --ts-toast-kicker: #b91c1c;
      }

      .ts-toast--info {
        --ts-toast-accent: #3a57e8;
        --ts-toast-surface: #f3f6ff;
        --ts-toast-border: #a8b8f0;
        --ts-toast-ring: rgba(58, 87, 232, 0.38);
        --ts-toast-icon-bg: #e0e7ff;
        --ts-toast-icon-fg: #3a57e8;
        --ts-toast-kicker: #3730a3;
      }

      .ts-toast--warning {
        --ts-toast-accent: #f59e0b;
        --ts-toast-surface: #fffbeb;
        --ts-toast-border: #fcd34d;
        --ts-toast-ring: rgba(245, 158, 11, 0.35);
        --ts-toast-icon-bg: #fef3c7;
        --ts-toast-icon-fg: #d97706;
        --ts-toast-kicker: #b45309;
      }

      .ts-toast--loading {
        --ts-toast-accent: #3a57e8;
        --ts-toast-surface: #eef2ff;
        --ts-toast-border: #93a5e8;
        --ts-toast-ring: rgba(58, 87, 232, 0.42);
        --ts-toast-icon-bg: #dbe4ff;
        --ts-toast-icon-fg: #3a57e8;
        --ts-toast-kicker: #3730a3;
      }

      .ts-toast--loading .ts-toast__message {
        font-weight: 600;
      }

      @keyframes ts-toast-enter {
        from {
          opacity: 0;
          transform: translateY(-16px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes ts-toast-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 575.98px) {
        .ts-toast-host {
          top: auto;
          bottom: 1rem;
          width: calc(100vw - 1.25rem);
        }
      }
    `,
  ],
})
export class TsToastStackComponent {
  readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);

  t(key: string): string {
    return this.i18n.t(key);
  }

  cerrar(event: MouseEvent, id: number): void {
    event.stopPropagation();
    this.toast.dismiss(id);
  }

  iconPath(variant: ToastVariant): string {
    switch (variant) {
      case 'success':
        return 'M9.55 17.05 4.5 12l1.4-1.42 3.65 3.65 8.06-8.06L18.9 7.1 9.55 17.05Z';
      case 'error':
        return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 14h-2v-2h2v2Zm0-8h-2v6h2V8Z';
      case 'warning':
        return 'M12 2 1.5 20h21L12 2Zm0 13.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm0-7.2a1.1 1.1 0 0 1 1.1 1.1v3.6a1.1 1.1 0 1 1-2.2 0V9.4A1.1 1.1 0 0 1 12 8.3Z';
      default:
        return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 14h-2v-5h2v5Zm0-8h-2V8h2v2Z';
    }
  }

  etiqueta(variant: ToastVariant): string {
    switch (variant) {
      case 'success':
        return this.t('toast.labelSuccess');
      case 'error':
        return this.t('toast.labelError');
      case 'warning':
        return this.t('toast.labelWarning');
      case 'loading':
        return this.t('toast.labelLoading');
      default:
        return this.t('toast.labelInfo');
    }
  }
}
