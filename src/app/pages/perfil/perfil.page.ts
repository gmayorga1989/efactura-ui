import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../core/ui/ui-toast.service';
import type { MeResponse } from '../../core/models/me.model';
import { extractApiErrorMessage } from '../../core/session/http-error.util';
import { SessionContextService } from '../../core/session/session-context.service';
import { TsPageLayoutComponent } from '../../shared/ui/organisms/ts-page-layout/ts-page-layout.component';

interface PerfilUsuario {
  identidadId?: string;
  email?: string;
  nombre?: string;
  genero?: string;
  fechaNacimiento?: string;
  pais?: string;
  provincia?: string;
  canton?: string;
  ciudad?: string;
  parroquia?: string;
  idioma?: string;
  moneda?: string;
  zonaHoraria?: string;
  mfaHabilitado?: boolean;
  avatarUrl?: string | null;
  ultimoPing?: string | null;
  enLinea?: boolean | null;
}

interface TwoFaSetupResponse {
  secret: string;
  otpauthUri: string;
  mfaHabilitado: boolean;
}

type ProfileSection = 'personal' | 'location' | 'preferences' | 'security';

@Component({
  selector: 'ts-perfil-page',
  standalone: true,
  imports: [DatePipe, FormsModule, TsPageLayoutComponent],
  template: `
    <ts-page-layout [title]="t('profile.title')" [subtitle]="t('profile.subtitle')" [eyebrow]="t('profile.eyebrow')">
      <div page-actions class="ts-page-actions-toolbar d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-soft-primary btn-sm" (click)="cargarPerfil()" [disabled]="loading">
          {{ loading ? t('profile.loading') : t('profile.refresh') }}
        </button>
        <button type="button" class="btn btn-primary btn-sm" (click)="guardarPerfil()" [disabled]="saving || loading">
          {{ saving ? t('profile.saving') : t('profile.save') }}
        </button>
      </div>

      <section class="profile-layout">
        <aside class="profile-side">
          <div class="profile-avatar-wrap">
            <div class="profile-avatar" [class.profile-avatar--image]="avatarDisplayUrl()">
              @if (avatarDisplayUrl(); as avatarUrl) {
                <img [src]="avatarUrl" alt="Avatar" />
              } @else {
                {{ initials() }}
              }
              <span class="presence-dot" [class.presence-dot--online]="perfil.enLinea" aria-hidden="true"></span>
            </div>
            <input
              #avatarInput
              type="file"
              class="d-none"
              accept="image/png,image/jpeg,image/webp"
              (change)="onAvatarSelected($event)"
            />
            <div class="avatar-actions">
              <button type="button" class="btn btn-soft-primary btn-sm" (click)="avatarInput.click()" [disabled]="avatarUploading">
                {{ t('profile.changeAvatar') }}
              </button>
              @if (perfil.avatarUrl) {
                <button type="button" class="btn btn-light btn-sm text-danger" (click)="eliminarAvatar()" [disabled]="avatarUploading">
                  {{ t('profile.removeAvatar') }}
                </button>
              }
            </div>
            @if (selectedAvatarFile) {
              <div class="avatar-preview-actions">
                <button type="button" class="btn btn-primary btn-sm" (click)="subirAvatar()" [disabled]="avatarUploading">
                  {{ avatarUploading ? t('profile.saving') : t('common.save') }}
                </button>
                <button type="button" class="btn btn-light btn-sm" (click)="cancelarAvatarPreview()" [disabled]="avatarUploading">
                  {{ t('common.cancel') }}
                </button>
              </div>
            }
            <p class="avatar-help">{{ t('profile.avatarHelp') }}</p>
          </div>
          <div class="profile-meta">
            <span>{{ t('profile.userProfile') }}</span>
            <h2>{{ perfil.nombre || t('profile.userFallback') }}</h2>
            <p>{{ perfil.email || session.profile()?.email }}</p>
          </div>
          <div class="presence-chip" [class.presence-chip--online]="perfil.enLinea">
            <span class="presence-chip__dot"></span>
            <div>
              <strong>{{ perfil.enLinea ? t('common.online') : t('common.offline') }}</strong>
              @if (perfil.ultimoPing) {
                <small>{{ t('common.lastActivity') }}: {{ perfil.ultimoPing | date:'short' }}</small>
              }
            </div>
          </div>
          <div class="security-chip" [class.security-chip--on]="perfil.mfaHabilitado">
            <span class="security-dot"></span>
            {{ perfil.mfaHabilitado ? t('profile.mfaOn') : t('profile.mfaOff') }}
          </div>
          <nav class="profile-nav" aria-label="Perfil">
            @for (item of navItems; track item.id) {
              <button type="button" [class.active]="activeSection === item.id" (click)="activeSection = item.id">
                <span class="nav-icon" [class.nav-icon--teal]="item.id === 'location'" [class.nav-icon--amber]="item.id === 'preferences'" [class.nav-icon--violet]="item.id === 'security'" aria-hidden="true">
                  @if (item.id === 'personal') {
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>
                  } @else if (item.id === 'location') {
                    <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
                  } @else if (item.id === 'preferences') {
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9"></path></svg>
                  } @else {
                    <svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.5-2.8 8.2-7 10-4.2-1.8-7-5.5-7-10V6l7-3Z"></path><path d="m9 12 2 2 4-5"></path></svg>
                  }
                </span>
                <span>{{ t(item.label) }}</span>
              </button>
            }
          </nav>
        </aside>

        <main class="profile-main">
          @if (activeSection === 'personal') {
            <article class="profile-card">
              <header class="section-head">
                <h3>{{ t('profile.nav.personal') }}</h3>
                <p>{{ t('profile.personal.desc') }}</p>
              </header>
              <div class="form-grid">
                <label class="span-2">
                  <span>{{ t('profile.fullName') }}</span>
                  <input class="form-control form-control-sm" [(ngModel)]="perfil.nombre" name="nombre" required />
                </label>
                <label>
                  <span>{{ t('profile.gender') }}</span>
                  <select class="form-select form-select-sm" [(ngModel)]="perfil.genero" name="genero">
                    <option value="">{{ t('profile.gender.none') }}</option>
                    <option value="MASCULINO">{{ t('profile.gender.male') }}</option>
                    <option value="FEMENINO">{{ t('profile.gender.female') }}</option>
                    <option value="OTRO">{{ t('profile.gender.other') }}</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('profile.birthDate') }}</span>
                  <input class="form-control form-control-sm" type="date" [(ngModel)]="perfil.fechaNacimiento" name="fechaNacimiento" />
                </label>
                <label class="span-2">
                  <span>{{ t('profile.email') }}</span>
                  <input class="form-control form-control-sm readonly-control" [value]="perfil.email || session.profile()?.email || ''" readonly />
                </label>
              </div>
            </article>
          }

          @if (activeSection === 'location') {
            <article class="profile-card">
              <header class="section-head">
                <h3>{{ t('profile.nav.location') }}</h3>
                <p>{{ t('profile.location.desc') }}</p>
              </header>
              <div class="form-grid">
                <label>
                  <span>{{ t('profile.country') }}</span>
                  <select class="form-select form-select-sm" [(ngModel)]="perfil.pais" name="pais">
                    <option value="EC">Ecuador</option>
                    <option value="CO">Colombia</option>
                    <option value="PE">Peru</option>
                    <option value="MX">Mexico</option>
                    <option value="US">United States</option>
                    <option value="OTRO">Other</option>
                  </select>
                </label>
                <label>
                  <span>{{ perfil.pais === 'EC' ? t('profile.province') : t('profile.state') }}</span>
                  <input class="form-control form-control-sm" [(ngModel)]="perfil.provincia" name="provincia" />
                </label>
                @if (perfil.pais === 'EC') {
                  <label>
                    <span>{{ t('profile.canton') }}</span>
                    <input class="form-control form-control-sm" [(ngModel)]="perfil.canton" name="canton" />
                  </label>
                  <label>
                    <span>{{ t('profile.city') }}</span>
                    <input class="form-control form-control-sm" [(ngModel)]="perfil.ciudad" name="ciudad" />
                  </label>
                  <label>
                    <span>{{ t('profile.parish') }}</span>
                    <input class="form-control form-control-sm" [(ngModel)]="perfil.parroquia" name="parroquia" />
                  </label>
                } @else {
                  <label class="span-2">
                    <span>{{ t('profile.city') }}</span>
                    <input class="form-control form-control-sm" [(ngModel)]="perfil.ciudad" name="ciudadOtro" />
                  </label>
                }
              </div>
            </article>
          }

          @if (activeSection === 'preferences') {
            <article class="profile-card">
              <header class="section-head">
                <h3>{{ t('profile.nav.preferences') }}</h3>
                <p>{{ t('profile.preferences.desc') }}</p>
              </header>
              <div class="form-grid">
                <label>
                  <span>{{ t('profile.language') }}</span>
                  <select class="form-select form-select-sm" [ngModel]="perfil.idioma" (ngModelChange)="onLanguageChange($event)" name="idioma">
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="pt">Português</option>
                    <option value="fr">Français</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('profile.currency') }}</span>
                  <select class="form-select form-select-sm" [(ngModel)]="perfil.moneda" name="moneda">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="COP">COP</option>
                    <option value="PEN">PEN</option>
                    <option value="MXN">MXN</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('profile.timezone') }}</span>
                  <select class="form-select form-select-sm" [(ngModel)]="perfil.zonaHoraria" name="zonaHoraria">
                    <option value="America/Guayaquil">America/Guayaquil</option>
                    <option value="America/Bogota">America/Bogota</option>
                    <option value="America/Lima">America/Lima</option>
                    <option value="America/Mexico_City">America/Mexico_City</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/Madrid">Europe/Madrid</option>
                  </select>
                </label>
              </div>
            </article>
          }

          @if (activeSection === 'security') {
            <article class="profile-card">
              <header class="section-head">
                <h3>{{ t('profile.nav.security') }}</h3>
                <p>{{ t('profile.security.desc') }}</p>
              </header>
              <div class="security-state" [class.security-state--on]="perfil.mfaHabilitado">
                <div>
                  <strong>{{ perfil.mfaHabilitado ? t('profile.protected') : t('profile.unprotected') }}</strong>
                  <p>{{ perfil.mfaHabilitado ? t('profile.protected.desc') : t('profile.unprotected.desc') }}</p>
                </div>
                @if (!perfil.mfaHabilitado && !setup2fa) {
                  <button type="button" class="btn btn-primary btn-sm" (click)="iniciar2fa()" [disabled]="securityLoading">{{ t('profile.enable2fa') }}</button>
                }
              </div>

              @if (setup2fa) {
                <div class="twofa-setup">
                  <div class="qr-box"><img [src]="qrUrl(setup2fa.otpauthUri)" alt="QR 2FA" /></div>
                  <div class="manual-secret">
                    <span>{{ t('profile.manualCode') }}</span>
                    <code>{{ setup2fa.secret }}</code>
                    <p>{{ t('profile.qrHelp') }}</p>
                  </div>
                  <label>
                    <span>{{ t('profile.twofaCode') }}</span>
                    <input class="form-control form-control-sm code-input" [(ngModel)]="confirm2faCode" name="confirm2faCode" maxlength="6" inputmode="numeric" />
                  </label>
                  <div class="profile-actions">
                    <button type="button" class="btn btn-light btn-sm" (click)="cancelarSetup2fa()">{{ t('profile.cancel') }}</button>
                    <button type="button" class="btn btn-primary btn-sm" (click)="confirmar2fa()" [disabled]="securityLoading">
                      {{ securityLoading ? t('profile.confirming') : t('profile.confirm2fa') }}
                    </button>
                  </div>
                </div>
              }

              @if (perfil.mfaHabilitado) {
                <div class="security-form">
                  <label>
                    <span>{{ t('profile.currentPassword') }}</span>
                    <input class="form-control form-control-sm" type="password" [(ngModel)]="disablePassword" name="disablePassword" autocomplete="current-password" />
                  </label>
                  <label>
                    <span>{{ t('profile.twofaCode') }}</span>
                    <input class="form-control form-control-sm code-input" [(ngModel)]="disableCode" name="disableCode" maxlength="6" inputmode="numeric" />
                  </label>
                  <button type="button" class="btn btn-light btn-sm text-danger" (click)="deshabilitar2fa()" [disabled]="securityLoading">
                    {{ securityLoading ? t('profile.disabling') : t('profile.disable2fa') }}
                  </button>
                </div>
              }

              <form class="security-form" (ngSubmit)="cambiarPassword()">
                <label>
                  <span>{{ t('profile.currentPassword') }}</span>
                  <input class="form-control form-control-sm" type="password" name="passwordActual" [(ngModel)]="passwordActual" autocomplete="current-password" />
                </label>
                <label>
                  <span>{{ t('profile.newPassword') }}</span>
                  <input class="form-control form-control-sm" type="password" name="passwordNuevo" [(ngModel)]="passwordNuevo" autocomplete="new-password" />
                </label>
                <button type="submit" class="btn btn-soft-primary btn-sm" [disabled]="passwordLoading">
                  {{ passwordLoading ? t('profile.updating') : t('profile.changePassword') }}
                </button>
              </form>
            </article>
          }
        </main>
      </section>
    </ts-page-layout>

    @if (cropSourceUrl) {
      <div class="ts-modal-backdrop" (click)="cancelarRecorteAvatar()"></div>
      <section class="avatar-crop-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
        <header class="avatar-crop-modal__header">
          <div>
            <p>{{ t('profile.avatarCropEyebrow') }}</p>
            <h3 id="avatar-crop-title">{{ t('profile.avatarCropTitle') }}</h3>
          </div>
          <button type="button" class="avatar-crop-modal__close" [attr.aria-label]="t('common.cancel')" (click)="cancelarRecorteAvatar()">&times;</button>
        </header>
        <div class="avatar-crop-modal__body">
          <div
            class="avatar-crop-stage"
            (pointerdown)="startCropDrag($event)"
            (pointermove)="moveCropDrag($event)"
            (pointerup)="endCropDrag()"
            (pointerleave)="endCropDrag()"
          >
            <img
              [src]="cropSourceUrl"
              alt=""
              draggable="false"
              (load)="onCropImageLoad($event)"
              [style.width.px]="cropImageWidth()"
              [style.height.px]="cropImageHeight()"
              [style.transform]="cropTransform()"
            />
            <span class="avatar-crop-guide"></span>
          </div>
          <label class="avatar-crop-zoom">
            <span>{{ t('profile.avatarZoom') }}</span>
            <input type="range" min="1" max="3" step="0.05" [(ngModel)]="cropZoom" name="cropZoom" />
          </label>
          <p class="avatar-crop-help">{{ t('profile.avatarCropHelp') }}</p>
        </div>
        <footer class="avatar-crop-modal__footer">
          <button type="button" class="btn btn-light btn-sm" (click)="cancelarRecorteAvatar()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-primary btn-sm" (click)="aplicarRecorteAvatar()">{{ t('profile.useAvatar') }}</button>
        </footer>
      </section>
    }
  `,
  styles: [
    `
      .profile-layout {
        display: grid;
        grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
        gap: 1rem;
      }
      .profile-side,
      .profile-card {
        background: var(--card);
        border: 1px solid var(--ef-surface-border, #e2e8f0);
        border-radius: 16px;
        box-shadow: var(--ef-surface-shadow);
        color: var(--text);
      }
      .profile-side {
        align-self: start;
        display: grid;
        gap: 0.8rem;
        padding: 1rem;
      }
      .profile-avatar-wrap {
        display: grid;
        gap: 0.55rem;
      }
      .profile-avatar {
        position: relative;
        display: grid;
        place-items: center;
        width: 82px;
        height: 82px;
        color: #1d4ed8;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 999px;
        font-size: 1.25rem;
        font-weight: 850;
        overflow: visible;
      }
      .profile-avatar--image {
        background: #fff;
      }
      .profile-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }
      .presence-dot {
        position: absolute;
        right: 4px;
        bottom: 6px;
        width: 0.9rem;
        height: 0.9rem;
        border: 2px solid #fff;
        border-radius: 999px;
        background: #94a3b8;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
      }
      .presence-dot--online {
        background: #22c55e;
      }
      .avatar-actions,
      .avatar-preview-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }
      .avatar-actions .btn,
      .avatar-preview-actions .btn {
        min-height: 1.85rem;
        padding: 0.26rem 0.58rem;
        font-size: 0.76rem;
      }
      .avatar-help {
        margin: 0;
        color: #64748b;
        font-size: 0.72rem;
      }
      .ts-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1090;
        background: rgba(15, 23, 42, 0.42);
        backdrop-filter: blur(3px);
      }
      .avatar-crop-modal {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(430px, calc(100vw - 2rem));
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      .avatar-crop-modal__header,
      .avatar-crop-modal__footer {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.9rem 1rem;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .avatar-crop-modal__header p {
        margin: 0;
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
      }
      .avatar-crop-modal__header h3 {
        margin: 0.1rem 0 0;
        color: #0f172a;
        font-size: 1rem;
        font-weight: 850;
      }
      .avatar-crop-modal__close {
        display: grid;
        place-items: center;
        margin-left: auto;
        width: 32px;
        height: 32px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        color: #475569;
        background: #fff;
        font-size: 1.2rem;
        line-height: 1;
      }
      .avatar-crop-modal__body {
        display: grid;
        justify-items: center;
        gap: 0.8rem;
        padding: 1rem;
      }
      .avatar-crop-stage {
        position: relative;
        width: 240px;
        height: 240px;
        background: #0f172a;
        border-radius: 18px;
        overflow: hidden;
        touch-action: none;
        cursor: grab;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
      }
      .avatar-crop-stage:active {
        cursor: grabbing;
      }
      .avatar-crop-stage img {
        position: absolute;
        left: 50%;
        top: 50%;
        max-width: none;
        user-select: none;
        transform-origin: center;
      }
      .avatar-crop-guide {
        position: absolute;
        inset: 18px;
        border: 1px solid rgba(255,255,255,0.72);
        border-radius: 999px;
        box-shadow: 0 0 0 999px rgba(15, 23, 42, 0.28);
        pointer-events: none;
      }
      .avatar-crop-zoom {
        width: min(290px, 100%);
      }
      .avatar-crop-zoom input {
        width: 100%;
      }
      .avatar-crop-help {
        max-width: 300px;
        margin: 0;
        color: #64748b;
        font-size: 0.78rem;
        text-align: center;
      }
      .avatar-crop-modal__footer {
        justify-content: flex-end;
        border-top: 1px solid #e2e8f0;
        border-bottom: 0;
      }
      .profile-meta span {
        color: #64748b;
        font-size: 0.76rem;
        font-weight: 750;
        text-transform: uppercase;
      }
      .profile-meta h2 {
        margin: 0.12rem 0;
        color: #0f172a;
        font-size: 1.12rem;
        font-weight: 800;
        line-height: 1.2;
      }
      .profile-meta p {
        margin: 0;
        color: #475569;
        font-size: 0.84rem;
        overflow-wrap: anywhere;
      }
      .security-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        width: fit-content;
        padding: 0.35rem 0.65rem;
        color: #92400e;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
      }
      .presence-chip {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.55rem 0.65rem;
        color: #475569;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
      .presence-chip--online {
        color: #166534;
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .presence-chip__dot {
        flex: 0 0 0.55rem;
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: currentColor;
      }
      .presence-chip strong,
      .presence-chip small {
        display: block;
      }
      .presence-chip strong {
        font-size: 0.78rem;
        font-weight: 850;
      }
      .presence-chip small {
        margin-top: 0.05rem;
        color: #64748b;
        font-size: 0.7rem;
      }
      .security-chip--on {
        color: #166534;
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .security-dot {
        width: 0.45rem;
        height: 0.45rem;
        border-radius: 999px;
        background: currentColor;
      }
      .profile-nav {
        display: grid;
        gap: 0.45rem;
        padding-top: 0.35rem;
        border-top: 1px solid #edf2f7;
      }
      .profile-nav button {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        width: 100%;
        min-height: 2.65rem;
        padding: 0.45rem 0.55rem;
        border: 1px solid transparent;
        border-radius: 11px;
        color: #334155;
        background: transparent;
        font-size: 0.86rem;
        font-weight: 750;
        text-align: left;
      }
      .profile-nav button:hover,
      .profile-nav button.active {
        color: #1d4ed8;
        background: #eff6ff;
        border-color: #bfdbfe;
      }
      .nav-icon {
        display: grid;
        place-items: center;
        flex: 0 0 30px;
        width: 30px;
        height: 30px;
        color: #2563eb;
        background: #f8fbff;
        border: 1px solid #dbeafe;
        border-radius: 10px;
      }
      .nav-icon--teal {
        color: #0f766e;
        background: #f0fdfa;
        border-color: #99f6e4;
      }
      .nav-icon--amber {
        color: #b45309;
        background: #fffbeb;
        border-color: #fde68a;
      }
      .nav-icon--violet {
        color: #7c3aed;
        background: #f5f3ff;
        border-color: #ddd6fe;
      }
      .nav-icon svg {
        width: 17px;
        height: 17px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .profile-main {
        min-width: 0;
      }
      .profile-card {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }
      .section-head {
        padding-bottom: 0.8rem;
        border-bottom: 1px solid #edf2f7;
      }
      .section-head h3 {
        margin: 0;
        color: #0f172a;
        font-size: 1.05rem;
        font-weight: 850;
      }
      .section-head p {
        margin: 0.12rem 0 0;
        color: #64748b;
        font-size: 0.82rem;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.72rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
      }
      label span,
      .manual-secret span {
        color: #475569;
        font-size: 0.76rem;
        font-weight: 750;
      }
      .span-2 {
        grid-column: span 2;
      }
      .readonly-control {
        color: #475569;
        background: #f8fafc;
        border-color: #e2e8f0;
      }
      .security-state,
      .security-form,
      .twofa-setup {
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 0.85rem;
      }
      .security-state {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: #fffbeb;
        border-color: #fde68a;
      }
      .security-state--on {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .security-state strong {
        color: #0f172a;
        font-size: 0.92rem;
      }
      .security-state p,
      .manual-secret p {
        margin: 0.1rem 0 0;
        color: #64748b;
        font-size: 0.8rem;
      }
      .twofa-setup {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.85rem;
        background: #f8fafc;
      }
      .qr-box {
        display: grid;
        place-items: center;
        width: 132px;
        height: 132px;
        background: #fff;
        border: 1px solid #dbe3ef;
        border-radius: 12px;
      }
      .qr-box img {
        width: 112px;
        height: 112px;
      }
      .manual-secret code {
        display: block;
        width: fit-content;
        max-width: 100%;
        margin-top: 0.18rem;
        padding: 0.35rem 0.5rem;
        color: #1e293b;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow-wrap: anywhere;
      }
      .code-input {
        max-width: 9rem;
        text-align: center;
        font-weight: 800;
      }
      .profile-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .security-form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
        align-items: end;
        gap: 0.72rem;
        background: #fff;
      }
      @media (max-width: 980px) {
        .profile-layout,
        .form-grid,
        .twofa-setup,
        .security-form {
          grid-template-columns: 1fr;
        }
        .span-2 {
          grid-column: auto;
        }
        .security-state {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class PerfilPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(UiToastService);
  readonly session = inject(SessionContextService);
  readonly i18n = inject(UiI18nService);

  readonly navItems: Array<{ id: ProfileSection; label: string }> = [
    { id: 'personal', label: 'profile.nav.personal' },
    { id: 'location', label: 'profile.nav.location' },
    { id: 'preferences', label: 'profile.nav.preferences' },
    { id: 'security', label: 'profile.nav.security' },
  ];

  activeSection: ProfileSection = 'personal';
  perfil: PerfilUsuario = this.defaultPerfil();
  setup2fa: TwoFaSetupResponse | null = null;
  confirm2faCode = '';
  disablePassword = '';
  disableCode = '';
  passwordActual = '';
  passwordNuevo = '';
  loading = false;
  saving = false;
  securityLoading = false;
  passwordLoading = false;
  avatarUploading = false;
  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;
  cropSourceUrl: string | null = null;
  cropOriginalFile: File | null = null;
  cropNaturalWidth = 1;
  cropNaturalHeight = 1;
  cropZoom = 1;
  cropOffsetX = 0;
  cropOffsetY = 0;
  private cropDragging = false;
  private cropDragStartX = 0;
  private cropDragStartY = 0;
  private cropStartOffsetX = 0;
  private cropStartOffsetY = 0;

  ngOnInit(): void {
    this.cargarPerfil();
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  onLanguageChange(language: string): void {
    this.perfil.idioma = language;
    this.i18n.setLanguage(language);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.showMsg(this.t('profile.avatarInvalidType'), false);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.showMsg(this.t('profile.avatarInvalidSize'), false);
      return;
    }
    this.cancelarAvatarPreview();
    this.cancelarRecorteAvatar();
    this.cropOriginalFile = file;
    this.cropSourceUrl = URL.createObjectURL(file);
    this.cropZoom = 1;
    this.cropOffsetX = 0;
    this.cropOffsetY = 0;
  }

  subirAvatar(): void {
    if (!this.selectedAvatarFile) {
      return;
    }
    const formData = new FormData();
    formData.append('archivo', this.selectedAvatarFile);
    this.avatarUploading = true;
    this.http.post<{ avatarUrl?: string | null }>('/api/web/v1/me/avatar', formData).subscribe({
      next: (res) => {
        this.avatarUploading = false;
        this.perfil.avatarUrl = res.avatarUrl ?? this.perfil.avatarUrl;
        this.cancelarAvatarPreview();
        this.showMsg(this.t('profile.avatarUploaded'), true);
        this.recargarMe();
        this.cargarPerfil();
      },
      error: (err: HttpErrorResponse) => {
        this.avatarUploading = false;
        this.showMsg(extractApiErrorMessage(err, this.t('profile.avatarUploadError')), false);
      },
    });
  }

  eliminarAvatar(): void {
    this.avatarUploading = true;
    this.http.delete<PerfilUsuario>('/api/web/v1/me/avatar').subscribe({
      next: (perfil) => {
        this.avatarUploading = false;
        this.cancelarAvatarPreview();
        this.perfil = { ...this.perfil, ...perfil, avatarUrl: perfil.avatarUrl ?? null };
        this.showMsg(this.t('profile.avatarDeleted'), true);
        this.recargarMe();
      },
      error: (err: HttpErrorResponse) => {
        this.avatarUploading = false;
        this.showMsg(extractApiErrorMessage(err, this.t('profile.avatarDeleteError')), false);
      },
    });
  }

  cancelarAvatarPreview(): void {
    if (this.avatarPreviewUrl) {
      URL.revokeObjectURL(this.avatarPreviewUrl);
    }
    this.avatarPreviewUrl = null;
    this.selectedAvatarFile = null;
  }

  cancelarRecorteAvatar(): void {
    if (this.cropSourceUrl) {
      URL.revokeObjectURL(this.cropSourceUrl);
    }
    this.cropSourceUrl = null;
    this.cropOriginalFile = null;
    this.cropZoom = 1;
    this.cropOffsetX = 0;
    this.cropOffsetY = 0;
    this.cropDragging = false;
  }

  onCropImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.cropNaturalWidth = img.naturalWidth || 1;
    this.cropNaturalHeight = img.naturalHeight || 1;
  }

  cropImageWidth(): number {
    return this.cropNaturalWidth * this.cropScale();
  }

  cropImageHeight(): number {
    return this.cropNaturalHeight * this.cropScale();
  }

  cropTransform(): string {
    return `translate(-50%, -50%) translate(${this.cropOffsetX}px, ${this.cropOffsetY}px)`;
  }

  startCropDrag(event: PointerEvent): void {
    this.cropDragging = true;
    this.cropDragStartX = event.clientX;
    this.cropDragStartY = event.clientY;
    this.cropStartOffsetX = this.cropOffsetX;
    this.cropStartOffsetY = this.cropOffsetY;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  moveCropDrag(event: PointerEvent): void {
    if (!this.cropDragging) {
      return;
    }
    this.cropOffsetX = this.cropStartOffsetX + event.clientX - this.cropDragStartX;
    this.cropOffsetY = this.cropStartOffsetY + event.clientY - this.cropDragStartY;
  }

  endCropDrag(): void {
    this.cropDragging = false;
  }

  aplicarRecorteAvatar(): void {
    if (!this.cropOriginalFile || !this.cropSourceUrl) {
      return;
    }
    const image = new Image();
    image.onload = () => {
      const sourceSize = 240;
      const targetSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      const scale = this.cropScale() * (targetSize / sourceSize);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const dx = (targetSize - drawWidth) / 2 + this.cropOffsetX * (targetSize / sourceSize);
      const dy = (targetSize - drawHeight) / 2 + this.cropOffsetY * (targetSize / sourceSize);
      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
      canvas.toBlob((blob) => {
        if (!blob) {
          return;
        }
        const fileName = this.cropOriginalFile?.name.replace(/\.[^.]+$/, '') || 'avatar';
        if (this.avatarPreviewUrl) {
          URL.revokeObjectURL(this.avatarPreviewUrl);
        }
        this.selectedAvatarFile = new File([blob], `${fileName}.png`, { type: 'image/png' });
        this.avatarPreviewUrl = URL.createObjectURL(blob);
        this.cancelarRecorteAvatar();
      }, 'image/png', 0.92);
    };
    image.src = this.cropSourceUrl;
  }

  avatarDisplayUrl(): string | null {
    return this.avatarPreviewUrl || this.perfil.avatarUrl || this.session.profile()?.avatarUrl || null;
  }

  cargarPerfil(): void {
    this.loading = true;
    this.http.get<PerfilUsuario>('/api/web/v1/me/perfil').subscribe({
      next: (perfil) => {
        this.loading = false;
        this.perfil = { ...this.defaultPerfil(), ...perfil };
        this.i18n.setLanguage(this.perfil.idioma);
        const current = this.session.profile();
        if (current) {
          this.session.setMe({
            ...current,
            nombre: this.perfil.nombre ?? current.nombre,
            avatarUrl: this.perfil.avatarUrl ?? current.avatarUrl ?? null,
            enLinea: this.perfil.enLinea ?? current.enLinea ?? null,
            ultimoPing: this.perfil.ultimoPing ?? current.ultimoPing ?? null,
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.showMsg(extractApiErrorMessage(err, this.t('profile.loadError')), false);
      },
    });
  }

  guardarPerfil(): void {
    if (!this.perfil.nombre?.trim()) {
      this.showMsg(this.t('profile.nameRequired'), false);
      return;
    }
    this.saving = true;
    this.http.patch<PerfilUsuario>('/api/web/v1/me/perfil', this.profilePayload()).subscribe({
      next: (perfil) => {
        this.saving = false;
        this.perfil = { ...this.perfil, ...perfil };
        this.i18n.setLanguage(this.perfil.idioma);
        this.showMsg(this.t('profile.saved'), true);
        this.recargarMe();
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.showMsg(extractApiErrorMessage(err, this.t('profile.saveError')), false);
      },
    });
  }

  iniciar2fa(): void {
    this.securityLoading = true;
    this.http.post<TwoFaSetupResponse>('/api/web/v1/me/2fa/setup', {}).subscribe({
      next: (res) => {
        this.securityLoading = false;
        this.setup2fa = res;
        this.confirm2faCode = '';
      },
      error: (err: HttpErrorResponse) => {
        this.securityLoading = false;
        this.showMsg(extractApiErrorMessage(err, this.t('profile.setupError')), false);
      },
    });
  }

  cancelarSetup2fa(): void {
    this.setup2fa = null;
    this.confirm2faCode = '';
  }

  confirmar2fa(): void {
    if (!/^\d{6}$/.test(this.confirm2faCode.trim())) {
      this.showMsg(this.t('profile.codeRequired'), false);
      return;
    }
    this.securityLoading = true;
    this.http.post('/api/web/v1/me/2fa/confirm', { codigo: this.confirm2faCode.trim() }).subscribe({
      next: () => {
        this.securityLoading = false;
        this.setup2fa = null;
        this.confirm2faCode = '';
        this.perfil.mfaHabilitado = true;
        this.showMsg(this.t('profile.mfaEnabled'), true);
        this.cargarPerfil();
      },
      error: (err: HttpErrorResponse) => {
        this.securityLoading = false;
        this.showMsg(extractApiErrorMessage(err, this.t('profile.confirmError')), false);
      },
    });
  }

  deshabilitar2fa(): void {
    if (!this.disablePassword || !/^\d{6}$/.test(this.disableCode.trim())) {
      this.showMsg(this.t('profile.disableRequired'), false);
      return;
    }
    this.securityLoading = true;
    this.http
      .post('/api/web/v1/me/2fa/disable', {
        passwordActual: this.disablePassword,
        codigo: this.disableCode.trim(),
      })
      .subscribe({
        next: () => {
          this.securityLoading = false;
          this.disablePassword = '';
          this.disableCode = '';
          this.perfil.mfaHabilitado = false;
          this.showMsg(this.t('profile.mfaDisabled'), true);
          this.cargarPerfil();
        },
        error: (err: HttpErrorResponse) => {
          this.securityLoading = false;
          this.showMsg(extractApiErrorMessage(err, this.t('profile.disableError')), false);
        },
      });
  }

  cambiarPassword(): void {
    if (!this.passwordActual || !this.passwordNuevo) {
      this.showMsg(this.t('profile.passwordRequired'), false);
      return;
    }
    this.passwordLoading = true;
    this.http
      .post('/api/web/v1/me/password', {
        passwordActual: this.passwordActual,
        passwordNuevo: this.passwordNuevo,
      })
      .subscribe({
        next: () => {
          this.passwordLoading = false;
          this.passwordActual = '';
          this.passwordNuevo = '';
          this.showMsg(this.t('profile.passwordSaved'), true);
        },
        error: (err: HttpErrorResponse) => {
          this.passwordLoading = false;
          this.showMsg(extractApiErrorMessage(err, this.t('profile.passwordError')), false);
        },
      });
  }

  qrUrl(otpauthUri: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUri)}`;
  }

  initials(): string {
    const name = this.perfil.nombre || this.session.profile()?.nombre || this.perfil.email || 'U';
    const parts = name.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0] ?? 'U').slice(0, 2).toUpperCase();
  }

  private profilePayload(): Omit<PerfilUsuario, 'identidadId' | 'email' | 'mfaHabilitado'> {
    return {
      nombre: this.perfil.nombre?.trim(),
      genero: this.perfil.genero || undefined,
      fechaNacimiento: this.perfil.fechaNacimiento || undefined,
      pais: this.perfil.pais || 'EC',
      provincia: this.perfil.provincia?.trim() || undefined,
      canton: this.perfil.pais === 'EC' ? this.perfil.canton?.trim() || undefined : undefined,
      ciudad: this.perfil.ciudad?.trim() || undefined,
      parroquia: this.perfil.pais === 'EC' ? this.perfil.parroquia?.trim() || undefined : undefined,
      idioma: this.perfil.idioma || 'es',
      moneda: this.perfil.moneda || 'USD',
      zonaHoraria: this.perfil.zonaHoraria || 'America/Guayaquil',
    };
  }

  private cropScale(): number {
    const stageSize = 240;
    return Math.max(stageSize / this.cropNaturalWidth, stageSize / this.cropNaturalHeight) * this.cropZoom;
  }

  private recargarMe(): void {
    this.http.get<MeResponse>('/api/web/v1/me').subscribe({
      next: (me) =>
        this.session.setMe({
          ...me,
          avatarUrl: this.perfil.avatarUrl ?? me.avatarUrl ?? null,
          enLinea: this.perfil.enLinea ?? me.enLinea ?? null,
          ultimoPing: this.perfil.ultimoPing ?? me.ultimoPing ?? null,
        }),
      error: () => undefined,
    });
  }

  private defaultPerfil(): PerfilUsuario {
    const me = this.session.profile();
    return {
      email: me?.email,
      nombre: me?.nombre,
      pais: 'EC',
      idioma: this.i18n.language(),
      moneda: 'USD',
      zonaHoraria: 'America/Guayaquil',
      mfaHabilitado: false,
    };
  }

  private showMsg(text: string, ok: boolean): void {
    if (ok) {
      this.toast.success(text);
    } else {
      this.toast.error(text);
    }
  }
}
