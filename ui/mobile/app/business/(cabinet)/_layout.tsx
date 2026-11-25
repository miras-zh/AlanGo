import { Tabs } from "expo-router";
import { useT } from "@/lib/i18n";
import { BusinessGlassTabBar } from "@/components/LiquidGlassTabBar";
import { useMyArenaId } from "@/lib/business";

// Android/web: JS Liquid Glass капсула. На iOS приоритет у _layout.ios.tsx
// (нативный NativeTabs). Набор вкладок и заголовки держать в синхроне с ним.
export default function BusinessCabinetLayout() {
  const t = useT();
  const { venueType } = useMyArenaId();
  return (
    <Tabs
      tabBar={(props) => <BusinessGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t(venueType === "single" ? "bizTabs.hall" : "bizTabs.arena") }} />
      <Tabs.Screen name="halls" options={{ title: t("bizTabs.halls") }} />
      <Tabs.Screen name="schedule" options={{ title: t("bizTabs.schedule") }} />
      <Tabs.Screen name="bookings" options={{ title: t("bizTabs.bookings") }} />
      <Tabs.Screen name="profile" options={{ title: t("bizTabs.profile") }} />
    </Tabs>
  );
}
