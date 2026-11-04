import { Platform } from "react-native";

// Single source of truth for app branding on Mobile.
// Automatically updated by scripts/new-app.sh when cloning a new project.
export const SITE_NAME = "AlanGo";
export const SITE_TAGLINE = "Fast, clean mobile & web starter";
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "http://localhost:3002";
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8092" : "http://localhost:8092");
export const SUPPORT_URL = "https://t.me/support";
export const SUPPORT_EMAIL = "support@alango.dev";
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const TERMS_URL = `${SITE_URL}/terms`;
