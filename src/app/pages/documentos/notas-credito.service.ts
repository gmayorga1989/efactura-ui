import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ComprobanteFactura, FacturaEmitPayload, FacturaItemPayload } from '../facturas/facturas.service';

export interface NotaCreditoPayload {
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

@Injectable({ providedIn: 'root' })
export class NotasCreditoService {
  private readonly http = inject(HttpClient);

  guardarBorrador(body: NotaCreditoPayload): Observable<ComprobanteFactura> {
    return this.http.post<ComprobanteFactura>('/api/web/v1/ventas/notas-credito/borrador', body);
  }

  actualizarBorrador(id: string, body: NotaCreditoPayload): Observable<ComprobanteFactura> {
    return this.http.put<ComprobanteFactura>(`/api/web/v1/ventas/notas-credito/borrador/${id}`, body);
  }

  emitirBorrador(id: string, idempotencyKey: string): Observable<ComprobanteFactura> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http.post<ComprobanteFactura>(
      `/api/web/v1/ventas/notas-credito/${id}/emitir`,
      null,
      { headers },
    );
  }

  obtener(id: string): Observable<ComprobanteFactura> {
    return this.http.get<ComprobanteFactura>(`/api/web/v1/ventas/notas-credito/${id}`);
  }

  /** Convierte payload de factura (sin pagos) a nota de crédito. */
  fromFacturaPayload(
    facturaId: string,
    motivo: string,
    payload: FacturaEmitPayload,
  ): NotaCreditoPayload {
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
}
