import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "@/theme/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { hydrateSession } from "@/lib/auth";
import { initPushNotifications } from "@/lib/push";
import { trackFirstLaunchOnce, startOnlineHeartbeat, stopOnlineHeartbeat } from "@/lib/analytics";
import { AppUpdatePrompt } from "@/components/AppUpdatePrompt";

function RootNavigator() {
  const { isDark, colors } = useAppTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      await hydrateSession();
      if (!mounted) return;
      await trackFirstLaunchOnce();
      await initPushNotifications();
      startOnlineHeartbeat();
    })();
    return () => {
      mounted = false;
      stopOnlineHeartbeat();
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="register" options={{ presentation: "modal" }} />
        <Stack.Screen name="forgot-password" options={{ presentation: "modal" }} />
        <Stack.Screen name="apple-name" options={{ presentation: "modal" }} />
        <Stack.Screen name="settings/index" />
      </Stack>
      <AppUpdatePrompt />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <RootNavigator />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
