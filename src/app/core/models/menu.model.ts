/** `GET /api/web/v1/menu` */
export interface MenuItemDto {
  id: string;
  codigo: string;
  padreCodigo: string | null;
  orden: number;
  etiqueta: string;
  labelKey?: string | null;
  fallbackLabel?: string | null;
  rutaFront: string | null;
  icono: string | null;
  modulo: string | null;
  hijos?: MenuItemDto[];
}
