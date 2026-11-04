import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { apiFetch } from "./api";

const FIRST_LAUNCH_KEY = "alango_first_launch_tracked";
const FIRST_VALUE_KEY = "alango_first_value_tracked";

export type FunnelEventName =
  | "app_install"
  | "first_launch"
  | "first_value"
  | "core_action"
  | "paywall_view"
  | "trial_start"
  | "subscribe"
  | "store_click";

export async function trackEvent(
  event: FunnelEventName,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await apiFetch("/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        event,
        platform: Platform.OS,
        metadata: metadata || {},
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
  const send = () => {
    apiFetch("/analytics/heartbeat", {
      method: "POST",
      body: JSON.stringify({ platform: Platform.OS }),
    }).catch(() => {});
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
