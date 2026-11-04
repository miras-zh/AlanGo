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
  try {
    const res = await api.get<NotificationList>("/api/notifications", {
      params: { limit, offset },
    });
    if (res.data?.items && res.data.items.length > 0) {
      res.data.items = res.data.items.map((i) => ({
        ...i,
        is_read: i.is_read ?? i.read,
      }));
      return res.data;
    }
  } catch {
    // fallback to mock
  }

  return {
    items: MOCK_NOTIFICATIONS,
    unread_count: MOCK_NOTIFICATIONS.filter((i) => !i.is_read).length,
  };
}

export const listNotifications = getNotifications;

export async function markNotificationsRead(): Promise<void> {
  try {
    await api.post("/api/notifications/read");
  } catch {
    // fallback
  }
  MOCK_NOTIFICATIONS.forEach((n) => {
    n.read = true;
    n.is_read = true;
  });
}

export const markAllNotificationsRead = markNotificationsRead;

export async function markNotificationRead(id?: number): Promise<void> {
  try {
    await api.post("/api/notifications/read", id ? { id } : {});
  } catch {
    // fallback
  }
  if (id) {
    const item = MOCK_NOTIFICATIONS.find((n) => n.id === id);
    if (item) {
      item.read = true;
      item.is_read = true;
    }
  }
}
