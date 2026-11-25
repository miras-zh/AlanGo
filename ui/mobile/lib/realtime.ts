import { apiFetch, baseURL } from "./api";
import { hasRealSession } from "./auth";

type RealtimeListener = (event: { type: string; payload: unknown }) => void;

const listeners = new Set<RealtimeListener>();
let ws: WebSocket | null = null;
let isConnecting = false;
let manuallyDisconnected = false;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

export function subscribeRealtimeEvents(fn: RealtimeListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function connectRealtime(): Promise<void> {
  manuallyDisconnected = false;
  if (ws || isConnecting || !hasRealSession()) return;
  isConnecting = true;
  try {
    const { ticket } = await apiFetch<{ ticket: string }>("/api/realtime/ticket", {
      method: "POST",
    });
    if (manuallyDisconnected || !hasRealSession()) {
      return;
    }
    const wsBase = baseURL.replace(/^http/, "ws");
    const socket = new WebSocket(`${wsBase}/api/realtime/ws?ticket=${encodeURIComponent(ticket)}`);
    ws = socket;

    socket.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        listeners.forEach((fn) => fn(parsed));
      } catch {
        // ignore invalid payload
      }
    };

    socket.onclose = () => {
      if (ws === socket) {
        ws = null;
      }
      if (!manuallyDisconnected && hasRealSession()) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connectRealtime();
        }, 4000);
      }
    };
  } catch {
    // ignore connection error
  } finally {
    isConnecting = false;
  }
}

export function disconnectRealtime(): void {
  manuallyDisconnected = true;
  isConnecting = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (ws) {
    const closing = ws;
    ws = null;
    closing.onclose = null;
    closing.close();
  }
}
