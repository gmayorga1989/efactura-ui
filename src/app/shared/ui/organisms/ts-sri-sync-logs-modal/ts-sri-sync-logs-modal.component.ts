import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { ColumnDefinition } from 'tabulator-tables';
import { sriProgressDetail, sriProgressLabel, type SriBotLogLike } from '../../../../core/sri/sri-bot-log-display.util';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import {
  formatFechaDdMmYyyy,
  tabulatorTextareaCell,
} from '../../tabulator-formatters.util';
import { TsTabulatorLocalGridComponent } from '../ts-tabulator-local-grid/ts-tabulator-local-grid.component';

export interface SriSyncRunResumen {
  id?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  iniciadoEn?: string;
}

@Component({
  selector: 'ts-sri-sync-logs-modal',
  standalone: true,
  imports: [TsTabulatorLocalGridComponent],
  template: `
    @if (open()) {
      <div class="ts-modal-backdrop" (click)="cerrar()"></div>
      <section
        class="ts-form-modal ts-form-modal--logs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sri-logs-modal-title"
      >
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 6h16M4 12h10M4 18h6"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('sriDownload.tabSync') }}</p>
            <h3 id="sri-logs-modal-title" class="mb-0">{{ t('sriDownload.botLogsTitle') }}</h3>
            @if (subtitulo()) {
              <p class="ts-form-modal__subtitle mb-0">{{ subtitulo() }}</p>
            }
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrar()">
            &times;
          </button>
        </header>
        <div class="ts-form-modal__body ts-form-modal__body--flush">
          @if (logs().length === 0) {
            <p class="text-muted small mb-0 px-1">{{ t('sriDownload.botLogsEmpty') }}</p>
          } @else {
            <ts-tabulator-local-grid
              [data]="gridData()"
              [columns]="columns()"
              [reloadNonce]="reloadNonce()"
              emptyContext="sriLogs"
              height="min(420px, calc(90vh - 12rem))"
            />
          }
        </div>
        <footer class="ts-form-modal__footer">
          <button type="button" class="btn btn-light btn-sm" (click)="cerrar()">{{ t('common.close') }}</button>
        </footer>
      </section>
    }
  `,
  styles: [
    `
      .ts-form-modal--logs {
        width: min(920px, calc(100vw - 1.5rem));
        max-height: min(92vh, 720px);
        display: flex;
        flex-direction: column;
      }
      .ts-form-modal--logs > .ts-form-modal__header,
      .ts-form-modal--logs > .ts-form-modal__footer {
        flex-shrink: 0;
      }
      .ts-form-modal__body--flush {
        flex: 1 1 auto;
        min-height: 0;
        padding-bottom: 0.5rem;
        overflow: hidden;
      }
      .ts-form-modal__icon {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        flex-shrink: 0;
        border: 1px solid #dfe7ff;
        border-radius: 10px;
        background: linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
        color: #3a57e8;
      }
    `,
  ],
})
export class TsSriSyncLogsModalComponent {
  private readonly i18n = inject(UiI18nService);

  readonly open = input(false);
  readonly logs = input<SriBotLogLike[]>([]);
  readonly syncRun = input<SriSyncRunResumen | null>(null);
  readonly closed = output<void>();

  readonly reloadNonce = signal(0);

  readonly subtitulo = computed(() => {
    const run = this.syncRun();
    if (!run) {
      return '';
    }
    const parts: string[] = [];
    if (run.fechaDesde && run.fechaHasta) {
      parts.push(`${run.fechaDesde} — ${run.fechaHasta}`);
    }
    if (run.estado) {
      parts.push(run.estado);
    }
    return parts.join(' · ');
  });

  readonly gridData = computed(() =>
    this.logs().map((log, i) => ({ ...log, _row: i }) as Record<string, unknown>),
  );

  readonly columns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const t = (k: string) => this.t(k);
    return [
      {
        title: this.t('sriDownload.colStarted'),
        field: 'fecha',
        width: 130,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(formatFechaDdMmYyyy(c.getValue()) || '—');
        },
      },
      {
        title: this.t('common.status'),
        field: 'estado',
        width: 90,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(String(c.getValue() ?? ''));
        },
      },
      {
        title: this.t('sriDownload.progressStep'),
        field: 'tipoOperacion',
        minWidth: 160,
        formatter: (cell: unknown) => {
          const c = cell as { getValue: () => unknown };
          return tabulatorTextareaCell(sriProgressLabel(t, String(c.getValue() ?? '')));
        },
      },
      {
        title: this.t('sriDownload.colMessage'),
        field: 'mensaje',
        minWidth: 280,
        formatter: (cell: unknown) => {
          const c = cell as { getData: () => SriBotLogLike };
          const detail = sriProgressDetail(t, c.getData());
          return tabulatorTextareaCell(detail ?? c.getData().mensaje ?? '');
        },
      },
    ];
  });

  t(key: string): string {
    return this.i18n.t(key);
  }

  cerrar(): void {
    this.closed.emit();
  }
}
