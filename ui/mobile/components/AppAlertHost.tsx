import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { Ionicons } from "@expo/vector-icons";
import {
  dismissAlert,
  subscribeAlerts,
  type AlertTone,
  type AppAlertButton,
  type AppAlertItem,
} from "@/lib/alert";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { cardShadow, usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { radii, spacing } from "@/constants/theme";

type ToneVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

function getToneVisual(tone: AlertTone, c: Palette): ToneVisual {
  switch (tone) {
    case "success":
      return { icon: "checkmark-circle", color: c.success, bg: c.primarySoft };
    case "error":
      return { icon: "alert-circle", color: c.error, bg: "rgba(240, 68, 82, 0.14)" };
    case "destructive":
      return { icon: "trash-outline", color: c.error, bg: "rgba(240, 68, 82, 0.14)" };
    case "warning":
      return { icon: "warning", color: c.warning, bg: c.warningSoft };
    case "info":
    default:
      return { icon: "information-circle", color: c.primary, bg: c.primarySoft };
  }
}

export function AppAlertHost() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const t = useT();
  const [current, setCurrent] = useState<AppAlertItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    return subscribeAlerts((item) => {
      closingRef.current = false;
      setCurrent(item);
      if (item) {
        opacity.setValue(0);
        scale.setValue(0.94);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            damping: 20,
            stiffness: 260,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
  }, [opacity, scale]);

  const orderedButtons = useMemo(() => {
    if (!current) return [];
    const btns = current.buttons;
    if (btns.length === 2) {
      const cancelIdx = btns.findIndex((b) => b.style === "cancel");
      if (cancelIdx === 1) return [btns[1], btns[0]];
    }
    return btns;
  }, [current]);

  const useRowLayout = useMemo(() => {
    if (orderedButtons.length !== 2) return false;
    return orderedButtons.every((b) => (b.text || t("common.ok")).length <= 16);
  }, [orderedButtons, t]);

  if (!current) return null;

  const toneVisual = getToneVisual(current.tone, c);
  const canBackdropDismiss =
    current.options.cancelable === true ||
    (current.options.cancelable !== false && current.buttons.length === 1);

  const handleAction = (btn?: AppAlertButton) => {
    if (closingRef.current) return;
    closingRef.current = true;
    hapticSelection();

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissAlert(current.id);
      if (btn?.onPress) {
        btn.onPress();
      } else if (!btn && current.options.onDismiss) {
        current.options.onDismiss();
      }
    });
  };

  const content = (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={canBackdropDismiss ? () => handleAction(undefined) : undefined}
      />
      <Animated.View style={[styles.card, cardShadow(c), { transform: [{ scale }] }]}>
        <View style={[styles.iconWrap, { backgroundColor: toneVisual.bg }]}>
          <Ionicons name={toneVisual.icon} size={28} color={toneVisual.color} />
        </View>

        <Text style={styles.title}>{current.title}</Text>
        {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

        <View style={[styles.actions, useRowLayout && styles.actionsRow]}>
          {orderedButtons.map((btn, index) => {
            const label = btn.text || t("common.ok");
            const isCancel = btn.style === "cancel";
            const isDestructive = btn.style === "destructive";
            const isPrimary = !isCancel && !isDestructive;

            return (
              <Pressable
                key={`${current.id}-btn-${index}`}
                onPress={() => handleAction(btn)}
                style={({ pressed }) => [
                  styles.button,
                  useRowLayout && styles.buttonRow,
                  isPrimary && styles.buttonPrimary,
                  isCancel && styles.buttonCancel,
                  isDestructive && styles.buttonDestructive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.buttonText,
                    isPrimary && styles.buttonTextPrimary,
                    isCancel && styles.buttonTextCancel,
                    isDestructive && styles.buttonTextDestructive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Animated.View>
  );

  if (Platform.OS === "ios") {
    return <FullWindowOverlay>{content}</FullWindowOverlay>;
  }

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (canBackdropDismiss) handleAction(undefined);
      }}
    >
      {content}
    </Modal>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: c.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      zIndex: 9999,
    },
    card: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: c.surface,
      borderRadius: radii.modal,
      borderWidth: 1,
      borderColor: c.glassBorder,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
      alignItems: "center",
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: c.textPrimary,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    actions: {
      width: "100%",
      marginTop: spacing.xl,
      gap: spacing.sm,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    button: {
      width: "100%",
      minHeight: 46,
      borderRadius: radii.button,
      paddingHorizontal: spacing.lg,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonRow: {
      flex: 1,
      width: undefined,
    },
    buttonPrimary: {
      backgroundColor: c.primary,
    },
    buttonCancel: {
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    buttonDestructive: {
      backgroundColor: c.error,
    },
    buttonPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.985 }],
    },
    buttonText: {
      fontSize: 15,
      fontWeight: "600",
    },
    buttonTextPrimary: {
      color: c.onPrimary,
    },
    buttonTextCancel: {
      color: c.textPrimary,
    },
    buttonTextDestructive: {
      color: c.onImage,
    },
  });
