import React from "react";
import { BlurView } from "expo-blur";
import {
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  UIManager,
} from "react-native";
import { radii } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

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

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  variant?: "default" | "selected" | "card" | "pill" | "button";
  intensity?: number;
  glow?: boolean;
  pointerEvents?: "box-none" | "none" | "box-only" | "auto";
}

export function GlassSurface({
  children,
  style,
  borderRadius = radii.card,
  variant = "default",
  intensity = 55,
  glow = false,
  pointerEvents,
}: GlassSurfaceProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const canBlur = isBlurSupported();
  const isSelected = variant === "selected";

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.container,
        { borderRadius },
        isSelected && styles.containerSelected,
        glow && styles.glowEffect,
        style,
      ]}
    >
      {/* Background Blur on iOS/supported */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius, overflow: "hidden" },
        ]}
        pointerEvents="none"
      >
        {canBlur ? (
          <BlurView
            tint="systemChromeMaterialDark"
            intensity={Platform.OS === "android" ? Math.min(intensity, 40) : intensity}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Translucent Tint Overlay */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isSelected
                ? "rgba(0, 201, 104, 0.16)"
                : canBlur
                ? c.glassBackground
                : c.glassBackground,
            },
          ]}
        />

        {/* Glass Specular Border */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.borderOverlay,
            {
              borderRadius,
              borderColor: isSelected
                ? "rgba(0, 201, 104, 0.45)"
                : c.subtle,
            },
          ]}
        />
      </View>

      {children}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    position: "relative",
    borderWidth: 1,
    borderColor: c.subtle,
    backgroundColor: "transparent",
  },
  containerSelected: {
    borderColor: c.primary,
  },
  glowEffect: {
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  borderOverlay: {
    borderWidth: 1,
  },
});
