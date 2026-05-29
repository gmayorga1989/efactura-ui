/** Catalogo SRI forma de pago (codigo → etiqueta). */
export const FORMA_PAGO_SRI: Record<string, string> = {
  '01': 'Sin utilizacion del sistema financiero',
  '15': 'Compensacion de deudas',
  '16': 'Tarjeta de debito',
  '17': 'Dinero electronico',
  '18': 'Tarjeta prepago',
  '19': 'Tarjeta de credito',
  '20': 'Otros con utilizacion del sistema financiero',
  '21': 'Endoso de titulos',
};

export function etiquetaFormaPagoSri(codigo: string): string {
  const c = String(codigo ?? '').trim();
  if (!c) {
    return '';
  }
  const label = FORMA_PAGO_SRI[c];
  return label ? `${c} — ${label}` : c;
}

export function textoPagosDesdeCustomData(cd?: Record<string, unknown>): string {
  const raw = cd?.['pagos'];
  if (!Array.isArray(raw) || !raw.length) {
    return '';
  }
  const partes: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const fp = String(row['formaPago'] ?? '').trim();
    if (!fp) {
      continue;
    }
    const total = row['total'];
    const monto =
      typeof total === 'number'
        ? total.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
    partes.push(monto ? `${etiquetaFormaPagoSri(fp)} (${monto})` : etiquetaFormaPagoSri(fp));
  }
  return partes.join('; ');
}
