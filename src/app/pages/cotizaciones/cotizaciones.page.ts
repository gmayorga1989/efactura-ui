import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { ColumnDefinition } from 'tabulator-tables';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { htmlBadgeEstadoCotizacion } from '../../shared/ui/cotizacion-estado.util';
import { gridActionsMenu } from '../../shared/ui/grid-actions.util';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';
import { TsTabulatorSpringGridComponent } from '../../shared/ui/organisms/ts-tabulator-spring-grid/ts-tabulator-spring-grid.component';
import {
  TABULATOR_FROZEN_PROPS,
  tabulatorCellValue,
  tabulatorCodeCell,
  tabulatorFechaCell,
  tabulatorMoneyCell,
  tabulatorTextareaCell,
} from '../../shared/ui/tabulator-formatters.util';
import { CotizacionesService } from './cotizaciones.service';

@Component({
  selector: 'ts-cotizaciones-page',
  standalone: true,
  imports: [RouterLink, TsPageLayoutComponent, TsTabulatorSpringGridComponent],
  template: `
    <ts-page-layout [title]="t('quotation.title')" [subtitle]="t('quotation.listSubtitle')" [eyebrow]="t('menu.sales')">
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-primary" [routerLink]="['/t', tenant.tenantSlug(), 'ventas', 'cotizaciones', 'nueva']">
          {{ t('quotation.new') }}
        </a>
        <a class="btn btn-outline-secondary" [routerLink]="['/t', tenant.tenantSlug(), 'ventas', 'vendedores']">
          {{ t('salespeople.title') }}
        </a>
        <button type="button" class="btn btn-soft-primary" (click)="refrescar()">{{ t('common.refresh') }}</button>
      </div>

      <ts-tabulator-spring-grid
        ajaxUrl="/api/web/v1/ventas/cotizaciones"
        [pageSize]="20"
        height="min(620px, calc(100vh - 15.5rem))"
        [columns]="columns()"
        [reloadNonce]="gridNonce()"
        emptyContext="quotations"
        [frozenColumns]="2"
        (rowAction)="onRowAction($event)"
      />
    </ts-page-layout>
  `,
})
export class CotizacionesPage implements OnInit {
  readonly tenant = inject(TenantContextService);
  readonly i18n = inject(UiI18nService);
  private readonly cotizaciones = inject(CotizacionesService);
  private readonly router = inject(Router);

  readonly gridNonce = signal(0);

  readonly columns = computed<ColumnDefinition[]>(() => {
    this.i18n.language();
    const t = (k: string) => this.t(k);
    return [
      {
        title: '',
        field: 'id',
        width: 80,
        headerSort: false,
        hozAlign: 'center',
        ...TABULATOR_FROZEN_PROPS,
        formatter: () =>
          gridActionsMenu(
            [
              { action: 'edit', label: t('common.edit'), icon: 'edit' },
              { action: 'preview', label: t('quotation.preview'), icon: 'view' },
            ],
            t('common.actions'),
          ),
      },
      {
        title: t('quotation.number'),
        field: 'numero',
        width: 130,
        ...TABULATOR_FROZEN_PROPS,
        formatter: (cell: unknown) => tabulatorCodeCell(cell),
      },
      {
        title: t('documents.date'),
        field: 'fechaEmision',
        width: 118,
        formatter: (cell: unknown) => tabulatorFechaCell(tabulatorCellValue(cell)),
      },
      {
        title: t('documents.receiver'),
        field: 'razonSocialReceptor',
        minWidth: 200,
        formatter: (cell: unknown) => tabulatorTextareaCell(tabulatorCellValue(cell)),
      },
      {
        title: t('salespeople.label'),
        field: 'vendedorNombre',
        minWidth: 150,
        formatter: (cell: unknown) => tabulatorTextareaCell(tabulatorCellValue(cell) || '—'),
      },
      {
        title: t('documents.total'),
        field: 'valorTotal',
        hozAlign: 'right',
        width: 120,
        formatter: (cell: unknown) => tabulatorMoneyCell(tabulatorCellValue(cell)),
      },
      {
        title: t('common.status'),
        field: 'estado',
        width: 150,
        formatter: (cell: unknown) => htmlBadgeEstadoCotizacion(String(tabulatorCellValue(cell) ?? ''), t),
      },
    ];
  });

  ngOnInit(): void {
    this.i18n.initializeFromProfileOnce();
  }

  refrescar(): void {
    this.gridNonce.update((n) => n + 1);
  }

  onRowAction(event: { action: string; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    if (!id) {
      return;
    }
    if (event.action === 'edit') {
      void this.router.navigate(['/t', this.tenant.tenantSlug(), 'ventas', 'cotizaciones', 'editar', id]);
      return;
    }
    if (event.action === 'preview') {
      window.open(this.cotizaciones.previewUrl(id), '_blank', 'noopener,noreferrer');
    }
  }

  t(key: string): string {
    return this.i18n.t(key);
  }
}
