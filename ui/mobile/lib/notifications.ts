import { api } from "@/lib/api";

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  entity_id: number | null;
  read: boolean;
  is_read?: boolean;
  created_at: string;
  actor_avatar?: string;
  actor_name?: string;
};

export type AppNotification = Notification;

export type NotificationList = {
  items: Notification[];
  unread_count: number;
};

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: "booking_confirmed",
    title: "Бронирование подтверждено 🎉",
    body: "Футбольный зал Arena ожидает вас завтра с 19:00 до 21:00. Код брони: #SR-4921.",
    entity_id: 1,
    read: false,
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actor_name: "Arena Sport",
    actor_avatar: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100",
  },
  {
    id: 2,
    type: "promo",
    title: "Скидка 20% на дневные слоты ⚡️",
    body: "В Баскетбольном зале Pro действуют специальные цены с 10:00 до 16:00 в будние дни.",
    entity_id: 2,
    read: false,
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    actor_name: "Pro Basketball",
    actor_avatar: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=100",
  },
  {
    id: 3,
    type: "event",
    title: "Открыта регистрация на Nomad Padel Cup 🏆",
    body: "Любительский турнир по падл-теннису в эти выходные. Призовой фонд 300 000 ₸.",
    entity_id: 5,
    read: true,
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actor_name: "Nomad Sports",
    actor_avatar: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=100",
  },
];

export async function getNotifications(limit?: number, offset?: number): Promise<NotificationList> {
  const res = await api.get<NotificationList>("/api/notifications", {
    params: { limit, offset },
  });
  const items = Array.isArray(res.data?.items)
    ? res.data.items.map((i) => ({
        ...i,
        is_read: i.is_read ?? i.read,
      }))
    : [];
  return {
    items,
    unread_count: res.data?.unread_count ?? items.filter((i) => !i.is_read).length,
  };
}

export const listNotifications = getNotifications;

export async function markNotificationsRead(): Promise<void> {
  await api.post("/api/notifications/read");
}

export const markAllNotificationsRead = markNotificationsRead;

export async function markNotificationRead(id?: number): Promise<void> {
  await api.post("/api/notifications/read", id ? { id } : {});
}

export type BroadcastCampaign = {
  id: number;
  scope: "platform" | "arena";
  arena_id?: number | null;
  title: string;
  body: string;
  target_filter: string;
  recipients_count: number;
  push_sent_count: number;
  created_at: string;
};

export type ArenaBroadcastResponse = {
  campaign: BroadcastCampaign;
  total_arena_clients: number;
  app_linked_clients: number;
};

export async function sendArenaBroadcast(payload: {
  title: string;
  body: string;
  segment: "all" | "vip" | "regular";
}): Promise<ArenaBroadcastResponse> {
  const res = await api.post<ArenaBroadcastResponse>("/api/business/broadcasts", payload);
  return res.data;
}

export async function listArenaBroadcasts(): Promise<BroadcastCampaign[]> {
  const res = await api.get<{ campaigns: BroadcastCampaign[] }>("/api/business/broadcasts");
  return Array.isArray(res.data?.campaigns) ? res.data.campaigns : [];
}

export async function sendAdminBroadcast(payload: {
  title: string;
  body: string;
  role: "all" | "client" | "business";
  city?: string;
}): Promise<{ campaign: BroadcastCampaign }> {
  const res = await api.post<{ campaign: BroadcastCampaign }>("/api/admin/broadcasts", payload);
  return res.data;
}

export async function listAdminBroadcasts(): Promise<BroadcastCampaign[]> {
  const res = await api.get<{ campaigns: BroadcastCampaign[] }>("/api/admin/broadcasts");
  return Array.isArray(res.data?.campaigns) ? res.data.campaigns : [];
}
