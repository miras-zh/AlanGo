import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { radii, spacing } from "@/constants/theme";
import { hapticSelection } from "@/lib/haptics";
import { useLocaleTag, useT } from "@/lib/i18n";
import { useAppTheme } from "@/theme/ThemeProvider";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type MinuteInterval = 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;

export function parseHHMM(val: string, fallback = "08:00"): Date {
  const src = (val || fallback).trim();
  const base = new Date();
  base.setSeconds(0, 0);

  if (src === "24:00") {
    base.setHours(23, 59, 0, 0);
    return base;
  }

  const m = /^(\d{1,2}):(\d{2})$/.exec(src);
  if (!m) {
    return fallback !== src ? parseHHMM(fallback, "08:00") : base;
  }
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  base.setHours(hh, mm, 0, 0);
  return base;
}

export function formatHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function minutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  if (clamped >= 24 * 60) return "24:00";
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function hhmmToMinutes(val: string): number {
  if (val.trim() === "24:00") return 24 * 60;
  const m = /^(\d{1,2}):(\d{2})$/.exec(val.trim());
  if (!m) return 0;
  return Math.min(24 * 60, Math.max(0, Number(m[1]) * 60 + Number(m[2])));
}

function usePickerLocale(): string {
  const localeTag = useLocaleTag();
  // Keep 24-hour wheels even when the UI language is English.
  return localeTag.startsWith("en") ? "en-GB" : localeTag;
}

type NativeTimePickerPanelProps = {
  value: string;
  title?: string;
  allowMidnight24?: boolean;
  minuteInterval?: MinuteInterval;
  onConfirm: (nextHHMM: string) => void;
  onCancel: () => void;
  inline?: boolean;
};

/**
 * Shared iOS spinner time picker panel. Used inside a bottom-sheet modal by
 * `TimePickerField`, or inline inside an existing modal (since iOS UIKit does
 * not reliably present nested React Native `<Modal>` sheets).
 */
export function NativeTimePickerPanel({
  value,
  title,
  allowMidnight24 = false,
  minuteInterval = 5,
  onConfirm,
  onCancel,
  inline = false,
}: NativeTimePickerPanelProps) {
  const c = usePalette();
  const t = useT();
  const { isDark } = useAppTheme();
  const pickerLocale = usePickerLocale();
  const styles = useThemedStyles(createStyles);

  const [draftDate, setDraftDate] = useState<Date>(() => parseHHMM(value));

  useEffect(() => {
    setDraftDate(parseHHMM(value));
  }, [value]);

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      setDraftDate(selected);
    }
  };

  return (
    <View style={[styles.panel, inline && styles.panelInline]}>
      <View style={styles.panelHeader}>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.headerActionBtn}>
          <Text style={styles.cancelText}>{t("common.cancel")}</Text>
        </Pressable>

        {title ? (
          <Text style={styles.panelTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={styles.headerRight}>
          {allowMidnight24 ? (
            <Pressable
              onPress={() => {
                hapticSelection();
                onConfirm("24:00");
              }}
              hitSlop={6}
              style={[
                styles.midnightBtn,
                value === "24:00" && styles.midnightBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.midnightBtnText,
                  value === "24:00" && styles.midnightBtnTextActive,
                ]}
              >
                24:00
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              hapticSelection();
              onConfirm(formatHHMM(draftDate));
            }}
            hitSlop={8}
            style={styles.headerActionBtn}
          >
            <Text style={styles.doneText}>{t("common.done")}</Text>
          </Pressable>
        </View>
      </View>

      <DateTimePicker
        value={draftDate}
        mode="time"
        display="spinner"
        is24Hour
        minuteInterval={minuteInterval}
        locale={pickerLocale}
        themeVariant={isDark ? "dark" : "light"}
        textColor={c.textPrimary}
        onChange={handleChange}
        style={styles.iosWheel}
      />
    </View>
  );
}

type TimePickerFieldProps = {
  value: string;
  onChange: (nextHHMM: string) => void;
  label?: string;
  placeholder?: string;
  allowMidnight24?: boolean;
  minuteInterval?: MinuteInterval;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * Tappable HH:MM time selector that opens the native iOS time picker wheel
 * (or the native Android time dialog) instead of a text keyboard.
 */
export function TimePickerField({
  value,
  onChange,
  label,
  placeholder = "08:00",
  allowMidnight24 = false,
  minuteInterval = 5,
  compact = false,
  style,
  textStyle,
  testID,
}: TimePickerFieldProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);

  const displayValue = value?.trim() || placeholder;

  const handleOpen = () => {
    Keyboard.dismiss();
    hapticSelection();
    setOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === "set" && selected) {
      onChange(formatHHMM(selected));
    }
  };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${displayValue}` : displayValue}
        style={({ pressed }) => [
          styles.field,
          compact && styles.fieldCompact,
          pressed && styles.fieldPressed,
          style,
        ]}
        onPress={handleOpen}
      >
        <Text
          style={[
            styles.fieldText,
            compact && styles.fieldTextCompact,
            !value?.trim() && { color: c.textMuted },
            textStyle,
          ]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
        <Ionicons
          name="time-outline"
          size={compact ? 13 : 15}
          color={c.textSecondary}
        />
      </Pressable>

      {Platform.OS === "android" && open ? (
        <DateTimePicker
          value={parseHHMM(value, placeholder)}
          mode="time"
          display="default"
          is24Hour
          minuteInterval={minuteInterval}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS !== "android" ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setOpen(false)}
            />
            <NativeTimePickerPanel
              value={value || placeholder}
              title={label}
              allowMidnight24={allowMidnight24}
              minuteInterval={minuteInterval}
              onCancel={() => setOpen(false)}
              onConfirm={(next) => {
                onChange(next);
                setOpen(false);
              }}
            />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    field: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xs,
      backgroundColor: c.background,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: c.subtle,
    },
    fieldCompact: {
      justifyContent: "center",
      paddingHorizontal: 6,
      paddingVertical: 8,
    },
    fieldPressed: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    fieldText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textPrimary,
      fontVariant: ["tabular-nums"],
    },
    fieldTextCompact: {
      fontSize: 13,
      textAlign: "center",
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: c.overlay,
    },
    panel: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.modal,
      borderTopRightRadius: radii.modal,
      borderTopWidth: 1,
      borderColor: c.glassBorder,
      paddingBottom: spacing.xxl,
    },
    panelInline: {
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.background,
      paddingBottom: spacing.xs,
      marginBottom: spacing.lg,
      overflow: "hidden",
    },
    panelHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
      gap: spacing.sm,
    },
    panelTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "700",
      color: c.textPrimary,
    },
    headerActionBtn: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: "500",
      color: c.textSecondary,
    },
    doneText: {
      fontSize: 15,
      fontWeight: "700",
      color: c.primary,
    },
    midnightBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
    },
    midnightBtnActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    midnightBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    midnightBtnTextActive: {
      color: c.primary,
    },
    iosWheel: {
      height: 190,
      width: "100%",
    },
  });
