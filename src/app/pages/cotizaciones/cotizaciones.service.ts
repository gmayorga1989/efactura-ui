import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { FacturaLinea } from '../facturas/facturas.service';

export type CotizacionEstado = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'CONVERTIDA' | 'ANULADA';

export interface CotizacionAdjuntoDto {
  id?: string;
  tipo?: 'ENLACE' | 'ARCHIVO';
  proveedor?: string;
  titulo?: string;
  url: string;
  nombreArchivo?: string;
  orden?: number;
}

export interface CotizacionLineaDto {
  productoId?: string;
  codigoPrincipal?: string;
  codigoAuxiliar?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  ivaPorcentaje?: number;
}

export interface CotizacionPayload {
  fechaEmision?: string;
  validezDias?: number;
  clienteId?: string | null;
  vendedorId?: string | null;
  tipoIdentificacionReceptor: string;
  identificacionReceptor: string;
  razonSocialReceptor: string;
  emailReceptor?: string;
  items: CotizacionLineaDto[];
  adjuntos?: CotizacionAdjuntoDto[];
  introduccionHtml?: string;
  condicionesHtml?: string;
  plantillaJson?: Record<string, unknown>;
}

export interface CotizacionResumen {
  id: string;
  numero: string;
  fechaEmision: string;
  validezDias: number;
  fechaVencimiento: string;
  estado: CotizacionEstado;
  clienteId?: string | null;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  razonSocialReceptor: string;
  identificacionReceptor: string;
  tipoIdentificacionReceptor?: string;
  valorTotal: number;
  comprobanteId?: string | null;
}

export interface CotizacionDetalle extends CotizacionResumen {
  emailReceptor?: string;
  subtotalSinImpuestos?: number;
  ivaTotal?: number;
  introduccionHtml?: string;
  condicionesHtml?: string;
  plantillaJson?: Record<string, unknown>;
  items: CotizacionLineaDto[];
  adjuntos: CotizacionAdjuntoDto[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
}

@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/web/v1/ventas/cotizaciones';

  listar(params: {
    estado?: string;
    vendedorId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    q?: string;
    page?: number;
    size?: number;
  }): Observable<PageResponse<CotizacionResumen>> {
    let p = new HttpParams();
    if (params.estado) p = p.set('estado', params.estado);
    if (params.vendedorId) p = p.set('vendedorId', params.vendedorId);
    if (params.fechaDesde) p = p.set('fechaDesde', params.fechaDesde);
    if (params.fechaHasta) p = p.set('fechaHasta', params.fechaHasta);
    if (params.q) p = p.set('q', params.q);
    p = p.set('page', String(params.page ?? 0)).set('size', String(params.size ?? 20));
    return this.http.get<PageResponse<CotizacionResumen>>(this.base, { params: p });
  }

  obtener(id: string): Observable<CotizacionDetalle> {
    return this.http.get<CotizacionDetalle>(`${this.base}/${id}`);
  }

  crear(body: CotizacionPayload): Observable<CotizacionDetalle> {
    return this.http.post<CotizacionDetalle>(this.base, body);
  }

  actualizar(id: string, body: CotizacionPayload): Observable<CotizacionDetalle> {
    return this.http.put<CotizacionDetalle>(`${this.base}/${id}`, body);
  }

  anular(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/anular`, {});
  }

  aceptar(id: string): Observable<CotizacionDetalle> {
    return this.http.post<CotizacionDetalle>(`${this.base}/${id}/aceptar`, {});
  }

  rechazar(id: string): Observable<CotizacionDetalle> {
    return this.http.post<CotizacionDetalle>(`${this.base}/${id}/rechazar`, {});
  }

  convertirFactura(id: string, puntoEmisionId: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/${id}/convertir-factura`, { puntoEmisionId });
  }

  enviarCorreo(id: string, destinatarios: string[], asunto?: string, mensajeAdicional?: string): Observable<{ enviado: boolean }> {
    return this.http.post<{ enviado: boolean }>(`${this.base}/${id}/enviar-correo`, {
      destinatarios,
      asunto,
      mensajeAdicional,
    });
  }

  previewUrl(id: string): string {
    return `${this.base}/${id}/preview`;
  }

  plantillaEmpresa(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/plantilla-empresa`);
  }

  lineasToPayload(lineas: FacturaLinea[]): CotizacionLineaDto[] {
    return lineas
      .filter((l) => l.descripcion?.trim())
      .map((l) => ({
        codigoPrincipal: l.codigoPrincipal || 'ITEM',
        codigoAuxiliar: l.codigoAuxiliar,
        descripcion: l.descripcion,
        cantidad: Number(l.cantidad) || 0,
        precioUnitario: Number(l.precioUnitario) || 0,
        descuento: Number(l.descuento) || 0,
        ivaPorcentaje: Number(l.ivaPorcentaje) || 0,
      }));
  }
}
