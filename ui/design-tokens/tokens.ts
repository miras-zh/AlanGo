// Shared design tokens for Web (Next.js) and Mobile (Expo / React Native).
// Generated for AlanGo (Emerald Mint Theme for Sports & Fitness).

export const colors = {
  light: {
    bg: "#F8FAF9",
    surface: "#FFFFFF",
    surface2: "#F0F5F2",
    border: "#E1EBE5",
    text: "#0F1F17",
    muted: "#5A7065",
    accent: "#059669",
    accentHover: "#047857",
    accentSoft: "#E6F7F0",
    accentSoftText: "#065F46",
  },
  dark: {
    bg: "#0B130E",
    surface: "#131F18",
    surface2: "#1B2B22",
    border: "#253A2E",
    text: "#ECFDF5",
    muted: "#7DA38E",
    accent: "#10B981",
    accentHover: "#34D399",
    accentSoft: "#1A3B29",
    accentSoftText: "#A7F3D0",
  },
} as const;

export const radius = {
  card: 16,
  control: 10,
  pill: 9999,
} as const;

export const typography = {
  heading1: 28,
  heading2: 20,
  body: 15,
  caption: 13,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
} as const;

export type ThemeName = keyof typeof colors;
export type ThemeColors = (typeof colors)[ThemeName];
