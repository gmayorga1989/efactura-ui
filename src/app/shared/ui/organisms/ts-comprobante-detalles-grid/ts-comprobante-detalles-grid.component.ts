import { Component, computed, inject, input } from '@angular/core';
import type { ColumnDefinition } from 'tabulator-tables';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { TsTabulatorLocalGridComponent } from '../ts-tabulator-local-grid/ts-tabulator-local-grid.component';

/** Fila de detalle de comprobante (factura, NC, guía, etc.). */
export interface ComprobanteDetalleGridRow {
  id: string;
  linea: number;
  codigoPrincipal: string;
  codigoAuxiliar?: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  detalleAdicional?: string;
}

function formatQty(value: unknown): string {
  const v = Number(value);
  return Number.isFinite(v)
    ? v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : '';
}

function formatMoney(value: unknown): string {
  const v = Number(value);
  return Number.isFinite(v)
    ? v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
}

@Component({
  selector: 'ts-comprobante-detalles-grid',
  standalone: true,
  imports: [TsTabulatorLocalGridComponent],
  template: `
    <ts-tabulator-local-grid
      [data]="rows()"
      [columns]="columns()"
      [reloadNonce]="gridReloadNonce()"
      [height]="height()"
      emptyContext="comprobanteLines"
    />
  `,
})
export class TsComprobanteDetallesGridComponent {
  readonly detalles = input.required<ComprobanteDetalleGridRow[]>();
  readonly mostrarDetalleAdicional = input(false);
  readonly height = input('360px');
  readonly reloadNonce = input(0);

  private readonly i18n = inject(UiI18nService);

  readonly rows = computed(() =>
    (this.detalles() ?? []).map((d) => ({
      id: d.id,
      linea: d.linea,
      codigoPrincipal: d.codigoPrincipal ?? '',
      codigoAuxiliar: d.codigoAuxiliar ?? '',
      descripcion: d.descripcion ?? '',
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
      descuento: d.descuento,
      precioTotalSinImpuesto: d.precioTotalSinImpuesto,
      detalleAdicional: d.detalleAdicional ?? '',
    })),
  );

  readonly tieneDescuento = computed(() => this.detalles().some((d) => Number(d.descuento) > 0));

  readonly gridReloadNonce = computed(() => {
    const list = this.detalles();
    const base = this.reloadNonce();
    if (!list.length) {
      return base;
    }
    return base + list.reduce((n, d) => n + d.linea, 0) + list.length;
  });

  readonly columns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const t = (key: string) => this.i18n.t(key);
    const numFmt =
      (fn: (v: unknown) => string) =>
      (cell: unknown) =>
        fn((cell as { getValue: () => unknown }).getValue());

    const cols: ColumnDefinition[] = [
      { title: '#', field: 'linea', width: 56, hozAlign: 'center' },
      { title: t('masters.code'), field: 'codigoPrincipal', width: 120 },
      { title: t('masters.description'), field: 'descripcion', minWidth: 220 },
    ];
    if (this.mostrarDetalleAdicional()) {
      cols.push({
        title: t('invoice.additionalDetailColumn'),
        field: 'detalleAdicional',
        minWidth: 180,
        formatter: 'textarea',
      });
    }
    cols.push(
      {
        title: t('invoice.quantity'),
        field: 'cantidad',
        width: 108,
        hozAlign: 'right',
        formatter: numFmt(formatQty),
      },
      {
        title: t('invoice.unitPriceShort'),
        field: 'precioUnitario',
        width: 110,
        hozAlign: 'right',
        formatter: numFmt(formatMoney),
      },
    );
    if (this.tieneDescuento()) {
      cols.push({
        title: t('invoice.discount'),
        field: 'descuento',
        width: 100,
        hozAlign: 'right',
        formatter: numFmt(formatMoney),
      });
    }
    cols.push({
      title: t('invoice.lineSubtotal'),
      field: 'precioTotalSinImpuesto',
      width: 120,
      hozAlign: 'right',
      formatter: numFmt(formatMoney),
    });
    return cols;
  });
}
