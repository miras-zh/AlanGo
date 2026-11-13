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
import { Appearance, useColorScheme } from "react-native";
import {
  colors as tokenColors,
  type ThemeColors,
  type ThemeName,
} from "@alango/design-tokens";

const STORAGE_KEY = "alango.theme_mode";

export type ThemeMode = "system" | "light" | "dark";

export type ExtendedThemeColors = ThemeColors & {
  textSecondary: string;
  textMuted: string;
  card: string;
  background: string;
  primary: string;
  danger: string;
};

export type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  themeName: ThemeName;
  tokens: ThemeColors;
  colors: ExtendedThemeColors;
  isDark: boolean;
  setThemeName: (name: ThemeName) => void;
  toggleTheme: () => void;
};

function getExtendedColors(name: ThemeName): ExtendedThemeColors {
  const t = tokenColors[name] ?? tokenColors.dark;
  return {
    ...t,
    textSecondary: t.muted,
    textMuted: t.muted,
    card: t.surface,
    background: t.bg,
    primary: t.accent,
    danger: "#EF4444",
  };
}

const defaultColors = getExtendedColors("dark");

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  setMode: () => {},
  themeName: "dark",
  tokens: tokenColors.dark,
  colors: defaultColors,
  isDark: true,
  setThemeName: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!isMounted) return;
        if (stored === "system" || stored === "light" || stored === "dark") {
          setModeState(stored as ThemeMode);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setHydrated(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Push the choice to UIKit so native UI (tab bar, alerts, keyboard, date
  // pickers) follows the app theme; "system" clears the override.
  useEffect(() => {
    try {
      Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
    } catch {
      // older runtimes without setColorScheme
    }
  }, [mode]);

  const themeName: ThemeName = useMemo(() => {
    if (mode === "light") return "light";
    if (mode === "dark") return "dark";
    return systemScheme === "light" ? "light" : "dark";
  }, [mode, systemScheme]);

  const isDark = themeName === "dark";

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const setThemeName = useCallback(
    (next: ThemeName) => {
      setMode(next);
    },
    [setMode],
  );

  const toggleTheme = useCallback(() => {
    setMode(themeName === "dark" ? "light" : "dark");
  }, [setMode, themeName]);

  const value = useMemo<ThemeContextValue>(() => {
    const rawTokens = tokenColors[themeName] ?? tokenColors.dark;
    return {
      mode,
      setMode,
      themeName,
      tokens: rawTokens,
      colors: getExtendedColors(themeName),
      isDark,
      setThemeName,
      toggleTheme,
    };
  }, [mode, setMode, themeName, isDark, setThemeName, toggleTheme]);

  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export const useTheme = useAppTheme;
