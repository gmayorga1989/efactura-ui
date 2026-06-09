import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import { UiToastService } from '../../../../core/ui/ui-toast.service';
import {
  MaestrosService,
  type ClienteProveedor,
  type ClienteProveedorPayload,
  type ProductoServicio,
  type ProductoServicioPayload,
} from '../../../../pages/maestros/maestros.service';
import { IVA_CODIGO_OPTIONS } from '../../../../pages/facturas/facturas.service';

@Component({
  selector: 'ts-maestro-rapido-modals',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (clienteOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarCliente()"></div>
      <section
        class="ts-form-modal ts-form-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cliente-rapido-title"
      >
        <header class="ts-form-modal__header ts-form-modal__header--compact">
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('invoice.eyebrow') }}</p>
            <h3 id="cliente-rapido-title" class="mb-0">{{ t('invoice.quickNewCustomer') }}</h3>
            <p class="ts-form-modal__subtitle mb-0">{{ t('invoice.quickNewCustomerHint') }}</p>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarCliente()">
            &times;
          </button>
        </header>
        <form class="ts-form-modal__body" (ngSubmit)="guardarCliente()">
          <div class="row g-2">
            <div class="col-4">
              <label class="form-label">{{ t('masters.identificationType') }}</label>
              <select class="form-select form-select-sm" [(ngModel)]="cliente.tipoIdentificacion" name="cr-tipo">
                <option value="04">04 — RUC</option>
                <option value="05">05 — {{ t('masters.idCard') }}</option>
                <option value="06">06 — {{ t('masters.passport') }}</option>
                <option value="07">07 — {{ t('masters.finalConsumer') }}</option>
              </select>
            </div>
            <div class="col-8">
              <label class="form-label">{{ t('masters.identification') }}</label>
              <div class="input-group input-group-sm">
                <input class="form-control" [(ngModel)]="cliente.identificacion" name="cr-id" required />
                @if (cliente.tipoIdentificacion === '04' || cliente.tipoIdentificacion === '05') {
                  <button
                    type="button"
                    class="btn btn-soft-primary"
                    (click)="consultarIdentificacion()"
                    [disabled]="consultandoRuc()"
                  >
                    @if (cliente.tipoIdentificacion === '04') {
                      {{ consultandoRuc() ? t('masters.querying') : t('masters.queryRuc') }}
                    } @else {
                      {{ consultandoRuc() ? t('masters.querying') : t('masters.queryCedula') }}
                    }
                  </button>
                }
              </div>
            </div>
            <div class="col-12">
              <label class="form-label">{{ t('masters.businessName') }}</label>
              <input class="form-control form-control-sm" [(ngModel)]="cliente.razonSocial" name="cr-rs" required />
            </div>
            <div class="col-12">
              <label class="form-label">{{ t('masters.email') }}</label>
              <input type="email" class="form-control form-control-sm" [(ngModel)]="cliente.email" name="cr-mail" />
            </div>
          </div>
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarCliente()" [disabled]="guardando()">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="guardando()">
              {{ guardando() ? t('common.loading') : t('common.save') }}
            </button>
          </footer>
        </form>
      </section>
    }

    @if (itemOpen()) {
      <div class="ts-modal-backdrop" (click)="cerrarItem()"></div>
      <section
        class="ts-form-modal ts-form-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-rapido-title"
      >
        <header class="ts-form-modal__header ts-form-modal__header--compact">
          <div class="ts-form-modal__head-text">
            <p class="ts-form-modal__eyebrow mb-0">{{ t('invoice.eyebrow') }}</p>
            <h3 id="item-rapido-title" class="mb-0">{{ t('invoice.quickNewItem') }}</h3>
            <p class="ts-form-modal__subtitle mb-0">{{ t('invoice.quickNewItemHint') }}</p>
          </div>
          <button type="button" class="ts-form-modal__close" [attr.aria-label]="t('common.close')" (click)="cerrarItem()">
            &times;
          </button>
        </header>
        <form class="ts-form-modal__body" (ngSubmit)="guardarItem()">
          <div class="row g-2">
            <div class="col-5">
              <label class="form-label">{{ t('masters.type') }}</label>
              <select class="form-select form-select-sm" [(ngModel)]="item.tipo" name="ir-tipo">
                <option value="PRODUCTO">{{ t('menu.products') }}</option>
                <option value="SERVICIO">{{ t('menu.services') }}</option>
              </select>
            </div>
            <div class="col-7">
              <label class="form-label">{{ t('masters.mainCode') }}</label>
              <input
                class="form-control form-control-sm"
                [(ngModel)]="item.codigoPrincipal"
                name="ir-cod"
                [placeholder]="t('invoice.quickItemCodePlaceholder')"
              />
            </div>
            <div class="col-12">
              <label class="form-label">{{ t('masters.description') }}</label>
              <input class="form-control form-control-sm" [(ngModel)]="item.descripcion" name="ir-desc" required />
            </div>
            <div class="col-6">
              <label class="form-label">{{ t('masters.unitPrice') }}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                class="form-control form-control-sm"
                [(ngModel)]="item.precioUnitario"
                name="ir-precio"
                required
              />
            </div>
            <div class="col-6">
              <label class="form-label">{{ t('invoice.ivaRate') }}</label>
              <select class="form-select form-select-sm" [(ngModel)]="item.ivaCodigo" name="ir-iva">
                @for (opt of ivaOpciones; track opt.code) {
                  <option [value]="opt.code">{{ opt.label }}</option>
                }
              </select>
            </div>
          </div>
          <footer class="ts-form-modal__footer">
            <button type="button" class="btn btn-light btn-sm" (click)="cerrarItem()" [disabled]="guardando()">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="guardando()">
              {{ guardando() ? t('common.loading') : t('common.save') }}
            </button>
          </footer>
        </form>
      </section>
    }
  `,
})
export class TsMaestroRapidoModalsComponent {
  readonly clienteOpen = input(false);
  readonly itemOpen = input(false);

  readonly clienteOpenChange = output<boolean>();
  readonly itemOpenChange = output<boolean>();
  readonly clienteCreado = output<ClienteProveedor>();
  readonly itemCreado = output<ProductoServicio>();

  private readonly maestros = inject(MaestrosService);
  private readonly toast = inject(UiToastService);
  private readonly i18n = inject(UiI18nService);

  readonly guardando = signal(false);
  readonly consultandoRuc = signal(false);

  readonly ivaOpciones = Object.entries(IVA_CODIGO_OPTIONS).map(([code, label]) => ({ code, label }));

  cliente = this.nuevoClienteForm();
  item = this.nuevoItemForm();

  t(key: string): string {
    return this.i18n.t(key);
  }

  cerrarCliente(): void {
    this.clienteOpenChange.emit(false);
  }

  cerrarItem(): void {
    this.itemOpenChange.emit(false);
  }

  consultarIdentificacion(): void {
    const id = this.cliente.identificacion.trim();
    if (this.cliente.tipoIdentificacion === '04') {
      if (!/^\d{13}$/.test(id)) {
        this.toast.error(this.t('masters.rucInvalid'));
        return;
      }
      this.consultandoRuc.set(true);
      this.maestros.consultaRuc('clientes', id).subscribe({
        next: (res) => {
          this.consultandoRuc.set(false);
          if (!res.encontrado) {
            this.toast.error(this.t('masters.rucNotFound'));
            return;
          }
          this.cliente.razonSocial = res.razonSocial?.trim() || this.cliente.razonSocial;
          this.toast.success(this.t('masters.sriLoaded'));
        },
        error: () => {
          this.consultandoRuc.set(false);
          this.toast.error(this.t('masters.rucLookupError'));
        },
      });
      return;
    }
    if (!/^\d{10}$/.test(id)) {
      this.toast.error(this.t('masters.cedulaInvalid'));
      return;
    }
    this.consultandoRuc.set(true);
    this.maestros.consultaCedula('clientes', id).subscribe({
      next: (res) => {
        this.consultandoRuc.set(false);
        if (!res.encontrado || !res.nombres?.trim()) {
          this.toast.error(this.t('masters.cedulaNotFound'));
          return;
        }
        this.cliente.razonSocial = res.nombres.trim();
        this.toast.success(this.t('masters.cedulaLoaded'));
      },
      error: () => {
        this.consultandoRuc.set(false);
        this.toast.error(this.t('masters.cedulaLookupError'));
      },
    });
  }

  guardarCliente(): void {
    const tipo = this.cliente.tipoIdentificacion;
    const identificacion = this.cliente.identificacion.trim();
    const razonSocial = this.cliente.razonSocial.trim();
    if (!identificacion || !razonSocial) {
      this.toast.error(this.t('masters.thirdPartyRequired'));
      return;
    }
    if (tipo === '04' && !/^\d{13}$/.test(identificacion)) {
      this.toast.error(this.t('masters.rucDigitsError'));
      return;
    }
    if (tipo === '05' && !/^\d{10}$/.test(identificacion)) {
      this.toast.error(this.t('masters.idCardDigitsError'));
      return;
    }
    if (tipo === '06' && (identificacion.length < 3 || identificacion.length > 20)) {
      this.toast.error(this.t('masters.passportLengthError'));
      return;
    }

    const payload: ClienteProveedorPayload = {
      tipoIdentificacion: tipo,
      identificacion,
      razonSocial,
      email: this.cliente.email.trim() || undefined,
      tipoTercero: 'CLIENTE',
      customData: {},
    };

    this.guardando.set(true);
    this.maestros.create('clientes', payload).subscribe({
      next: (row) => {
        this.guardando.set(false);
        this.toast.success(this.t('invoice.quickCustomerCreated'));
        this.clienteCreado.emit(row as ClienteProveedor);
        this.cliente = this.nuevoClienteForm();
        this.cerrarCliente();
      },
      error: () => {
        this.guardando.set(false);
        this.toast.error(this.t('masters.saveRecordError'));
      },
    });
  }

  guardarItem(): void {
    const descripcion = this.item.descripcion.trim();
    const precio = Number(this.item.precioUnitario);
    if (!descripcion) {
      this.toast.error(this.t('masters.productRequired'));
      return;
    }
    if (!Number.isFinite(precio) || precio < 0) {
      this.toast.error(this.t('masters.productRequired'));
      return;
    }

    let codigo = this.item.codigoPrincipal.trim();
    if (!codigo) {
      const prefix = this.item.tipo === 'SERVICIO' ? 'SRV' : 'PRD';
      codigo = `${prefix}-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    }

    const payload: ProductoServicioPayload = {
      codigoPrincipal: codigo,
      descripcion,
      tipo: this.item.tipo,
      precioUnitario: precio,
      ivaCodigo: this.item.ivaCodigo || '4',
      preciosListas: [{ listaCodigo: 'BASE', precio }],
      customData: {},
    };

    const tipoEnt = this.item.tipo === 'SERVICIO' ? 'servicios' : 'productos';
    this.guardando.set(true);
    this.maestros.create(tipoEnt, payload).subscribe({
      next: (row) => {
        this.guardando.set(false);
        this.toast.success(this.t('invoice.quickItemCreated'));
        this.itemCreado.emit(row as ProductoServicio);
        this.item = this.nuevoItemForm();
        this.cerrarItem();
      },
      error: () => {
        this.guardando.set(false);
        this.toast.error(this.t('masters.saveRecordError'));
      },
    });
  }

  private nuevoClienteForm() {
    return {
      tipoIdentificacion: '04',
      identificacion: '',
      razonSocial: '',
      email: '',
    };
  }

  private nuevoItemForm() {
    return {
      tipo: 'PRODUCTO' as 'PRODUCTO' | 'SERVICIO',
      codigoPrincipal: '',
      descripcion: '',
      precioUnitario: 0,
      ivaCodigo: '4',
    };
  }
}
