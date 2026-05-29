import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { ColumnDefinition } from 'tabulator-tables';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import {
  contarDetallesAdicionales,
  IVA_CODIGO_OPTIONS,
  ivaPorcentajeDesdeCodigo,
  lineTotalConIva,
  type FacturaLinea,
} from '../../../../pages/facturas/facturas.service';
import type { ProductoServicio } from '../../../../pages/maestros/maestros.service';
import { escapeGridHtml, gridActionIcon } from '../../grid-actions.util';
import { TsTabulatorLocalGridComponent } from '../ts-tabulator-local-grid/ts-tabulator-local-grid.component';

interface PrecioListaOption {
  listaCodigo: string;
  listaNombre: string;
  precio: number;
}

function formatMoney(value: unknown): string {
  const v = Number(value);
  return Number.isFinite(v)
    ? v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
}

function formatQty(value: unknown): string {
  const v = Number(value);
  return Number.isFinite(v)
    ? v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : '';
}

function lineSubtotal(row: Record<string, unknown>): number {
  const cant = Number(row['cantidad']) || 0;
  const pu = Number(row['precioUnitario']) || 0;
  const desc = Number(row['descuento']) || 0;
  return Math.max(0, cant * pu - desc);
}

function lineTotal(row: Record<string, unknown>): number {
  const cant = Number(row['cantidad']) || 0;
  const pu = Number(row['precioUnitario']) || 0;
  const desc = Number(row['descuento']) || 0;
  const ivaPct =
    Number(row['ivaPorcentaje']) ||
    ivaPorcentajeDesdeCodigo(String(row['ivaCodigoPorcentaje'] ?? '4'));
  return lineTotalConIva(cant, pu, desc, ivaPct);
}

@Component({
  selector: 'ts-factura-lineas-tabulator',
  standalone: true,
  imports: [DecimalPipe, TsTabulatorLocalGridComponent],
  template: `
    <ts-tabulator-local-grid
      [data]="gridRows()"
      [columns]="columns()"
      [reloadNonce]="reloadNonce()"
      [height]="height()"
      emptyContext="invoiceLines"
      [editable]="true"
      (dataChange)="onDataChange($event)"
      (rowAction)="onRowAction($event)"
    />

    @if (preciosModal(); as modal) {
      <div
        class="modal fade show d-block ts-factura-precios-modal"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        (click)="cerrarPreciosModal()"
      >
        <div class="modal-dialog modal-dialog-centered modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h2 class="modal-title h6 mb-0">{{ t('invoice.priceListsTitle') }}</h2>
              <button type="button" class="btn-close" (click)="cerrarPreciosModal()" [attr.aria-label]="t('common.close')"></button>
            </div>
            <div class="modal-body p-0">
              @if (modal.options.length === 0) {
                <p class="text-muted small mb-0 p-3">{{ t('invoice.priceListsEmpty') }}</p>
              } @else {
                <ul class="list-group list-group-flush">
                  @for (opt of modal.options; track opt.listaCodigo) {
                    <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                      <span>
                        <span class="fw-medium">{{ opt.listaNombre || opt.listaCodigo }}</span>
                        <span class="text-muted small ms-1">({{ opt.listaCodigo }})</span>
                      </span>
                      <button type="button" class="btn btn-soft-primary btn-sm" (click)="aplicarPrecioLista(opt.precio)">
                        {{ opt.precio | number: '1.2-2' }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      :host ::ng-deep .tabulator-cell[tabulator-field='_accionAdicionales'],
      :host ::ng-deep .tabulator-cell[tabulator-field='_accionEliminar'] {
        padding: 0.35rem 0.25rem !important;
        overflow: visible;
        text-align: center;
      }
      :host ::ng-deep .ts-linea-action-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 2.25rem;
      }
      :host ::ng-deep .ts-linea-action-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        min-width: 2.25rem;
        min-height: 2.25rem;
        padding: 0;
        border-radius: 0.5rem;
        cursor: pointer;
        border: 1px solid transparent;
        flex-shrink: 0;
        line-height: 0;
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease,
          transform 0.1s ease;
      }
      :host ::ng-deep .ts-linea-action-btn svg {
        display: block;
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
      }
      :host ::ng-deep .ts-linea-action-btn:active {
        transform: scale(0.96);
      }
      :host ::ng-deep .ts-linea-action-btn--primary {
        border-color: rgba(var(--bs-primary-rgb), 0.25);
        background: rgba(var(--bs-primary-rgb), 0.08);
        color: var(--bs-primary);
      }
      :host ::ng-deep .ts-linea-action-btn--primary:hover {
        background: rgba(var(--bs-primary-rgb), 0.16);
      }
      :host ::ng-deep .ts-linea-action-btn--danger {
        border-color: rgba(var(--bs-danger-rgb), 0.25);
        background: rgba(var(--bs-danger-rgb), 0.08);
        color: var(--bs-danger);
      }
      :host ::ng-deep .ts-linea-action-btn--danger:hover {
        background: rgba(var(--bs-danger-rgb), 0.16);
      }
      :host ::ng-deep .ts-linea-action-badge {
        position: absolute;
        top: -0.35rem;
        right: -0.35rem;
        min-width: 1.1rem;
        height: 1.1rem;
        padding: 0 0.25rem;
        font-size: 0.65rem;
        line-height: 1.1rem;
      }
      :host ::ng-deep .tabulator {
        border: 1px solid var(--ef-surface-border, #cbd5e1);
        border-radius: 8px;
      }
      :host ::ng-deep .ts-factura-precio-cell {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.25rem;
        width: 100%;
      }
      :host ::ng-deep .ts-factura-precio-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.65rem;
        height: 1.65rem;
        padding: 0;
        border: 1px solid rgba(var(--bs-primary-rgb), 0.25);
        border-radius: 0.35rem;
        background: rgba(var(--bs-primary-rgb), 0.08);
        color: var(--bs-primary);
        cursor: pointer;
        flex-shrink: 0;
      }
      :host ::ng-deep .ts-factura-precio-btn:hover {
        background: rgba(var(--bs-primary-rgb), 0.16);
      }
      .ts-factura-precios-modal .modal-content {
        border-radius: 0.65rem;
      }
    `,
  ],
})
export class TsFacturaLineasTabulatorComponent {
  readonly lineas = input.required<FacturaLinea[]>();
  readonly itemsMaestro = input<ProductoServicio[]>([]);
  readonly reloadNonce = input(0);
  readonly height = input('420px');

