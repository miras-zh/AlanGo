import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform, TurboModuleRegistry } from "react-native";
import { api } from "@/lib/api";
import { getToken, hasRealSession } from "@/lib/auth";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type ServerPushStatus = {
  has_token: boolean;
  token_kind: "expo" | "native" | "";
  expo_configured: boolean;
  fcm_configured: boolean;
  transport_ready: boolean;
  marketing_push_enabled: boolean;
};

let inFlightRegistration: Promise<void> | null = null;
let fbMessagingModule: any = null;

export const initPushNotifications = registerForPushNotifications;

/**
 * Safely load Firebase Messaging dynamically so Expo Go and web never throw
 * when native RNFB modules are absent.
 */
function getFirebaseMessaging(): any | null {
  if (Platform.OS === "web") {
    return null;
  }
  try {
    const isNativeAvailable = TurboModuleRegistry
      ? TurboModuleRegistry.get("NativeRNFBTurboApp") != null
      : false;
    if (!isNativeAvailable) {
      return null;
    }
    if (!fbMessagingModule) {
      fbMessagingModule = require("@react-native-firebase/messaging");
    }
    return fbMessagingModule;
  } catch {
    return null;
  }
}

function resolveEasProjectId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const fromConfig =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof fromConfig === "string" && fromConfig.trim() ? fromConfig.trim() : undefined;
}

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) {
    return;
  }
  if (!hasRealSession() || !(await getToken())) {
    return;
  }
  if (inFlightRegistration) {
    return inFlightRegistration;
  }

  inFlightRegistration = (async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      // 1. Primary path: Direct Firebase Cloud Messaging (FCM v1 + Apple APNs)
      try {
        const fb = getFirebaseMessaging();
        if (fb) {
          const messaging = fb.getMessaging();
          const authStatus = await fb.requestPermission(messaging);
          const enabled =
            authStatus === fb.AuthorizationStatus.AUTHORIZED ||
            authStatus === fb.AuthorizationStatus.PROVISIONAL;

          if (enabled) {
            if (Platform.OS === "ios") {
              await fb.registerDeviceForRemoteMessages(messaging).catch(() => {});
            }
            const fcmToken = await fb.getToken(messaging);
            if (typeof fcmToken === "string" && fcmToken.trim()) {
              await api.put("/api/profile/push-token", { token: fcmToken.trim() });
              return;
            }
          }
        }
      } catch {
        // Fallback to Expo Notifications when native Firebase runtime is unavailable.
      }

      // 2. Fallback path: Expo Push (when EAS projectId is set) or native Android token
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        return;
      }

      let pushToken: string | null = null;
      const projectId = resolveEasProjectId();
      if (projectId) {
        const res = await Notifications.getExpoPushTokenAsync({ projectId });
        pushToken = res?.data || null;
      } else if (Platform.OS === "android") {
        try {
          const native = await Notifications.getDevicePushTokenAsync();
          if (typeof native?.data === "string" && native.data.trim()) {
            pushToken = native.data.trim();
          }
        } catch {
          // Ignore when running inside Expo Go without EAS projectId.
        }
      }

      if (!pushToken) {
        return;
      }

      await api.put("/api/profile/push-token", { token: pushToken });
    } catch {
      // Non-fatal on unconfigured simulator/dev environments
    }
  })().finally(() => {
    inFlightRegistration = null;
  });

  return inFlightRegistration;
}

export function setupPushNotificationListeners(): () => void {
  try {
    const fb = getFirebaseMessaging();
    if (!fb) return () => {};

    const messaging = fb.getMessaging();

    const unsubscribeTokenRefresh = fb.onTokenRefresh(messaging, async (newToken: string) => {
      try {
        if (!hasRealSession() || !newToken?.trim()) return;
        await api.put("/api/profile/push-token", { token: newToken.trim() });
      } catch {
        // Best-effort
      }
    });

    const unsubscribeForeground = fb.onMessage(messaging, async (remoteMessage: any) => {
      try {
        if (remoteMessage?.notification) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: remoteMessage.notification.title || "AlanGo",
              body: remoteMessage.notification.body || "",
              data: (remoteMessage.data as Record<string, unknown>) || {},
              sound: true,
            },
            trigger: null,
          });
        }
      } catch {
        // Best-effort
      }
    });

    return () => {
      unsubscribeTokenRefresh();
      unsubscribeForeground();
    };
  } catch {
    return () => {};
  }
}

export function setupFcmOpenedListeners(onOpen: (data: Record<string, any>) => void): () => void {
  try {
    const fb = getFirebaseMessaging();
    if (!fb) return () => {};

    const messaging = fb.getMessaging();
    const unsubscribe = fb.onNotificationOpenedApp(messaging, (remoteMessage: any) => {
      if (remoteMessage?.data) {
        onOpen(remoteMessage.data);
      }
    });

    fb.getInitialNotification(messaging)
      .then((remoteMessage: any) => {
        if (remoteMessage?.data) {
          onOpen(remoteMessage.data);
        }
      })
      .catch(() => {});

    return unsubscribe;
  } catch {
    return () => {};
  }
}

export async function getServerPushStatus(): Promise<ServerPushStatus> {
  const res = await api.get<ServerPushStatus>("/api/profile/push-status");
  return res.data;
}

export async function sendServerTestPush(): Promise<{
  sent: boolean;
  status: ServerPushStatus;
}> {
  const res = await api.post<{ sent: boolean; status: ServerPushStatus }>(
    "/api/profile/push-test"
  );
  return res.data;
}

export function routeForNotificationData(data: Record<string, any> | undefined): string {
  const notifType = typeof data?.type === "string" ? data.type : "";
  if (notifType === "booking_request") return "/business/bookings?mode=requests";
  if (notifType === "business_reminder") return "/business/reminders";
  if (
    notifType.startsWith("booking_") ||
    notifType === "upcoming_game"
  ) {
    return "/my-bookings";
  }
  return "/(tabs)/notifications";
}
