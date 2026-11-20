import { Alert, type AlertButton, type AlertOptions } from "react-native";

export type AlertTone = "success" | "error" | "warning" | "info" | "destructive";

export type AppAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: AlertButton["style"];
};

export type AppAlertOptions = AlertOptions & {
  tone?: AlertTone;
};

export type AppAlertItem = {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options: AppAlertOptions;
  tone: AlertTone;
};

type Listener = (current: AppAlertItem | null) => void;

let nextId = 1;
const queue: AppAlertItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  const current = queue[0] ?? null;
  listeners.forEach((fn) => fn(current));
}

export function inferAlertTone(
  title: string,
  _message?: string,
  buttons?: AppAlertButton[],
  explicitTone?: AlertTone,
): AlertTone {
  if (explicitTone) return explicitTone;
  if (buttons?.some((b) => b.style === "destructive")) return "destructive";

  const low = title.toLowerCase();
  if (
    low.includes("ошибк") ||
    low.includes("error") ||
    low.includes("қате") ||
    low.includes("failed") ||
    low.includes("не удал")
  ) {
    return "error";
  }
  if (
    low.includes("сохранен") ||
    low.includes("saved") ||
    low.includes("сақталд") ||
    low.includes("отправлен") ||
    low.includes("sent") ||
    low.includes("жіберілд") ||
    low.includes("подтвержд") ||
    low.includes("confirmed") ||
    low.includes("успех") ||
    low.includes("success") ||
    low.includes("сәтті") ||
    low.includes("готов") ||
    low.includes("done") ||
    low.includes("оплачен") ||
    low.includes("обновлен")
  ) {
    return "success";
  }
  if (
    low.includes("вниман") ||
    low.includes("выберите") ||
    low.includes("attention") ||
    low.includes("warning") ||
    low.includes("ескерту") ||
    low.includes("лимит") ||
    low.includes("укажит") ||
    low.includes("введите") ||
    low.includes("нужно") ||
    low.includes("отмен")
  ) {
    return "warning";
  }
  return "info";
}

/**
 * Shows an app-styled modal alert matching DESIGN_SYSTEM.md.
 * API-compatible with React Native's `Alert.alert`.
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: AppAlertOptions,
): void {
  if (listeners.size === 0) {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const normalizedButtons =
    buttons && buttons.length > 0 ? buttons : [{ text: "OK", style: "default" as const }];

  const item: AppAlertItem = {
    id: nextId++,
    title,
    message,
    buttons: normalizedButtons,
    options: options ?? {},
    tone: inferAlertTone(title, message, normalizedButtons, options?.tone),
  };

  queue.push(item);
  if (queue.length === 1) {
    notify();
  }
}

export function dismissAlert(id: number): void {
  if (queue[0]?.id !== id) return;
  queue.shift();
  notify();
}

export function subscribeAlerts(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue[0] ?? null);
  return () => {
    listeners.delete(listener);
  };
}
