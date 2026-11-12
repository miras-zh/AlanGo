import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { hapticImpact } from "@/lib/haptics";

// Prevent native splash from auto-hiding before our animation takes over
SplashScreen.preventAutoHideAsync().catch(() => {});

const { width, height } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
  children: React.ReactNode;
}

export function AnimatedSplashScreen({
  onAnimationComplete,
  children,
}: AnimatedSplashScreenProps) {
  const [animationFinished, setAnimationFinished] = useState(false);

  // Animation values
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.4)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // Ball animation values
  const ballProgress = useRef(new Animated.Value(0)).current;
  const ballRotation = useRef(new Animated.Value(0)).current;
  const ballScale = useRef(new Animated.Value(0.5)).current;
  const ballOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Immediately hide native splash now that React Native view is mounted
    SplashScreen.hideAsync().catch(() => {});

    // 2. Logo entrance + pulse
    const logoEntrance = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
    ]);

    // Pulsing letter "A" / icon glow
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.35,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 2 }
    );

    // 3. Flying sports ball sequence across screen
    const ballSequence = Animated.parallel([
      Animated.timing(ballOpacity, {
        toValue: 1,
        duration: 150,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.timing(ballProgress, {
        toValue: 1,
        duration: 850,
        delay: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(ballRotation, {
        toValue: 1,
        duration: 850,
        delay: 250,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(ballScale, {
          toValue: 1.25,
          duration: 450,
          delay: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ballScale, {
          toValue: 0.7,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    // Haptic kick as the ball sweeps by
    const hapticTimer = setTimeout(() => {
      hapticImpact();
    }, 550);

    // 4. Master Orchestration
    Animated.sequence([
      logoEntrance,
      Animated.parallel([pulseLoop, ballSequence]),
      Animated.delay(180),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimationFinished(true);
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    });

    return () => {
      clearTimeout(hapticTimer);
    };
  }, []);

  // Ball trajectory: curve across the screen
  const ballTranslateX = ballProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [-60, width * 0.52, width + 80],
  });

  const ballTranslateY = ballProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [height * 0.68, height * 0.44, height * 0.22],
  });

  const spin = ballRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "720deg"],
  });

  return (
    <View style={styles.rootContainer}>
      {/* 1. Underlying main app screen */}
      {children}

      {/* 2. Top-level Animated Splash Overlay */}
      {!animationFinished && (
        <Animated.View
          style={[
            styles.splashOverlay,
            {
              opacity: containerOpacity,
            },
          ]}
          pointerEvents={animationFinished ? "none" : "auto"}
        >
          {/* Subtle Ambient Emerald Glow in Background */}
          <Animated.View
            style={[
              styles.ambientGlow,
              {
                opacity: glowPulse,
                transform: [
                  {
                    scale: glowPulse.interpolate({
                      inputRange: [0.35, 1],
                      outputRange: [0.95, 1.15],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Logo & Pulsing Letter "A" Center Container */}
          <Animated.View
            style={[
              styles.centerBox,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            {/* Outer Pulsing Glow Ring */}
            <Animated.View
              style={[
                styles.glowRing,
                {
                  opacity: glowPulse,
                  transform: [
                    {
                      scale: glowPulse.interpolate({
                        inputRange: [0.35, 1],
                        outputRange: [1, 1.08],
                      }),
                    },
                  ],
                },
              ]}
            />

            {/* App Icon Card */}
            <View style={styles.iconContainer}>
              <Image
                source={require("@/assets/icon.png")}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            {/* Typography */}
            <Animated.View style={[styles.titleRow, { opacity: textOpacity }]}>
              <Text style={styles.titleAlan}>Alan</Text>
              <Text style={styles.titleGo}>Go</Text>
            </Animated.View>

            <Animated.Text
              style={[styles.subtitle, { opacity: textOpacity }]}
            >
              Аренда спортивных залов
            </Animated.Text>
          </Animated.View>

          {/* Flying Neon Sports Ball */}
          <Animated.View
            style={[
              styles.ballContainer,
              {
                opacity: ballOpacity,
                transform: [
                  { translateX: ballTranslateX },
                  { translateY: ballTranslateY },
                  { rotate: spin },
                  { scale: ballScale },
                ],
              },
            ]}
          >
            {/* Ball Motion Trail */}
            <View style={styles.ballTrail} />

            {/* Glowing Football (soccer) Ball */}
            <View style={styles.ballBody}>
              <MaterialCommunityIcons
                name="soccer"
                size={36}
                color={colors.background}
              />
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background, // Deep Dark #080D0B
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
  ambientGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(0, 201, 104, 0.16)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    top: -6,
    width: 144,
    height: 144,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 24,
  },
  iconContainer: {
    width: 132,
    height: 132,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#000000",
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  logoImage: {
    width: 132,
    height: 132,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    gap: 4,
  },
  titleAlan: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  titleGo: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Ball Styling
  ballContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100000,
  },
  ballTrail: {
    position: "absolute",
    width: 36,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(0, 201, 104, 0.45)",
    transform: [{ translateX: -18 }, { rotate: "-25deg" }],
  },
  ballBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.textPrimary, // White football ball body
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
