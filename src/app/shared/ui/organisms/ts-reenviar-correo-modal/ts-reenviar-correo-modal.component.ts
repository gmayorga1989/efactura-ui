import { Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';

@Component({
  selector: 'ts-reenviar-correo-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (open()) {
      <div class="ts-modal-backdrop" (click)="cerrar()"></div>
      <section
        class="ts-form-modal ts-form-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reenviar-correo-title"
      >
        <header class="ts-form-modal__header ts-form-modal__header--compact">
          <div class="ts-form-modal__head-text">
            <h3 id="reenviar-correo-title" class="mb-0">{{ t('invoice.resendEmailModalTitle') }}</h3>
            @if (numeroComprobante()) {
              <p class="ts-form-modal__subtitle mb-0">{{ numeroComprobante() }}</p>
            }
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrar()">
            &times;
          </button>
        </header>
        <div class="ts-form-modal__body">
          <label class="form-label" for="reenviar-correo-input">{{ t('invoice.resendEmailModalLabel') }}</label>
          <input
            id="reenviar-correo-input"
            type="text"
            class="form-control"
            [(ngModel)]="email"
            name="emailReceptor"
            [placeholder]="t('invoice.resendEmailModalPlaceholder')"
            autocomplete="email"
          />
          <p class="form-text mb-0">{{ t('invoice.resendEmailModalHint') }}</p>
        </div>
        <footer class="ts-form-modal__footer">
          <button type="button" class="btn btn-light" (click)="cerrar()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-primary" [disabled]="!email.trim()" (click)="confirmar()">
            {{ t('invoice.resendEmailModalConfirm') }}
          </button>
        </footer>
      </section>
    }
  `,
})
export class TsReenviarCorreoModalComponent {
  private readonly i18n = inject(UiI18nService);

  readonly open = input(false);
  readonly emailInicial = input('');
  readonly numeroComprobante = input('');

  readonly confirmed = output<string>();
  readonly closed = output<void>();

  email = '';

  private readonly syncEmail = effect(() => {
    if (this.open()) {
      this.email = this.emailInicial();
    }
  });

  t(key: string): string {
    return this.i18n.t(key);
  }

  cerrar(): void {
    this.closed.emit();
  }

  confirmar(): void {
    const mail = this.email.trim();
    if (!mail) {
      return;
    }
    this.confirmed.emit(mail);
  }
}
