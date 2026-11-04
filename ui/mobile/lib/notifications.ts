import { api } from "@/lib/api";

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  entity_id: number | null;
  read: boolean;
  created_at: string;
  actor_avatar?: string;
  actor_name?: string;
};

export type NotificationList = {
  items: Notification[];
  unread_count: number;
};

export async function getNotifications(): Promise<NotificationList> {
  const res = await api.get<NotificationList>("/api/notifications");
  return res.data;
}

export async function markNotificationsRead(): Promise<void> {
  await api.post("/api/notifications/read");
}
