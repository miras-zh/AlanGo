import { NativeTabs } from "expo-router/unstable-native-tabs";
import { usePalette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

// iOS tab bar: the system UITabBar (Expo Router NativeTabs). On iOS 26+ the
// OS draws it in Liquid Glass — a floating glass bar with a glass lens that
// flows to the selected tab — which a JS tab bar can only imitate (same
// approach as Vison). Android/web keep the JS LiquidGlassTabBar in
// _layout.tsx; keep the tab set and titles of both files in sync.
//
// NativeTabs can't navigate to hidden tabs, so every route in (tabs) must be
// a visible tab here.
export default function TabsLayout() {
  const c = usePalette();
  const t = useT();
  return (
    <NativeTabs tintColor={c.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="items">
        <NativeTabs.Trigger.Label>{t("tabs.halls")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sportscourt", selected: "sportscourt.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Label>{t("tabs.events")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "trophy", selected: "trophy.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>{t("tabs.chat")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t("tabs.profile")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
