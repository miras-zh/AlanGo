import { apiFetch } from "./api";
import { API_BASE_URL } from "./site";

export async function openRealtimeSocket(onEvent: (event: { type: string; payload: unknown }) => void): Promise<WebSocket | null> {
  try {
    const { ticket } = await apiFetch<{ ticket: string }>("/ws/ticket", { method: "POST" });
    const wsBase = API_BASE_URL.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/ws?ticket=${encodeURIComponent(ticket)}`);
    ws.onmessage = (msg) => {
      try {
        onEvent(JSON.parse(msg.data));
      } catch {
        // ignore
      }
    };
    return ws;
  } catch {
    return null;
  }
}
