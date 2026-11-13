import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_BCP47,
  messages,
  type Locale,
  type MessageKey,
} from "@/lib/messages";

export type { MessageKey };
export type TranslateVars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: TranslateVars) => string;

const STORAGE_KEY = "alango.locale";

// Locale for code outside React (alerts in lib/, push texts, error mapping).
// Kept in sync by LocaleProvider; components should use useT() so they
// re-render when the language changes.
let currentLocale: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return currentLocale;
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!isMounted) return;
        if (stored && (LOCALES as string[]).includes(stored)) {
          currentLocale = stored as Locale;
          setLocaleState(stored as Locale);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    currentLocale = next;
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const I18nProvider = LocaleProvider;
export type AppLocale = Locale;

export function useLocale() {
  return useContext(LocaleContext);
}

// Index of the plural form for `n`: ru one|few|many, en one|other, kk single.
function pluralIndex(locale: Locale, n: number): number {
  const abs = Math.abs(Math.trunc(n));
  if (locale === "ru") {
    const n10 = abs % 10;
    const n100 = abs % 100;
    if (n10 === 1 && n100 !== 11) return 0;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 1;
    return 2;
  }
  if (locale === "en") return abs === 1 ? 0 : 1;
  return 0;
}

export function translate(locale: Locale, key: MessageKey, vars?: TranslateVars): string {
  let s: string = messages[locale]?.[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  if (s.includes("|")) {
    const forms = s.split("|");
    const count = typeof vars?.count === "number" ? vars.count : Number(vars?.count ?? 0);
    s = forms[Math.min(pluralIndex(locale, count), forms.length - 1)];
  }
  if (vars) {
    for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  }
  return s;
}

/** Translate outside React (uses the last selected locale). */
export function tr(key: MessageKey, vars?: TranslateVars): string {
  return translate(currentLocale, key, vars);
}

export function useT(): TFunction {
  const { locale } = useLocale();
  return useCallback((key: MessageKey, vars?: TranslateVars) => translate(locale, key, vars), [locale]);
}

export function useI18n() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  return { locale, setLocale, t };
}

export function useLocaleTag(): string {
  const { locale } = useLocale();
  return LOCALE_BCP47[locale];
}

/**
 * Group thousands: "15 000" for ru/kk, "15,000" for en. Done by hand so the
 * output does not depend on which ICU locales the JS engine ships with.
 */
export function formatNumber(n: number, locale: Locale = currentLocale): string {
  if (!Number.isFinite(n)) return String(n);
  const sign = n < 0 ? "-" : "";
  const [int, frac] = Math.abs(n).toString().split(".");
  const sep = locale === "en" ? "," : " ";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return sign + grouped + (frac ? (locale === "en" ? "." : ",") + frac.slice(0, 2) : "");
}

export function useFormatNumber() {
  const { locale } = useLocale();
  return useCallback((n: number) => formatNumber(n, locale), [locale]);
}
