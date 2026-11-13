import { Tabs } from "expo-router";
import { LiquidGlassTabBar } from "@/components/LiquidGlassTabBar";
import { useT } from "@/lib/i18n";

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: t("tabs.halls"),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t("tabs.events"),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.chat"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
        }}
      />
    </Tabs>
  );
}
