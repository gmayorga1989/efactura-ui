/** Respuesta de `GET /api/web/v1/me` (Jackson en camelCase). */
export interface EmpresaMeDto {
  id: string;
  ruc: string;
  slug: string | null;
  razonSocial: string;
  nombreComercial: string | null;
  obligadoContabilidad: boolean;
  contribuyenteEspecial: string | null;
  exportadorHabitual: boolean;
  calificacionArtesanal: boolean;
  codigoArtesano: string | null;
  agenteRetencion: boolean;
  ambienteSri: number;
  tipoEmision: number;
  direccionMatriz: string | null;
  logoUrl: string | null;
  timezone: string;
  paisIso?: string;
  estado: string;
  configExtra: Record<string, unknown>;
}

export interface MeFeatures {
  puedeAdministrarEmpresa: boolean;
  puedeEmitir: boolean;
  puedeGestionarVentas: boolean;
  puedeGestionarProveedores: boolean;
  puedeMonitorComprobantes: boolean;
  puedeVerReportes: boolean;
  puedeGestionarUsuarios: boolean;
  puedeApiKeys: boolean;
  esPlataforma: boolean;
  puedeAbrirCarteraSuite: boolean;
  puedeAbrirPosSuite: boolean;
}

export interface MeResponse {
  identidadId: string;
  membresiaId: string | null;
  email: string;
  nombre: string;
  avatarUrl?: string | null;
  ultimoPing?: string | null;
  enLinea?: boolean | null;
  empresaId: string | null;
  empresa: EmpresaMeDto | null;
  permisos: string[];
  roles: string[];
  features: MeFeatures;
  menuHints: string[];
}

export interface TokenResponse {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface LoginResult {
  loginStep: string;
  tokens: TokenResponse | null;
  sessionTicket: string | null;
  empresas: EmpresaLoginOptionDto[] | null;
  mfaRequired?: boolean | null;
}

export interface EmpresaLoginOptionDto {
  empresaId: string | null;
  esPlataforma: boolean;
  razonSocial: string;
  nombreComercial: string | null;
  ruc: string | null;
  slug: string | null;
  seleccionable: boolean;
  motivoNoSeleccion: string | null;
}

/** `GET /api/web/v1/mis-empresas` */
export interface MiEmpresaResumenDto {
  membresiaId: string;
  empresaId: string | null;
  esPlataforma: boolean;
  razonSocial: string;
  nombreComercial: string | null;
  ruc: string | null;
  slug: string | null;
  estadoMembresia: string;
  empresaActiva: boolean;
  esContextoActual: boolean;
}

/** GET /api/public/v1/auth/suite-identity */
export interface SuiteIdentityPublicStatus {
  enabled: boolean;
  /** Flag efactura.suite.identity.enabled (sin validar cripto). */
  featureFlag?: boolean;
  /** Issuer + secreto HS256 >= 32 bytes (alineable con el gateway). */
  cryptoReady?: boolean;
  identityBaseUrl: string;
  issuer: string;
  companySlug: string;
  /** URL base del shell Suite (p. ej. http://localhost:4300). */
  suiteShellBaseUrl?: string;
  /** URL base UI Cartera (referencia / futuros deep links). */
  carteraBaseUrl?: string;
  /** URL base UI POS (referencia / futuros deep links). */
  posBaseUrl?: string;
}

/** POST al Identity Gateway /api/v1/auth/login */
export interface IdentityGatewayTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
  companyId?: string;
  companySlug?: string;
  scopes?: string[];
}
