import { HttpInterceptorFn } from '@angular/common/http';
import { isEfacturaApiPath, resolveApiUrl } from './api/api-origin';

/** En prod antepone environment.apiOrigin a las peticiones /api del backend eFactura. */
export const apiOriginInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isEfacturaApiPath(req.url)) {
    return next(req);
  }
  const url = resolveApiUrl(req.url);
  if (url === req.url) {
    return next(req);
  }
  return next(req.clone({ url }));
};
