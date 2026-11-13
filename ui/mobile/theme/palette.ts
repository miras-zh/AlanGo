import { useMemo } from "react";
import { useAppTheme } from "@/theme/ThemeProvider";

// Semantic colour palette for both themes (DESIGN_SYSTEM.md). Screens build
// their StyleSheets from it via useThemedStyles(createStyles), so switching
// the theme re-styles the whole app. Keep keys in sync between both themes.

export type Palette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryGlow: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  hairline: string; // thin dividers / faint outlines
  subtle: string; // faint fill for chips and inputs
  glassBorder: string;
  glassBackground: string;
  success: string;
  error: string;
  onPrimary: string; // text/icons on primary (green) fills
  onImage: string; // text/icons drawn over photos
  overlay: string; // modal backdrop
};

export const darkPalette: Palette = {
  background: "#080D0B",
  surface: "#121A16",
  surfaceElevated: "#1C2722",
  primary: "#00C968",
  primaryGlow: "#12F27B",
  accent: "#F04452",
  textPrimary: "#F7FAF8",
  textSecondary: "#87978F",
  textMuted: "#6B7C72",
  border: "#26382F",
  hairline: "rgba(255,255,255,0.06)",
  subtle: "rgba(255,255,255,0.08)",
  glassBorder: "rgba(255,255,255,0.12)",
  glassBackground: "rgba(28,39,34,0.72)",
  success: "#00C968",
  error: "#F04452",
  onPrimary: "#080D0B",
  onImage: "#FFFFFF",
  overlay: "rgba(0,0,0,0.6)",
};

export const lightPalette: Palette = {
  background: "#F3F6F4",
  surface: "#FFFFFF",
  surfaceElevated: "#EAF0EC",
  primary: "#00A65A",
  primaryGlow: "#00C968",
  accent: "#E5384A",
  textPrimary: "#0F1F17",
  textSecondary: "#5A7065",
  textMuted: "#7E928A",
  border: "#DCE6E0",
  hairline: "rgba(15,31,23,0.08)",
  subtle: "rgba(15,31,23,0.05)",
  glassBorder: "rgba(15,31,23,0.08)",
  glassBackground: "rgba(255,255,255,0.82)",
  success: "#00A65A",
  error: "#DC2626",
  onPrimary: "#FFFFFF",
  onImage: "#FFFFFF",
  overlay: "rgba(15,31,23,0.45)",
};

export function usePalette(): Palette {
  const { themeName } = useAppTheme();
  return themeName === "light" ? lightPalette : darkPalette;
}

// Memoised per theme: const styles = useThemedStyles(createStyles);
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const c = usePalette();
  return useMemo(() => factory(c), [factory, c]);
}
