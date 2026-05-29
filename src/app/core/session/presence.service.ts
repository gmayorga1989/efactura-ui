import { HttpClient } from '@angular/common/http';
import { inject, Injectable, NgZone } from '@angular/core';
import { readAccessToken } from '../auth.interceptor.tokens';
import { SessionContextService } from './session-context.service';

interface PresencePingResponse {
  identidadId?: string;
  enLinea?: boolean;
  ultimoPing?: string;
}

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionContextService);
  private readonly zone = inject(NgZone);
  private timer: number | null = null;
  private inFlight = false;

  start(): void {
    if (this.timer !== null || !readAccessToken()) {
      return;
    }
    this.ping();
    this.zone.runOutsideAngular(() => {
      this.timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          this.zone.run(() => this.ping());
        }
      }, 60_000);
    });
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.inFlight = false;
  }

  ping(): void {
    if (this.inFlight || !readAccessToken()) {
      return;
    }
    this.inFlight = true;
    this.http.post<PresencePingResponse>('/api/web/v1/me/presence/ping', {}).subscribe({
      next: (res) => {
        this.inFlight = false;
        const current = this.session.profile();
        if (current) {
          this.session.setMe({
            ...current,
            enLinea: res.enLinea ?? current.enLinea,
            ultimoPing: res.ultimoPing ?? current.ultimoPing,
          });
        }
      },
      error: () => {
        this.inFlight = false;
      },
    });
  }
}
