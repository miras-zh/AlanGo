import { useEffect } from "react";
import { Stack } from "expo-router";

import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "@/theme/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { hasRealSession, hydrateSession, subscribeAuth } from "@/lib/auth";
import { initPushNotifications } from "@/lib/push";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime";
import { trackFirstLaunchOnce, startOnlineHeartbeat, stopOnlineHeartbeat } from "@/lib/analytics";
import { AppUpdatePrompt } from "@/components/AppUpdatePrompt";
import { AppAlertHost } from "@/components/AppAlertHost";
import { AnimatedSplashScreen } from "@/components/AnimatedSplashScreen";
import { usePalette } from "@/theme/palette";

function RootNavigator() {
  const { isDark } = useAppTheme();
  const palette = usePalette();

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
