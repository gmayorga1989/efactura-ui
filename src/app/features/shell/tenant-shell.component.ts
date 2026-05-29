import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SessionContextService } from '../../core/session/session-context.service';
import { SessionWorkflowService } from '../../core/session/session-workflow.service';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { PresenceService } from '../../core/session/presence.service';
import { TsAppFooterComponent } from '../../shared/ui/organisms/ts-app-footer/ts-app-footer.component';
import { TsAppNavbarComponent } from '../../shared/ui/organisms/ts-app-navbar/ts-app-navbar.component';
import { TsAppSidebarComponent } from '../../shared/ui/organisms/ts-app-sidebar/ts-app-sidebar.component';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

@Component({
  selector: 'ts-tenant-shell',
  standalone: true,
  imports: [RouterOutlet, TsAppSidebarComponent, TsAppNavbarComponent, TsAppFooterComponent],
  template: `
    <ts-app-sidebar />
    <main class="main-content ts-main-content">
      <div class="position-relative iq-banner">
        <ts-app-navbar (logout)="onLogout()" />
        @if (isHome()) {
        <div class="iq-navbar-header tenant-hero tenant-hero--home">
          <div class="container-fluid iq-container">
            <div class="row">
              <div class="col-md-12">
                <div class="flex-wrap d-flex justify-content-between align-items-center gap-3">
                  <div>
                    <h1>{{ homeHeaderTitle() }}</h1>
                    <p>{{ homeHeaderSubtitle() }}</p>
                  </div>
                  <button type="button" class="btn btn-link btn-soft-light">
                    <svg class="icon-20" width="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M11.8251 15.2171H12.1748C14.0987 15.2171 15.731 13.985 16.3054 12.2764C16.3887 12.0276 16.1979 11.7713 15.9334 11.7713H14.8562C14.5133 11.7713 14.2362 11.4977 14.2362 11.16C14.2362 10.8213 14.5133 10.5467 14.8562 10.5467H15.9005C16.2463 10.5467 16.5263 10.2703 16.5263 9.92875C16.5263 9.58722 16.2463 9.31075 15.9005 9.31075H14.8562C14.5133 9.31075 14.2362 9.03619 14.2362 8.69849C14.2362 8.35984 14.5133 8.08528 14.8562 8.08528H15.9005C16.2463 8.08528 16.5263 7.8088 16.5263 7.46728C16.5263 7.12575 16.2463 6.84928 15.9005 6.84928H14.8562C14.5133 6.84928 14.2362 6.57472 14.2362 6.23606C14.2362 5.89837 14.5133 5.62381 14.8562 5.62381H15.9886C16.2483 5.62381 16.4343 5.3789 16.3645 5.13113C15.8501 3.32401 14.1694 2 12.1748 2H11.8251C9.42172 2 7.47363 3.92287 7.47363 6.29729V10.9198C7.47363 13.2933 9.42172 15.2171 11.8251 15.2171Z"
                        fill="currentColor"
                      />
                      <path
                        opacity="0.4"
                        d="M19.5313 9.82568C18.9966 9.82568 18.5626 10.2533 18.5626 10.7823C18.5626 14.3554 15.6186 17.2627 12.0005 17.2627C8.38136 17.2627 5.43743 14.3554 5.43743 10.7823C5.43743 10.2533 5.00345 9.82568 4.46872 9.82568C3.93398 9.82568 3.5 10.2533 3.5 10.7823C3.5 15.0873 6.79945 18.6413 11.0318 19.1186V21.0434C11.0318 21.5715 11.4648 22.0001 12.0005 22.0001C12.5352 22.0001 12.9692 21.5715 12.9692 21.0434V19.1186C17.2006 18.6413 20.5 15.0873 20.5 10.7823C20.5 10.2533 20.066 9.82568 19.5313 9.82568Z"
                        fill="currentColor"
                      />
                    </svg>
                    {{ i18n.t('shell.notices') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="iq-header-img">
            <img
              src="assets/vendor/hope-ui/images/dashboard/top-header.png"
              alt=""
              class="theme-color-default-img img-fluid w-100 h-100 animated-scaleX"
            />
          </div>
        </div>
        }
      </div>
      <div class="container-fluid content-inner ts-content-inner" [class.mt-n5]="isHome()" [class.tenant-content--compact]="!isHome()">
        <router-outlet />
      </div>
      <ts-app-footer />
    </main>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .ts-main-content {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .ts-main-content > .position-relative {
        flex: 0 0 auto;
      }

      .ts-content-inner {
        flex: 1 0 auto;
      }

      .tenant-hero {
        position: relative;
        height: 170px;
        min-height: 170px;
      }

      .tenant-hero .iq-container {
        position: relative;
        z-index: 2;
        padding-top: 1.25rem;
        padding-bottom: 1.25rem;
      }

      .tenant-hero h1 {
        margin-bottom: 0.35rem;
        font-size: clamp(1.45rem, 2vw, 1.9rem);
        line-height: 1.18;
      }

      .tenant-hero p {
        margin-bottom: 0;
      }

      .tenant-hero .btn {
        white-space: nowrap;
      }

      .tenant-hero .iq-header-img {
        height: 170px;
      }

      .tenant-content--compact {
        margin-top: 0;
        padding-top: 3.6rem !important;
        padding-bottom: 1.5rem !important;
      }

      ts-app-footer {
        flex: 0 0 auto;
        margin-top: auto;
      }

    `,
  ],
})
export class TenantShellComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly tenant = inject(TenantContextService);
  private readonly session = inject(SessionContextService);
  private readonly workflow = inject(SessionWorkflowService);
  private readonly presence = inject(PresenceService);
  readonly i18n = inject(UiI18nService);

  readonly currentUrl = signal(this.router.url);
  readonly isHome = computed(() => /\/(dashboard|inicio)(?:[?#].*)?$/.test(this.currentUrl()));
  readonly homeHeaderTitle = computed(() => this.i18n.t('shell.homeGreeting', { nombre: this.session.displayName() }));
  readonly homeHeaderSubtitle = computed(
    () => this.i18n.t('shell.homeSubtitle', { empresa: this.tenant.displayName() }),
  );

  constructor() {
    this.i18n.initializeFromProfileOnce();
    this.presence.start();
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    this.presence.stop();
  }

  onLogout(): void {
    this.presence.stop();
    this.workflow.logoutServer().subscribe({
      complete: () => {
        this.session.clearMe();
        const slug = this.tenant.tenantSlug();
        void this.router.navigate(['/t', slug, 'login']);
      },
    });
  }
}
