import { Stack } from "expo-router";

export default function BusinessLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0B0F0D" },
      }}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

