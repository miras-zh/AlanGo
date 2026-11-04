import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const HAPTICS_KEY = "alango_haptics_enabled";
let cachedEnabled = true;

export async function isHapticsEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(HAPTICS_KEY);
    if (val !== null) {
      cachedEnabled = val === "1";
    }
  } catch {
    // ignore
  }
  return cachedEnabled;
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  cachedEnabled = enabled;
  try {
    await AsyncStorage.setItem(HAPTICS_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

export function hapticSelection(): void {
  if (!cachedEnabled) return;
  Haptics.selectionAsync().catch(() => {});
}

export const selectionHaptic = hapticSelection;

export function hapticSuccess(): void {
  if (!cachedEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError(): void {
  if (!cachedEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
