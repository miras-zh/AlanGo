import { useState } from "react";
import { FlatList, Keyboard, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticSelection } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

export type SelectOption<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  label?: string;
  placeholder?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  sheetTitle?: string;
};

// Dropdown field: tapping opens a bottom sheet with the options list.
export function SelectField<T extends string | number>({
  label,
  placeholder,
  value,
  options,
  onChange,
  sheetTitle,
}: Props<T>) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
        onPress={() => {
          hapticSelection();
          Keyboard.dismiss();
          setOpen(true);
        }}
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder ?? t("select.placeholder")}
        </Text>
        <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{sheetTitle || label || placeholder || t("select.placeholder")}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.value)}
            style={styles.list}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                  onPress={() => {
                    hapticSelection();
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.label}</Text>
                  {active ? <Ionicons name="checkmark" size={20} color={c.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    fontWeight: "600",
    color: c.textSecondary,
  },
  field: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  value: {
    ...typography.body,
    fontSize: 15,
    color: c.textPrimary,
    flex: 1,
  },
  placeholder: {
    color: c.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    maxHeight: "65%",
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderColor: c.glassBorder,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.cardTitle,
    color: c.textPrimary,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  option: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  optionText: {
    ...typography.body,
    fontSize: 15,
    color: c.textPrimary,
  },
  optionTextActive: {
    color: c.primary,
    fontWeight: "600",
  },
});
