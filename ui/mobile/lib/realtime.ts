import { apiFetch } from "./api";
import { API_BASE_URL } from "./site";
import { getAccessToken } from "./auth";

type RealtimeListener = (event: { type: string; payload: unknown }) => void;

const listeners = new Set<RealtimeListener>();
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

export function subscribeRealtimeEvents(fn: RealtimeListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function connectRealtime(): Promise<void> {
  if (ws || !getAccessToken()) return;
  try {
    const { ticket } = await apiFetch<{ ticket: string }>("/ws/ticket", {
      method: "POST",
    });
    const wsBase = API_BASE_URL.replace(/^http/, "ws");
    const socket = new WebSocket(`${wsBase}/ws?ticket=${encodeURIComponent(ticket)}`);
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
      ws = null;
      if (getAccessToken()) {
        reconnectTimeout = setTimeout(() => {
          connectRealtime();
        }, 4000);
      }
    };
  } catch {
    // ignore connection error
  }
}

export function disconnectRealtime(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}
