import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { SessionContextService } from '../../core/session/session-context.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

export interface MiPlanDto {
  planCodigo: string | null;
  limiteMensual: number | null;
  emitidosPeriodo: number;
  periodoDesde: string;
  periodoHasta: string;
  sinLimite: boolean;
  modulosActivos: Record<string, unknown>;
}

@Component({
  selector: 'ts-mi-plan-page',
  standalone: true,
  imports: [RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout [title]="t('plan.title')" [subtitle]="t('plan.subtitle')" [eyebrow]="t('plan.eyebrow')">
      @if (!tokenPresent || !tieneEmpresa) {
        <p class="text-warning mb-0">
          @if (!tokenPresent) {
            <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>
            {{ t('plan.signInHelp') }}
          } @else {
            {{ t('plan.selectCompany') }}
          }
        </p>
      } @else if (plan()) {
        <div class="row row-cols-1 row-cols-md-2 g-3 mb-4">
          <div class="col">
            <div class="border rounded p-3 h-100">
              <p class="text-muted small mb-1">{{ t('plan.title') }}</p>
              <h4 class="mb-0">{{ plan()!.planCodigo ?? '-' }}</h4>
            </div>
          </div>
          <div class="col">
            <div class="border rounded p-3 h-100">
              <p class="text-muted small mb-1">{{ t('plan.period') }}</p>
              <p class="mb-0">{{ plan()!.periodoDesde }} - {{ plan()!.periodoHasta }}</p>
            </div>
          </div>
          <div class="col">
            <div class="border rounded p-3 h-100">
              <p class="text-muted small mb-1">{{ t('plan.issuedMonth') }}</p>
              <h3 class="mb-0">{{ plan()!.emitidosPeriodo }}</h3>
              @if (plan()!.sinLimite) {
                <p class="text-muted small mb-0">{{ t('plan.noMonthlyLimit') }}</p>
              } @else {
                <p class="text-muted small mb-0">
                  {{ t('plan.limit') }}: <strong>{{ plan()!.limiteMensual }}</strong> {{ t('plan.documents') }}
                </p>
              }
            </div>
          </div>
          <div class="col">
            <div class="border rounded p-3 h-100">
              <p class="text-muted small mb-1">{{ t('plan.modulesConfig') }}</p>
              @if (moduloEntries().length === 0) {
                <p class="text-muted small mb-0">{{ t('plan.noFlags') }}</p>
              } @else {
                <ul class="list-unstyled small mb-0">
                  @for (e of moduloEntries(); track e[0]) {
                    <li>
                      <strong>{{ e[0] }}</strong>:
                      {{ e[1] }}
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        </div>
      }
    </ts-page-layout>
  `,
})
export class MiPlanPage {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);

  readonly tokenPresent = !!readAccessToken();
  readonly tieneEmpresa = !!this.session.profile()?.empresaId;

  readonly plan = signal<MiPlanDto | null>(null);

  readonly moduloEntries = signal<[string, string][]>([]);

  constructor() {
    if (!this.tokenPresent || !this.tieneEmpresa) {
      return;
    }
    this.http.get<MiPlanDto>('/api/web/v1/mi-plan').subscribe({
      next: (p) => {
        this.plan.set(p);
        const m = p.modulosActivos ?? {};
        this.moduloEntries.set(
          Object.entries(m).map(([k, v]) => [k, v == null ? '' : String(v)] as [string, string]),
        );
      },
      error: () => this.toast.error(this.t('plan.loadError')),
    });
  }

  t(key: string): string {
    return this.i18n.t(key);
  }
}
