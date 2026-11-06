import AsyncStorage from "@react-native-async-storage/async-storage";

export type SenderRole = "client" | "business" | "bot";

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: SenderRole;
  senderName: string;
  text: string;
  createdAt: string;
  isRead: boolean;
  bookingRef?: {
    arenaTitle: string;
    hallTitle: string;
    date: string;
    timeSlot: string;
    totalPrice: number;
    status: "confirmed" | "pending" | "cancelled";
  };
}

export interface ChatDialog {
  id: string;
  arenaId: number;
  arenaTitle: string;
  arenaAvatar: string;
  clientName: string;
  clientPhone: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  online: boolean;
  botMode: "always" | "after_hours" | "delayed" | "off";
}

const CHAT_DIALOGS_KEY = "alango_chat_dialogs_v1";
const CHAT_MESSAGES_KEY_PREFIX = "alango_chat_msgs_";

const INITIAL_DIALOGS: ChatDialog[] = [
  {
    id: "1",
    arenaId: 1,
    arenaTitle: "Футбольный комплекс Nomad Pro",
    arenaAvatar: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300",
    clientName: "Мирас Жумабай",
    clientPhone: "+7 (777) 999-00-11",
    lastMessage: "Здравствуйте! Раздевалка №3 подготовлена для вашей команды к 19:00.",
    lastMessageTime: "15:42",
    unreadCount: 1,
    online: true,
    botMode: "always",
  },
  {
    id: "2",
    arenaId: 2,
    arenaTitle: "Теннисный центр Daulet",
    arenaAvatar: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=300",
    clientName: "Мирас Жумабай",
    clientPhone: "+7 (777) 999-00-11",
    lastMessage: "Корты подготовлены. Ракетки Head и мячи доступны в аренду на ресепшн.",
    lastMessageTime: "Вчера",
    unreadCount: 0,
    online: true,
    botMode: "always",
  },
  {
    id: "3",
    arenaId: 3,
    arenaTitle: "Баскетбольный Pro Клуб",
    arenaAvatar: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300",
    clientName: "Мирас Жумабай",
    clientPhone: "+7 (777) 999-00-11",
    lastMessage: "Мячи Molten BG4500 уже на стойке администратора.",
    lastMessageTime: "3 ноя",
    unreadCount: 0,
    online: false,
    botMode: "after_hours",
  },
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  "1": [
    {
      id: "m-101",
      chatId: "1",
      senderId: "client-1",
      senderRole: "client",
      senderName: "Мирас",
      text: "Добрый день! Подскажите, пожалуйста, какая обувь разрешена на первом футбольном поле?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      isRead: true,
    },
    {
      id: "m-102",
      chatId: "1",
      senderId: "bot-1",
      senderRole: "bot",
      senderName: "Nomad AI Бот",
      text: "Здравствуйте! 🤖 На искусственном газоне 1-го поля разрешены сороконожки (TF) и футзалки. Бутсы с металлическими шипами (FG/SG) запрещены.",
      createdAt: new Date(Date.now() - 1000 * 60 * 59).toISOString(),
      isRead: true,
    },
    {
      id: "m-103",
      chatId: "1",
      senderId: "arena-1",
      senderRole: "business",
      senderName: "Администратор Азамат",
      text: "Здравствуйте! Раздевалка №3 подготовлена для вашей команды к 19:00.",
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      isRead: false,
      bookingRef: {
        arenaTitle: "Nomad Pro Complex",
        hallTitle: "Футбольный зал Arena 1",
        date: "Сегодня",
        timeSlot: "19:00 - 20:00",
        totalPrice: 15000,
        status: "confirmed",
      },
    },
  ],
  "2": [
    {
      id: "m-201",
      chatId: "2",
      senderId: "client-1",
      senderRole: "client",
      senderName: "Мирас",
      text: "Здравствуйте, можно ли арендовать ракетки на месте?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      isRead: true,
    },
    {
      id: "m-202",
      chatId: "2",
      senderId: "arena-2",
      senderRole: "business",
      senderName: "Ресепшн Daulet",
      text: "Корты подготовлены. Ракетки Head и мячи доступны в аренду на ресепшн.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
      isRead: true,
    },
  ],
  "3": [
    {
      id: "m-301",
      chatId: "3",
      senderId: "arena-3",
      senderRole: "business",
      senderName: "Баскетбольный Pro Клуб",
      text: "Мячи Molten BG4500 уже на стойке администратора.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      isRead: true,
    },
  ],
};

