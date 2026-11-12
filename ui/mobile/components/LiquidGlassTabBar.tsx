import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TabBarGlassBackground } from "@/components/TabBarGlassBackground";
import { hapticSelection } from "@/lib/haptics";
import { colors } from "@/constants/theme";

const TAB_CONFIG: Record<
  string,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconFocused: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: {
    label: "Главная",
    icon: "home-outline",
    iconFocused: "home",
  },
  items: {
    label: "Залы",
    icon: "calendar-outline",
    iconFocused: "calendar",
  },
  events: {
    label: "События",
    icon: "trophy-outline",
    iconFocused: "trophy",
  },
  notifications: {
    label: "Чат",
    icon: "chatbubble-ellipses-outline",
    iconFocused: "chatbubble-ellipses",
  },
  profile: {
    label: "Профиль",
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
};

/** Внешний вид плавающей капсулы без привязки к навигатору табов. */
export function TabBarCapsule({ tabs, activeTab, onTabPress }: CapsuleProps) {
  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <View style={styles.tabBarPill}>
        <TabBarGlassBackground isCapsule={true} />

        <View style={styles.tabsRow}>
          {tabs.map((name) => {
            const isFocused = activeTab === name;
            const config = TAB_CONFIG[name] || {
              label: name,
              icon: "ellipse-outline",
              iconFocused: "ellipse",
            };

            const onPress = () => {
              hapticSelection();
              onTabPress(name);
            };

            return (
              <Pressable
                key={name}
                onPress={onPress}
                style={[
                  styles.tabButton,
                  isFocused && styles.tabButtonActive,
                ]}
                hitSlop={6}
              >
                <Ionicons
                  name={isFocused ? config.iconFocused : config.icon}
                  size={20}
                  color={isFocused ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused && styles.tabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {config.label}
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

/**
 * Капсула для экранов поверх табов (корневой Stack): закрывает экраны
 * до табов и открывает выбранную вкладку.
 */
export function StandaloneTabBar({ activeTab = "index" }: { activeTab?: TabName | null }) {
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

const styles = StyleSheet.create({
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
    borderColor: "rgba(255, 255, 255, 0.12)",
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
});
