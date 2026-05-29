import { Component, ElementRef, forwardRef, input, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { plainTextLengthFromHtml } from '../../../utils/rich-text.util';

@Component({
  selector: 'ts-rich-text-editor',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TsRichTextEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ts-rich-text" [class.ts-rich-text--limit]="atLimit()">
      <div class="ts-rich-text__toolbar" role="toolbar" [attr.aria-label]="toolbarLabel()">
        <button
          type="button"
          class="ts-rich-text__btn"
          [class.ts-rich-text__btn--active]="isActive('bold')"
          (mousedown)="$event.preventDefault()"
          (click)="run('bold')"
          title="Negrita"
          aria-label="Negrita"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          class="ts-rich-text__btn"
          [class.ts-rich-text__btn--active]="isActive('italic')"
          (mousedown)="$event.preventDefault()"
          (click)="run('italic')"
          title="Cursiva"
          aria-label="Cursiva"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          class="ts-rich-text__btn"
          (mousedown)="$event.preventDefault()"
          (click)="run('insertUnorderedList')"
          title="Viñetas"
          aria-label="Viñetas"
        >
          •≡
        </button>
        <button
          type="button"
          class="ts-rich-text__btn"
          (mousedown)="$event.preventDefault()"
          (click)="run('insertOrderedList')"
          title="Numeración"
          aria-label="Numeración"
        >
          1.
        </button>
        <button
          type="button"
          class="ts-rich-text__btn"
          (mousedown)="$event.preventDefault()"
          (click)="run('removeFormat')"
          title="Quitar formato"
          aria-label="Quitar formato"
        >
          ✕
        </button>
      </div>
      <div
        #editor
        class="ts-rich-text__editor"
        contenteditable="true"
        role="textbox"
        [attr.aria-multiline]="true"
        [attr.data-placeholder]="placeholder()"
        (input)="onInput()"
        (blur)="onBlur()"
        (keydown)="onKeydown($event)"
      ></div>
      <span class="ts-rich-text__count" [class.ts-rich-text__count--warn]="atLimit()">
        {{ plainLength() }}/{{ maxLength() }}
      </span>
    </div>
  `,
  styles: [
    `
      .ts-rich-text {
        position: relative;
        border: 1px solid var(--ef-input-border, #cbd5e1);
        border-radius: 0.55rem;
        background: #fff;
        overflow: hidden;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .ts-rich-text:focus-within {
        border-color: rgba(var(--bs-primary-rgb), 0.45);
        box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.12);
      }
      .ts-rich-text--limit {
        border-color: rgba(var(--bs-warning-rgb), 0.55);
      }
      .ts-rich-text__toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem;
        padding: 0.35rem 0.45rem;
        border-bottom: 1px solid var(--ef-divider, #e2e8f0);
        background: #f8fafc;
      }
      .ts-rich-text__btn {
        min-width: 1.85rem;
        height: 1.75rem;
        padding: 0 0.4rem;
        border: 1px solid var(--ef-input-border, #cbd5e1);
        border-radius: 0.35rem;
        background: #fff;
        font-size: 0.78rem;
        line-height: 1;
        color: rgba(17, 24, 39, 0.75);
        cursor: pointer;
      }
      .ts-rich-text__btn:hover {
        background: rgba(var(--bs-primary-rgb), 0.08);
        border-color: rgba(var(--bs-primary-rgb), 0.25);
        color: var(--bs-primary);
      }
      .ts-rich-text__btn--active {
        background: rgba(var(--bs-primary-rgb), 0.12);
        border-color: rgba(var(--bs-primary-rgb), 0.35);
        color: var(--bs-primary);
      }
      .ts-rich-text__editor {
        min-height: 5rem;
        max-height: 10rem;
        overflow-y: auto;
        padding: 0.55rem 0.65rem 1.75rem;
        font-size: 0.875rem;
        line-height: 1.45;
        outline: none;
      }
      .ts-rich-text__editor:empty::before {
        content: attr(data-placeholder);
        color: var(--bs-secondary-color);
        pointer-events: none;
      }
      .ts-rich-text__editor ul,
      .ts-rich-text__editor ol {
        margin: 0.25rem 0 0.25rem 1.1rem;
        padding: 0;
      }
      .ts-rich-text__editor p {
        margin: 0 0 0.35rem;
      }
      .ts-rich-text__editor p:last-child {
        margin-bottom: 0;
      }
      .ts-rich-text__count {
        position: absolute;
        right: 0.65rem;
        bottom: 0.45rem;
        font-size: 0.7rem;
        font-variant-numeric: tabular-nums;
        color: var(--bs-secondary-color);
        pointer-events: none;
        background: linear-gradient(90deg, transparent, #fff 28%);
        padding-left: 0.75rem;
      }
      .ts-rich-text__count--warn {
        color: var(--bs-warning);
        font-weight: 600;
      }
    `,
  ],
})
export class TsRichTextEditorComponent implements ControlValueAccessor {
  readonly maxLength = input(300);
  readonly placeholder = input('');
  readonly toolbarLabel = input('Formato de texto');

  @ViewChild('editor', { static: true }) editorRef!: ElementRef<HTMLElement>;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private pendingHtml = '';

  writeValue(value: string | null): void {
    this.pendingHtml = value ?? '';
    this.syncEditorHtml();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    const el = this.editorRef?.nativeElement;
    if (!el) {
      return;
    }
    el.contentEditable = isDisabled ? 'false' : 'true';
    el.classList.toggle('ts-rich-text__editor--disabled', isDisabled);
  }

  plainLength(): number {
    return plainTextLengthFromHtml(this.editorRef?.nativeElement?.innerHTML ?? this.pendingHtml);
  }

  atLimit(): boolean {
    return this.plainLength() >= this.maxLength();
  }

  isActive(cmd: string): boolean {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  }

  run(cmd: string): void {
    const el = this.editorRef.nativeElement;
    el.focus();
    document.execCommand(cmd, false);
    this.onInput();
  }

  onInput(): void {
    const el = this.editorRef.nativeElement;
    let html = el.innerHTML;
    if (this.plainLength() > this.maxLength()) {
      html = this.pendingHtml;
      el.innerHTML = html;
      return;
    }
    this.pendingHtml = html;
    this.onChange(html);
  }

  onBlur(): void {
    this.onTouched();
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && this.plainLength() >= this.maxLength()) {
      ev.preventDefault();
    }
  }

  private syncEditorHtml(): void {
    const el = this.editorRef?.nativeElement;
    if (!el) {
      return;
    }
    if (el.innerHTML !== this.pendingHtml) {
      el.innerHTML = this.pendingHtml || '';
    }
  }
}