  readonly lineasChange = output<FacturaLinea[]>();
  readonly eliminarLinea = output<string>();
  readonly solicitarDetallesAdicionales = output<string>();

  private readonly i18n = inject(UiI18nService);

  readonly preciosModal = signal<{ rowId: string; options: PrecioListaOption[] } | null>(null);

  readonly gridRows = computed(() =>
    this.lineas().map((l) => ({
      _rowId: l._rowId,
      productoId: l.productoId ?? '',
      codigoPrincipal: l.codigoPrincipal ?? '',
      descripcion: l.descripcion ?? '',
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      descuento: l.descuento,
      ivaPorcentaje: l.ivaPorcentaje,
      ivaCodigoPorcentaje: l.ivaCodigoPorcentaje ?? '4',
      detallesAdicionalesCount: contarDetallesAdicionales(
        l.detallesAdicionales,
        l.detallesAdicionalesHtml,
      ),
      subtotalLinea: lineSubtotal(l as unknown as Record<string, unknown>),
      totalLinea: lineTotal(l as unknown as Record<string, unknown>),
    })),
  );

  readonly productoValues = computed(() => {
    const values: Record<string, string> = { '': this.t('invoice.selectItem') };
    for (const p of this.itemsMaestro()) {
      values[p.id] = `${p.codigoPrincipal} — ${p.descripcion}`;
    }
    return values;
  });

  readonly ivaValues = computed(() => ({ ...IVA_CODIGO_OPTIONS }));

  readonly columns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const t = (key: string) => this.i18n.t(key);
    const productoLabels = this.productoValues();
    const ivaLabels = this.ivaValues();
    const numFmt =
      (fn: (v: unknown) => string) =>
      (cell: unknown) =>
        fn((cell as { getValue: () => unknown }).getValue());

    const productoFormatter = (cell: unknown) => {
      const id = String((cell as { getValue: () => unknown }).getValue() ?? '');
      if (!id) {
        return `<span class="text-muted">${escapeGridHtml(t('invoice.selectItem'))}</span>`;
      }
      return escapeGridHtml(productoLabels[id] ?? id);
    };

