import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface VendedorDto {
  id: string;
  codigoInterno: string;
  codigo?: string;
  nombres: string;
  apellidos?: string;
  nombreCompleto: string;
  email?: string;
  telefono?: string;
  documentoIdentidad?: string;
  notas?: string;
  estado: string;
}

export interface VendedorPayload {
  codigo?: string;
  nombres: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
  documentoIdentidad?: string;
  notas?: string;
  estado?: string;
}

export interface VendedorMetaDto {
  id?: string;
  periodoAnio: number;
  periodoMes: number;
  metaMonto: number;
  metaCantidad?: number;
  notas?: string;
}

export interface VendedorKpiDto {
  vendedorId: string;
  nombreCompleto: string;
  periodoAnio: number;
  periodoMes: number;
  metaMonto: number;
  ventasMonto: number;
  cotizacionesConvertidas: number;
  porcentajeAvance: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
}

@Injectable({ providedIn: 'root' })
export class VendedoresService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/web/v1/ventas/vendedores';

  listar(page = 0, size = 50, estado?: string): Observable<PageResponse<VendedorDto>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (estado) p = p.set('estado', estado);
    return this.http.get<PageResponse<VendedorDto>>(this.base, { params: p });
  }

  activos(): Observable<VendedorDto[]> {
    return this.http.get<VendedorDto[]>(`${this.base}/activos`);
  }

  crear(body: VendedorPayload): Observable<VendedorDto> {
    return this.http.post<VendedorDto>(this.base, body);
  }

  actualizar(id: string, body: VendedorPayload): Observable<VendedorDto> {
    return this.http.put<VendedorDto>(`${this.base}/${id}`, body);
  }

  kpis(anio: number, mes: number): Observable<VendedorKpiDto[]> {
    const p = new HttpParams().set('anio', anio).set('mes', mes);
    return this.http.get<VendedorKpiDto[]>(`${this.base}/kpis`, { params: p });
  }

  guardarMeta(vendedorId: string, body: VendedorMetaDto): Observable<VendedorMetaDto> {
    return this.http.put<VendedorMetaDto>(`${this.base}/${vendedorId}/metas`, body);
  }

  metas(vendedorId: string, anio: number): Observable<VendedorMetaDto[]> {
    const p = new HttpParams().set('anio', anio);
    return this.http.get<VendedorMetaDto[]>(`${this.base}/${vendedorId}/metas`, { params: p });
  }
}
