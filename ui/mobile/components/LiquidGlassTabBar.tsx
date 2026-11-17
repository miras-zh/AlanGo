import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TabBarGlassBackground } from "@/components/TabBarGlassBackground";
import { hapticSelection } from "@/lib/haptics";
import { useT, type MessageKey } from "@/lib/i18n";
import { usePendingCount } from "@/lib/pendingBookings";
import { useMyArenaId } from "@/lib/business";


import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type TabEntry = {
  labelKey: MessageKey;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const TAB_CONFIG: Record<string, TabEntry> = {
  index: {
    labelKey: "tabs.home",
    icon: "home-outline",
    iconFocused: "home",
  },
  items: {
    labelKey: "tabs.halls",
    icon: "calendar-outline",
    iconFocused: "calendar",
  },
  events: {
    labelKey: "tabs.events",
    icon: "trophy-outline",
    iconFocused: "trophy",
  },
  notifications: {
    labelKey: "tabs.chat",
    icon: "chatbubble-ellipses-outline",
    iconFocused: "chatbubble-ellipses",
  },
  profile: {
    labelKey: "tabs.profile",
    icon: "person-outline",
    iconFocused: "person",
  },
};

/** Порядок вкладок — как в app/(tabs)/_layout.tsx. */
export const TAB_NAMES = ["index", "items", "events", "notifications", "profile"] as const;
export type TabName = (typeof TAB_NAMES)[number];

type CapsuleProps = {
  tabs: readonly string[];
  activeTab: string | null;
  onTabPress: (name: string) => void;
  /** Переопределение иконок/лейблов (по умолчанию — клиентский TAB_CONFIG). */
  config?: Record<string, TabEntry>;
  /** Числовые бейджи по имени вкладки (например, кол-во новых заявок). */
  badges?: Record<string, number | undefined>;
  /** Префикс testID кнопок (по умолчанию "tab"). */
  testIDPrefix?: string;
};

/** Внешний вид плавающей капсулы без привязки к навигатору табов. */
export function TabBarCapsule({ tabs, activeTab, onTabPress, config, badges, testIDPrefix = "tab" }: CapsuleProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const t = useT();
  const configMap = config ?? TAB_CONFIG;
  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <View style={styles.tabBarPill}>
        <TabBarGlassBackground isCapsule={true} />

        <View style={styles.tabsRow}>
          {tabs.map((name) => {
            const isFocused = activeTab === name;
            const entry = configMap[name];
            const label = entry ? t(entry.labelKey) : name;
            const icon = entry?.icon ?? "ellipse-outline";
            const iconFocused = entry?.iconFocused ?? "ellipse";
            const badge = badges?.[name] ?? 0;

            const onPress = () => {
              hapticSelection();
              onTabPress(name);
            };

            return (
              <Pressable
                key={name}
                testID={`${testIDPrefix}-${name}`}
                onPress={onPress}
                style={[
                  styles.tabButton,
                  isFocused && styles.tabButtonActive,
                ]}
                hitSlop={6}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={isFocused ? iconFocused : icon}
                    size={20}
                    color={isFocused ? c.primary : c.textSecondary}
                  />
                  {badge > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {badge > 99 ? "99+" : String(badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused && styles.tabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Таб-бар навигатора (tabs): капсула + стандартная логика tabPress. */
export function LiquidGlassTabBar(props: any) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const { state, navigation } = props;
  const routes: any[] = state.routes;
  return (
    <TabBarCapsule
      tabs={routes.map((r) => r.name)}
      activeTab={routes[state.index]?.name ?? null}
      onTabPress={(name) => {
        const route = routes.find((r) => r.name === name);
        if (!route) return;
        const isFocused = routes[state.index]?.key === route.key;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      }}
    />
  );
}

/** Иконки/лейблы вкладок кабинета бизнеса. */
const BIZ_TAB_CONFIG: Record<string, TabEntry> = {
  index: { labelKey: "bizTabs.arena", icon: "business-outline", iconFocused: "business" },
  halls: { labelKey: "bizTabs.halls", icon: "layers-outline", iconFocused: "layers" },
  schedule: { labelKey: "bizTabs.schedule", icon: "time-outline", iconFocused: "time" },
  bookings: { labelKey: "bizTabs.bookings", icon: "calendar-outline", iconFocused: "calendar" },
  profile: { labelKey: "bizTabs.profile", icon: "person-outline", iconFocused: "person" },
};

/** Видимые вкладки бизнес-навигации (порядок как в business/_layout.tsx). */
const BIZ_TAB_NAMES = ["index", "halls", "schedule", "bookings", "profile"] as const;

/** Liquid Glass таб-бар для навигатора кабинета бизнеса. */
export function BusinessGlassTabBar(props: any) {
  const { state, navigation } = props;
  const pending = usePendingCount(true);
  const { venueType } = useMyArenaId();
  const routes: any[] = state.routes;

  // Только видимые вкладки, в фиксированном порядке (скрытые href:null отсекаем).
  const visible = BIZ_TAB_NAMES.filter((name) => routes.some((r) => r.name === name));

  const config: Record<string, TabEntry> = {
    ...BIZ_TAB_CONFIG,
    index: {
      ...BIZ_TAB_CONFIG.index,
      labelKey: venueType === "single" ? "bizTabs.hall" : "bizTabs.arena",
    },
  };

  return (
    <TabBarCapsule
      tabs={visible}
      activeTab={routes[state.index]?.name ?? null}
      config={config}
      badges={{ bookings: pending }}
      testIDPrefix="biz-tab"
      onTabPress={(name) => {
        const route = routes.find((r) => r.name === name);
        if (!route) return;
        const isFocused = routes[state.index]?.key === route.key;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      }}
    />
  );
}

/**
 * Капсула для экранов поверх табов (корневой Stack): закрывает экраны
 * до табов и открывает выбранную вкладку.
 */
export function StandaloneTabBar({ activeTab = "index" }: { activeTab?: TabName | null }) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  return (
    <TabBarCapsule
      tabs={TAB_NAMES}
      activeTab={activeTab}
      onTabPress={(name) => {
        router.dismissTo(name === "index" ? "/(tabs)" : (`/(tabs)/${name}` as any));
      }}
    />
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  tabBarPill: {
    width: "92%",
    maxWidth: 420,
    height: 66,
    borderRadius: 33,
    marginBottom: Platform.OS === "ios" ? 22 : 12,
    backgroundColor: "rgba(18, 24, 20, 0.88)",
    borderWidth: 1,
    borderColor: c.subtle,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  tabButtonActive: {
    backgroundColor: "rgba(0, 201, 104, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(0, 201, 104, 0.45)",
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: c.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: c.onPrimary,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: c.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  tabLabelActive: {
    color: c.primary,
    fontWeight: "700",
  },
});
