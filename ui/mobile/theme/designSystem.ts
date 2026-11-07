/**
 * Alan Go — Mobile Design System Tokens
 * Reference: DESIGN_SYSTEM.md
 */

export const colors = {
  background: "#080D0B",
  surface: "#121A16",
  surfaceElevated: "#1C2722",

  primary: "#00C968",
  primaryGlow: "#12F27B",

  accent: "#F04452",

  textPrimary: "#F7FAF8",
  textSecondary: "#87978F",

  border: "#26382F",
  glassBorder: "rgba(255,255,255,0.12)",
  glassBackground: "rgba(28,39,34,0.72)",

  success: "#00C968",
  error: "#F04452",
} as const;

export const typography = {
  screenTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
} as const;

export const spacing = {
  screenHorizontal: 16,
  card: 12,
  section: 20,
  compact: 8,
  icon: 6,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  bottomScrollPadding: 110,
} as const;

export const radii = {
  smallChip: 12,
  button: 14,
  card: 18,
  modal: 24,
  floatingNav: 28,
} as const;

export const designSystem = {
  colors,
  typography,
  spacing,
  radii,
};

export default designSystem;

