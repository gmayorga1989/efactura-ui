import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import type { ColumnDefinition, Options } from 'tabulator-tables';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import type { TabulatorEmptyContext } from '../../tabulator-empty-placeholder.constants';
import { buildTabulatorEmptyPlaceholder } from '../../tabulator-empty-placeholder.resolver';

/**
 * Tabulator sin paginación remota: los datos se pasan por `@Input() data`
 * y se sincronizan con `setData` al cambiar `data` o `reloadNonce`.
 */
@Component({
  selector: 'ts-tabulator-local-grid',
  standalone: true,
  template: `<div #host class="ts-tabulator-grid ts-tabulator-local-root"></div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .ts-tabulator-local-root {
        width: 100%;
      }
    `,
  ],
})
export class TsTabulatorLocalGridComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  @Input({ required: true }) data: Record<string, unknown>[] = [];
  @Input({ required: true }) columns: ColumnDefinition[] = [];
  @Input() height = '400px';

  /** Habilita edición inline cuando las columnas definen `editor`. */
  @Input() editable = false;

  /** Incrementar para forzar `setData` con el mismo arreglo de referencia. */
  @Input() reloadNonce = 0;

  /** Estado vacío: contexto i18n por defecto; sobrescriba con emptyTitle/Description/ImageSrc. */
  @Input() emptyContext: TabulatorEmptyContext = 'generic';
  @Input() emptyTitle = '';
  @Input() emptyDescription = '';
  @Input() emptyImageSrc = '';
  @Input() emptyFallbackText = '';

  private readonly i18n = inject(UiI18nService);

  @Output() rowAction = new EventEmitter<{ action: string; row: Record<string, unknown> }>();
  @Output() dataChange = new EventEmitter<Record<string, unknown>[]>();

  private table: Tabulator | null = null;
  /** Evita `setData` en bucle cuando el padre reenvía el mismo contenido con otra referencia. */
  private lastDataInputSignature = '';
  private lastReloadNonceApplied: number | null = null;
  private activeMenu: HTMLElement | null = null;
  private activeToggle: HTMLElement | null = null;
  private activeMenuHome: HTMLElement | null = null;
  private activeRow: Record<string, unknown> | null = null;
  private readonly onDocumentClick = (event: MouseEvent) => this.handleDocumentClick(event);

  ngAfterViewInit(): void {
    this.buildTable();
    document.addEventListener('click', this.onDocumentClick);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.table) {
      return;
    }
    if (changes['data'] || changes['reloadNonce']) {
      const reloadCh = changes['reloadNonce'];
      const nonceForced =
        !!reloadCh && (reloadCh.firstChange || reloadCh.previousValue !== reloadCh.currentValue);
      const sig = JSON.stringify(this.data);
      const sameNonce = this.lastReloadNonceApplied !== null && this.reloadNonce === this.lastReloadNonceApplied;
      if (!nonceForced && sig === this.lastDataInputSignature && sameNonce) {
        // mismo contenido y mismo nonce: no volver a setData
      } else {
        this.lastDataInputSignature = sig;
        this.lastReloadNonceApplied = this.reloadNonce;
        this.table.setData([...this.data]);
      }
    }
    if (changes['columns'] && !changes['columns'].firstChange) {
      this.table.setColumns(this.normalizedColumns());
    }
    if (
      this.table &&
      (changes['emptyTitle'] ||
        changes['emptyDescription'] ||
        changes['emptyImageSrc'] ||
        changes['emptyFallbackText'] ||
        changes['emptyContext'])
    ) {
      this.applyPlaceholder();
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick);
    this.closeActionMenus();
    this.table?.destroy();
    this.table = null;
  }

  private buildTable(): void {
    const opts: Options = {
      layout: 'fitColumns',
      height: this.height,
      pagination: false,
      placeholder: this.buildPlaceholder(),
      editable: this.editable,
      data: [...this.data],
      columns: this.normalizedColumns(),
    };
    this.table = new Tabulator(this.host.nativeElement, opts);
    this.lastDataInputSignature = JSON.stringify(this.data);
    this.lastReloadNonceApplied = this.reloadNonce;
    this.table.on('cellEdited', () => {
      this.emitDataSnapshot();
    });
    this.table.on('rowDeleted', () => {
      this.emitDataSnapshot();
    });
    this.table.on('cellClick', (e: unknown, cell: unknown) => {
      const ev = e as unknown as MouseEvent;
      const el = ev.target as HTMLElement | null;
      if (!el) {
        return;
      }
      const btn = el.closest<HTMLElement>('[data-ts-action]');
      const toggle = el.closest<HTMLElement>('.ts-grid-actions__toggle');
      if (toggle) {
        ev.preventDefault();
        ev.stopPropagation();
        const c = cell as { getRow: () => { getData: () => Record<string, unknown> } };
        const row = c.getRow().getData();
        const menu = toggle.parentElement?.querySelector<HTMLElement>('.dropdown-menu');
        const open = menu?.classList.contains('show') ?? false;
        this.closeActionMenus();
        if (!open) {
          this.openActionMenu(toggle, menu, row);
        }
        return;
      }
      if (!btn) {
        return;
      }
      const action = btn.getAttribute('data-ts-action');
      if (!action) {
        return;
      }
      const c = cell as { getRow: () => { getData: () => Record<string, unknown> } };
      const row = c.getRow().getData();
      this.rowAction.emit({ action, row });
    });
  }

  private emitDataSnapshot(): void {
    if (!this.table) {
      return;
    }
    this.dataChange.emit([...(this.table.getData() as Record<string, unknown>[])]);
  }

  private buildPlaceholder(): string {
    return buildTabulatorEmptyPlaceholder(this.i18n, {
      emptyTitle: this.emptyTitle,
      emptyDescription: this.emptyDescription,
      emptyImageSrc: this.emptyImageSrc,
      emptyFallbackText: this.emptyFallbackText,
      emptyContext: this.emptyContext,
    });
  }

  private applyPlaceholder(): void {
    if (!this.table) {
      return;
    }
    const placeholder = this.buildPlaceholder();
    this.table.options.placeholder = placeholder;
    void this.table.redraw(true);
  }

  private normalizedColumns(): ColumnDefinition[] {
    return this.columns.map((col) => ({
      ...col,
      headerSort: col.headerSort === true,
      headerWordWrap: true,
    }));
  }

  private closeActionMenus(): void {
    if (this.activeMenu) {
      this.activeMenu.classList.remove('show');
      this.activeMenu.removeAttribute('style');
      if (this.activeMenuHome && this.activeMenu.parentElement !== this.activeMenuHome) {
        this.activeMenuHome.appendChild(this.activeMenu);
      }
    }
    this.activeToggle?.classList.remove('show');
    this.activeToggle?.setAttribute('aria-expanded', 'false');
    this.activeMenu = null;
    this.activeToggle = null;
    this.activeMenuHome = null;
    this.activeRow = null;
  }

  private openActionMenu(
    toggle: HTMLElement,
    menu: HTMLElement | null | undefined,
    row: Record<string, unknown>,
  ): void {
    if (!menu) {
      return;
    }
    this.activeMenu = menu;
    this.activeToggle = toggle;
    this.activeMenuHome = menu.parentElement;
    this.activeRow = row;
    document.body.appendChild(menu);
    this.positionMenu(toggle, menu);
    menu.classList.add('show');
    toggle.classList.add('show');
    toggle.setAttribute('aria-expanded', 'true');
  }

  private handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (this.activeMenu?.contains(target)) {
      const btn = target.closest<HTMLElement>('[data-ts-action]');
      const action = btn?.getAttribute('data-ts-action');
      if (action && this.activeRow) {
        event.preventDefault();
        this.rowAction.emit({ action, row: this.activeRow });
        this.closeActionMenus();
      }
      return;
    }
    if (this.activeToggle?.contains(target)) {
      return;
    }
    this.closeActionMenus();
  }

  private positionMenu(toggle: HTMLElement, menu: HTMLElement | null | undefined): void {
    if (!menu) {
      return;
    }
    const rect = toggle.getBoundingClientRect();
    const menuWidth = 174;
    const preferredLeft = rect.right + 8;
    const fallbackLeft = rect.left - menuWidth - 8;
    const left =
      preferredLeft + menuWidth <= window.innerWidth - 8
        ? preferredLeft
        : Math.max(8, fallbackLeft);
    const top = Math.min(window.innerHeight - 8, rect.bottom + 8);
    menu.style.position = 'fixed';
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.minWidth = `${menuWidth}px`;
  }
}
