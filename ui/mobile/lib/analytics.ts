import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { apiFetch } from "./api";

const FIRST_LAUNCH_KEY = "alango_first_launch_tracked";
const FIRST_VALUE_KEY = "alango_first_value_tracked";
const GUEST_ID_KEY = "alango_analytics_guest_id";

export type FunnelEventName =
  | "app_install"
  | "first_launch"
  | "first_value"
  | "core_action"
  | "paywall_view"
  | "trial_start"
  | "subscribe"
  | "store_click"
  | "item_view"
  | "item_share";

let cachedGuestId: string | null = null;

async function getOrCreateGuestId(): Promise<string> {
  if (cachedGuestId) return cachedGuestId;
  try {
    const existing = await AsyncStorage.getItem(GUEST_ID_KEY);
    if (existing) {
      cachedGuestId = existing;
      return existing;
    }
    const generated = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(GUEST_ID_KEY, generated);
    cachedGuestId = generated;
    return generated;
  } catch {
    return "m-anonymous";
  }
}

export async function trackEvent(
  event: FunnelEventName,
  metadata?: {
    target_type?: string;
    target_id?: number;
    source?: string;
    [key: string]: unknown;
  },
): Promise<void> {
  try {
    const deviceId = await getOrCreateGuestId();
    await apiFetch("/api/analytics/events", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({
        event_type: event,
        target_type: metadata?.target_type ?? "",
        target_id: typeof metadata?.target_id === "number" ? metadata.target_id : 0,
        platform: Platform.OS,
        source: metadata?.source ?? "",
        device_id: deviceId,
      }),
    });
  } catch {
    // Non-blocking analytics
  }
}

export async function trackFirstLaunchOnce(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (done) return;
    await trackEvent("app_install");
    await trackEvent("first_launch");
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, "1");
  } catch {
    // ignore
  }
}

export async function trackFirstValueOnce(metadata?: Record<string, unknown>): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(FIRST_VALUE_KEY);
    if (done) return;
    await trackEvent("first_value", metadata);
    await AsyncStorage.setItem(FIRST_VALUE_KEY, "1");
  } catch {
    // ignore
  }
}

export async function trackCoreAction(metadata?: Record<string, unknown>): Promise<void> {
  await trackEvent("core_action", metadata);
}

export async function trackPaywallView(metadata?: Record<string, unknown>): Promise<void> {
  await trackEvent("paywall_view", metadata);
}

export async function trackTrialStart(metadata?: Record<string, unknown>): Promise<void> {
  await trackEvent("trial_start", metadata);
}

export async function trackSubscribe(metadata?: Record<string, unknown>): Promise<void> {
  await trackEvent("subscribe", metadata);
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startOnlineHeartbeat(intervalMs = 60000) {
  stopOnlineHeartbeat();
  const send = async () => {
    try {
      const guestId = await getOrCreateGuestId();
      await apiFetch("/analytics/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          guest_id: guestId,
          platform: Platform.OS,
          path: "mobile",
        }),
      });
    } catch {
      // Non-blocking heartbeat
    }
  };
  send();
  heartbeatTimer = setInterval(send, intervalMs);
}

export function stopOnlineHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