    const ivaFormatter = (cell: unknown) => {
      const cod = String((cell as { getValue: () => unknown }).getValue() ?? '4');
      return escapeGridHtml(ivaLabels[cod] ?? `${ivaPorcentajeDesdeCodigo(cod)}%`);
    };

    const precioFormatter = (cell: unknown) => {
      const c = cell as { getValue: () => unknown; getData: () => Record<string, unknown> };
      const row = c.getData();
      const val = formatMoney(c.getValue());
      const hasProduct = !!String(row['productoId'] ?? '').trim();
      const btn = hasProduct
        ? `<button type="button" class="ts-factura-precio-btn" data-ts-action="precios" title="${escapeGridHtml(t('invoice.priceListsTitle'))}" aria-label="${escapeGridHtml(t('invoice.priceListsTitle'))}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6H20V18H4V6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M8 10H16M8 14H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>`
        : '';
      return `<span class="ts-factura-precio-cell"><span>${val}</span>${btn}</span>`;
    };

    const adicionalesFormatter = (cell: unknown) => {
      const row = (cell as { getData: () => Record<string, unknown> }).getData();
      const count = Number(row['detallesAdicionalesCount'] ?? 0);
      const badge =
        count > 0
          ? `<span class="badge rounded-pill bg-primary ts-linea-action-badge">${count}</span>`
          : '';
      const detalleTitle = escapeGridHtml(t('invoice.lineAdditionalDetailsTitle'));
      return `<span class="ts-linea-action-cell"><button type="button" class="ts-linea-action-btn ts-linea-action-btn--primary" data-ts-action="adicionales" title="${detalleTitle}" aria-label="${detalleTitle}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 8H18M6 12H14M6 16H16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        ${badge}
      </button></span>`;
    };

    const eliminarFormatter = () => {
      const eliminarTitle = escapeGridHtml(t('invoice.removeLine'));
      return `<span class="ts-linea-action-cell"><button type="button" class="ts-linea-action-btn ts-linea-action-btn--danger" data-ts-action="eliminar" title="${eliminarTitle}" aria-label="${eliminarTitle}">
        ${gridActionIcon('delete')}
      </button></span>`;
    };

