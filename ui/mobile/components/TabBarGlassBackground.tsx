import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";

/**
 * TabBarGlassBackground provides a premium blurred glass background for the tab bar,
 * mirroring the high-end iOS/Android Liquid Glass visual design from Vison.
 */
export function TabBarGlassBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        tint="systemChromeMaterialDark"
        intensity={Platform.OS === "android" ? 60 : 70}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(11, 15, 13, 0.72)",
          },
        ]}
      />
      <View
        style={[
          styles.hairline,
          {
            backgroundColor: "rgba(255, 255, 255, 0.10)",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});

