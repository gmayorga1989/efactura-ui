import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { htmlToPlainSriText, htmlToPlainPdfText, isRichTextEmpty } from '../../shared/utils/rich-text.util';
import type { ClienteProveedor, ProductoServicio, TerceroDireccion } from '../maestros/maestros.service';

export interface CampoExtraDef {
  codigo: string;
  etiqueta: string;
  tipo: 'text' | 'number' | 'select';
  requerido: boolean;
  opciones?: string[];
}

export interface PuntoEmitir {
  id: string;
  establecimientoCodigo: string;
  codigo: string;
  nombre: string | null;
}

export const MAX_INFO_ADICIONAL_CHARS = 300;
export const MAX_DETALLES_ADICIONALES_LINEA = 3;

export interface FacturaLinea {
  _rowId: string;
  /** Línea de factura origen al armar NC desde factura (selección manual). */
  _origenDetalleId?: string;
  productoId: string;
  codigoPrincipal: string;
  codigoAuxiliar: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  ivaPorcentaje: number;
  ivaCodigoPorcentaje: string;
  /** Texto plano para XML SRI (sin saltos de línea). */
  detallesAdicionales?: string[];
  /** HTML para representación impresa PDF; no se envía al XML. */
  detallesAdicionalesHtml?: string[];
}

export interface FacturaItemPayload {
  codigoPrincipal: string;
  codigoAuxiliar?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  ivaPorcentaje: number;
  ivaCodigoPorcentaje?: string;
  customData?: Record<string, unknown>;
}

export interface FacturaEmitPayload {
  puntoEmisionId: string;
  fechaEmision?: string;
  tipoIdentificacionReceptor: string;
  identificacionReceptor: string;
  razonSocialReceptor: string;
  emailReceptor?: string;
  vendedorId?: string | null;
  notificarEmails?: string[];
  items: FacturaItemPayload[];
  pagos?: { formaPago: string; total: number }[];
  customData?: Record<string, unknown>;
}

export interface IvaDesgloseLinea {
  codigo: string;
  porcentaje: number;
  subtotal: number;
  iva: number;
}

export interface ComprobanteDetalle {
  id: string;
  linea: number;
  codigoPrincipal: string;
  codigoAuxiliar: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  customData?: Record<string, unknown>;
}

export interface ComprobanteFactura {
  id: string;
  tipo?: string;
  numeroComprobante: string;
  fechaEmision: string;
  razonSocialReceptor: string;
  identificacionReceptor: string;
  subtotalSinImpuestos: number;
  descuentoTotal: number;
  ivaTotal: number;
  valorTotal: number;
  estadoSri: string;
  claveAcceso: string;
  numeroAutorizacion?: string | null;
  fechaAutorizacion?: string | null;
  ultimoMensajeSri?: string | null;
  tipoIdentificacionReceptor?: string;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  customData?: Record<string, unknown>;
  detalles: ComprobanteDetalle[];
}

export interface ComprobanteRelacionadoResumen {
  id: string;
  tipo: string;
  numeroComprobante: string;
  estadoSri: string;
  fechaAutorizacion?: string | null;
}

export interface FacturaTotales {
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  subtotalExento: number;
  ivaPorTarifa: IvaDesgloseLinea[];
}

/** Etiquetas para selector de tarifa IVA (código SRI). */
export const IVA_CODIGO_OPTIONS: Record<string, string> = {
  '0': '0% (0)',
  '2': '12% (2)',
  '4': '15% (4)',
  '5': '5% (5)',
  '6': '8% (8)',
};