// Listeners
type ChatListener = () => void;
const listeners = new Set<ChatListener>();

export function subscribeToChats(fn: ChatListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifySubscribers() {
  listeners.forEach((fn) => fn());
}

export async function getStoredDialogs(): Promise<ChatDialog[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_DIALOGS_KEY);
    if (!raw) {
      await AsyncStorage.setItem(CHAT_DIALOGS_KEY, JSON.stringify(INITIAL_DIALOGS));
      return INITIAL_DIALOGS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DIALOGS;
  }
}

export async function getStoredMessages(chatId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CHAT_MESSAGES_KEY_PREFIX}${chatId}`);
    if (!raw) {
      const initial = INITIAL_MESSAGES[chatId] || [];
      await AsyncStorage.setItem(
        `${CHAT_MESSAGES_KEY_PREFIX}${chatId}`,
        JSON.stringify(initial)
      );
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_MESSAGES[chatId] || [];
  }
}

export async function sendChatMessage(
  chatId: string,
  text: string,
  senderRole: SenderRole = "client",
  senderName: string = "Вы",
  bookingRef?: ChatMessage["bookingRef"]
): Promise<ChatMessage> {
  const messages = await getStoredMessages(chatId);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chatId,
    senderId: senderRole === "client" ? "client-1" : `sender-${senderRole}`,
    senderRole,
    senderName,
    text,
    createdAt: now.toISOString(),
    isRead: senderRole === "client",
    bookingRef,
  };

  const updatedMessages = [...messages, newMsg];
  await AsyncStorage.setItem(
    `${CHAT_MESSAGES_KEY_PREFIX}${chatId}`,
    JSON.stringify(updatedMessages)
  );

  // Update dialog last message
  const dialogs = await getStoredDialogs();
  const dIdx = dialogs.findIndex((d) => d.id === chatId);
  if (dIdx >= 0) {
    dialogs[dIdx] = {
      ...dialogs[dIdx],
      lastMessage: text,
      lastMessageTime: timeStr,
      unreadCount: senderRole === "client" ? dialogs[dIdx].unreadCount : 0,
    };
    await AsyncStorage.setItem(CHAT_DIALOGS_KEY, JSON.stringify(dialogs));
  }

  notifySubscribers();
  return newMsg;
}

export async function markChatAsRead(chatId: string): Promise<void> {
  const dialogs = await getStoredDialogs();
  const dIdx = dialogs.findIndex((d) => d.id === chatId);
  if (dIdx >= 0 && dialogs[dIdx].unreadCount > 0) {
    dialogs[dIdx] = { ...dialogs[dIdx], unreadCount: 0 };
    await AsyncStorage.setItem(CHAT_DIALOGS_KEY, JSON.stringify(dialogs));
  }

  const messages = await getStoredMessages(chatId);
  let changed = false;
  const updated = messages.map((m) => {
    if (!m.isRead) {
      changed = true;
      return { ...m, isRead: true };
    }
    return m;
  });

  if (changed) {
    await AsyncStorage.setItem(
      `${CHAT_MESSAGES_KEY_PREFIX}${chatId}`,
      JSON.stringify(updated)
    );
  }

  notifySubscribers();
}

export async function updateArenaBotMode(
  chatId: string,
  botMode: ChatDialog["botMode"]
): Promise<void> {
  const dialogs = await getStoredDialogs();
  const dIdx = dialogs.findIndex((d) => d.id === chatId);
  if (dIdx >= 0) {
    dialogs[dIdx] = { ...dialogs[dIdx], botMode };
    await AsyncStorage.setItem(CHAT_DIALOGS_KEY, JSON.stringify(dialogs));
    notifySubscribers();
  }
}

