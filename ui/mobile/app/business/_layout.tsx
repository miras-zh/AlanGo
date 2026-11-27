import { Stack } from "expo-router";
import { usePalette } from "@/theme/palette";

// Бизнес-кабинет: Stack-навигатор. Вкладки живут в группе (cabinet) с
// собственным таб-навигатором (NativeTabs на iOS / JS LiquidGlass на
// Android), а вторичные CRM-экраны (income, clients, staff, promotions,
// subscription, location) открываются push поверх табов, как клиентские
// arena/[id] и hall/[id] вне (tabs).
export default function BusinessLayout() {
  const c = usePalette();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="(cabinet)" />
      <Stack.Screen name="income" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="reminders" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="promotions" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="location" />
    </Stack>
  );
}
