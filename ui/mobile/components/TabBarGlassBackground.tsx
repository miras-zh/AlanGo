import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, UIManager } from "react-native";

import { useAppTheme } from "@/theme/ThemeProvider";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

// Safe check to avoid "Unimplemented component: <ViewManagerAdapter_ExpoBlur_ExpoBlurView>"
// if native module isn't loaded in the current Expo Go client.
function isBlurSupported(): boolean {
  if (Platform.OS === "web") return false;
  try {
    const hasConfig =
      UIManager.hasViewManagerConfig &&
      (UIManager.hasViewManagerConfig("ExpoBlurView") ||
        UIManager.hasViewManagerConfig("ExponentBlurView"));
    return !!hasConfig;
  } catch {
    return false;
  }
}

/**
 * TabBarGlassBackground provides a premium blurred glass background for the tab bar,
 * mirroring the high-end iOS/Android Liquid Glass visual design from Vison.
 */
export function TabBarGlassBackground({ isCapsule = false }: { isCapsule?: boolean }) {
  const c = usePalette();
  const { themeName } = useAppTheme();
  const isLight = themeName === "light";
  const styles = useThemedStyles(createStyles);
  const canBlur = isBlurSupported();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        isCapsule && { borderRadius: 32, overflow: "hidden" },
      ]}
    >
      {canBlur ? (
        <BlurView
          tint={isLight ? "systemChromeMaterialLight" : "systemChromeMaterialDark"}
          intensity={Platform.OS === "android" ? 65 : 75}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Translucent tint overlay for strong separation from content */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isLight
              ? canBlur
                ? "rgba(255, 255, 255, 0.82)"
                : "rgba(255, 255, 255, 0.94)"
              : canBlur
                ? "rgba(11, 15, 13, 0.72)"
                : "rgba(18, 24, 20, 0.92)",
          },
          isCapsule && { borderRadius: 32 },
        ]}
      />

      {/* Crisp glass border for separation */}
      <View
        style={[
          isCapsule ? styles.capsuleBorder : styles.hairline,
          {
            borderColor: isLight ? "rgba(23, 43, 37, 0.14)" : c.subtle,
          },
        ]}
      />
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.subtle,
  },
  capsuleBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 32,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
});
