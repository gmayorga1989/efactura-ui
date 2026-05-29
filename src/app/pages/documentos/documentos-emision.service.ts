import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ComprobanteFactura, FacturaEmitPayload, FacturaItemPayload } from '../facturas/facturas.service';

export type TipoDocumentoEmision =
  | 'notas-credito'
  | 'notas-debito'
  | 'guias'
  | 'retenciones'
  | 'liquidaciones';

export interface DocumentoModificadoPayload {
  puntoEmisionId: string;
  fechaEmision?: string;
  tipoIdentificacionReceptor: string;
  identificacionReceptor: string;
  razonSocialReceptor: string;
  facturaModificadaId?: string;
  motivo?: string;
  items?: FacturaItemPayload[];
  customData?: Record<string, unknown>;
}

export interface GuiaRemisionPayload {
  puntoEmisionId: string;
  fechaEmision?: string;
  dirPartida: string;
  tipoIdentificacionTransportista: string;
  identificacionTransportista: string;
  razonSocialTransportista: string;
  fechaIniTransporte?: string;
  fechaFinTransporte?: string;
  placa: string;
  tipoIdentificacionDestinatario: string;
  identificacionDestinatario: string;
  razonSocialDestinatario: string;
  dirDestinatario: string;
  motivoTraslado: string;
  facturaSustentoId?: string;
  items?: FacturaItemPayload[];
  customData?: Record<string, unknown>;
}

export interface RetencionImpuestoPayload {
  codigo: string;
  codigoRetencion: string;
  baseImponible: number;
  porcentajeRetener: number;
  valorRetenido: number;
  numDocSustento?: string;
}

export interface RetencionPayload {
  puntoEmisionId: string;
  fechaEmision?: string;
  periodoFiscal: string;
  tipoIdentificacionSujetoRetenido: string;
  identificacionSujetoRetenido: string;
  razonSocialSujetoRetenido: string;
  impuestos: RetencionImpuestoPayload[];
}

@Injectable({ providedIn: 'root' })
export class DocumentosEmisionService {
  private readonly http = inject(HttpClient);

  private basePath(tipo: TipoDocumentoEmision): string {
    switch (tipo) {
      case 'notas-credito':
        return '/api/web/v1/ventas/notas-credito';
      case 'notas-debito':
        return '/api/web/v1/ventas/notas-debito';
      case 'guias':
        return '/api/web/v1/ventas/guias';
      case 'retenciones':
        return '/api/web/v1/proveedores/retenciones';
      case 'liquidaciones':
        return '/api/web/v1/proveedores/liquidaciones';
    }
  }

  guardarBorradorModificado(
    tipo: 'notas-credito' | 'notas-debito',
    body: DocumentoModificadoPayload,
  ): Observable<ComprobanteFactura> {
    return this.http.post<ComprobanteFactura>(`${this.basePath(tipo)}/borrador`, body);
  }

  actualizarBorradorModificado(
    tipo: 'notas-credito' | 'notas-debito',
    id: string,
    body: DocumentoModificadoPayload,
  ): Observable<ComprobanteFactura> {
    return this.http.put<ComprobanteFactura>(`${this.basePath(tipo)}/borrador/${id}`, body);
  }

  guardarBorradorGuia(body: GuiaRemisionPayload): Observable<ComprobanteFactura> {
    return this.http.post<ComprobanteFactura>(`${this.basePath('guias')}/borrador`, body);
  }

  actualizarBorradorGuia(id: string, body: GuiaRemisionPayload): Observable<ComprobanteFactura> {
    return this.http.put<ComprobanteFactura>(`${this.basePath('guias')}/borrador/${id}`, body);
  }

  guardarBorradorRetencion(body: RetencionPayload): Observable<ComprobanteFactura> {
    return this.http.post<ComprobanteFactura>(`${this.basePath('retenciones')}/borrador`, body);
  }

  actualizarBorradorRetencion(id: string, body: RetencionPayload): Observable<ComprobanteFactura> {
    return this.http.put<ComprobanteFactura>(`${this.basePath('retenciones')}/borrador/${id}`, body);
  }

  guardarBorradorLiquidacion(body: FacturaEmitPayload): Observable<ComprobanteFactura> {
    return this.http.post<ComprobanteFactura>(`${this.basePath('liquidaciones')}/borrador`, body);
  }

  actualizarBorradorLiquidacion(id: string, body: FacturaEmitPayload): Observable<ComprobanteFactura> {
    return this.http.put<ComprobanteFactura>(`${this.basePath('liquidaciones')}/borrador/${id}`, body);
  }

  emitirBorrador(tipo: TipoDocumentoEmision, id: string): Observable<ComprobanteFactura> {
    const headers = new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() });
    return this.http.post<ComprobanteFactura>(`${this.basePath(tipo)}/${id}/emitir`, null, { headers });
  }

  fromFacturaModificado(
    facturaId: string,
    motivo: string,
    payload: FacturaEmitPayload,
  ): DocumentoModificadoPayload {
    return {
      puntoEmisionId: payload.puntoEmisionId,
      fechaEmision: payload.fechaEmision,
      tipoIdentificacionReceptor: payload.tipoIdentificacionReceptor,
      identificacionReceptor: payload.identificacionReceptor,
      razonSocialReceptor: payload.razonSocialReceptor,
      facturaModificadaId: facturaId,
      motivo,
      items: payload.items,
      customData: payload.customData,
    };
  }

  soportaEmisionSri(endpoint: string): boolean {
    return (
      endpoint.includes('notas-credito') ||
      endpoint.includes('notas-debito') ||
      endpoint.includes('/guias') ||
      endpoint.includes('retenciones') ||
      endpoint.includes('liquidaciones')
    );
  }

  tipoDesdeEndpoint(endpoint: string): TipoDocumentoEmision | null {
    if (endpoint.includes('notas-credito')) return 'notas-credito';
    if (endpoint.includes('notas-debito')) return 'notas-debito';
    if (endpoint.includes('/guias')) return 'guias';
    if (endpoint.includes('retenciones')) return 'retenciones';
    if (endpoint.includes('liquidaciones')) return 'liquidaciones';
    return null;
  }

  listadoPath(tipo: TipoDocumentoEmision): string[] {
    switch (tipo) {
      case 'notas-credito':
        return ['ventas', 'notas-credito'];
      case 'notas-debito':
        return ['ventas', 'notas-debito'];
      case 'guias':
        return ['ventas', 'guias'];
      case 'retenciones':
        return ['proveedores', 'retenciones'];
      case 'liquidaciones':
        return ['proveedores', 'liquidaciones'];
    }
  }
}
