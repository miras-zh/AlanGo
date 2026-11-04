// Shared design tokens for Web (Next.js) and Mobile (Expo / React Native).
// Change `accent` / `accentHover` / `bg` here to re-skin the entire application!

export const colors = {
  light: {
    bg: "#FAFAFC",
    surface: "#FFFFFF",
    surface2: "#F2F1F7",
    border: "#E6E4F0",
    text: "#18171F",
    muted: "#6E6B7B",
    accent: "#6D4BFF",
    accentHover: "#5A38F0",
    accentSoft: "#EEE9FF",
    accentSoftText: "#5133D6",
  },
  dark: {
    bg: "#0E0E14",
    surface: "#171721",
    surface2: "#21212E",
    border: "#2B2B3B",
    text: "#F3F2F8",
    muted: "#9694A8",
    accent: "#8B6DFF",
    accentHover: "#9D83FF",
    accentSoft: "#251E42",
    accentSoftText: "#C7B8FF",
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
