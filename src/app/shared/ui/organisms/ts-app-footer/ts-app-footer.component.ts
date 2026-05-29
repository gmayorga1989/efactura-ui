import { Component, inject } from '@angular/core';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { SessionContextService } from '../../../../core/session/session-context.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';

@Component({
  selector: 'ts-app-footer',
  standalone: true,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
  template: `
    <footer class="footer">
      <div class="footer-body">
        <ul class="left-panel list-inline mb-0 p-0">
          <li class="list-inline-item">
            <span class="text-muted">{{ i18n.t('footer.tenant', { tenant: tenant.tenantSlug() }) }}</span>
          </li>
          @if (session.profile(); as p) {
            <li class="list-inline-item"><span class="text-muted">{{ p.email }}</span></li>
          }
        </ul>
        <div class="right-panel">
          {{ i18n.t('footer.templateCredit', { year: year }) }}
          <a href="https://templates.iqonic.design/hope-ui/html/dist/" target="_blank" rel="noopener noreferrer">
            Hope UI
          </a>
        </div>
      </div>
    </footer>
  `,
})
export class TsAppFooterComponent {
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);
  readonly i18n = inject(UiI18nService);
  readonly year = new Date().getFullYear();
}
