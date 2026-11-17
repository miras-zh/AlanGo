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
  primarySoft: string; // translucent primary fill for selected chips/tiles
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
  warning: string; // pending / awaiting an answer
  warningSoft: string; // translucent warning fill for badges
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
  primarySoft: "rgba(0,201,104,0.15)",
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
  warning: "#F5B70A",
  warningSoft: "rgba(245,183,10,0.15)",
  error: "#F04452",
  onPrimary: "#080D0B",
  onImage: "#FFFFFF",
  overlay: "rgba(0,0,0,0.6)",
};

export const lightPalette: Palette = {
  background: "#F2F5F3",
  surface: "#FFFFFF",
  surfaceElevated: "#EAF0EC",
  primary: "#00A65A",
  primaryGlow: "#00C968",
  primarySoft: "rgba(0,166,90,0.12)",
  accent: "#E5384A",
  textPrimary: "#172B25",
  textSecondary: "#556B63",
  textMuted: "#7C9088",
  border: "#DCE5DF",
  hairline: "rgba(23,43,37,0.08)",
  subtle: "rgba(23,43,37,0.05)",
  glassBorder: "rgba(23,43,37,0.12)",
  glassBackground: "rgba(255,255,255,0.86)",
  success: "#00A65A",
  warning: "#B7791F",
  warningSoft: "rgba(183,121,31,0.12)",
  error: "#DC2626",
  onPrimary: "#FFFFFF",
  onImage: "#FFFFFF",
  overlay: "rgba(23,43,37,0.45)",
};

export function cardShadow(c: Palette) {
  if (c.background !== lightPalette.background) return {};
  return {
    shadowColor: "#172B25",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  };
}

export function usePalette(): Palette {
  const { themeName } = useAppTheme();
  return themeName === "light" ? lightPalette : darkPalette;
}

// Memoised per theme: const styles = useThemedStyles(createStyles);
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const c = usePalette();
  return useMemo(() => factory(c), [factory, c]);
}
