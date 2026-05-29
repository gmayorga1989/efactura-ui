import { HttpClient } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';
import type { CotizacionAdjuntoDto } from '../../../../pages/cotizaciones/cotizaciones.service';

interface CloudConfig {
  enabled: boolean;
  google: { configured: boolean; clientId?: string; apiKey?: string; connected: boolean };
  microsoft: { configured: boolean; clientId?: string; connected: boolean };
}

interface OneDriveItem {
  id?: string;
  name?: string;
  webUrl?: string;
  folder?: Record<string, unknown>;
  file?: Record<string, unknown>;
}

declare global {
  interface Window {
    google?: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS: unknown };
        Action: { PICKED: string };
        Response: { ACTION: string; DOCUMENTS: string };
      };
    };
  }
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(cb: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface GooglePickerResponse {
  [key: string]: string | GooglePickerDoc[] | undefined;
  action?: string;
  docs?: GooglePickerDoc[];
}

interface GooglePickerDoc {
  url?: string;
  name?: string;
}

@Component({
  selector: 'ts-cotizacion-adjuntos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="ts-cot-adj">
      <div class="d-flex flex-wrap gap-2 mb-2">
        @if (cotizacionId()) {
          <label class="btn btn-sm btn-soft-primary mb-0" [class.disabled]="uploading()">
            {{ uploading() ? t('quotation.uploading') : t('quotation.uploadFile') }}
            <input type="file" class="d-none" (change)="onFileSelected($event)" [disabled]="uploading()" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" />
          </label>
        }
        @if (cloud()?.google?.configured) {
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="conectarGoogle()" [disabled]="cloud()?.google?.connected">
            {{ cloud()?.google?.connected ? t('quotation.googleConnected') : t('quotation.connectGoogle') }}
          </button>
          @if (cloud()?.google?.connected) {
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="elegirGoogleDrive()">
              {{ t('quotation.pickFromDrive') }}
            </button>
          }
        }
        @if (cloud()?.microsoft?.configured) {
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="conectarMicrosoft()" [disabled]="cloud()?.microsoft?.connected">
            {{ cloud()?.microsoft?.connected ? t('quotation.onedriveConnected') : t('quotation.connectOneDrive') }}
          </button>
          @if (cloud()?.microsoft?.connected) {
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="abrirOneDrive()">
              {{ t('quotation.pickFromOneDrive') }}
            </button>
          }
        }
        <button type="button" class="btn btn-sm btn-soft-primary" (click)="agregarEnlace()">+ {{ t('quotation.addLink') }}</button>
      </div>
      <p class="text-muted small">{{ t('quotation.attachmentsHint') }}</p>
      @for (adj of adjuntos(); track $index; let i = $index) {
        <div class="border rounded p-2 mb-2">
          @if (esArchivo(adj)) {
            <div class="small fw-semibold">{{ adj.titulo || adj.url }}</div>
            <a [href]="adj.url" target="_blank" rel="noopener" class="small">{{ adj.url }}</a>
          } @else {
            <select class="form-select form-select-sm mb-1" [ngModel]="adj.proveedor" (ngModelChange)="patch(i, 'proveedor', $event)" [name]="'p' + i">
              <option value="GOOGLE_DRIVE">Google Drive</option>
              <option value="ONEDRIVE">OneDrive</option>
              <option value="DROPBOX">Dropbox</option>
              <option value="OTRO">{{ t('quotation.other') }}</option>
            </select>
            <input class="form-control form-control-sm mb-1" [placeholder]="t('quotation.linkTitle')" [ngModel]="adj.titulo" (ngModelChange)="patch(i, 'titulo', $event)" />
            <input class="form-control form-control-sm" [placeholder]="t('quotation.linkUrl')" [ngModel]="adj.url" (ngModelChange)="patch(i, 'url', $event)" required />
          }
          <button type="button" class="btn btn-link btn-sm text-danger px-0 mt-1" (click)="quitar(i)">
            {{ esArchivo(adj) ? t('quotation.removeFile') : t('common.remove') }}
          </button>
        </div>
      }

      @if (msPickerOpen()) {
        <div class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.45)">
          <div class="modal-dialog modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">{{ t('quotation.pickFromOneDrive') }}</h5>
                <button type="button" class="btn-close" (click)="cerrarOneDrive()"></button>
              </div>
              <div class="modal-body">
                @if (msFolderStack().length > 1) {
                  <button type="button" class="btn btn-sm btn-light mb-2" (click)="subirCarpetaOneDrive()">
                    ← {{ t('common.back') }}
                  </button>
                }
                @if (msLoading()) {
                  <p class="text-muted mb-0">{{ t('common.loading') }}</p>
                } @else if (!msItems().length) {
                  <p class="text-muted mb-0">{{ t('quotation.oneDriveEmpty') }}</p>
                } @else {
                  <div class="list-group">
                    @for (it of msItems(); track $index) {
                      @if (it.folder) {
                        <button type="button" class="list-group-item list-group-item-action" (click)="entrarCarpetaOneDrive(it)">
                          <div class="fw-semibold small">📁 {{ it.name }}</div>
                        </button>
                      } @else if (it.file) {
                        <button type="button" class="list-group-item list-group-item-action" (click)="seleccionarOneDrive(it)">
                          <div class="fw-semibold small">{{ it.name }}</div>
                          <div class="text-muted small text-truncate">{{ it.webUrl }}</div>
                        </button>
                      }
                    }
                  </div>
                }
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" (click)="cerrarOneDrive()">{{ t('common.close') }}</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ts-cot-adj {
        display: block;
      }
    `,
  ],
})
export class TsCotizacionAdjuntosComponent implements OnInit {
  readonly cotizacionId = input<string | null>(null);
  readonly adjuntos = input.required<CotizacionAdjuntoDto[]>();
  readonly adjuntosChange = output<CotizacionAdjuntoDto[]>();
  readonly uploaded = output<CotizacionAdjuntoDto>();

  private readonly http = inject(HttpClient);
  private readonly toast = inject(UiToastService);
  readonly i18n = inject(UiI18nService);

  readonly cloud = signal<CloudConfig | null>(null);
  private gapiLoaded = false;
  readonly msPickerOpen = signal(false);
  readonly msItems = signal<OneDriveItem[]>([]);
  readonly msFolderStack = signal<Array<{ id: string; name: string }>>([{ id: 'root', name: 'OneDrive' }]);
  readonly msLoading = signal(false);
  readonly uploading = signal(false);
  private msAccessToken = '';
  private oauthTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.cargarConfig();
  }

  private cargarConfig(onLoaded?: (cfg: CloudConfig) => void): void {
    this.http.get<CloudConfig>('/api/web/v1/integraciones/cloud/config').subscribe({
      next: (c) => {
        this.cloud.set(c);
        onLoaded?.(c);
      },
      error: () => this.cloud.set(null),
    });
  }

  agregarEnlace(): void {
    const next = [...this.adjuntos(), { proveedor: 'GOOGLE_DRIVE', titulo: '', url: '' }];
    this.adjuntosChange.emit(next);
  }

  quitar(i: number): void {
    const list = this.adjuntos();
    const adj = list[i];
    if (!adj) {
      return;
    }
    const next = list.filter((_, idx) => idx !== i);

    // Enlaces: solo se quitan del draft local
    if (!this.esArchivo(adj)) {
      this.adjuntosChange.emit(next);
      return;
    }

    // Archivos: si ya existen en backend, eliminar servidor + storage
    const cotId = this.cotizacionId();
    if (!cotId || !adj.id) {
      this.adjuntosChange.emit(next);
      return;
    }

    this.http.delete<void>(`/api/web/v1/ventas/cotizaciones/${cotId}/adjuntos/${adj.id}`).subscribe({
      next: () => {
        this.adjuntosChange.emit(next);
        this.toast.success(this.t('quotation.attachmentDeleted'));
      },
      error: () => this.toast.error(this.t('quotation.attachmentDeleteError')),
    });
  }

  patch(i: number, field: keyof CotizacionAdjuntoDto, value: string): void {
    const next = this.adjuntos().map((a, idx) => (idx === i ? { ...a, [field]: value } : a));
    this.adjuntosChange.emit(next);
  }

  onFileSelected(ev: Event): void {
    const id = this.cotizacionId();
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!id || !file) {
      return;
    }
    const fd = new FormData();
    fd.append('archivo', file);
    this.uploading.set(true);
    this.http.post<CotizacionAdjuntoDto>(`/api/web/v1/ventas/cotizaciones/${id}/adjuntos/archivo`, fd).subscribe({
      next: (adj) => {
        this.uploading.set(false);
        this.uploaded.emit({ ...adj, tipo: 'ARCHIVO' });
        this.toast.success(this.t('quotation.fileUploaded'));
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        this.toast.error(this.t('quotation.fileUploadError'));
      },
    });
  }

  conectarGoogle(): void {
    const wasConnected = this.cloud()?.google?.connected ?? false;
    this.http.get<{ url: string }>('/api/web/v1/integraciones/cloud/google/auth-url').subscribe({
      next: (r) => {
        const w = window.open(r.url, 'google_oauth', 'width=520,height=640');
        this.babysitPopup(w, 'google', wasConnected);
      },
      error: () => this.toast.error(this.t('quotation.cloudNotConfigured')),
    });
  }

  conectarMicrosoft(): void {
    const wasConnected = this.cloud()?.microsoft?.connected ?? false;
    this.http.get<{ url: string }>('/api/web/v1/integraciones/cloud/microsoft/auth-url').subscribe({
      next: (r) => {
        const w = window.open(r.url, 'ms_oauth', 'width=520,height=640');
        this.babysitPopup(w, 'microsoft', wasConnected);
      },
      error: () => this.toast.error(this.t('quotation.cloudNotConfigured')),
    });
  }

  elegirGoogleDrive(): void {
    const cfg = this.cloud()?.google;
    if (!cfg?.apiKey || !cfg.clientId) {
      return;
    }
    this.http.get<{ accessToken: string }>('/api/web/v1/integraciones/cloud/google/access-token').subscribe({
      next: (tok) => this.abrirPicker(tok.accessToken, cfg.apiKey!),
      error: () => this.toast.error(this.t('quotation.reconnectGoogle')),
    });
  }

  abrirOneDrive(): void {
    this.msFolderStack.set([{ id: 'root', name: 'OneDrive' }]);
    this.http.get<{ accessToken: string }>('/api/web/v1/integraciones/cloud/microsoft/access-token').subscribe({
      next: (tok) => {
        this.msAccessToken = tok.accessToken;
        this.msPickerOpen.set(true);
        this.cargarCarpetaOneDrive('root');
      },
      error: () => this.toast.error(this.t('quotation.reconnectOneDrive')),
    });
  }

  entrarCarpetaOneDrive(it: OneDriveItem): void {
    if (!it.id) {
      return;
    }
    this.msFolderStack.update((stack) => [...stack, { id: it.id!, name: it.name ?? 'Carpeta' }]);
    this.cargarCarpetaOneDrive(it.id);
  }

  subirCarpetaOneDrive(): void {
    const stack = this.msFolderStack();
    if (stack.length <= 1) {
      return;
    }
    const next = stack.slice(0, -1);
    this.msFolderStack.set(next);
    this.cargarCarpetaOneDrive(next[next.length - 1].id);
  }

  private cargarCarpetaOneDrive(folderId: string): void {
    if (!this.msAccessToken) {
      return;
    }
    const url =
      folderId === 'root'
        ? 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100'
        : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$top=100`;
    this.msLoading.set(true);
    this.http
      .get<{ value?: OneDriveItem[] }>(url, {
        headers: { Authorization: `Bearer ${this.msAccessToken}` },
      })
      .subscribe({
        next: (r) => {
          this.msItems.set(r.value ?? []);
          this.msLoading.set(false);
        },
        error: () => {
          this.msLoading.set(false);
          this.toast.error(this.t('quotation.oneDriveListError'));
        },
      });
  }

  seleccionarOneDrive(it: OneDriveItem): void {
    if (!it.webUrl) {
      return;
    }
    const next = [...this.adjuntos(), { proveedor: 'ONEDRIVE', titulo: it.name ?? 'OneDrive', url: it.webUrl }];
    this.adjuntosChange.emit(next);
    this.msPickerOpen.set(false);
  }

  cerrarOneDrive(): void {
    this.msPickerOpen.set(false);
  }

  private abrirPicker(accessToken: string, apiKey: string): void {
    const run = () => {
      const g = window.google?.picker;
      if (!g) {
        return;
      }
      const builder = new g.PickerBuilder();
      builder
        .addView(g.ViewId.DOCS)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data: GooglePickerResponse) => {
          if (data[g.Response.ACTION] === g.Action.PICKED) {
            const docs = (data[g.Response.DOCUMENTS] as GooglePickerDoc[]) ?? data.docs ?? [];
            const doc = docs[0];
            if (doc?.url) {
              const next = [
                ...this.adjuntos(),
                { proveedor: 'GOOGLE_DRIVE', titulo: doc.name ?? 'Google Drive', url: doc.url },
              ];
              this.adjuntosChange.emit(next);
            }
          }
        });
      builder.build().setVisible(true);
    };
    if (this.gapiLoaded && window.google?.picker) {
      run();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => {
      (window as unknown as { gapi: { load: (n: string, cb: () => void) => void } }).gapi.load('picker', () => {
        this.gapiLoaded = true;
        run();
      });
    };
    document.body.appendChild(s);
  }

  private babysitPopup(w: Window | null, provider: 'google' | 'microsoft', wasConnected: boolean): void {
    if (!w) {
      return;
    }
    if (this.oauthTimer) {
      clearInterval(this.oauthTimer);
    }
    this.oauthTimer = setInterval(() => {
      if (w.closed) {
        clearInterval(this.oauthTimer!);
        this.oauthTimer = null;
        this.cargarConfig((cfg) => {
          if (wasConnected) {
            return;
          }
          if (provider === 'google' && cfg.google?.connected) {
            this.toast.success(this.t('quotation.googleConnectedToast'));
          }
          if (provider === 'microsoft' && cfg.microsoft?.connected) {
            this.toast.success(this.t('quotation.onedriveConnectedToast'));
          }
        });
      }
    }, 900);
  }

  esArchivo(adj: CotizacionAdjuntoDto): boolean {
    return adj.tipo === 'ARCHIVO' || !!adj.nombreArchivo;
  }

  t(key: string): string {
    return this.i18n.t(key);
  }
}
