import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform, TurboModuleRegistry } from "react-native";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

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

function getSafeMessaging(): { mod: any; instance: any } | null {
  try {
    const isNativeAvailable = TurboModuleRegistry
      ? TurboModuleRegistry.get("NativeRNFBTurboApp") != null
      : false;
    if (!isNativeAvailable) {
      return null;
    }
    const mod = require("@react-native-firebase/messaging");
    const instance = mod.getMessaging();
    return { mod, instance };
  } catch {
    return null;
  }
}

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) {
    return;
  }
  if (!(await getToken())) {
    return;
  }

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

    let pushToken = "";

    const fb = getSafeMessaging();
    if (fb) {
      try {
        if (Platform.OS === "ios" && fb.mod.registerDeviceForRemoteMessages) {
          await fb.mod.registerDeviceForRemoteMessages(fb.instance);
        }
        const fcmToken = await fb.mod.getToken(fb.instance);
        if (fcmToken && typeof fcmToken === "string") {
          pushToken = fcmToken;
        }
      } catch {}
    }

    if (!pushToken) {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (projectId) {
        const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });
        pushToken = expoToken;
      }
    }

    if (!pushToken) {
      return;
    }

    await api.put("/api/profile/push-token", { token: pushToken });
  } catch {
    // Non-fatal
  }
}
