import type { UiI18nService } from '../../core/i18n/ui-i18n.service';
import {
  TABULATOR_EMPTY_CONTEXTS,
  TABULATOR_EMPTY_DEFAULT_IMAGE,
  type TabulatorEmptyContext,
} from './tabulator-empty-placeholder.constants';
import {
  resolveTabulatorPlaceholder,
  type TabulatorEmptyPlaceholderConfig,
} from './tabulator-empty-placeholder.util';

export interface TabulatorEmptyInputs {
  emptyTitle: string;
  emptyDescription: string;
  emptyImageSrc: string;
  emptyFallbackText: string;
  emptyContext: TabulatorEmptyContext;
}

export function buildTabulatorEmptyPlaceholder(
  i18n: UiI18nService,
  inputs: TabulatorEmptyInputs,
): string {
  const config = resolveTabulatorEmptyConfig(i18n, inputs);
  const fallback =
    inputs.emptyFallbackText.trim() || i18n.t('gridEmpty.fallback');
  return resolveTabulatorPlaceholder(config, fallback);
}

export function resolveTabulatorEmptyConfig(
  i18n: UiI18nService,
  inputs: TabulatorEmptyInputs,
): TabulatorEmptyPlaceholderConfig {
  const title = inputs.emptyTitle.trim();
  if (title) {
    return {
      title,
      description:
        inputs.emptyDescription.trim() || i18n.t('gridEmpty.genericDescription'),
      imageSrc: inputs.emptyImageSrc.trim() || TABULATOR_EMPTY_DEFAULT_IMAGE,
    };
  }
  const spec = TABULATOR_EMPTY_CONTEXTS[inputs.emptyContext] ?? TABULATOR_EMPTY_CONTEXTS.generic;
  return {
    title: i18n.t(spec.titleKey),
    description: i18n.t(spec.descriptionKey),
    imageSrc: spec.imageSrc,
  };
}
