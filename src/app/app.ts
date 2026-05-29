import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TsToastStackComponent } from './shared/ui/organisms/ts-toast-stack/ts-toast-stack.component';

@Component({
  selector: 'ts-root',
  standalone: true,
  imports: [RouterOutlet, TsToastStackComponent],
  template: `<router-outlet /><ts-toast-stack />`,
})
export class AppComponent {}
