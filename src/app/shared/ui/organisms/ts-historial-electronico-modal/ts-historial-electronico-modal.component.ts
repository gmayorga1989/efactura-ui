import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';

export interface SriMensajeHistorial {
  identificador?: string | null;
  tipo?: string | null;
  mensaje?: string | null;
  informacionAdicional?: string | null;
}

export interface HistorialElectronicoEvento {
  id: string;
  fecha: string;
  categoria: string;
  operacion: string;
  titulo: string;
  mensaje: string;
  resultado: string;
  httpStatus?: number | null;
  comprobanteId?: string;
  numeroComprobante?: string;
  tipoComprobante?: string;
  expandible?: boolean;
  detalleSolicitud?: string | null;
  detalleRespuesta?: string | null;
  mensajesSri?: SriMensajeHistorial[];
}

type DetalleTab = 'resumen' | 'solicitud' | 'respuesta';

@Component({
  selector: 'ts-historial-electronico-modal',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (open()) {
      <div class="ts-modal-backdrop" (click)="cerrar()"></div>
      <section class="ts-form-modal ts-form-modal--historial" role="dialog" aria-modal="true" aria-labelledby="historial-modal-title">
        <header class="ts-form-modal__header">
          <div class="ts-form-modal__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            </svg>
          </div>
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('monitor.historyEyebrow') }}</p>
            <h3 id="historial-modal-title" class="mb-0">{{ tituloModal() }}</h3>
            @if (subtitulo()) {
              <p class="ts-form-modal__subtitle mb-0">{{ subtitulo() }}</p>
            }
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrar()">&times;</button>
        </header>
        <div class="ts-historial-layout">
          <div class="ts-historial-list ts-historial-scroll">
            @if (loading()) {
              <p class="p-3 text-muted mb-0 small">{{ t('common.loading') }}</p>
            } @else if (eventos().length === 0) {
              <p class="p-3 text-muted mb-0 small">{{ t('monitor.historyEmpty') }}</p>
            } @else {
              @for (ev of eventos(); track ev.id + ev.fecha) {
                <button
                  type="button"
                  class="ts-historial-item"
                  [class.ts-historial-item--active]="esSeleccionado(ev)"
                  (click)="seleccionar(ev)"
                >
                  <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                    <span class="ts-historial-item__meta">{{ ev.fecha | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
                    <span class="badge badge-cat" [class]="badgeResultado(ev.resultado)">{{ ev.resultado }}</span>
                  </div>
                  <div class="mb-1">
                    <span class="badge badge-cat me-1" [class]="badgeCategoria(ev.categoria)">{{ ev.categoria }}</span>
                  </div>
                  <div class="ts-historial-item__title">{{ ev.titulo }}</div>
                  <p class="ts-historial-item__msg mb-0">{{ ev.mensaje || '—' }}</p>
                </button>
              }
            }
          </div>
          <div class="ts-historial-detail">
            @if (!seleccionado()) {
              <div class="ts-historial-detail__empty">{{ t('monitor.historySelectHint') }}</div>
            } @else {
              <div class="ts-historial-detail__head">
                <h4>{{ seleccionado()!.titulo }}</h4>
                <div class="d-flex flex-wrap align-items-center gap-2">
                  <span class="badge" [class]="badgeResultado(seleccionado()!.resultado)">{{ seleccionado()!.resultado }}</span>
                  <span class="badge badge-cat" [class]="badgeCategoria(seleccionado()!.categoria)">{{ seleccionado()!.categoria }}</span>
                  @if (seleccionado()!.httpStatus != null) {
                    <span class="small text-muted">{{ t('monitor.historyHttp') }} {{ seleccionado()!.httpStatus }}</span>
                  }
                  <span class="small text-muted">{{ seleccionado()!.fecha | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
                </div>
              </div>
              <div class="ts-historial-tabs">
                <button type="button" [class.active]="tabDetalle() === 'resumen'" (click)="cambiarTab('resumen')">{{ t('monitor.historyTabSummary') }}</button>
                <button type="button" [class.active]="tabDetalle() === 'solicitud'" [disabled]="!tieneSolicitud(seleccionado())" (click)="cambiarTab('solicitud')">{{ t('monitor.historyTabRequest') }}</button>
                <button type="button" [class.active]="tabDetalle() === 'respuesta'" [disabled]="!tieneRespuesta(seleccionado())" (click)="cambiarTab('respuesta')">{{ t('monitor.historyTabResponse') }}</button>
              </div>
              <div class="ts-historial-detail__body ts-historial-scroll">
                @if (tabDetalle() === 'resumen') {
                  <p class="small mb-3">{{ seleccionado()!.mensaje || '—' }}</p>
                  @if (mensajesSri(seleccionado()).length > 0) {
                    <p class="small fw-semibold text-muted mb-2">{{ t('monitor.historySriMessages') }}</p>
                    @for (m of mensajesSri(seleccionado()); track $index) {
                      <div class="ts-sri-msg" [class.ts-sri-msg--error]="(m.tipo || '').toUpperCase() === 'ERROR'">
                        @if (m.identificador) {
                          <div class="ts-sri-msg__id">[{{ m.identificador }}] {{ m.tipo || '' }}</div>
                        }
                        <p class="ts-sri-msg__text">{{ m.mensaje }}</p>
                        @if (m.informacionAdicional) {
                          <p class="ts-sri-msg__extra">{{ m.informacionAdicional }}</p>
                        }
                      </div>
                    }
                  }
                }
                @if (tabDetalle() === 'solicitud' && tieneSolicitud(seleccionado())) {
                  <div class="ts-code-block">
                    <button type="button" class="btn btn-light btn-sm ts-code-block__copy" (click)="copiar(seleccionado()!.detalleSolicitud)">{{ t('monitor.historyCopy') }}</button>
                    <pre>{{ seleccionado()!.detalleSolicitud }}</pre>
                  </div>
                }
                @if (tabDetalle() === 'respuesta' && tieneRespuesta(seleccionado())) {
                  <div class="ts-code-block">
                    <button type="button" class="btn btn-light btn-sm ts-code-block__copy" (click)="copiar(seleccionado()!.detalleRespuesta)">{{ t('monitor.historyCopy') }}</button>
                    <pre>{{ seleccionado()!.detalleRespuesta }}</pre>
                  </div>
                }
              </div>
            }
          </div>
        </div>
        <footer class="ts-form-modal__footer">
          <button type="button" class="btn btn-light btn-sm" (click)="cerrar()">{{ t('common.close') }}</button>
        </footer>
      </section>
    }
  `,
  styles: [
    `
      .ts-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1090;
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(3px);
      }
      .ts-form-modal--historial {
        position: fixed;
        z-index: 1100;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(1120px, calc(100vw - 1.5rem));
        height: min(90vh, 860px);
        max-height: min(90vh, 860px);
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      .ts-form-modal--historial > .ts-form-modal__header,
      .ts-form-modal--historial > .ts-form-modal__footer {
        flex-shrink: 0;
      }
      .ts-form-modal__icon {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        flex-shrink: 0;
        border: 1px solid #dfe7ff;
        border-radius: 10px;
        background: linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
        color: #3a57e8;
      }
      .ts-historial-layout {
        display: grid;
        grid-template-columns: minmax(280px, 38%) minmax(0, 1fr);
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }
      @media (max-width: 768px) {
        .ts-historial-layout {
          grid-template-columns: 1fr;
        }
      }
      .ts-historial-scroll {
        scrollbar-width: thin;
        scrollbar-color: #94a3b8 #f1f5f9;
        overscroll-behavior: contain;
      }
      .ts-historial-scroll::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      .ts-historial-scroll::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
      .ts-historial-scroll::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 6px;
        border: 2px solid #f1f5f9;
      }
      .ts-historial-scroll::-webkit-scrollbar-thumb:hover {
        background: #64748b;
      }
      .ts-form-modal--historial .ts-historial-scroll::-webkit-scrollbar-thumb {
        background: #94a3b8;
      }
      .ts-historial-list {
        border-right: 1px solid #e8edf4;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        background: #f8fafc;
      }
      .ts-historial-item {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        border-bottom: 1px solid #e8edf4;
        background: transparent;
        padding: 0.7rem 0.85rem;
        cursor: pointer;
        transition: background 0.12s ease;
      }
      .ts-historial-item:hover {
        background: #f1f5f9;
      }
      .ts-historial-item--active {
        background: #fff;
        box-shadow: inset 3px 0 0 #3a57e8;
      }
      .ts-historial-item__meta {
        color: #64748b;
        font-size: 0.72rem;
        margin-bottom: 0.25rem;
      }
      .ts-historial-item__title {
        color: #0f172a;
        font-size: 0.82rem;
        font-weight: 600;
        line-height: 1.3;
        margin-bottom: 0.2rem;
      }
      .ts-historial-item__msg {
        color: #475569;
        font-size: 0.78rem;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ts-historial-detail {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        background: #fff;
      }
      .ts-historial-detail__empty {
        display: grid;
        place-items: center;
        flex: 1;
        padding: 2rem;
        color: #64748b;
        font-size: 0.9rem;
        text-align: center;
      }
      .ts-historial-detail__head {
        flex-shrink: 0;
        padding: 0.85rem 1rem;
        border-bottom: 1px solid #e8edf4;
      }
      .ts-historial-detail__head h4 {
        margin: 0 0 0.35rem;
        font-size: 0.95rem;
        font-weight: 650;
        color: #0f172a;
      }
      .ts-historial-tabs {
        display: flex;
        flex-shrink: 0;
        gap: 0.35rem;
        padding: 0.55rem 1rem 0;
        border-bottom: 1px solid #e8edf4;
      }
      .ts-historial-tabs button {
        border: 0;
        background: transparent;
        color: #64748b;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0.35rem 0.55rem;
        border-radius: 6px;
      }
      .ts-historial-tabs button.active {
        background: #eef3ff;
        color: #3a57e8;
      }
      .ts-historial-tabs button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ts-historial-detail__body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        padding: 0.85rem 1rem 1rem;
      }
      .ts-sri-msg {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.55rem 0.65rem;
        margin-bottom: 0.5rem;
        background: #fafbfc;
      }
      .ts-sri-msg--error {
        border-color: #fecaca;
        background: #fff5f5;
      }
      .ts-sri-msg__id {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 0.15rem;
      }
      .ts-sri-msg__text {
        font-size: 0.82rem;
        color: #0f172a;
        margin: 0;
      }
      .ts-sri-msg__extra {
        font-size: 0.78rem;
        color: #475569;
        margin: 0.35rem 0 0;
      }
      .ts-code-block {
        position: relative;
        margin: 0;
      }
      .ts-code-block pre {
        margin: 0;
        overflow: visible;
        padding: 0.75rem;
        border-radius: 8px;
        background: #0f172a;
        color: #e2e8f0;
        font-size: 0.72rem;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .ts-code-block__copy {
        position: absolute;
        top: 0.45rem;
        right: 0.45rem;
        z-index: 1;
      }
      .badge-cat {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class TsHistorialElectronicoModalComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(UiI18nService);
  private readonly toast = inject(UiToastService);

  readonly open = input(false);
  readonly modo = input<'comprobante' | 'empresa'>('comprobante');
  readonly comprobanteId = input<string | null>(null);
  readonly numeroComprobante = input<string | null>(null);
  readonly fechaDesde = input<string>('');
  readonly fechaHasta = input<string>('');

  readonly closed = output<void>();

  readonly loading = signal(false);
  readonly eventos = signal<HistorialElectronicoEvento[]>([]);
  readonly seleccionado = signal<HistorialElectronicoEvento | null>(null);
  readonly tabDetalle = signal<DetalleTab>('resumen');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.cargar();
      } else {
        this.seleccionado.set(null);
      }
    });
  }

  tituloModal(): string {
    return this.modo() === 'comprobante' ? this.t('monitor.historyTitle') : this.t('monitor.historyTitleAll');
  }

  subtitulo(): string {
    if (this.modo() === 'comprobante' && this.numeroComprobante()) {
      return this.numeroComprobante()!;
    }
    if (this.modo() === 'empresa' && this.fechaDesde() && this.fechaHasta()) {
      return `${this.fechaDesde()} — ${this.fechaHasta()}`;
    }
    return '';
  }

  mostrarComprobante(): boolean {
    return this.modo() === 'empresa';
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  badgeResultado(resultado: string): string {
    const r = String(resultado ?? '').toUpperCase();
    if (r === 'ERROR') return 'bg-danger';
    if (r === 'WARN') return 'bg-warning text-dark';
    if (r === 'OK') return 'bg-success';
    return 'bg-secondary';
  }

  badgeCategoria(cat: string): string {
    const c = String(cat ?? '').toUpperCase();
    if (c === 'SRI') return 'text-primary bg-primary-subtle';
    if (c === 'ARCHIVO') return 'text-success bg-success-subtle';
    if (c === 'CORREO') return 'text-info bg-info-subtle';
    if (c === 'AUDITORIA') return 'text-secondary bg-secondary-subtle';
    return 'text-dark bg-light';
  }

  seleccionar(ev: HistorialElectronicoEvento): void {
    this.seleccionado.set(ev);
    this.tabDetalle.set('resumen');
  }

  esSeleccionado(ev: HistorialElectronicoEvento): boolean {
    const s = this.seleccionado();
    return s != null && s.id === ev.id && s.fecha === ev.fecha;
  }

  tieneSolicitud(ev: HistorialElectronicoEvento | null): boolean {
    return !!ev?.detalleSolicitud?.trim();
  }

  tieneRespuesta(ev: HistorialElectronicoEvento | null): boolean {
    return !!ev?.detalleRespuesta?.trim();
  }

  mensajesSri(ev: HistorialElectronicoEvento | null): SriMensajeHistorial[] {
    return ev?.mensajesSri ?? [];
  }

  cambiarTab(tab: DetalleTab): void {
    this.tabDetalle.set(tab);
  }

  async copiar(texto: string | null | undefined): Promise<void> {
    const v = (texto ?? '').trim();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      this.toast.success(this.t('monitor.historyCopied'));
    } catch {
      this.toast.error(this.t('common.error'));
    }
  }

  cargar(): void {
    this.loading.set(true);
    this.eventos.set([]);
    this.seleccionado.set(null);
    if (this.modo() === 'comprobante') {
      const id = this.comprobanteId();
      if (!id) {
        this.loading.set(false);
        return;
      }
      this.http.get<HistorialElectronicoEvento[]>(`/api/web/v1/comprobantes/${id}/historial-electronico`).subscribe({
        next: (rows) => this.finalizarCarga(rows),
        error: () => this.finalizarCarga([]),
      });
      return;
    }
    const hp = new HttpParams()
      .set('fechaDesde', this.fechaDesde())
      .set('fechaHasta', this.fechaHasta())
      .set('page', '0')
      .set('size', '50');
    this.http
      .get<{ content: HistorialElectronicoEvento[] }>('/api/web/v1/comprobantes-electronicos/historial', { params: hp })
      .subscribe({
        next: (page) => this.finalizarCarga(page.content ?? []),
        error: () => this.finalizarCarga([]),
      });
  }

  private finalizarCarga(rows: HistorialElectronicoEvento[]): void {
    const ordenados = [...rows].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
    this.eventos.set(ordenados);
    this.loading.set(false);
    const preferido =
      ordenados.find((e) => e.categoria === 'SRI' && e.expandible) ??
      ordenados.find((e) => e.expandible) ??
      ordenados[0] ??
      null;
    this.seleccionado.set(preferido);
  }

  cerrar(): void {
    this.closed.emit();
  }
}
