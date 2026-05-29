import { HttpClient, HttpParams } from '@angular/common/http';
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
import { firstValueFrom } from 'rxjs';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import type { ColumnDefinition, Options } from 'tabulator-tables';
import type { SpringPage } from '../../../../core/models/page.model';
import { UiI18nService } from '../../../../core/i18n/ui-i18n.service';
import type { TabulatorEmptyContext } from '../../tabulator-empty-placeholder.constants';
import { buildTabulatorEmptyPlaceholder } from '../../tabulator-empty-placeholder.resolver';

/**
 * Grid Tabulator con paginación remota compatible con `Page` de Spring Data
 * (`content`, `totalPages`, parámetros `page` 0-based y `size`).
 */
@Component({
  selector: 'ts-tabulator-spring-grid',
  standalone: true,
  template: `<div #host class="ts-tabulator-grid ts-tabulator-spring-root"></div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .ts-tabulator-spring-root {
        width: 100%;
      }
      :host ::ng-deep .ts-cell-textarea {
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.35;
        display: block;
        max-height: 4.2em;
        overflow: hidden;
      }
      :host ::ng-deep .tabulator-cell .ts-cell-fecha {
        white-space: nowrap;
      }
    `,
  ],
})
export class TsTabulatorSpringGridComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);

  @Input({ required: true }) ajaxUrl!: string;
  @Input() pageSize = 20;
  @Input() height = '440px';
  @Input({ required: true }) columns: ColumnDefinition[] = [];
  @Input() ajaxParams: Record<string, string | number | boolean | null | undefined> = {};
  @Input() reloadNonce = 0;
  /** Número de columnas iniciales con scroll congelado (acciones, fecha, etc.). */
  @Input() frozenColumns = 2;

  @Input() emptyContext: TabulatorEmptyContext = 'generic';
  @Input() emptyTitle = '';
  @Input() emptyDescription = '';
  @Input() emptyImageSrc = '';
  @Input() emptyFallbackText = '';

  @Output() rowAction = new EventEmitter<{ action: string; row: Record<string, unknown> }>();

  private readonly i18n = inject(UiI18nService);
  private table: Tabulator | null = null;
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
    if (changes['reloadNonce'] && !changes['reloadNonce'].firstChange && this.table) {
      void this.table.setPage(1);
    }
    if (changes['columns'] && !changes['columns'].firstChange && this.table) {
      this.table.setColumns(this.normalizedColumns());
    }
    if (changes['ajaxParams'] && !changes['ajaxParams'].firstChange && this.table) {
      const prev = changes['ajaxParams'].previousValue as Record<string, unknown> | undefined;
      const curr = changes['ajaxParams'].currentValue as Record<string, unknown> | undefined;
      if (this.paramsEqual(prev, curr)) {
        return;
      }
      void this.table.setPage(1);
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
      pagination: true,
      paginationMode: 'remote',
      paginationSize: this.pageSize,
      paginationSizeSelector: [10, 15, 20, 50, 100],
      placeholder: this.buildPlaceholder(),
      ajaxURL: this.ajaxUrl,
      ajaxRequestFunc: (_url: string, _config: unknown, params: Record<string, unknown>) =>
        this.fetchPage(params),
      columns: this.normalizedColumns(),
    };
    this.table = new Tabulator(this.host.nativeElement, opts);
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
    this.table.options.placeholder = this.buildPlaceholder();
    void this.table.redraw(true);
  }

  private normalizedColumns(): ColumnDefinition[] {
    const frozen = Math.max(0, this.frozenColumns);
    return this.columns.map((col, index) => {
      const raw = col as ColumnDefinition & { frozen?: boolean };
      const isFrozen = raw.frozen === true || (raw.frozen !== false && index < frozen);
      return {
        ...col,
        headerSort: col.headerSort === true,
        headerWordWrap: true,
        ...(isFrozen ? { frozen: true } : {}),
      } as ColumnDefinition;
    });
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

  private paramsEqual(
    a: Record<string, unknown> | undefined,
    b: Record<string, unknown> | undefined,
  ): boolean {
    const left = a ?? {};
    const right = b ?? {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (String(left[key] ?? '') !== String(right[key] ?? '')) {
        return false;
      }
    }
    return true;
  }

  private fetchPage(params: Record<string, unknown>): Promise<{ data: unknown[]; last_page: number }> {
    const pageRaw = typeof params['page'] === 'number' ? params['page'] : Number(params['page'] ?? 1);
    const sizeRaw = typeof params['size'] === 'number' ? params['size'] : Number(params['size'] ?? this.pageSize);
    const springPage = Math.max(0, pageRaw - 1);
    const size = Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : this.pageSize;

    let hp = new HttpParams().set('page', String(springPage)).set('size', String(size));
    for (const [key, value] of Object.entries(this.ajaxParams ?? {})) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        hp = hp.set(key, String(value));
      }
    }

    return firstValueFrom(
      this.http.get<SpringPage<unknown>>(this.ajaxUrl, {
        params: hp,
      }),
    ).then((r) => {
      const totalPages =
        r.totalPages > 0
          ? r.totalPages
          : Math.max(1, Math.ceil((r.totalElements ?? 0) / Math.max(1, size)));
      return {
        data: r.content,
        last_page: totalPages,
      };
    });
  }
}
