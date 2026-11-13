import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { tr } from "@/lib/i18n";

// Ensure handler is set
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function triggerLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: data || {},
      },
      trigger: null, // triggers immediately
    });
  } catch (e) {
    console.log("Local notification schedule error:", e);
  }
}

export async function notifyBookingConfirmed(
  arenaTitle: string,
  date: string,
  timeSlot: string
): Promise<void> {
  await triggerLocalNotification(
    tr("push.confirmedTitle"),
    tr("push.confirmedBody", { arena: arenaTitle, date, time: timeSlot }),
    { type: "booking_confirmed" }
  );
}

export async function notifyBookingRejected(
  arenaTitle: string,
  reason: string
): Promise<void> {
  await triggerLocalNotification(
    tr("push.rejectedTitle"),
    tr("push.rejectedBody", { arena: arenaTitle, reason }),
    { type: "booking_rejected" }
  );
}

export async function notifyUpcomingGame(
  arenaTitle: string,
  timeSlot: string
): Promise<void> {
  await triggerLocalNotification(
    tr("push.reminderTitle"),
    tr("push.reminderBody", { arena: arenaTitle, time: timeSlot }),
    { type: "upcoming_game" }
  );
}

export async function notifyNewChatMessage(
  senderName: string,
  message: string
): Promise<void> {
  await triggerLocalNotification(
    tr("push.newMessage", { name: senderName }),
    message,
    { type: "new_chat_message" }
  );
}

