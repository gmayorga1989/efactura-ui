import { readAccessToken } from '../auth.interceptor';
import { resolveApiUrl } from '../api/api-origin';

export interface SriSyncSseHandlers {
  onBotLog?: (payload: Record<string, unknown>) => void;
  onSyncRun?: (payload: Record<string, unknown>) => void;
  onConnected?: () => void;
  onError?: (err: unknown) => void;
}

function readTenantSlug(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 't' && parts[1]) {
    return parts[1];
  }
  return null;
}

/** SSE con Authorization header (fetch + parser manual). */
export function connectSriSyncSse(
  syncRunId: string,
  queryParams: Record<string, string>,
  handlers: SriSyncSseHandlers,
): AbortController {
  const ctrl = new AbortController();
  const token = readAccessToken();
  const tenantSlug = readTenantSlug();
  const qs = new URLSearchParams(queryParams).toString();
  const url = resolveApiUrl(
    `/api/web/v1/sri-descarga/sync-runs/${syncRunId}/events${qs ? `?${qs}` : ''}`,
  );

  void (async () => {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {}),
        },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventName = 'message';
      let dataLines: string[] = [];

      const flush = () => {
        if (dataLines.length === 0) {
          eventName = 'message';
          return;
        }
        const raw = dataLines.join('\n');
        dataLines = [];
        try {
          const payload = JSON.parse(raw) as Record<string, unknown>;
          if (eventName === 'connected') {
            handlers.onConnected?.();
          } else if (eventName === 'bot_log') {
            handlers.onBotLog?.(payload);
          } else if (eventName === 'sync_run') {
            handlers.onSyncRun?.(payload);
          }
        } catch {
          /* ignore malformed chunks */
        }
        eventName = 'message';
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          flush();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line === '') {
            flush();
            continue;
          }
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        handlers.onError?.(err);
      }
    }
  })();

  return ctrl;
}
