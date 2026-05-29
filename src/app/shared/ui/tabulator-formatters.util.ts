import type { ColumnDefinition } from 'tabulator-tables';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Valor de celda Tabulator (el parámetro `cell` del formatter suele ser `unknown`). */
export function tabulatorCellValue(cell: unknown): unknown {
  return (cell as { getValue: () => unknown }).getValue();
}

export function tabulatorCodeCell(cell: unknown): string {
  return `<span class="ts-cell-code">${escapeHtml(String(tabulatorCellValue(cell) ?? ''))}</span>`;
}

/** Formato dd/MM/yyyy para ISO (yyyy-MM-dd) u otros valores de fecha. */
export function formatFechaDdMmYyyy(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const instant = Date.parse(s);
  if (!Number.isNaN(instant)) {
    const d = new Date(instant);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return s;
}

export function tabulatorTextareaCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return '<div class="ts-cell-textarea">' + escapeHtml(text) + '</div>';
}

export function tabulatorFechaCell(value: unknown): string {
  return `<span class="ts-cell-fecha">${escapeHtml(formatFechaDdMmYyyy(value))}</span>`;
}

export function parseMoney(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value: unknown, locale = 'es-EC'): string {
  const n = parseMoney(value);
  if (n == null) {
    return '—';
  }
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function tabulatorMoneyCell(value: unknown): string {
  return `<span class="ts-cell-money">${escapeHtml(formatMoney(value))}</span>`;
}

/** Tabulator admite `frozen` aunque los tipos oficiales no lo declaren. */
export const TABULATOR_FROZEN_PROPS = { frozen: true } as ColumnDefinition;
