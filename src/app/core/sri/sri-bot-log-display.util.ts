export interface SriBotLogLike {
  tipoOperacion: string;
  estado: string;
  mensaje?: string;
}

export function sriProgressLabel(t: (key: string) => string, tipo: string): string {
  const key = `sriDownload.progress.${tipo}`;
  const translated = t(key);
  return translated !== key ? translated : tipo;
}

export function sriProgressDetail(t: (key: string) => string, log: SriBotLogLike): string | null {
  const msg = (log.mensaje ?? '').trim();
  if (!msg) {
    return null;
  }

  const xmlProgress = msg.match(/Descargando XML\s+(\d+)\s*\/\s*(\d+)/i);
  if (xmlProgress) {
    return t('sriDownload.progressMsg.downloadingXml')
      .replace('{current}', xmlProgress[1])
      .replace('{total}', xmlProgress[2]);
  }

  const records = msg.match(/Registros en tabla:\s*(\d+)/i);
  if (records) {
    return t('sriDownload.progressMsg.foundRecords').replace('{count}', records[1]);
  }

  const syncOk = msg.match(/comprobantes\s*=\s*(\d+)/i);
  if (syncOk && log.tipoOperacion === 'SYNC_OK') {
    return t('sriDownload.progressMsg.syncCompleted').replace('{count}', syncOk[1]);
  }

  if (/engine\s*=|efactura|embedded|selenium/i.test(msg)) {
    return t('sriDownload.progressMsg.connectingPortal');
  }

  if (/sesi[oó]n iniciada/i.test(msg)) {
    return t('sriDownload.progressMsg.sessionOk');
  }

  if (/formulario comprobantes recibidos/i.test(msg)) {
    return t('sriDownload.progressMsg.formReady');
  }

  if (/login|credencial/i.test(msg)) {
    return t('sriDownload.progressMsg.authenticating');
  }

  return msg;
}
