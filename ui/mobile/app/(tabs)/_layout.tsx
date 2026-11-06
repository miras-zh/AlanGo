import { Tabs } from "expo-router";
import { LiquidGlassTabBar } from "@/components/LiquidGlassTabBar";

export default function TabsLayout() {
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
          title: "Главная",
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Залы",
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "События",
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Чат",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Профиль",
        }}
      />
    </Tabs>
  );
}
