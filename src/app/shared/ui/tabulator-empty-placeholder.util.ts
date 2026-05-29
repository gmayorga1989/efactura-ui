import { escapeHtml } from './tabulator-formatters.util';

export interface TabulatorEmptyPlaceholderConfig {
  title: string;
  description: string;
  imageSrc: string;
}

/** HTML para el placeholder vacío de Tabulator (título + descripción | ilustración). */
export function tabulatorEmptyPlaceholderHtml(config: TabulatorEmptyPlaceholderConfig): string {
  const title = escapeHtml(config.title);
  const description = escapeHtml(config.description);
  const imageSrc = escapeHtml(config.imageSrc);
  return `
    <div class="ts-tabulator-empty" role="status">
      <div class="ts-tabulator-empty__content">
        <h3 class="ts-tabulator-empty__title">${title}</h3>
        <p class="ts-tabulator-empty__description">${description}</p>
      </div>
      <div class="ts-tabulator-empty__visual" aria-hidden="true">
        <div
          class="ts-tabulator-empty__illustration"
          style="--ts-empty-mask: url('${imageSrc}')"
        ></div>
      </div>
    </div>
  `.trim();
}

/** Placeholder textual mínimo (retrocompatibilidad). */
export function tabulatorDefaultEmptyPlaceholder(text = 'Sin datos.'): string {
  return `<span class="ts-tabulator-empty-fallback">${escapeHtml(text)}</span>`;
}

export function resolveTabulatorPlaceholder(
  config: TabulatorEmptyPlaceholderConfig | null | undefined,
  fallbackText = 'Sin datos.',
): string {
  if (config?.title?.trim() && config.description?.trim() && config.imageSrc?.trim()) {
    return tabulatorEmptyPlaceholderHtml(config);
  }
  return tabulatorDefaultEmptyPlaceholder(fallbackText);
}
