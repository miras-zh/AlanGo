import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
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

let inFlightRegistration: Promise<void> | null = null;

export const initPushNotifications = registerForPushNotifications;

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
        });
      }

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        return;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        return;
      }

      const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!pushToken) {
        return;
      }

      await api.put("/api/profile/push-token", { token: pushToken });
    } catch {
      // Non-fatal
    }
  })().finally(() => {
    inFlightRegistration = null;
  });

  return inFlightRegistration;
}
