import type { CotizacionEstado } from '../../pages/cotizaciones/cotizaciones.service';
import type { SriEstadoTono } from './sri-estado.util';
import { escapeHtml } from './tabulator-formatters.util';

export function normalizarEstadoCotizacion(estado: string | null | undefined): CotizacionEstado | '' {
  const s = String(estado ?? '').trim().toUpperCase();
  if (!s) {
    return '';
  }
  return s as CotizacionEstado;
}

export function tonoEstadoCotizacion(estado: string | null | undefined): SriEstadoTono {
  switch (normalizarEstadoCotizacion(estado)) {
    case 'BORRADOR':
      return 'draft';
    case 'ENVIADA':
      return 'info';
    case 'ACEPTADA':
      return 'success';
    case 'CONVERTIDA':
      return 'success';
    case 'RECHAZADA':
      return 'danger';
    case 'ANULADA':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function badgeClaseEstadoCotizacion(estado: string | null | undefined): string {
  return `ts-sri-badge ts-sri-badge--${tonoEstadoCotizacion(estado)}`;
}

/** Badge HTML para celdas Tabulator. */
export function htmlBadgeEstadoCotizacion(estado: string | null | undefined, t: (key: string) => string): string {
  const label = etiquetaEstadoCotizacion(estado, t);
  const cls = badgeClaseEstadoCotizacion(estado);
  return `<span class="${cls}"><span class="ts-sri-badge__dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

export function etiquetaEstadoCotizacion(estado: string | null | undefined, t: (key: string) => string): string {
  switch (normalizarEstadoCotizacion(estado)) {
    case 'BORRADOR':
      return t('quotation.statusDraft');
    case 'ENVIADA':
      return t('quotation.statusSent');
    case 'ACEPTADA':
      return t('quotation.statusAccepted');
    case 'RECHAZADA':
      return t('quotation.statusRejected');
    case 'CONVERTIDA':
      return t('quotation.statusConverted');
    case 'ANULADA':
      return t('quotation.statusVoid');
    default:
      return String(estado ?? '').trim() || '—';
  }
}
