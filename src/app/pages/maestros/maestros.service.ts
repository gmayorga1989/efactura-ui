import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { SpringPage } from '../../core/models/page.model';
import { extractApiErrorMessage } from '../../core/session/http-error.util';

export type ClienteProveedorTipo = 'clientes' | 'proveedores';
export type ProductoServicioTipo = 'productos' | 'servicios';
export type MaestroEntidadTipo = ClienteProveedorTipo | ProductoServicioTipo;

export interface ClienteProveedor {
  id: string;
  tipoIdentificacion: string;
  identificacion: string;
  razonSocial: string;
  nombreComercial?: string | null;
  tipoTercero?: 'CLIENTE' | 'PROVEEDOR' | 'AMBOS' | string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  contactoEmail?: string | null;
  obligadoContabilidad?: 'SI' | 'NO' | string | null;
  contribuyenteEspecial?: string | null;
  regimen?: string | null;
  estadoSri?: string | null;
  actividadEconomica?: string | null;
  fuenteDatos?: string | null;
  direcciones?: TerceroDireccion[] | null;
  activo?: boolean | null;
  estado?: string | null;
  customData?: Record<string, unknown> | null;
}

export interface ClienteProveedorPayload {
  tipoIdentificacion: string;
  identificacion: string;
  razonSocial: string;
  nombreComercial?: string;
  tipoTercero?: 'CLIENTE' | 'PROVEEDOR' | 'AMBOS';
  direccion?: string;
  telefono?: string;
  email?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  contribuyenteEspecial?: string;
  regimen?: string;
  estadoSri?: string;
  actividadEconomica?: string;
  fuenteDatos?: string;
  direcciones?: TerceroDireccion[];
  customData?: Record<string, unknown>;
}

export interface TerceroDireccion {
  tipo?: string | null;
  direccion?: string | null;
  provincia?: string | null;
  canton?: string | null;
  parroquia?: string | null;
  referencia?: string | null;
  principal?: boolean | null;
}

export interface ConsultaCedulaResponse {
  identificacion: string;
  encontrado: boolean;
  nombres?: string | null;
  lugarNacimiento?: string | null;
  fechaNacimiento?: string | null;
  fuente?: string | null;
  obsoleto?: boolean;
  datosRaw?: Record<string, unknown> | null;
}

export interface ConsultaRucResponse {
  numeroRuc: string;
  encontrado: boolean;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  tipoContribuyente?: string | null;
  estadoContribuyenteRuc?: string | null;
  obligadoLlevarContabilidad?: string | null;
  contribuyenteEspecial?: string | null;
  regimen?: string | null;
  actividadEconomicaPrincipal?: string | null;
  direcciones?: TerceroDireccion[] | null;
  contribuyenteRaw?: Record<string, unknown> | null;
  establecimientosRaw?: unknown[] | null;
}

export interface ListaPrecioOption {
  id: string;
  codigo: string;
  nombre: string;
  esDefault: boolean;
}

export interface ListaPrecioCreatePayload {
  codigo: string;
  nombre: string;
  esDefault?: boolean;
}

export interface ProductoImportLineResult {
  fila: number;
  codigoPrincipal: string | null;
  estado: 'CREADO' | 'ACTUALIZADO' | 'ERROR';
  mensaje: string;
}

export interface ProductoImportResult {
  totalFilas: number;
  creados: number;
  actualizados: number;
  errores: number;
  detalles: ProductoImportLineResult[];
}

export interface ProductoListaPrecioRow {
  listaId: string;
  listaCodigo: string;
  listaNombre: string;
  precio: number | null;
}

export interface ProductoImpuestoRow {
  catalogoItemId?: string | null;
  nombre?: string | null;
  tipo?: string | null;
  codigo?: string | null;
  porcentaje?: number | null;
}

export interface ImpuestoCatalogoItem {
  id: string;
  empresaId?: string | null;
  paisIso: string;
  tipo: string;
  codigo: string;
  nombre: string;
  porcentajeDefault?: number | null;
  orden: number;
  activo?: boolean;
}

