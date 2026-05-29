import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ts-labeled-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="form-group">
      <label [for]="inputId()" class="form-label">{{ label() }}</label>
      <input
        [id]="inputId()"
        [name]="nameAttr()"
        [type]="type()"
        class="form-control"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
        [attr.autocomplete]="autocomplete()"
        [attr.placeholder]="placeholder()"
        [disabled]="disabled()"
      />
    </div>
  `,
})
export class TsLabeledInputComponent {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly nameAttr = input.required<string>();
  readonly type = input<string>('text');
  readonly autocomplete = input<string>('on');
  readonly placeholder = input<string>(' ');
  readonly disabled = input(false);
  readonly value = model<string>('');
}
