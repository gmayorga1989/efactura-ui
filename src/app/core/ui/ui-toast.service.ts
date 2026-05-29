import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface UiToast {
  id: number;
  message: string;
  variant: ToastVariant;
}

@Injectable({ providedIn: 'root' })
export class UiToastService {
  private seq = 0;
  private readonly items = signal<UiToast[]>([]);

  /** Lista actual de toasts (solo lectura para plantillas). */
  readonly toasts = this.items.asReadonly();

  /**
   * Muestra un toast flotante que se cierra solo tras `durationMs` o al hacer clic.
   */
  show(message: string, variant: ToastVariant = 'info', durationMs = 5200): number {
    const text = message.trim();
    if (!text) {
      return 0;
    }
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, message: text, variant }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  success(message: string, durationMs?: number): number {
    return this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs?: number): number {
    return this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs?: number): number {
    return this.show(message, 'info', durationMs);
  }

  warning(message: string, durationMs?: number): number {
    return this.show(message, 'warning', durationMs);
  }

  /** Toast persistente con indicador de progreso (cerrar con dismiss). */
  loading(message: string): number {
    return this.show(message, 'loading', 0);
  }
}
