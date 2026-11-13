import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { usePalette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

export default function BusinessTabsLayout() {
  const c = usePalette();
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.hairline,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("bizTabs.arena"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "business" : "business-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="halls"
        options={{
          title: t("bizTabs.halls"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "layers" : "layers-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("bizTabs.schedule"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t("bizTabs.bookings"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("bizTabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      {/* Hidden CRM Screens */}
      <Tabs.Screen
        name="location"
        options={{
          href: null,
          title: t("bizLocation.title"),
        }}
      />
      <Tabs.Screen
        name="income"
        options={{
          href: null,
          title: t("bizTabs.income"),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          href: null,
          title: t("bizTabs.clients"),
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          href: null,
          title: t("bizTabs.staff"),
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          href: null,
          title: t("bizTabs.promotions"),
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          href: null,
          title: t("bizTabs.subscription"),
        }}
      />
    </Tabs>
  );
}

