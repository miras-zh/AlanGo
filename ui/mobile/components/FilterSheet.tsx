import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

// Shared bottom sheet for the Halls and Events filters: header, scrollable
// sections, "Reset" + "Show results (N)" footer. Screens keep a draft and
// apply it only from the footer button.

type SheetProps = {
  visible: boolean;
  title: string;
  resultCount: number;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  children: React.ReactNode;
};

export function FilterSheet({ visible, title, resultCount, onClose, onReset, onApply, children }: SheetProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t("common.close")} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("common.close")}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                hapticImpact();
                onReset();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.resetText}>{t("filters.reset")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.9 }]}
              onPress={() => {
                hapticSuccess();
                onApply();
                onClose();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.applyText}>{t("events.showResults", { n: resultCount })}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function FilterChips({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.chips}>{children}</View>;
}

export function FilterChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? c.primary : c.textSecondary} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function FilterToggle({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      style={styles.toggleRow}
      onPress={() => {
        hapticSelection();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.toggleSub}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.checkbox, value && styles.checkboxActive]}>
        {value ? <Ionicons name="checkmark" size={16} color={c.onPrimary} /> : null}
      </View>
    </Pressable>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
    },
    scrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: c.overlay,
    },
    sheet: {
      maxHeight: "88%",
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.modal,
      borderTopRightRadius: radii.modal,
      borderWidth: 1,
      borderColor: c.glassBorder,
      paddingHorizontal: spacing.screenHorizontal,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      marginTop: spacing.sm,
      backgroundColor: c.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    content: {
      flexGrow: 0,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      marginBottom: spacing.sm,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassBackground,
    },
    chipSelected: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
    },
    chipTextSelected: {
      color: c.primary,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    toggleTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textPrimary,
    },
    toggleSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    footer: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingTop: spacing.md,
    },
    resetBtn: {
      flex: 1,
      height: 48,
      borderRadius: radii.button,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    resetText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textPrimary,
    },
    applyBtn: {
      flex: 2,
      height: 48,
      borderRadius: radii.button,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    applyText: {
      fontSize: 14,
      fontWeight: "800",
      color: c.onPrimary,
    },
  });
}