/** Código SRI tarifa IVA → porcentaje (referencia Ecuador). */
const IVA_PCT_BY_CODIGO: Record<string, number> = {
  '0': 0,
  '2': 12,
  '3': 14,
  '4': 15,
  '5': 5,
  '6': 8,
  '7': 0,
  '8': 8,
};

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private readonly http = inject(HttpClient);

  listarCamposExtra(): Observable<CampoExtraDef[]> {
    return this.http.get<CampoExtraDef[]>('/api/web/v1/facturas/campos-extra');
  }

  listarPuntos(): Observable<PuntoEmitir[]> {
    return this.http.get<PuntoEmitir[]>('/api/web/v1/facturas/puntos-emision');
  }

  obtenerComprobante(id: string): Observable<ComprobanteFactura> {
    return this.http.get<ComprobanteFactura>(`/api/web/v1/comprobantes/${id}`);
  }

  listarRelacionados(comprobanteId: string): Observable<ComprobanteRelacionadoResumen[]> {
    return this.http.get<ComprobanteRelacionadoResumen[]>(
      `/api/web/v1/comprobantes/${comprobanteId}/relacionados`,
    );
  }

  emitir(body: FacturaEmitPayload, idempotencyKey: string): Observable<ComprobanteFactura> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http.post<ComprobanteFactura>('/api/web/v1/facturas', body, { headers });
  }

  guardarBorrador(body: FacturaEmitPayload): Observable<ComprobanteFactura> {
    return this.http.post<ComprobanteFactura>('/api/web/v1/facturas/borrador', body);
  }

  actualizarBorrador(id: string, body: FacturaEmitPayload): Observable<ComprobanteFactura> {
    return this.http.put<ComprobanteFactura>(`/api/web/v1/facturas/borrador/${id}`, body);
  }

  emitirBorrador(id: string, idempotencyKey: string): Observable<ComprobanteFactura> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http.post<ComprobanteFactura>(`/api/web/v1/facturas/${id}/emitir`, null, { headers });
  }

  comprobanteToLineas(c: ComprobanteFactura): FacturaLinea[] {
    if (!c.detalles?.length) {
      return [this.nuevaLineaVacia()];
    }
    return c.detalles.map((d) => {
      const cd = d.customData ?? {};
      const ivaPct = Number(cd['ivaPorcentaje'] ?? 15);
      const ivaCod = String(cd['ivaCodigoPorcentaje'] ?? '4');
      return {
        _rowId: crypto.randomUUID(),
        productoId: '',
        codigoPrincipal: d.codigoPrincipal ?? '',
        codigoAuxiliar: d.codigoAuxiliar ?? '',
        descripcion: d.descripcion ?? '',
        cantidad: Number(d.cantidad) || 1,
        precioUnitario: Number(d.precioUnitario) || 0,
        descuento: Number(d.descuento) || 0,
        ivaPorcentaje: Number.isFinite(ivaPct) ? ivaPct : 15,
        ivaCodigoPorcentaje: ivaCod,
        detallesAdicionales: leerDetallesAdicionales(cd),
        detallesAdicionalesHtml: leerDetallesAdicionalesHtml(cd),
      };
    });
  }

  buildPayload(
    cabecera: {
      puntoEmisionId: string;
      fechaEmision: string;
      tipoIdentificacionReceptor: string;
      identificacionReceptor: string;
      razonSocialReceptor: string;
      emailReceptor: string;
      glosa: string;
      direccionReceptor?: string;
      vendedorId?: string;
    },
    lineas: FacturaLinea[],
    extraValores: Record<string, string | number>,
    camposExtra: CampoExtraDef[],
    total: number,
  ): FacturaEmitPayload {
    const customData: Record<string, unknown> = {};
    for (const c of camposExtra) {
      const raw = extraValores[c.codigo];
      if (raw === '' || raw === undefined || raw === null) {
        continue;
      }
      customData[c.codigo] = c.tipo === 'number' ? Number(raw) : String(raw);
    }
    const items = this.lineasToPayload(lineas);
    const totales = this.calcularTotales(lineas);
    const emails = parseCorreosLista(cabecera.emailReceptor);
    if (emails.length) {
      customData['emailsReceptor'] = emails;
    }
    customData['desgloseImpuestos'] = totales.ivaPorTarifa;
    customData['desgloseSubtotales'] = {
      general: totales.subtotal,
      exento: totales.subtotalExento,
      gravado: round2(totales.subtotal - totales.subtotalExento),
    };
    const glosa = cabecera.glosa.trim().slice(0, MAX_INFO_ADICIONAL_CHARS);
    if (glosa) {
      customData['glosa'] = glosa;
    }
    const dir = cabecera.direccionReceptor?.trim();
    if (dir) {
      customData['direccionReceptor'] = dir;
    }
    return {
      puntoEmisionId: cabecera.puntoEmisionId,
      fechaEmision: cabecera.fechaEmision,
      tipoIdentificacionReceptor: cabecera.tipoIdentificacionReceptor,
      identificacionReceptor: cabecera.identificacionReceptor.trim(),
      razonSocialReceptor: cabecera.razonSocialReceptor.trim(),
      items,
      pagos: [{ formaPago: '20', total }],
      ...(emails[0] ? { emailReceptor: emails[0] } : {}),
      ...(cabecera.vendedorId ? { vendedorId: cabecera.vendedorId } : {}),
      ...(emails.length ? { notificarEmails: emails } : {}),
      ...(Object.keys(customData).length ? { customData } : {}),
    };
  }

  nuevaLineaVacia(): FacturaLinea {
    return {
      _rowId: crypto.randomUUID(),
      productoId: '',
      codigoPrincipal: '',
      codigoAuxiliar: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0,
      descuento: 0,
      ivaPorcentaje: 15,
      ivaCodigoPorcentaje: '4',
      detallesAdicionales: [],
    };
  }

  aplicarProducto(linea: FacturaLinea, item: ProductoServicio): void {
    linea.productoId = item.id;
    linea.codigoPrincipal = item.codigoPrincipal ?? '';
    linea.codigoAuxiliar = item.codigoAuxiliar ?? '';
    linea.descripcion = item.descripcion ?? '';
    linea.precioUnitario = Number(item.precioUnitario ?? 0);
    const codigo = String(item.ivaCodigo ?? '4').trim() || '4';
    linea.ivaCodigoPorcentaje = codigo;
    linea.ivaPorcentaje = ivaPorcentajeDesdeCodigo(codigo);
  }

  aplicarCliente(
    form: {
      tipoIdentificacionReceptor: string;
      identificacionReceptor: string;
      razonSocialReceptor: string;
      emailReceptor: string;
      direccionReceptor?: string;
    },
    cliente: ClienteProveedor,
  ): void {
    form.tipoIdentificacionReceptor = cliente.tipoIdentificacion || form.tipoIdentificacionReceptor;
    form.identificacionReceptor = cliente.identificacion;
    form.razonSocialReceptor = cliente.razonSocial;
    form.emailReceptor = correosDesdeCliente(cliente).join(';');
    form.direccionReceptor = direccionPrincipalCliente(cliente);
  }

  calcularTotales(lineas: FacturaLinea[]): FacturaTotales {
    let subtotal = 0;
    let descuento = 0;
    let subtotalExento = 0;
    const porTarifa = new Map<string, IvaDesgloseLinea>();

    for (const l of lineas) {
      const cant = Number(l.cantidad) || 0;
      const pu = Number(l.precioUnitario) || 0;
      const desc = Number(l.descuento) || 0;
      const lineGross = cant * pu;
      const lineSub = Math.max(0, lineGross - desc);
      const codigo = String(l.ivaCodigoPorcentaje ?? '4').trim() || '4';
      const ivaPct = Number(l.ivaPorcentaje) || 0;
      subtotal += lineSub;
      descuento += desc;

      if (ivaPct <= 0) {
        subtotalExento += lineSub;
        continue;
      }

      const key = `${codigo}:${ivaPct}`;
      const row = porTarifa.get(key) ?? { codigo, porcentaje: ivaPct, subtotal: 0, iva: 0 };
      row.subtotal += lineSub;
      row.iva += lineSub * (ivaPct / 100);
      porTarifa.set(key, row);
    }

    const ivaPorTarifa = [...porTarifa.values()]
      .map((row) => ({
        ...row,
        subtotal: round2(row.subtotal),
        iva: round2(row.iva),
      }))
      .sort((a, b) => a.porcentaje - b.porcentaje || a.codigo.localeCompare(b.codigo));

    const iva = round2(ivaPorTarifa.reduce((sum, row) => sum + row.iva, 0));
    subtotal = round2(subtotal);
    descuento = round2(descuento);
    subtotalExento = round2(subtotalExento);

    return {
      subtotal,
      descuento,
      iva,
      total: round2(subtotal + iva),
      subtotalExento,
      ivaPorTarifa,
    };
  }

  lineasToPayload(lineas: FacturaLinea[]): FacturaItemPayload[] {
    return lineas.map((l) => {
      const htmlDraft = l.detallesAdicionalesHtml ?? [];
      const built = buildDetallesAdicionalesFromHtmlDraft(htmlDraft, l.detallesAdicionales);
      const customData: Record<string, unknown> = {};
      if (built.plain.length) {
        customData['detallesAdicionales'] = built.plain;
      }
      if (built.html.length) {
        customData['detallesAdicionalesHtml'] = built.html;
      }
      return {
        codigoPrincipal: l.codigoPrincipal.trim(),
        codigoAuxiliar: l.codigoAuxiliar.trim() || undefined,
        descripcion: l.descripcion.trim(),
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        descuento: Number(l.descuento) || 0,
        ivaPorcentaje: Number(l.ivaPorcentaje) || 0,
        ivaCodigoPorcentaje: l.ivaCodigoPorcentaje?.trim() || undefined,
        ...(Object.keys(customData).length ? { customData } : {}),
      };
    });
  }
}

