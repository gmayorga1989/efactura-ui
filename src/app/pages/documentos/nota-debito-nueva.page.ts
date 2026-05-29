import { DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

interface FacturaBusqueda {
  id: string;
  numeroComprobante: string;
  fechaEmision: string;
  razonSocialReceptor: string;
  identificacionReceptor: string;
  valorTotal: number;
  estadoSri: string;
}

@Component({
  selector: 'ts-nota-debito-nueva-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('invoice.debitNoteManualTitle')"
      [subtitle]="t('invoice.debitNoteManualSubtitle')"
      [eyebrow]="t('menu.sales')"
    >
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <a class="btn btn-light" [routerLink]="['/t', tenant.tenantSlug(), 'ventas', 'notas-debito']">
          {{ t('common.back') }}
        </a>
        <a class="btn btn-soft-primary" [routerLink]="['/t', tenant.tenantSlug(), 'facturas']">
          {{ t('invoice.title') }}
        </a>
      </div>

      <div class="alert alert-info border-0 mb-3">
        <h2 class="h6 mb-2">{{ t('invoice.debitNoteProcessTitle') }}</h2>
        <ol class="small mb-0 ps-3">
          <li>{{ t('invoice.debitNoteProcessStep1') }}</li>
          <li>{{ t('invoice.debitNoteProcessStep2') }}</li>
          <li>{{ t('invoice.debitNoteProcessStep3') }}</li>
        </ol>
      </div>

      <div class="border rounded p-3 mb-3">
        <h2 class="h6 mb-3">{{ t('invoice.debitNoteSearchInvoice') }}</h2>
        <form class="row g-2 align-items-end" (ngSubmit)="buscar()">
          <div class="col-md-4">
            <label class="form-label" for="nd-num">{{ t('documents.number') }}</label>
            <input
              id="nd-num"
              class="form-control"
              [(ngModel)]="numeroBusqueda"
              name="numeroBusqueda"
              placeholder="001-001-000000001"
            />
          </div>
          <div class="col-md-3">
            <button type="submit" class="btn btn-primary w-100" [disabled]="buscando()">
              {{ buscando() ? t('common.loading') : t('common.search') }}
            </button>
          </div>
        </form>
        <p class="text-muted small mt-2 mb-0">{{ t('invoice.debitNoteSearchHint') }}</p>
      </div>

      @if (buscando()) {
        <p class="text-muted">{{ t('common.loading') }}</p>
      } @else if (resultados().length === 0 && busquedaRealizada()) {
        <p class="text-muted mb-0">{{ t('invoice.debitNoteSearchEmpty') }}</p>
      } @else if (resultados().length > 0) {
        <div class="table-responsive border rounded">
          <table class="table table-sm table-hover mb-0">
            <thead>
              <tr>
                <th>{{ t('documents.number') }}</th>
                <th>{{ t('documents.date') }}</th>
                <th>{{ t('documents.receiver') }}</th>
                <th class="text-end">{{ t('documents.total') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (f of resultados(); track f.id) {
                <tr>
                  <td class="text-nowrap">{{ f.numeroComprobante }}</td>
                  <td>{{ f.fechaEmision }}</td>
                  <td>
                    <div>{{ f.razonSocialReceptor }}</div>
                    <div class="text-muted small">{{ f.identificacionReceptor }}</div>
                  </td>
                  <td class="text-end">{{ f.valorTotal | number: '1.2-2' }}</td>
                  <td class="text-end">
                    <button type="button" class="btn btn-primary btn-sm" (click)="continuar(f.id)">
                      {{ t('invoice.debitNoteContinue') }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </ts-page-layout>
  `,
})
export class NotaDebitoNuevaPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  numeroBusqueda = '';
  readonly buscando = signal(false);
  readonly busquedaRealizada = signal(false);
  readonly resultados = signal<FacturaBusqueda[]>([]);

  ngOnInit(): void {
    if (!readAccessToken() || !this.session.profile()?.empresaId) {
      return;
    }
    if (!this.session.puedeGestionarVentas()) {
      this.toast.warning(this.t('documents.permissionRequired'));
    }
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  buscar(): void {
    const q = this.numeroBusqueda.trim().toLowerCase();
    if (!q) {
      this.toast.warning(this.t('invoice.debitNoteSearchRequired'));
      return;
    }
    this.buscando.set(true);
    this.busquedaRealizada.set(false);
    const params = new HttpParams()
      .set('tipo', 'FACTURA')
      .set('estadoSri', 'AUTORIZADO')
      .set('page', '0')
      .set('size', '100');
    this.http
      .get<{ content: FacturaBusqueda[] }>('/api/web/v1/comprobantes', { params })
      .subscribe({
        next: (page) => {
          const rows = (page.content ?? []).filter((f) =>
            String(f.numeroComprobante ?? '')
              .toLowerCase()
              .includes(q),
          );
          this.resultados.set(rows);
          this.busquedaRealizada.set(true);
          this.buscando.set(false);
        },
        error: () => {
          this.resultados.set([]);
          this.busquedaRealizada.set(true);
          this.buscando.set(false);
          this.toast.error(this.t('common.error'));
        },
      });
  }

  continuar(facturaId: string): void {
    void this.router.navigate(['/t', this.tenant.tenantSlug(), 'facturas', facturaId, 'nota-debito']);
  }
}
