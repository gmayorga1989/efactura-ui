import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LuxThemeService } from './core/theme/lux-theme.service';
import { TsToastStackComponent } from './shared/ui/organisms/ts-toast-stack/ts-toast-stack.component';

@Component({
  selector: 'ts-root',
  standalone: true,
  imports: [RouterOutlet, TsToastStackComponent],
  template: `<router-outlet /><ts-toast-stack />`,
})
export class AppComponent {
  constructor() {
    inject(LuxThemeService);
  }
}