export interface ImpuestoCatalogoCreatePayload {
  tipo: string;
  codigo: string;
  nombre: string;
  porcentajeDefault?: number | null;
  orden?: number | null;
}

export interface ImpuestoCatalogoPatchPayload {
  nombre?: string;
  porcentajeDefault?: number | null;
  orden?: number | null;
  activo?: boolean;
}

export interface ProductoCategoriaRow {
  id: string;
  parentId: string | null;
  codigo: string;
  nombre: string;
  nivel: number;
  ruta: string;
  orden: number;
}

export interface ProductoCategoriaPayload {
  parentId?: string | null;
  codigo: string;
  nombre: string;
  orden?: number | null;
}

export interface ProductoCategoriaUpdatePayload {
  parentId?: string | null;
  nombre?: string | null;
  orden?: number | null;
}

export interface ProductoServicio {
  id: string;
  codigoPrincipal: string;
  codigoAuxiliar?: string | null;
  descripcion: string;
  tipo?: 'PRODUCTO' | 'SERVICIO' | string | null;
  precioUnitario?: number | null;
  ivaCodigo?: string | null;
  iceCodigo?: string | null;
  irbpnrCodigo?: string | null;
  categoriaId?: string | null;
  categoriaCodigo?: string | null;
  categoriaNombre?: string | null;
  categoriaRuta?: string | null;
  activo?: boolean | null;
  estado?: string | null;
  customData?: Record<string, unknown> | null;
  imagenUrl?: string | null;
  preciosListas?: ProductoListaPrecioRow[] | null;
  impuestosAdicionales?: ProductoImpuestoRow[] | null;
}

export interface ProductoServicioPayload {
  codigoPrincipal: string;
  codigoAuxiliar?: string;
  descripcion: string;
  tipo?: 'PRODUCTO' | 'SERVICIO';
  precioUnitario?: number;
  ivaCodigo?: string;
  iceCodigo?: string;
  irbpnrCodigo?: string;
  categoriaId?: string | null;
  customData?: Record<string, unknown>;
  preciosListas?: { listaCodigo: string; precio: number }[];
  impuestosCatalogo?: { catalogoItemId: string; porcentaje?: number }[];
  impuestosManuales?: { nombre: string; porcentaje: number }[];
}

export type MaestroPayload = ClienteProveedorPayload | ProductoServicioPayload;
export type MaestroRow = ClienteProveedor | ProductoServicio;

