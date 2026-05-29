import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { readAccessToken } from '../../core/auth.interceptor';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

interface ApiKeyRow {
  id: string;
  nombre: string;
  prefix: string;
  scopes: string[];
  estado: string;
  fechaExpiracion: string | null;
  ultimoUso: string | null;
  fechaCreacion: string;
}

@Component({
  selector: 'ts-api-keys-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TsPageLayoutComponent],
  template: `
    <ts-page-layout
      [title]="t('apiKeys.title')"
      [subtitle]="t('apiKeys.subtitle')"
      [eyebrow]="t('apiKeys.eyebrow')"
    >
      <div page-actions>
        <button type="button" class="btn btn-soft-primary" (click)="reload()" [disabled]="!tokenPresent || loading">
          {{ t('common.refresh') }}
        </button>
      </div>

      @if (!tokenPresent) {
        <p class="text-warning">
          {{ t('common.noSession') }} <a [routerLink]="['/t', tenant.tenantSlug(), 'login']">{{ t('common.signIn') }}</a>.
        </p>
      } @else {
        <div class="border rounded p-3 mb-4">
          <h5>{{ t('apiKeys.newKey') }}</h5>
          <form (ngSubmit)="crear()" class="row g-2 align-items-end">
            <div class="col-md">
              <label class="form-label visually-hidden" for="apikey-nombre">{{ t('apiKeys.name') }}</label>
              <input
                id="apikey-nombre"
                type="text"
                class="form-control"
                [(ngModel)]="nombre"
                name="nombre"
                [placeholder]="t('apiKeys.namePlaceholder')"
              />
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-primary" [disabled]="loading">{{ t('common.create') }}</button>
            </div>
          </form>
          @if (plainKey) {
            <p class="alert alert-info mt-3 mb-0 small">
              <strong>{{ t('apiKeys.copyNow') }}</strong><br />
              <code class="user-select-all">{{ plainKey }}</code>
            </p>
          }
        </div>

        <div class="border rounded p-3">
          <h5>{{ t('apiKeys.existing') }}</h5>
          @if (keys.length === 0) {
            <p class="text-muted mb-0">{{ t('apiKeys.empty') }}</p>
          } @else {
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>{{ t('apiKeys.name') }}</th>
                    <th>{{ t('apiKeys.prefix') }}</th>
                    <th>{{ t('common.status') }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (k of keys; track k.id) {
                    <tr>
                      <td>{{ k.nombre }}</td>
                      <td><code>{{ k.prefix }}</code></td>
                      <td>{{ k.estado }}</td>
                      <td>
                        @if (k.estado === 'ACTIVA') {
                          <button type="button" class="btn btn-link btn-sm text-danger p-0" (click)="revocar(k.id)">
                            {{ t('apiKeys.revoke') }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </ts-page-layout>
  `,
})
export class ApiKeysPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);
  readonly tenant = inject(TenantContextService);

  keys: ApiKeyRow[] = [];
  nombre = '';
  plainKey = '';
  loading = false;
  tokenPresent = false;

  ngOnInit(): void {
    this.tokenPresent = !!readAccessToken();
    if (this.tokenPresent) {
      this.reload();
    }
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  reload(): void {
    this.http.get<ApiKeyRow[]>('/api/web/v1/api-keys').subscribe({
      next: (rows) => (this.keys = rows),
      error: () => {
        this.toast.error(this.t('apiKeys.loadError'));
        void this.router.navigate(['/t', this.tenant.tenantSlug(), 'login']);
      },
    });
  }

  crear(): void {
    this.plainKey = '';
    this.loading = true;
    this.http
      .post<{ plainKey: string }>('/api/web/v1/api-keys', {
        nombre: this.nombre.trim() || undefined,
        scopes: ['FACTURA_EMITIR'],
      })
      .subscribe({
        next: (res) => {
          this.plainKey = res.plainKey;
          this.nombre = '';
          this.loading = false;
          this.reload();
        },
        error: () => {
          this.loading = false;
          this.toast.error(this.t('apiKeys.createError'));
        },
      });
  }

  revocar(id: string): void {
    this.http.post(`/api/web/v1/api-keys/${id}/revocar`, {}).subscribe({
      next: () => this.reload(),
      error: () => this.toast.error(this.t('apiKeys.revokeError')),
    });
  }
}
