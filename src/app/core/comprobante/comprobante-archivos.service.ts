import { HttpClient } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { forkJoin, Observable, defer, finalize } from 'rxjs';

import { UiToastService } from '../ui/ui-toast.service';

import { UiI18nService } from '../i18n/ui-i18n.service';



@Injectable({ providedIn: 'root' })

export class ComprobanteArchivosService {

  private readonly http = inject(HttpClient);

  private readonly toast = inject(UiToastService);

  private readonly i18n = inject(UiI18nService);



  private cargando = false;



  abrirRide(comprobanteId: string): void {

    if (this.cargando) {

      return;

    }

    this.cargando = true;

    const loadingId = this.toast.loading(this.i18n.t('invoice.rideLoading'));

    this.http

      .get(`/api/web/v1/comprobantes/${comprobanteId}/ride`, { responseType: 'blob' })

      .pipe(finalize(() => (this.cargando = false)))

      .subscribe({

        next: (blob) => {

          this.toast.dismiss(loadingId);

          const url = URL.createObjectURL(blob);

          window.open(url, '_blank', 'noopener');

          setTimeout(() => URL.revokeObjectURL(url), 120_000);

        },

        error: () => {

          this.toast.dismiss(loadingId);

          this.toast.error(this.i18n.t('invoice.rideError'));

        },

      });

  }



  abrirXmlAutorizado(comprobanteId: string): void {

    if (this.cargando) {

      return;

    }

    this.cargando = true;

    const loadingId = this.toast.loading(this.i18n.t('invoice.xmlLoading'));

    this.http

      .get(`/api/web/v1/comprobantes/${comprobanteId}/xml-autorizado`, { responseType: 'blob' })

      .pipe(finalize(() => (this.cargando = false)))

      .subscribe({

        next: (blob) => {

          this.toast.dismiss(loadingId);

          const url = URL.createObjectURL(blob);

          window.open(url, '_blank', 'noopener');

          setTimeout(() => URL.revokeObjectURL(url), 120_000);

        },

        error: () => {

          this.toast.dismiss(loadingId);

          this.toast.error(this.i18n.t('invoice.xmlError'));

        },

      });

  }



  abrirRideYXml(comprobanteId: string): void {

    this.abrirRide(comprobanteId);

    setTimeout(() => this.abrirXmlAutorizado(comprobanteId), 400);

  }



  descargarTodo(comprobanteId: string, numero: string): void {

    if (this.cargando) {

      return;

    }

    this.cargando = true;

    const loadingId = this.toast.loading(this.i18n.t('invoice.downloadAllLoading'));

    const base = `/api/web/v1/comprobantes/${comprobanteId}`;

    forkJoin({

      ride: this.http.get(`${base}/ride`, { responseType: 'blob' }),

      xml: this.http.get(`${base}/xml-autorizado`, { responseType: 'blob' }),

    })

      .pipe(finalize(() => (this.cargando = false)))

      .subscribe({

        next: ({ ride, xml }) => {

          this.toast.dismiss(loadingId);

          this.descargarBlob(ride, `RIDE-${numero}.pdf`);

          setTimeout(() => this.descargarBlob(xml, `XML-${numero}.xml`), 300);

        },

        error: () => {

          this.toast.dismiss(loadingId);

          this.toast.error(this.i18n.t('invoice.downloadAllError'));

        },

      });

  }



  reprocesarAutorizacion(comprobanteId: string): Observable<unknown> {

    return this.conProgreso(

      this.i18n.t('invoice.reprocessLoading'),

      this.http.post(`/api/web/v1/comprobantes/${comprobanteId}/reprocesar-autorizacion`, {}),

    );

  }



  reemitirAlSri(comprobanteId: string): Observable<unknown> {

    return this.conProgreso(

      this.i18n.t('invoice.resendToSriLoading'),

      this.http.post(`/api/web/v1/comprobantes-electronicos/${comprobanteId}/reemitir-sri`, {}),

    );

  }



  reenviarCorreo(comprobanteId: string, emailReceptor?: string): Observable<{ enviado: boolean }> {

    const body =
      emailReceptor != null && emailReceptor.trim() !== ''
        ? { emailReceptor: emailReceptor.trim() }
        : {};

    return this.conProgreso(

      this.i18n.t('invoice.resendEmailLoading'),

      this.http.post<{ enviado: boolean }>(`/api/web/v1/comprobantes/${comprobanteId}/reenviar-correo`, body),

    );

  }



  private conProgreso<T>(mensaje: string, obs: Observable<T>): Observable<T> {

    return defer(() => {

      if (this.cargando) {

        throw new Error('busy');

      }

      this.cargando = true;

      const loadingId = this.toast.loading(mensaje);

      return obs.pipe(

        finalize(() => {

          this.cargando = false;

          this.toast.dismiss(loadingId);

        }),

      );

    });

  }



  private descargarBlob(blob: Blob, filename: string): void {

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = filename;

    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 5000);

  }

}


