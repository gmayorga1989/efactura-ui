import { HttpErrorResponse } from '@angular/common/http';

const GENERIC_HTTP_TITLES = new Set([
  'Bad Request',
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Method Not Allowed',
  'Conflict',
  'Precondition Required',
  'Unprocessable Entity',
  'Internal Server Error',
  'Service Unavailable',
]);

export interface HttpErrorResolveOptions {
  fallback: string;
  /** Solo si el cuerpo de la respuesta no trae mensaje util. */
  statusFallbacks?: Partial<Record<number, string>>;
}

export function extractApiErrorMessage(err: HttpErrorResponse, fallback: string): string {
  const fromBody = extractMessageFromBody(err.error);
  if (fromBody) {
    return fromBody;
  }
  return fallback;
}

export function resolveHttpErrorMessage(err: unknown, options: HttpErrorResolveOptions): string {
  if (err instanceof HttpErrorResponse) {
    const fromApi = extractApiErrorMessage(err, '');
    if (fromApi) {
      return fromApi;
    }
    const statusMsg = options.statusFallbacks?.[err.status];
    if (statusMsg) {
      return statusMsg;
    }
  }
  return options.fallback;
}

/** Mensaje concreto para fallos al emitir factura (usa detalle del API cuando existe). */
export function resolveInvoiceEmitError(err: unknown, t: (key: string) => string): string {
  return resolveHttpErrorMessage(err, {
    fallback: t('invoice.emitErrorUnknown'),
    statusFallbacks: {
      0: t('invoice.emitErrorNetwork'),
      400: t('invoice.emitErrorBadRequest'),
      401: t('invoice.emitErrorUnauthorized'),
      403: t('invoice.emitErrorForbidden'),
      404: t('invoice.emitErrorNotFound'),
      409: t('invoice.emitErrorConflict'),
      422: t('invoice.emitErrorUnprocessable'),
      428: t('invoice.emitErrorNoCertificate'),
      500: t('invoice.emitErrorServer'),
      503: t('invoice.emitErrorServer'),
    },
  });
}

/** Mensaje concreto para guardar/actualizar borrador de factura. */
export function resolveInvoiceDraftSaveError(err: unknown, t: (key: string) => string): string {
  return resolveHttpErrorMessage(err, {
    fallback: t('invoice.draftSaveErrorUnknown'),
    statusFallbacks: {
      0: t('invoice.emitErrorNetwork'),
      400: t('invoice.draftSaveErrorBadRequest'),
      404: t('invoice.draftSaveErrorNotFound'),
      409: t('invoice.draftSaveErrorConflict'),
      500: t('invoice.emitErrorServer'),
    },
  });
}

function extractMessageFromBody(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }
  if (!body || typeof body !== 'object') {
    return null;
  }
  const o = body as Record<string, unknown>;

  const detail = pickNonEmptyString(o['detail']);
  if (detail) {
    return detail;
  }

  const message = pickNonEmptyString(o['message']);
  if (message) {
    return message;
  }

  const errors = o['errors'];
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors
      .map((e) => {
        if (typeof e === 'string') {
          return e.trim();
        }
        if (e && typeof e === 'object') {
          const row = e as Record<string, unknown>;
          const field = pickNonEmptyString(row['field']);
          const msg = pickNonEmptyString(row['message']) ?? pickNonEmptyString(row['defaultMessage']);
          if (field && msg) {
            return `${field}: ${msg}`;
          }
          return msg ?? field;
        }
        return '';
      })
      .filter((s): s is string => !!s);
    if (parts.length) {
      return parts.join('; ');
    }
  }

  const title = pickNonEmptyString(o['title']);
  if (title && !GENERIC_HTTP_TITLES.has(title)) {
    return title;
  }

  const error = pickNonEmptyString(o['error']);
  if (error && error.toLowerCase() !== 'precondition required') {
    return error;
  }

  return null;
}

function pickNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const t = value.trim();
  return t.length > 0 ? t : null;
}
