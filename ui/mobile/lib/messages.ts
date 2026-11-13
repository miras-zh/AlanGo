import { en } from "@/lib/locales/en";
import { kk } from "@/lib/locales/kk";
import { ru, type MessageKey } from "@/lib/locales/ru";

export type { MessageKey };
export type Locale = "kk" | "ru" | "en";

export const LOCALES: Locale[] = ["kk", "ru", "en"];
export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_BCP47: Record<Locale, string> = {
  kk: "kk-KZ",
  ru: "ru-RU",
  en: "en-US",
};

export const messages: Record<Locale, Record<MessageKey, string>> = { kk, ru, en };
