export type RealtimeEntity = 'calls' | 'chats' | 'credits' | 'notifications' | 'contacts';

export type RealtimeEvent =
  | { type: 'invalidate'; entity: RealtimeEntity; id?: string }
  | { type: 'connected' };

type EventHandler = (event: RealtimeEvent) => void;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/realtime`;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<EventHandler>();
  private reconnectDelay = RECONNECT_BASE_MS;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.stopped = false;
    this._open();
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private _open(): void {
    this.ws = new WebSocket(getWsUrl());

    this.ws.onopen = () => {
      this.reconnectDelay = RECONNECT_BASE_MS;
    };

    this.ws.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as RealtimeEvent;
        for (const h of this.handlers) h(event);
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      if (this.stopped) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * RECONNECT_FACTOR, RECONNECT_MAX_MS);
        this._open();
      }, this.reconnectDelay);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }
}

export const realtimeClient = new RealtimeClient();
