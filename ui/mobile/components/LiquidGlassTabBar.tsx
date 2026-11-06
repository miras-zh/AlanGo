import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TabBarGlassBackground } from "@/components/TabBarGlassBackground";
import { hapticSelection } from "@/lib/haptics";

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

export function LiquidGlassTabBar(props: any) {
  const { state, navigation } = props;
  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <View style={styles.tabBarPill}>
        <TabBarGlassBackground isCapsule={true} />

        <View style={styles.tabsRow}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;
            const config = TAB_CONFIG[route.name] || {
              label: route.name,
              icon: "ellipse-outline",
              iconFocused: "ellipse",
            };

            const onPress = () => {
              hapticSelection();
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
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
                  color={isFocused ? "#22C55E" : "#8E9B94"}
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
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#8E9B94",
    marginTop: 2,
    textAlign: "center",
  },
  tabLabelActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
});
