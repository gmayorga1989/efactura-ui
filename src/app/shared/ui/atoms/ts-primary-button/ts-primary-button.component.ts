import { Component, input } from '@angular/core';

@Component({
  selector: 'ts-primary-button',
  standalone: true,
  template: `
    <button
      [type]="buttonType()"
      class="btn btn-primary"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
})
export class TsPrimaryButtonComponent {
  readonly buttonType = input<'button' | 'submit' | 'reset'>('submit');
  readonly disabled = input(false);
}
