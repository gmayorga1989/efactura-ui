import { escapeHtml } from './tabulator-formatters.util';



/** Tono visual del badge (colores por estado). */

export type SriEstadoTono = 'success' | 'draft' | 'info' | 'warning' | 'danger' | 'neutral';



/** Normaliza variantes del API (espacios, guiones) al código interno. */

export function normalizarCodigoEstadoSri(codigo: string | null | undefined): string {

  const s = String(codigo ?? '').trim().toUpperCase();

  if (!s) {

    return '';

  }

  if (s === 'NO AUTORIZADO' || s === 'NO AUTORIZADA' || s === 'NO-AUTORIZADO') {

    return 'NO_AUTORIZADO';

  }

  return s.replace(/\s+/g, '_');

}



/** Etiqueta legible para códigos de estado SRI / borrador. */

export function etiquetaEstadoSri(codigo: string | null | undefined, t: (key: string) => string): string {

  const s = normalizarCodigoEstadoSri(codigo);

  switch (s) {

    case 'BORRADOR':

      return t('invoice.statusDraft');

    case 'AUTORIZADO':

      return t('invoice.statusAuthorized');

    case 'RECIBIDA':

      return t('invoice.statusReceived');

    case 'RECHAZADA':

    case 'NO_AUTORIZADO':

      return t('invoice.statusRejected');

    case 'PENDIENTE_AUTORIZACION':

      return t('invoice.statusPending');

    case 'DEVUELTO':

    case 'DEVUELTA':

      return t('invoice.statusReturned');

    case 'ERROR':

      return t('invoice.statusError');

    case 'FIRMADO':

      return t('invoice.statusSigned');

    case 'GENERADO':

      return t('invoice.statusGenerated');

    default:

      return s || '-';

  }

}



/** Reconsulta autorización en el SRI (sin regenerar XML). */

export function puedeReconsultarAutorizacion(estadoSri: string | null | undefined): boolean {

  const s = String(estadoSri ?? '').trim().toUpperCase();

  return s === 'PENDIENTE_AUTORIZACION' || s === 'RECIBIDA';

}



/** Regenera XML, firma y reenvía al SRI con la misma clave y numeración. */

export function puedeReemitirAlSri(estadoSri: string | null | undefined): boolean {

  const s = String(estadoSri ?? '').trim().toUpperCase();

  return (

    s === 'ERROR' ||

    s === 'DEVUELTO' ||

    s === 'DEVUELTA' ||

    s === 'NO_AUTORIZADO' ||

    s === 'NO AUTORIZADO' ||

    s === 'RECHAZADA'

  );

}



export function tonoEstadoSri(codigo: string | null | undefined): SriEstadoTono {

  const s = normalizarCodigoEstadoSri(codigo);

  switch (s) {

    case 'AUTORIZADO':

      return 'success';

    case 'BORRADOR':

      return 'draft';

    case 'RECIBIDA':

    case 'FIRMADO':

    case 'GENERADO':

      return 'info';

    case 'PENDIENTE_AUTORIZACION':

      return 'warning';

    case 'DEVUELTO':

    case 'DEVUELTA':

    case 'ERROR':

    case 'RECHAZADA':

    case 'NO_AUTORIZADO':

    case 'NO AUTORIZADO':

      return 'danger';

    default:

      return 'neutral';

  }

}



/** Clases CSS para badge de estado SRI (grids y detalle). */

export function badgeClaseEstadoSri(codigo: string | null | undefined): string {

  return `ts-sri-badge ts-sri-badge--${tonoEstadoSri(codigo)}`;

}



const ESTADOS_CON_HINT = new Set([

  'PENDIENTE_AUTORIZACION',

  'ERROR',

  'RECHAZADA',

  'DEVUELTO',

  'DEVUELTA',

  'NO_AUTORIZADO',

  'NO AUTORIZADO',

]);



/** HTML del badge SRI para celdas Tabulator (etiqueta traducida + hint opcional). */

export function htmlBadgeEstadoSri(

  codigo: string | null | undefined,

  t: (key: string) => string,

  hint?: string | null,

  maxHintLen = 80,

): string {

  const label = etiquetaEstadoSri(codigo, t);

  const cls = badgeClaseEstadoSri(codigo);

  let html =

    `<span class="${cls}"><span class="ts-sri-badge__dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;

  const msg = hint?.trim();

  const s = normalizarCodigoEstadoSri(codigo);

  if (msg && ESTADOS_CON_HINT.has(s)) {

    const short = msg.length > maxHintLen ? msg.slice(0, maxHintLen - 1) + '…' : msg;

    html += `<div class="ts-sri-badge-hint" title="${escapeHtml(msg)}">${escapeHtml(short)}</div>`;

  }

  return html;

}



/** @deprecated Use puedeReconsultarAutorizacion o puedeReemitirAlSri */

export function puedeReprocesarAutorizacion(estadoSri: string | null | undefined): boolean {

  return puedeReconsultarAutorizacion(estadoSri) || puedeReemitirAlSri(estadoSri);

}



export function tonoEstadoEnvioCorreo(estado: string | null | undefined): SriEstadoTono {

  const s = String(estado ?? '').trim().toUpperCase();

  switch (s) {

    case 'ENVIADO':

      return 'success';

    case 'PENDIENTE':

      return 'warning';

    case 'ERROR':

      return 'danger';

    default:

      return 'neutral';

  }

}



export function badgeClaseEstadoEnvioCorreo(estado: string | null | undefined): string {

  return `ts-sri-badge ts-sri-badge--${tonoEstadoEnvioCorreo(estado)}`;

}



export function htmlBadgeEstadoEnvioCorreo(

  estado: string | null | undefined,

  t: (key: string) => string,

): string {

  const label = etiquetaEstadoEnvioCorreo(estado, t);

  const cls = badgeClaseEstadoEnvioCorreo(estado);

  return `<span class="${cls}"><span class="ts-sri-badge__dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;

}



export function etiquetaEstadoEnvioCorreo(estado: string | null | undefined, t: (key: string) => string): string {

  const s = String(estado ?? '').trim().toUpperCase();

  if (!s) {

    return t('monitor.emailNotSent');

  }

  switch (s) {

    case 'ENVIADO':

      return t('monitor.emailSent');

    case 'PENDIENTE':

      return t('monitor.emailPending');

    case 'ERROR':

      return t('monitor.emailError');

    default:

      return estado ?? '-';

  }

}