export function textoDetalleAdicionalLinea(cd?: Record<string, unknown>): string {
  if (!cd) {
    return '';
  }
  const html = leerDetallesAdicionalesHtml(cd);
  const plain = leerDetallesAdicionales(cd);
  const slots = Math.max(html.length, plain.length);
  const bloques: string[] = [];
  for (let i = 0; i < slots && i < MAX_DETALLES_ADICIONALES_LINEA; i++) {
    const h = html[i] ?? '';
    const p = plain[i] ?? '';
    const t = h ? htmlToPlainPdfText(h) : p;
    if (t.trim()) {
      bloques.push(t.trim());
    }
  }
  return bloques.join('\n\n');
}

export function leerDesgloseIva(cd?: Record<string, unknown>): IvaDesgloseLinea[] {
  const raw = cd?.['desgloseImpuestos'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        codigo: String(r['codigo'] ?? ''),
        porcentaje: Number(r['porcentaje']) || 0,
        subtotal: Number(r['subtotal']) || 0,
        iva: Number(r['iva']) || 0,
      };
    })
    .filter((r) => r.iva !== 0 || r.porcentaje !== 0);
}

function direccionPrincipalCliente(cliente: ClienteProveedor): string {
  const dirs = cliente.direcciones ?? [];
  const principal = dirs.find((d) => d.principal) ?? dirs[0];
  if (principal) {
    return formatearDireccionTercero(principal);
  }
  return (cliente.direccion ?? '').trim();
}

