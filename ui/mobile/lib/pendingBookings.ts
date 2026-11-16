import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { getPendingBookingsCount } from "@/lib/sportRentData";

// Number of booking requests waiting for the business owner's answer, shared
// by the cabinet tab badge, the dashboard banner and the bookings screen.

let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setPendingCount(n: number) {
  if (n === pending) return;
  pending = Math.max(0, n);
  emit();
}

export async function refreshPendingCount(): Promise<number> {
  try {
    setPendingCount(await getPendingBookingsCount());
  } catch {
    // keep the last known value
  }
  return pending;
}

const POLL_MS = 60_000;

/** Current pending count; with `poll` it refreshes on mount, every minute and when the app returns to the foreground. */
export function usePendingCount(poll = false): number {
  const value = useSyncExternalStore(subscribe, () => pending);
  useEffect(() => {
    if (!poll) return;
    refreshPendingCount();
    const timer = setInterval(refreshPendingCount, POLL_MS);
    const sub = AppState.addEventListener("change", (s) => s === "active" && refreshPendingCount());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [poll]);
  return value;
}
