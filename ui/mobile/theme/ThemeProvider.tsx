import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";
import {
  colors,
  type ThemeColors,
  type ThemeName,
} from "@alango/design-tokens";

const STORAGE_KEY = "alango.theme";

type ThemeContextValue = {
  themeName: ThemeName;
  tokens: ThemeColors;
  setThemeName: (name: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeName: "dark",
  tokens: colors.dark,
  setThemeName: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [storedTheme, setStoredTheme] = useState<ThemeName | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!isMounted) return;
        if (stored === "light" || stored === "dark") {
          setStoredTheme(stored);
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

  const themeName: ThemeName =
    storedTheme ?? (systemScheme === "light" ? "light" : "dark");

  const setThemeName = (next: ThemeName) => {
    setStoredTheme(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const toggleTheme = () => {
    setThemeName(themeName === "dark" ? "light" : "dark");
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeName,
      tokens: colors[themeName],
      setThemeName,
      toggleTheme,
    }),
    [themeName],
  );

  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
