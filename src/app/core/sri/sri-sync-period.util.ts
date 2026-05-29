export type SriSyncPeriodPreset = 'current_month' | 'previous_month' | 'custom_month';

export interface SriSyncPeriodRange {
  fechaDesde: string;
  fechaHasta: string;
  label: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function monthRange(year: number, monthIndex: number, capHastaToday = true): SriSyncPeriodRange {
  const desde = `${year}-${pad2(monthIndex + 1)}-01`;
  const last = lastDayOfMonth(year, monthIndex);
  let hasta = `${year}-${pad2(monthIndex + 1)}-${pad2(last)}`;
  const today = new Date();
  if (capHastaToday) {
    const todayIso = formatIsoDateLocal(today);
    if (hasta > todayIso) {
      hasta = todayIso;
    }
  }
  return { fechaDesde: desde, fechaHasta: hasta, label: `${desde} — ${hasta}` };
}

export function resolveSriSyncPeriod(
  preset: SriSyncPeriodPreset,
  customMonth?: string,
): SriSyncPeriodRange {
  const today = new Date();
  if (preset === 'current_month') {
    return monthRange(today.getFullYear(), today.getMonth());
  }
  if (preset === 'previous_month') {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return monthRange(d.getFullYear(), d.getMonth(), false);
  }
  const ym = (customMonth ?? '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) {
    return monthRange(today.getFullYear(), today.getMonth());
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return monthRange(today.getFullYear(), today.getMonth());
  }
  const isCurrent =
    year === today.getFullYear() && monthIndex === today.getMonth();
  return monthRange(year, monthIndex, isCurrent);
}

export function defaultCustomMonthValue(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
}
