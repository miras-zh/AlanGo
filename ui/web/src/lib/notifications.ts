import { apiFetch } from "./api";

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export async function listNotifications(): Promise<{ items: AppNotification[]; unread_count: number }> {
  return apiFetch("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch("/notifications/read-all", { method: "POST" });
}
