import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ShellLayoutService {
  readonly sidebarPinned = signal(false);

  toggleSidebarPinned(): void {
    this.sidebarPinned.update((v) => !v);
  }
}
