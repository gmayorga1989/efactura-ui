import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { MaestrosService, type ClienteProveedor } from '../maestros/maestros.service';
import { FacturasService, type PuntoEmitir } from '../facturas/facturas.service';

@Injectable({ providedIn: 'root' })
export class ComprobanteCatalogosService {
  private readonly facturas = inject(FacturasService);
  private readonly maestros = inject(MaestrosService);

  listarPuntos(): Observable<PuntoEmitir[]> {
    return this.facturas.listarPuntos().pipe(catchError(() => of([])));
  }

  listarClientes(size = 200): Observable<ClienteProveedor[]> {
    return this.maestros.list<ClienteProveedor>('clientes', 0, size).pipe(
      map((page) => page.content ?? []),
      catchError(() => of([])),
    );
  }

  listarProveedores(size = 200): Observable<ClienteProveedor[]> {
    return this.maestros.list<ClienteProveedor>('proveedores', 0, size).pipe(
      map((page) => page.content ?? []),
      catchError(() => of([])),
    );
  }
}