    return [
      {
        title: '',
        field: '_accionAdicionales',
        width: 52,
        minWidth: 52,
        headerSort: false,
        hozAlign: 'center',
        vertAlign: 'middle',
        resizable: false,
        formatter: adicionalesFormatter,
      },
      {
        title: '',
        field: '_accionEliminar',
        width: 52,
        minWidth: 52,
        headerSort: false,
        hozAlign: 'center',
        vertAlign: 'middle',
        resizable: false,
        formatter: eliminarFormatter,
      },
      {
        title: t('invoice.itemMaster'),
        field: 'productoId',
        minWidth: 200,
        editor: 'list',
        editorParams: { values: productoLabels, autocomplete: true, listOnEmpty: true },
        formatter: productoFormatter,
      },
      {
        title: t('masters.code'),
        field: 'codigoPrincipal',
        width: 110,
        editor: 'input',
      },
      {
        title: t('masters.description'),
        field: 'descripcion',
        minWidth: 160,
        editor: 'input',
      },
      {
        title: t('invoice.quantity'),
        field: 'cantidad',
        width: 100,
        hozAlign: 'right',
        editor: 'number',
        editorParams: { min: 0.000001, step: 0.000001 },
        formatter: numFmt(formatQty),
      },
      {
        title: t('invoice.unitPriceShort'),
        field: 'precioUnitario',
        width: 130,
        hozAlign: 'right',
        editor: 'number',
        editorParams: { min: 0, step: 0.01 },
        formatter: precioFormatter,
      },
      {
        title: t('invoice.discountShort'),
        field: 'descuento',
        width: 72,
        hozAlign: 'right',
        headerTooltip: t('invoice.discount'),
        editor: 'number',
        editorParams: { min: 0, step: 0.01 },
        formatter: numFmt(formatMoney),
      },
      {
        title: t('invoice.ivaRate'),
        field: 'ivaCodigoPorcentaje',
        width: 118,
        hozAlign: 'right',
        editor: 'list',
        editorParams: { values: ivaLabels },
        formatter: ivaFormatter,
      },
      {
        title: t('invoice.lineSubtotal'),
        field: 'subtotalLinea',
        width: 100,
        hozAlign: 'right',
        headerSort: false,
        formatter: numFmt(formatMoney),
      },
      {
        title: t('invoice.lineTotal'),
        field: 'totalLinea',
        width: 100,
        hozAlign: 'right',
        headerSort: false,
        formatter: numFmt(formatMoney),
      },
    ];
  });

  t(key: string, params?: Record<string, string | number>): string {
    return params ? this.i18n.t(key, params) : this.i18n.t(key);
  }

  onDataChange(rows: Record<string, unknown>[]): void {
    const prev = this.lineas();
    const mapped: FacturaLinea[] = rows.map((r) => {
      const rowId = String(r['_rowId'] ?? crypto.randomUUID());
      const old = prev.find((p) => p._rowId === rowId);
      const ivaCod = String(r['ivaCodigoPorcentaje'] ?? '4');
      return {
        _rowId: rowId,
        productoId: String(r['productoId'] ?? ''),
        codigoPrincipal: String(r['codigoPrincipal'] ?? ''),
        codigoAuxiliar: old?.codigoAuxiliar ?? '',
        descripcion: String(r['descripcion'] ?? ''),
        cantidad: Number(r['cantidad']) || 0,
        precioUnitario: Number(r['precioUnitario']) || 0,
        descuento: Number(r['descuento']) || 0,
        ivaCodigoPorcentaje: ivaCod,
        ivaPorcentaje: ivaPorcentajeDesdeCodigo(ivaCod),
        detallesAdicionales: old?.detallesAdicionales,
        detallesAdicionalesHtml: old?.detallesAdicionalesHtml,
      };
    });
    this.lineasChange.emit(mapped);
  }

  onRowAction(ev: { action: string; row: Record<string, unknown> }): void {
    if (ev.action === 'eliminar') {
      const id = String(ev.row['_rowId'] ?? '');
      if (id) {
        this.eliminarLinea.emit(id);
      }
      return;
    }
    if (ev.action === 'precios') {
      const rowId = String(ev.row['_rowId'] ?? '');
      const productoId = String(ev.row['productoId'] ?? '');
      if (rowId && productoId) {
        this.abrirPreciosModal(rowId, productoId);
      }
      return;
    }
    if (ev.action === 'adicionales') {
      const rowId = String(ev.row['_rowId'] ?? '');
      if (rowId) {
        this.solicitarDetallesAdicionales.emit(rowId);
      }
    }
  }

  abrirPreciosModal(rowId: string, productoId: string): void {
    const item = this.itemsMaestro().find((p) => p.id === productoId);
    if (!item) {
      return;
    }
    this.preciosModal.set({ rowId, options: this.preciosParaProducto(item) });
  }

  cerrarPreciosModal(): void {
    this.preciosModal.set(null);
  }

  aplicarPrecioLista(precio: number): void {
    const modal = this.preciosModal();
    if (!modal) {
      return;
    }
    const next = this.lineas().map((l) =>
      l._rowId === modal.rowId ? { ...l, precioUnitario: precio } : l,
    );
    this.lineasChange.emit(next);
    this.cerrarPreciosModal();
  }

  private preciosParaProducto(item: ProductoServicio): PrecioListaOption[] {
    const out: PrecioListaOption[] = [];
    const seen = new Set<string>();

    const push = (listaCodigo: string, listaNombre: string, precio: number | null | undefined) => {
      const code = listaCodigo.trim() || 'BASE';
      if (seen.has(code) || precio == null || !Number.isFinite(Number(precio))) {
        return;
      }
      seen.add(code);
      out.push({
        listaCodigo: code,
        listaNombre: listaNombre.trim() || code,
        precio: Number(precio),
      });
    };

    for (const row of item.preciosListas ?? []) {
      push(row.listaCodigo, row.listaNombre, row.precio);
    }

    const base = Number(item.precioUnitario ?? 0);
    if (base > 0) {
      push('BASE', this.t('invoice.priceListBase'), base);
    }

    return out.sort((a, b) => a.listaNombre.localeCompare(b.listaNombre, 'es'));
  }
}
