import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "@/theme/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { hasRealSession, hydrateSession, subscribeAuth } from "@/lib/auth";
import {
  initPushNotifications,
  routeForNotificationData,
  setupFcmOpenedListeners,
  setupPushNotificationListeners,
} from "@/lib/push";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime";
import { trackFirstLaunchOnce, startOnlineHeartbeat, stopOnlineHeartbeat } from "@/lib/analytics";
import { AppUpdatePrompt } from "@/components/AppUpdatePrompt";
import { AppAlertHost } from "@/components/AppAlertHost";
import { AnimatedSplashScreen } from "@/components/AnimatedSplashScreen";
import { usePalette } from "@/theme/palette";

function RootNavigator() {
  const { isDark } = useAppTheme();
  const palette = usePalette();
  const router = useRouter();
  const handledResponseRef = useRef<object | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const navigateFromData = (data: Record<string, any> | undefined) => {
      const target = routeForNotificationData(data);
      router.push(target as any);
    };

    const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response || handledResponseRef.current === response) return;
      handledResponseRef.current = response;
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      navigateFromData(data);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((last) => navigateFromResponse(last))
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      navigateFromResponse(resp);
    });
    const unsubscribeFcmOpened = setupFcmOpenedListeners(navigateFromData);
    const unsubscribePush = setupPushNotificationListeners();
    return () => {
      sub.remove();
      unsubscribeFcmOpened();
      unsubscribePush();
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;
    const syncSessionServices = () => {
      if (!mounted) return;
      if (hasRealSession()) {
        initPushNotifications();
        connectRealtime();
      } else {
        disconnectRealtime();
      }
    };
    const unsubscribe = subscribeAuth(syncSessionServices);
    (async () => {
      await hydrateSession();
      if (!mounted) return;
      await trackFirstLaunchOnce();
      syncSessionServices();
      startOnlineHeartbeat();
    })();
    return () => {
      mounted = false;
      unsubscribe();
      disconnectRealtime();
      stopOnlineHeartbeat();
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="business" />
        <Stack.Screen name="business-onboarding" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="hall/[id]" />
        <Stack.Screen name="arena/[id]" />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="register" options={{ presentation: "modal" }} />
        <Stack.Screen name="forgot-password" options={{ presentation: "modal" }} />
        <Stack.Screen name="apple-name" options={{ presentation: "modal" }} />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="my-bookings" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="arenas" />
      </Stack>
      <AppUpdatePrompt />
      <AppAlertHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AnimatedSplashScreen>
            <RootNavigator />
          </AnimatedSplashScreen>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
