import { NativeTabs } from "expo-router/unstable-native-tabs";
import { usePalette } from "@/theme/palette";
import { useT } from "@/lib/i18n";
import { usePendingCount } from "@/lib/pendingBookings";
import { useMyArenaId } from "@/lib/business";

// iOS: системный UITabBar (Expo Router NativeTabs). На iOS 26+ ОС рисует его в
// стиле Liquid Glass — плавающий стеклянный бар со «стеклянной линзой» на
// выбранной вкладке, как в клиентском app/(tabs)/_layout.ios.tsx. Android/web
// используют JS BusinessGlassTabBar в (cabinet)/_layout.tsx; набор вкладок и
// заголовки обоих файлов держать в синхроне.
//
// NativeTabs не умеет переходить на скрытые табы, поэтому вторичные CRM-экраны
// вынесены из группы (cabinet) в родительский Stack (app/business/_layout.tsx).
export default function BusinessCabinetLayoutIOS() {
  const c = usePalette();
  const t = useT();
  const pending = usePendingCount(true);
  const { venueType } = useMyArenaId();
  const pendingBadge = pending > 0 ? (pending > 99 ? "99+" : String(pending)) : null;

  return (
    <NativeTabs tintColor={c.primary}>
      <NativeTabs.Trigger name="index" testID="biz-tab-index">
        <NativeTabs.Trigger.Label>
          {t(venueType === "single" ? "bizTabs.hall" : "bizTabs.arena")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "building.2", selected: "building.2.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="halls" testID="biz-tab-halls">
        <NativeTabs.Trigger.Label>{t("bizTabs.halls")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "square.stack.3d.up", selected: "square.stack.3d.up.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule" testID="biz-tab-schedule">
        <NativeTabs.Trigger.Label>{t("bizTabs.schedule")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "clock", selected: "clock.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings" testID="biz-tab-bookings">
        <NativeTabs.Trigger.Label>{t("bizTabs.bookings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} />
        {pendingBadge ? <NativeTabs.Trigger.Badge>{pendingBadge}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile" testID="biz-tab-profile">
        <NativeTabs.Trigger.Label>{t("bizTabs.profile")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
