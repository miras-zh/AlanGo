import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, UIManager } from "react-native";

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
          tint="systemChromeMaterialDark"
          intensity={Platform.OS === "android" ? 60 : 70}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Dark tint overlay with liquid glass transparency */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: canBlur
              ? "rgba(11, 15, 13, 0.72)"
              : "rgba(18, 24, 20, 0.92)",
          },
          isCapsule && { borderRadius: 32 },
        ]}
      />

      {/* Subtle glass hairline highlight */}
      <View
        style={[
          isCapsule ? styles.capsuleBorder : styles.hairline,
          {
            borderColor: c.subtle,
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