function formatearDireccionTercero(d: TerceroDireccion): string {
  const parts = [d.direccion, d.parroquia, d.canton, d.provincia, d.referencia]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

export function leerDetallesAdicionales(cd: Record<string, unknown>): string[] {
  const raw = cd['detallesAdicionales'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((v) => htmlToPlainSriText(String(v ?? '')).slice(0, MAX_INFO_ADICIONAL_CHARS))
    .filter((v) => v.length > 0)
    .slice(0, MAX_DETALLES_ADICIONALES_LINEA);
}

export function leerDetallesAdicionalesHtml(cd: Record<string, unknown>): string[] {
  const raw = cd['detallesAdicionalesHtml'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((v) => String(v ?? '').trim())
    .filter((v) => !isRichTextEmpty(v))
    .slice(0, MAX_DETALLES_ADICIONALES_LINEA);
}

export function detallesAdicionalesParaPayload(raw?: string[]): string[] {
  return (raw ?? [])
    .map((v) => htmlToPlainSriText(String(v ?? '')).slice(0, MAX_INFO_ADICIONAL_CHARS))
    .filter((v) => v.length > 0)
    .slice(0, MAX_DETALLES_ADICIONALES_LINEA);
}

export function buildDetallesAdicionalesFromHtmlDraft(
  htmlDraft: string[],
  fallbackPlain?: string[],
): { plain: string[]; html: string[] } {
  const plain: string[] = [];
  const html: string[] = [];
  for (let i = 0; i < MAX_DETALLES_ADICIONALES_LINEA; i++) {
    const h = String(htmlDraft[i] ?? '').trim();
    const fromHtml = htmlToPlainSriText(h);
    const fromPlain = htmlToPlainSriText(String(fallbackPlain?.[i] ?? ''));
    const text = fromHtml || fromPlain;
    if (!text) {
      continue;
    }
    plain.push(text.slice(0, MAX_INFO_ADICIONAL_CHARS));
    html.push(h || `<p>${escapeHtmlMinimal(text)}</p>`);
  }
  return { plain, html };
}

function escapeHtmlMinimal(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function contarDetallesAdicionales(plain?: string[], html?: string[]): number {
  let n = 0;
  for (let i = 0; i < MAX_DETALLES_ADICIONALES_LINEA; i++) {
    const h = String(html?.[i] ?? '');
    const p = String(plain?.[i] ?? '');
    if (htmlToPlainSriText(h || p).length > 0) {
      n++;
    }
  }
  return n;
}

export function normalizarDetallesAdicionalesHtmlDraft(
  plain?: string[],
  html?: string[],
): [string, string, string] {
  const p = plain ?? [];
  const h = html ?? [];
  return [
    draftHtmlSlot(h[0], p[0]),
    draftHtmlSlot(h[1], p[1]),
    draftHtmlSlot(h[2], p[2]),
  ];
}

function draftHtmlSlot(htmlVal: unknown, plainVal: unknown): string {
  const h = String(htmlVal ?? '').trim();
  if (h && !isRichTextEmpty(h)) {
    return h;
  }
  const t = htmlToPlainSriText(String(plainVal ?? ''));
  return t ? `<p>${escapeHtmlMinimal(t)}</p>` : '';
}

export function lineTotalConIva(
  cantidad: number,
  precioUnitario: number,
  descuento: number,
  ivaPorcentaje: number,
): number {
  const sub = Math.max(0, cantidad * precioUnitario - descuento);
  const iva = sub * (ivaPorcentaje / 100);
  return Math.round((sub + iva) * 100) / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function correoTextoDesdeCustomData(cd?: Record<string, unknown> | null): string {
  if (!cd) {
    return '';
  }
  const emails = cd['emailsReceptor'];
  if (Array.isArray(emails) && emails.length) {
    return emails
      .map((e) => String(e).trim())
      .filter(Boolean)
      .join(';');
  }
  return String(cd['emailReceptor'] ?? '').trim();
}

export function parseCorreosLista(raw?: string | null): string[] {
  const out = new Set<string>();
  if (!raw?.trim()) {
    return [];
  }
  for (const part of raw.split(/[;,]/)) {
    const mail = part.trim().toLowerCase();
    if (mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      out.add(mail);
    }
  }
  return [...out];
}

export function correosDesdeCliente(cliente: {
  email?: string | null;
  contactoEmail?: string | null;
}): string[] {
  return parseCorreosLista([cliente.email, cliente.contactoEmail].filter(Boolean).join(';'));
}

export function ivaPorcentajeDesdeCodigo(codigo: string): number {
  const c = codigo.trim();
  if (IVA_PCT_BY_CODIGO[c] !== undefined) {
    return IVA_PCT_BY_CODIGO[c];
  }
  const n = Number(c);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 15;
}