@Injectable({ providedIn: 'root' })
export class MaestrosService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/web/v1';

  endpoint(tipo: MaestroEntidadTipo): string {
    return `${this.base}/${tipo}`;
  }

  list<T extends MaestroRow>(
    tipo: MaestroEntidadTipo,
    page = 0,
    size = 20,
    extraParams: Record<string, string | number | boolean | null | undefined> = {},
  ): Observable<SpringPage<T>> {
    let params = new HttpParams().set('page', String(page)).set('size', String(size));
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<SpringPage<T>>(this.endpoint(tipo), { params });
  }

  get<T extends MaestroRow>(tipo: MaestroEntidadTipo, id: string): Observable<T> {
    return this.http.get<T>(`${this.endpoint(tipo)}/${id}`);
  }

  create(tipo: MaestroEntidadTipo, payload: MaestroPayload): Observable<MaestroRow> {
    return this.http.post<MaestroRow>(this.endpoint(tipo), payload);
  }

  update(tipo: MaestroEntidadTipo, id: string, payload: MaestroPayload): Observable<MaestroRow> {
    return this.http.patch<MaestroRow>(`${this.endpoint(tipo)}/${id}`, payload);
  }

  delete(tipo: MaestroEntidadTipo, id: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tipo)}/${id}`);
  }

  consultaRuc(tipo: ClienteProveedorTipo, ruc: string): Observable<ConsultaRucResponse> {
    return this.http.get<ConsultaRucResponse>(`${this.endpoint(tipo)}/consulta-ruc/${encodeURIComponent(ruc)}`);
  }

  consultaCedula(tipo: ClienteProveedorTipo, cedula: string): Observable<ConsultaCedulaResponse> {
    return this.http.get<ConsultaCedulaResponse>(`${this.endpoint(tipo)}/consulta-cedula/${encodeURIComponent(cedula)}`);
  }

  listasPrecio(tipo: ProductoServicioTipo): Observable<ListaPrecioOption[]> {
    return this.http.get<ListaPrecioOption[]>(`${this.endpoint(tipo)}/listas-precio`);
  }

  crearListaPrecio(tipo: ProductoServicioTipo, body: ListaPrecioCreatePayload): Observable<ListaPrecioOption> {
    return this.http.post<ListaPrecioOption>(`${this.endpoint(tipo)}/listas-precio`, body);
  }

  descargarPlantillaImportacion(tipo: ProductoServicioTipo): Observable<Blob> {
    return this.http.get(`${this.endpoint(tipo)}/plantilla-importacion`, { responseType: 'blob' });
  }

  importarDesdePlantilla(tipo: ProductoServicioTipo, archivo: File): Observable<ProductoImportResult> {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.post<ProductoImportResult>(`${this.endpoint(tipo)}/importar`, form);
  }

  uploadProductoImagen(tipo: ProductoServicioTipo, id: string, archivo: File): Observable<ProductoServicio> {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.post<ProductoServicio>(`${this.endpoint(tipo)}/${id}/imagen`, form);
  }

  impuestosCatalogo(tipo: ProductoServicioTipo): Observable<ImpuestoCatalogoItem[]> {
    return this.http.get<ImpuestoCatalogoItem[]>(`${this.endpoint(tipo)}/impuestos-catalogo`);
  }

  crearImpuestoCatalogo(tipo: ProductoServicioTipo, body: ImpuestoCatalogoCreatePayload): Observable<ImpuestoCatalogoItem> {
    return this.http.post<ImpuestoCatalogoItem>(`${this.endpoint(tipo)}/impuestos-catalogo`, body);
  }

  actualizarImpuestoCatalogo(
    tipo: ProductoServicioTipo,
    id: string,
    body: ImpuestoCatalogoPatchPayload,
  ): Observable<ImpuestoCatalogoItem> {
    return this.http.patch<ImpuestoCatalogoItem>(`${this.endpoint(tipo)}/impuestos-catalogo/${encodeURIComponent(id)}`, body);
  }

  eliminarImpuestoCatalogo(tipo: ProductoServicioTipo, id: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tipo)}/impuestos-catalogo/${encodeURIComponent(id)}`);
  }

  categoriasProducto(tipo: ProductoServicioTipo): Observable<ProductoCategoriaRow[]> {
    return this.http.get<ProductoCategoriaRow[]>(`${this.endpoint(tipo)}/categorias`);
  }

  crearCategoriaProducto(tipo: ProductoServicioTipo, body: ProductoCategoriaPayload): Observable<ProductoCategoriaRow> {
    return this.http.post<ProductoCategoriaRow>(`${this.endpoint(tipo)}/categorias`, body);
  }

  actualizarCategoriaProducto(
    tipo: ProductoServicioTipo,
    id: string,
    body: ProductoCategoriaUpdatePayload,
  ): Observable<ProductoCategoriaRow> {
    return this.http.patch<ProductoCategoriaRow>(`${this.endpoint(tipo)}/categorias/${id}`, body);
  }

  eliminarCategoriaProducto(tipo: ProductoServicioTipo, id: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tipo)}/categorias/${id}`);
  }
}

export function maestroErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 409) {
      return 'Registro duplicado. Revisa la identificacion o codigo principal.';
    }
    if (err.status === 404) {
      return 'Registro no encontrado.';
    }
    if (err.status === 400) {
      return extractApiErrorMessage(err, 'Datos invalidos. Revisa los campos obligatorios.');
    }
    return extractApiErrorMessage(err, fallback);
  }
  return fallback;
}
