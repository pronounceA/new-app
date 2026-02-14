import { type ClientEvent, type ServerEvent } from "@/types/websocket";

type EventHandler = (event: ServerEvent) => void;
type ConnectionHandler = () => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private eventHandlers: Set<EventHandler> = new Set();
  private onConnectHandlers: Set<ConnectionHandler> = new Set();
  private onDisconnectHandlers: Set<ConnectionHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.shouldReconnect = true;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.onConnectHandlers.forEach((handler) => handler());
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const serverEvent = JSON.parse(event.data as string) as ServerEvent;
        this.eventHandlers.forEach((handler) => handler(serverEvent));
      } catch {
        console.error("WebSocket message parse error:", event.data);
      }
    };

    this.ws.onclose = () => {
      this.onDisconnectHandlers.forEach((handler) => handler());
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(event: ClientEvent): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not connected");
      return;
    }
    this.ws.send(JSON.stringify(event));
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.onConnectHandlers.add(handler);
    return () => this.onConnectHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.onDisconnectHandlers.add(handler);
    return () => this.onDisconnectHandlers.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
