import { gridActionsMenu, type GridActionItem } from './grid-actions.util';
import { puedeReconsultarAutorizacion, puedeReemitirAlSri } from './sri-estado.util';

export interface ComprobanteGridActionOptions {
  t: (key: string) => string;
  estadoSri: string;
  includeEdit?: boolean;
  includeEmit?: boolean;
  includeCreditNote?: boolean;
  tieneEmailReceptor?: boolean;
  includeHistorial?: boolean;
}

export function comprobanteGridActionsMenu(opts: ComprobanteGridActionOptions): string {
  const s = String(opts.estadoSri ?? '');
  const actions: GridActionItem[] = [{ action: 'ver', label: opts.t('common.view'), icon: 'view' }];

  if (opts.includeEdit && s === 'BORRADOR') {
    actions.push({ action: 'editar', label: opts.t('common.edit'), icon: 'edit' });
  }
  if (opts.includeEmit && s === 'BORRADOR') {
    actions.push({ action: 'emitir', label: opts.t('documents.emitToSri'), icon: 'resend' });
  }
  if (opts.includeCreditNote && s === 'AUTORIZADO') {
    actions.push({ action: 'nota-credito', label: opts.t('invoice.createCreditNote'), icon: 'edit' });
  }
  if (opts.includeHistorial !== false) {
    actions.push({ action: 'historial', label: opts.t('monitor.historyMenu'), icon: 'view' });
  }
  if (s !== 'BORRADOR') {
    if (puedeReemitirAlSri(s)) {
      actions.push({ action: 'reemitir', label: opts.t('invoice.resendToSri'), icon: 'resend' });
    }
    if (puedeReconsultarAutorizacion(s)) {
      actions.push({ action: 'reprocesar', label: opts.t('invoice.reprocessAuthorization'), icon: 'resend' });
    }
    actions.push({ action: 'ride', label: 'RIDE', icon: 'pdf' });
    actions.push({ action: 'xml', label: 'XML', icon: 'xml' });
    actions.push({ action: 'ride-xml', label: opts.t('invoice.downloadAll'), icon: 'pdf' });
    if (opts.tieneEmailReceptor !== false) {
      actions.push({ action: 'reenviar-correo', label: opts.t('invoice.resendEmail'), icon: 'resend' });
    }
  }

  return gridActionsMenu(actions, opts.t('common.actions'));
}
