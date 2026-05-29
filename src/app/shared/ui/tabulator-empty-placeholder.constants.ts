/** Ilustración por defecto para grids sin contexto específico. */
export const TABULATOR_EMPTY_DEFAULT_IMAGE = '/assets/illustrations/grid-generic.svg';

export const TABULATOR_EMPTY_TEAM_IMAGE = '/assets/illustrations/grid-team.svg';
export const TABULATOR_EMPTY_KPI_IMAGE = '/assets/illustrations/grid-kpi.svg';
export const TABULATOR_EMPTY_LINES_IMAGE = '/assets/illustrations/grid-lines.svg';

/** Contexto del estado vacío (textos i18n + ilustración). */
export type TabulatorEmptyContext =
  | 'generic'
  | 'users'
  | 'roles'
  | 'invitations'
  | 'branches'
  | 'emissionPoints'
  | 'documents'
  | 'masters'
  | 'addresses'
  | 'prices'
  | 'taxes'
  | 'sriAudit'
  | 'sriWebhooks'
  | 'sriLogs'
  | 'invoiceLines'
  | 'comprobanteLines'
  | 'quotations';

export interface TabulatorEmptyContextSpec {
  titleKey: string;
  descriptionKey: string;
  imageSrc: string;
}

export const TABULATOR_EMPTY_CONTEXTS: Record<TabulatorEmptyContext, TabulatorEmptyContextSpec> = {
  generic: {
    titleKey: 'gridEmpty.genericTitle',
    descriptionKey: 'gridEmpty.genericDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  users: {
    titleKey: 'gridEmpty.usersTitle',
    descriptionKey: 'gridEmpty.usersDescription',
    imageSrc: TABULATOR_EMPTY_TEAM_IMAGE,
  },
  roles: {
    titleKey: 'gridEmpty.rolesTitle',
    descriptionKey: 'gridEmpty.rolesDescription',
    imageSrc: TABULATOR_EMPTY_TEAM_IMAGE,
  },
  invitations: {
    titleKey: 'gridEmpty.invitationsTitle',
    descriptionKey: 'gridEmpty.invitationsDescription',
    imageSrc: TABULATOR_EMPTY_TEAM_IMAGE,
  },
  branches: {
    titleKey: 'gridEmpty.branchesTitle',
    descriptionKey: 'gridEmpty.branchesDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  emissionPoints: {
    titleKey: 'gridEmpty.emissionPointsTitle',
    descriptionKey: 'gridEmpty.emissionPointsDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  documents: {
    titleKey: 'gridEmpty.documentsTitle',
    descriptionKey: 'gridEmpty.documentsDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  masters: {
    titleKey: 'gridEmpty.mastersTitle',
    descriptionKey: 'gridEmpty.mastersDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  addresses: {
    titleKey: 'gridEmpty.addressesTitle',
    descriptionKey: 'gridEmpty.addressesDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  prices: {
    titleKey: 'gridEmpty.pricesTitle',
    descriptionKey: 'gridEmpty.pricesDescription',
    imageSrc: TABULATOR_EMPTY_LINES_IMAGE,
  },
  taxes: {
    titleKey: 'gridEmpty.taxesTitle',
    descriptionKey: 'gridEmpty.taxesDescription',
    imageSrc: TABULATOR_EMPTY_LINES_IMAGE,
  },
  sriAudit: {
    titleKey: 'gridEmpty.sriAuditTitle',
    descriptionKey: 'gridEmpty.sriAuditDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  sriWebhooks: {
    titleKey: 'gridEmpty.sriWebhooksTitle',
    descriptionKey: 'gridEmpty.sriWebhooksDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  sriLogs: {
    titleKey: 'gridEmpty.sriLogsTitle',
    descriptionKey: 'gridEmpty.sriLogsDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
  invoiceLines: {
    titleKey: 'gridEmpty.invoiceLinesTitle',
    descriptionKey: 'gridEmpty.invoiceLinesDescription',
    imageSrc: TABULATOR_EMPTY_LINES_IMAGE,
  },
  comprobanteLines: {
    titleKey: 'gridEmpty.comprobanteLinesTitle',
    descriptionKey: 'gridEmpty.comprobanteLinesDescription',
    imageSrc: TABULATOR_EMPTY_LINES_IMAGE,
  },
  quotations: {
    titleKey: 'gridEmpty.quotationsTitle',
    descriptionKey: 'gridEmpty.quotationsDescription',
    imageSrc: TABULATOR_EMPTY_DEFAULT_IMAGE,
  },
};
