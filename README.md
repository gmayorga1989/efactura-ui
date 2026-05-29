# eFactura UI (`efactura-ui`)

Repositorio independiente — Angular 19 standalone. Producción: **https://efactura.appluxora.com**.

Deploy automático: push a `main` → GitHub Actions → `/opt/efactura-ui/html` en el Droplet. Ver [docs en monorepo](../../docs/DEPLOY-FRONTENDS-APPLUXORA.md).

## Requisitos

Node.js 20+ y npm en PATH.

## Comandos

```bash
npm install
npm start
```

Abre `http://localhost:4200` (proxy API → `localhost:8080`).

## Próximos pasos

- Añadir `src/app/core` (auth, interceptors, tenant).
- Añadir Atomic Design bajo `src/app/shared/ui`.
- Conectar con API `http://localhost:8080` (proxy en `angular.json`).

## Producción

`environment.prod.ts` define `apiOrigin: https://api-efactura.appluxora.com`. Un interceptor antepone esa base a todas las rutas `/api/...` (HttpClient y refresh token).

Build:

```bash
npm run build
```

Sirve `dist/efactura-ec` en `:4200` (nginx o `npx serve`). Las URLs de Identity/Suite siguen viniendo del backend (`GET /api/public/v1/auth/suite-identity`).

Desarrollo local: `apiOrigin` vacío + proxy `proxy.conf.json` → `localhost:8080`.

### Error «Token Suite inválido o expirado» (401 en `/auth/suite/exchange`)

Suele ocurrir con **login en Identity remoto** (`159.89.41.88:8092`) y **efactura-app local** (`localhost:8080`):

| Causa | Qué hacer |
|-------|-----------|
| `SUITE_JWT_SECRET` distinto | Mismo secreto en identity-gateway y efactura-app |
| `SUITE_JWT_ISSUER` distinto | Local debe usar `http://159.89.41.88:8092`, no `localhost:8092` |
| Usuario sin membresía | 403 distinto; vincular `empresa.suite_company_id` al `company_id` del token |

Plantilla: `backend/efactura-app/src/main/resources/application-local.yml.example` → copiar a `application-local.yml`.
