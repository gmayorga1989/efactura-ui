import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

@Component({
  selector: 'ts-coming-soon',
  standalone: true,
  imports: [RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout [title]="title()" [eyebrow]="t('coming.eyebrow')" [subtitle]="subtitle()">
      <p class="text-muted mb-3">{{ t('coming.message') }}</p>
      <a [routerLink]="['/t', tenant.tenantSlug(), 'dashboard']" class="btn btn-primary btn-sm">
        {{ t('coming.backHome') }}
      </a>
    </ts-page-layout>
  `,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(UiI18nService);
  readonly tenant = inject(TenantContextService);

  private readonly dataTitle = toSignal(
    this.route.data.pipe(map((d) => (typeof d['title'] === 'string' ? d['title'] : this.i18n.t('coming.defaultTitle')))),
    { initialValue: this.i18n.t('coming.defaultTitle') },
  );

  readonly title = computed(() => this.dataTitle());
  readonly subtitle = computed(() => this.i18n.t('coming.tenantSubtitle', { tenant: this.tenant.tenantSlug() }));

  t(key: string): string {
    return this.i18n.t(key);
  }
}
