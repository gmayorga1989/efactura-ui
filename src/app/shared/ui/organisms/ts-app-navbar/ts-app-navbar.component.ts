import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LuxThemeService } from '../../../../core/theme/lux-theme.service';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { ShellLayoutService } from '../../../../core/shell/shell-layout.service';
import type { MiEmpresaResumenDto } from '../../../../core/models/me.model';
import { extractApiErrorMessage } from '../../../../core/session/http-error.util';
import { SessionContextService } from '../../../../core/session/session-context.service';
import { SessionWorkflowService } from '../../../../core/session/session-workflow.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';

@Component({
  selector: 'ts-app-navbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="nav navbar navbar-expand-xl navbar-light iq-navbar">
      <div class="container-fluid navbar-inner ts-navbar-inner">
        <div class="nav-item dropdown ts-empresa-dropdown">
          <button
            type="button"
            class="ts-empresa-chip"
            id="empresa-menu"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            [attr.aria-label]="t('navbar.switchContext')"
          >
            <span class="ts-empresa-chip__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  opacity="0.4"
                  d="M2 22H22"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M17 2H7C4.24 2 2 4.24 2 7V17C2 19.76 4.24 22 7 22H17C19.76 22 22 19.76 22 17V7C22 4.24 19.76 2 17 2Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path d="M7 9.5H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M7 14.5H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="ts-empresa-chip__text">
              <span class="ts-empresa-chip__eyebrow">{{ t('navbar.currentCompany') }}</span>
              <span class="ts-empresa-chip__name">{{ contextoActualLabel() }}</span>
            </span>
            <span class="ts-empresa-chip__chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </button>
          <div class="dropdown-menu ts-navbar-panel ts-navbar-panel--empresa" aria-labelledby="empresa-menu">
            <div class="ts-navbar-panel__header">
              <span>{{ t('navbar.currentContext') }}</span>
              <strong>{{ contextoActualLabel() }}</strong>
              @if (contextoActualRuc()) {
                <small>RUC {{ contextoActualRuc() }}</small>
              }
            </div>
            @if (switchError()) {
              <div class="ts-navbar-panel__error">{{ switchError() }}</div>
            }
            <div class="ts-navbar-panel__section-title">{{ t('navbar.switchCompany') }}</div>
            <div class="ts-navbar-panel__list">
              @for (row of switchTargets(); track row.membresiaId) {
                <button
                  type="button"
                  class="ts-navbar-panel__item"
                  [disabled]="switching()"
                  (click)="onSwitchEmpresa(row)"
                >
                  <span class="ts-navbar-panel__item-title">{{ etiquetaEmpresa(row) }}</span>
                  @if (row.ruc && !row.esPlataforma) {
                    <span class="ts-navbar-panel__item-meta">RUC {{ row.ruc }}</span>
                  }
                </button>
              }
              @if (switchTargets().length === 0) {
                <p class="ts-navbar-panel__empty">{{ t('navbar.noContexts') }}</p>
              }
            </div>
          </div>
        </div>

        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          [attr.aria-label]="t('navbar.toggleNavigation')"
        >
          <span class="navbar-toggler-icon">
            <span class="mt-2 navbar-toggler-bar bar1"></span>
            <span class="navbar-toggler-bar bar2"></span>
            <span class="navbar-toggler-bar bar3"></span>
          </span>
        </button>

        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="mb-2 navbar-nav ms-auto align-items-center navbar-list mb-lg-0">
            <li class="nav-item d-none d-md-flex ts-navbar-theme-item">
              <button
                type="button"
                class="ts-navbar-icon-btn ts-theme-toggle"
                (click)="luxTheme.toggleTheme()"
                [attr.aria-label]="luxTheme.theme() === 'dark' ? 'Modo claro' : 'Modo nocturno'"
              >
                {{ luxTheme.theme() === 'dark' ? '☀' : '☾' }}
              </button>
            </li>

            <li class="nav-item ts-navbar-search d-none d-xl-flex">
              <div class="input-group search-input">
                <span class="input-group-text" id="search-input">
                  <svg class="icon-18" width="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="11.7669" cy="11.7666" r="8.98856" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M18.0186 18.4851L21.5426 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <input type="search" class="form-control" [placeholder]="t('navbar.searchPlaceholder')" [attr.aria-label]="t('navbar.searchAria')" />
              </div>
            </li>

            <li class="nav-item dropdown">
              <button
                type="button"
                class="ts-navbar-icon-btn"
                id="notification-drop"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                [attr.aria-label]="t('navbar.notifications')"
              >
                <svg class="icon-22" width="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path
                    d="M19.7695 11.6453C19.039 10.7923 18.7071 10.0531 18.7071 8.79716V8.37013C18.7071 6.73354 18.3304 5.67907 17.5115 4.62459C16.2493 2.98699 14.1244 2 12.0442 2H11.9558C9.91935 2 7.86106 2.94167 6.577 4.5128C5.71333 5.58842 5.29293 6.68822 5.29293 8.37013V8.79716C5.29293 10.0531 4.98284 10.7923 4.23049 11.6453C3.67691 12.2738 3.5 13.0815 3.5 13.9557C3.5 14.8309 3.78723 15.6598 4.36367 16.3336C5.11602 17.1413 6.17846 17.6569 7.26375 17.7466C8.83505 17.9258 10.4063 17.9933 12.0005 17.9933C13.5937 17.9933 15.165 17.8805 16.7372 17.7466C17.8215 17.6569 18.884 17.1413 19.6363 16.3336C20.2118 15.6598 20.5 14.8309 20.5 13.9557C20.5 13.0815 20.3231 12.2738 19.7695 11.6453Z"
                    fill="currentColor"
                  />
                  <path
                    opacity="0.4"
                    d="M14.0088 19.2283C13.5088 19.1215 10.4627 19.1215 9.96275 19.2283C9.53539 19.327 9.07324 19.5566 9.07324 20.0602C9.09809 20.5406 9.37935 20.9646 9.76895 21.2335L9.76795 21.2345C10.2718 21.6273 10.8632 21.877 11.4824 21.9667C11.8123 22.012 12.1482 22.01 12.4901 21.9667C13.1083 21.877 13.6997 21.6273 14.2036 21.2345L14.2026 21.2335C14.5922 20.9646 14.8734 20.5406 14.8983 20.0602C14.8983 19.5566 14.4361 19.327 14.0088 19.2283Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div class="dropdown-menu dropdown-menu-end ts-navbar-panel" aria-labelledby="notification-drop">
                <div class="ts-navbar-panel__header ts-navbar-panel__header--notifications">
                  <h6>{{ t('navbar.notifications') }}</h6>
                </div>
                <div class="ts-navbar-panel__body ts-navbar-panel__body--empty">
                  <span class="ts-navbar-panel__empty-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M19.7695 11.6453C19.039 10.7923 18.7071 10.0531 18.7071 8.79716V8.37013C18.7071 6.73354 18.3304 5.67907 17.5115 4.62459C16.2493 2.98699 14.1244 2 12.0442 2H11.9558C9.91935 2 7.86106 2.94167 6.577 4.5128C5.71333 5.58842 5.29293 6.68822 5.29293 8.37013V8.79716C5.29293 10.0531 4.98284 10.7923 4.23049 11.6453C3.67691 12.2738 3.5 13.0815 3.5 13.9557C3.5 14.8309 3.78723 15.6598 4.36367 16.3336C5.11602 17.1413 6.17846 17.6569 7.26375 17.7466C8.83505 17.9258 10.4063 17.9933 12.0005 17.9933C13.5937 17.9933 15.165 17.8805 16.7372 17.7466C17.8215 17.6569 18.884 17.1413 19.6363 16.3336C20.2118 15.6598 20.5 14.8309 20.5 13.9557C20.5 13.0815 20.3231 12.2738 19.7695 11.6453Z"
                        fill="currentColor"
                        opacity="0.35"
                      />
                    </svg>
                  </span>
                  <p>{{ t('navbar.noNotifications') }}</p>
                </div>
              </div>
            </li>

            <li class="nav-item dropdown custom-drop">
              <button
                type="button"
                class="py-0 nav-link d-flex align-items-center btn btn-link user-menu-toggle"
                id="navbarDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                [attr.aria-label]="t('navbar.userMenu')"
              >
                <span class="user-initials-avatar" aria-hidden="true">
                  @if (session.profile()?.avatarUrl) {
                    <img [src]="session.profile()?.avatarUrl || ''" alt="" />
                  } @else {
                    {{ userInitials() }}
                  }
                  <span class="user-presence-dot" [class.user-presence-dot--online]="session.profile()?.enLinea"></span>
                </span>
              </button>
              <div class="dropdown-menu dropdown-menu-end user-account-menu" aria-labelledby="navbarDropdown">
                <div class="user-account-card">
                  <div class="user-account-card__header">
                    <span class="user-account-card__avatar" aria-hidden="true">
                      @if (session.profile()?.avatarUrl) {
                        <img [src]="session.profile()?.avatarUrl || ''" alt="" />
                      } @else {
                        {{ userInitials() }}
                      }
                      <span class="user-presence-dot" [class.user-presence-dot--online]="session.profile()?.enLinea"></span>
                    </span>
                    <div class="user-account-card__identity">
                      <h6>{{ session.displayName() }}</h6>
                      <p>{{ session.profile()?.email || t('navbar.userFallback') }}</p>
                    </div>
                  </div>
                  <div class="user-account-card__context">
                    <span>{{ t('navbar.context') }}</span>
                    <strong>{{ contextoActualLabel() }}</strong>
                  </div>
                  <div class="user-account-card__presence" [class.user-account-card__presence--online]="session.profile()?.enLinea">
                    <span class="user-account-card__presence-dot"></span>
                    <div>
                      <strong>{{ session.profile()?.enLinea ? t('common.online') : t('common.offline') }}</strong>
                      @if (session.profile()?.ultimoPing) {
                        <small>{{ t('common.lastActivity') }}: {{ session.profile()?.ultimoPing }}</small>
                      }
                    </div>
                  </div>
                  <div class="user-account-card__actions">
                    <a class="user-account-action" [routerLink]="profileLink()">
                      <span class="user-account-action__icon" aria-hidden="true">
                        <svg width="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" />
                          <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                        </svg>
                      </span>
                      <span>{{ t('navbar.myProfile') }}</span>
                    </a>
                    <button type="button" class="user-account-action user-account-action--danger" (click)="logout.emit()">
                      <span class="user-account-action__icon" aria-hidden="true">
                        <svg width="16" viewBox="0 0 24 24" fill="none">
                          <path d="M10 17l5-5-5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M15 12H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                          <path d="M15 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                        </svg>
                      </span>
                      <span>{{ t('navbar.logout') }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `,
  styles: [
    `
      .ts-navbar-inner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.65rem;
      }

      .ts-empresa-dropdown {
        margin: 0;
        max-width: min(100%, 22rem);
      }

      .ts-empresa-chip {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        max-width: 100%;
        min-height: 2.45rem;
        padding: 0.35rem 0.65rem 0.35rem 0.5rem;
        border: 1px solid var(--ef-surface-border);
        border-radius: 12px;
        background: color-mix(in srgb, var(--card) 92%, transparent);
        color: var(--text);
        text-align: left;
      }

      .ts-empresa-chip:hover,
      .ts-empresa-chip:focus-visible {
        border-color: color-mix(in srgb, var(--lux-indigo) 35%, var(--ef-surface-border));
        background: var(--ef-primary-soft);
        color: var(--lux-primary-strong);
      }

      .ts-empresa-chip__icon {
        display: grid;
        place-items: center;
        flex: 0 0 32px;
        width: 32px;
        height: 32px;
        color: var(--lux-primary-strong, #1d4ed8);
        background: var(--ef-surface-raised, #fff);
        border: 1px solid color-mix(in srgb, var(--lux-indigo) 18%, var(--ef-surface-border, #dbeafe));
        border-radius: 10px;
      }

      .ts-empresa-chip__text {
        display: grid;
        gap: 0.05rem;
        min-width: 0;
        flex: 1 1 auto;
      }

      .ts-empresa-chip__eyebrow {
        color: #64748b;
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .ts-empresa-chip__name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.86rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .ts-empresa-chip__chevron {
        flex: 0 0 auto;
        color: #64748b;
      }

      .ts-navbar-theme-item {
        margin-right: 0.55rem;
      }

      .ts-theme-toggle {
        font-size: 1.05rem;
        line-height: 1;
      }

      .ts-navbar-search .search-input {
        min-width: 12rem;
        max-width: 16rem;
      }

      .ts-navbar-icon-btn {
        display: grid;
        place-items: center;
        width: 2.45rem;
        height: 2.45rem;
        padding: 0;
        border: 1px solid transparent;
        border-radius: 12px;
        color: #1d4ed8;
        background: transparent;
      }

      .ts-navbar-icon-btn:hover,
      .ts-navbar-icon-btn:focus-visible {
        border-color: #dbeafe;
        background: #eff6ff;
      }

      .ts-navbar-panel {
        width: min(92vw, 320px);
        padding: 0;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 22px 56px rgba(15, 23, 42, 0.18);
        overflow: hidden;
      }

      .ts-navbar-panel--empresa {
        margin-top: 0.35rem;
      }

      .ts-navbar-panel__header {
        display: grid;
        gap: 0.12rem;
        padding: 0.85rem 0.95rem;
        background: var(--ef-surface-raised, #f8fafc);
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
      }

      .ts-navbar-panel__header span {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .ts-navbar-panel__header strong {
        color: #0f172a;
        font-size: 0.92rem;
        font-weight: 750;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ts-navbar-panel__header small {
        color: #64748b;
        font-size: 0.76rem;
      }

      .ts-navbar-panel__header--notifications {
        background: #fff;
      }

      .ts-navbar-panel__header--notifications h6 {
        margin: 0;
        color: #0f172a;
        font-size: 0.92rem;
        font-weight: 750;
      }

      .ts-navbar-panel__section-title {
        padding: 0.65rem 0.95rem 0.35rem;
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .ts-navbar-panel__error {
        padding: 0.5rem 0.95rem;
        color: #dc2626;
        font-size: 0.78rem;
        background: #fef2f2;
        border-bottom: 1px solid #fecaca;
      }

      .ts-navbar-panel__list {
        display: grid;
        gap: 0.2rem;
        padding: 0 0.55rem 0.65rem;
      }

      .ts-navbar-panel__item {
        display: grid;
        gap: 0.08rem;
        width: 100%;
        padding: 0.55rem 0.65rem;
        border: 0;
        border-radius: 10px;
        color: #334155;
        background: transparent;
        text-align: left;
      }

      .ts-navbar-panel__item:hover:not(:disabled),
      .ts-navbar-panel__item:focus-visible:not(:disabled) {
        color: #1d4ed8;
        background: #eff6ff;
      }

      .ts-navbar-panel__item:disabled {
        opacity: 0.6;
      }

      .ts-navbar-panel__item-title {
        font-size: 0.86rem;
        font-weight: 650;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ts-navbar-panel__item-meta {
        color: #64748b;
        font-size: 0.74rem;
      }

      .ts-navbar-panel__body--empty {
        display: grid;
        justify-items: center;
        gap: 0.45rem;
        padding: 1.15rem 1rem 1.25rem;
        text-align: center;
      }

      .ts-navbar-panel__empty-icon {
        display: grid;
        place-items: center;
        width: 3rem;
        height: 3rem;
        color: #94a3b8;
        background: #f1f5f9;
        border-radius: 999px;
      }

      .ts-navbar-panel__body--empty p,
      .ts-navbar-panel__empty {
        margin: 0;
        color: #64748b;
        font-size: 0.82rem;
      }

      .user-menu-toggle {
        min-height: 2.6rem;
        padding-inline: 0.2rem !important;
      }
      .user-initials-avatar,
      .user-account-card__avatar {
        position: relative;
        display: grid;
        place-items: center;
        color: #1d4ed8;
        background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
        border: 1px solid #bfdbfe;
        border-radius: 999px;
        font-weight: 800;
        letter-spacing: 0;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }
      .user-initials-avatar img,
      .user-account-card__avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }
      .user-presence-dot {
        position: absolute;
        right: -2px;
        bottom: -1px;
        width: 0.68rem;
        height: 0.68rem;
        border: 2px solid #fff;
        border-radius: 999px;
        background: #94a3b8;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16);
        z-index: 2;
      }
      .user-presence-dot--online {
        background: #22c55e;
      }
      .user-initials-avatar {
        width: 40px;
        height: 40px;
        font-size: 0.9rem;
      }
      .user-menu-toggle:hover .user-initials-avatar,
      .user-menu-toggle:focus-visible .user-initials-avatar {
        color: #1e40af;
        border-color: #93c5fd;
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.16);
      }
      .user-account-menu {
        width: 310px;
        padding: 0;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 22px 56px rgba(15, 23, 42, 0.18);
        overflow: hidden;
      }
      .user-account-card {
        padding: 0.85rem;
        background: var(--card, #fff);
      }
      .user-account-card__header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.45rem 0.35rem 0.85rem;
        border-bottom: 1px solid rgba(226, 232, 240, 0.9);
      }
      .user-account-card__avatar {
        flex: 0 0 46px;
        width: 46px;
        height: 46px;
        font-size: 0.98rem;
      }
      .user-account-card__identity {
        min-width: 0;
      }
      .user-account-card__identity h6 {
        margin: 0;
        color: #0f172a;
        font-size: 0.94rem;
        font-weight: 750;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .user-account-card__identity p {
        margin: 0.12rem 0 0;
        color: #64748b;
        font-size: 0.78rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .user-account-card__context {
        display: grid;
        gap: 0.15rem;
        margin: 0.75rem 0;
        padding: 0.62rem 0.72rem;
        background: var(--ef-surface-raised, #f8fafc);
        border: 1px solid var(--ef-surface-border, #e2e8f0);
        border-radius: 12px;
      }
      .user-account-card__presence {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin: 0 0 0.75rem;
        padding: 0.58rem 0.72rem;
        color: var(--muted);
        background: var(--ef-surface-raised, #f8fafc);
        border: 1px solid var(--ef-surface-border, #e2e8f0);
        border-radius: 12px;
      }
      .user-account-card__presence--online {
        color: #166534;
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .user-account-card__presence-dot {
        flex: 0 0 0.54rem;
        width: 0.54rem;
        height: 0.54rem;
        border-radius: 999px;
        background: currentColor;
      }
      .user-account-card__presence strong,
      .user-account-card__presence small {
        display: block;
      }
      .user-account-card__presence strong {
        font-size: 0.78rem;
        font-weight: 800;
      }
      .user-account-card__presence small {
        margin-top: 0.05rem;
        color: #64748b;
        font-size: 0.7rem;
        overflow-wrap: anywhere;
      }
      .user-account-card__context span {
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .user-account-card__context strong {
        color: #0f172a;
        font-size: 0.86rem;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .user-account-card__actions {
        display: grid;
        gap: 0.25rem;
      }
      .user-account-action {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        width: 100%;
        min-height: 2.25rem;
        padding: 0.45rem 0.55rem;
        border: 0;
        border-radius: 10px;
        color: #334155;
        background: transparent;
        font-size: 0.85rem;
        font-weight: 650;
        text-align: left;
        text-decoration: none;
      }
      .user-account-action:hover,
      .user-account-action:focus-visible {
        color: #1d4ed8;
        background: #eff6ff;
      }
      .user-account-action--danger:hover,
      .user-account-action--danger:focus-visible {
        color: #dc2626;
        background: #fef2f2;
      }
      .user-account-action__icon {
        display: grid;
        place-items: center;
        flex: 0 0 28px;
        width: 28px;
        height: 28px;
        border-radius: 9px;
        background: #f1f5f9;
      }
    `,
  ],
})
export class TsAppNavbarComponent implements OnInit {
  readonly luxTheme = inject(LuxThemeService);
  readonly tenant = inject(TenantContextService);
  readonly session = inject(SessionContextService);
  readonly layout = inject(ShellLayoutService);
  private readonly i18n = inject(UiI18nService);
  private readonly workflow = inject(SessionWorkflowService);

  readonly empresas = signal<MiEmpresaResumenDto[]>([]);
  readonly switchError = signal<string | null>(null);
  readonly switching = signal(false);

  readonly switchTargets = computed(() =>
    this.empresas().filter(
      (e) =>
        !e.esContextoActual &&
        e.estadoMembresia?.toUpperCase() === 'ACTIVO' &&
        (e.esPlataforma || e.empresaActiva),
    ),
  );

  readonly contextoActual = computed(() => this.empresas().find((e) => e.esContextoActual));

  readonly contextoActualLabel = computed(() => {
    const cur = this.contextoActual();
    if (cur?.esPlataforma) {
      return this.t('navbar.platform');
    }
    if (cur) {
      const nc = cur.nombreComercial?.trim();
      return nc || cur.razonSocial;
    }
    const e = this.session.profile()?.empresa;
    const nc = e?.nombreComercial?.trim();
    if (nc) {
      return nc;
    }
    if (e?.razonSocial?.trim()) {
      return e.razonSocial.trim();
    }
    return this.tenant.displayName();
  });

  readonly contextoActualRuc = computed(() => {
    const cur = this.contextoActual();
    if (cur?.ruc && !cur.esPlataforma) {
      return cur.ruc;
    }
    const ruc = this.session.profile()?.empresa?.ruc?.trim();
    return ruc || null;
  });

  readonly homeLink = computed(() => ['/t', this.tenant.tenantSlug(), 'dashboard']);
  readonly profileLink = computed(() => ['/t', this.tenant.tenantSlug(), 'perfil']);
  readonly userInitials = computed(() => this.buildInitials(this.session.displayName(), this.session.profile()?.email));

  readonly logout = output<void>();

  ngOnInit(): void {
    this.reloadEmpresas();
  }

  reloadEmpresas(): void {
    this.workflow.misEmpresas().subscribe({
      next: (list) => this.empresas.set(list),
      error: () => this.empresas.set([]),
    });
  }

  etiquetaEmpresa(row: MiEmpresaResumenDto): string {
    if (row.esPlataforma) {
      return this.t('navbar.platform');
    }
    const nc = row.nombreComercial?.trim();
    return nc || row.razonSocial;
  }

  onSwitchEmpresa(row: MiEmpresaResumenDto): void {
    if (row.esContextoActual) {
      return;
    }
    this.switchError.set(null);
    this.switching.set(true);
    const empresaId = row.esPlataforma ? null : row.empresaId;
    this.workflow.switchEmpresa(empresaId).subscribe({
      next: () => {
        this.switching.set(false);
        this.reloadEmpresas();
      },
      error: (err: HttpErrorResponse) => {
        this.switching.set(false);
        this.switchError.set(extractApiErrorMessage(err, this.t('navbar.switchError')));
      },
    });
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  private buildInitials(name: string, email: string | undefined): string {
    const source = name?.trim() || email?.trim() || this.t('navbar.userFallback');
    const parts = source
      .replace(/@.*/, '')
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    const first = parts[0] ?? source;
    return first.slice(0, 2).toUpperCase();
  }
}
