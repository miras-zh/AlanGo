import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/constants/theme";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT, type TFunction } from "@/lib/i18n";
import { monthGenitive } from "@/lib/dataLabels";

interface EventCalendarModalProps {
  visible: boolean;
  selectedDate: string;
  onClose: () => void;
  onSelectDate: (dateKey: string) => void;
}

const DATE_OPTIONS = [
  { id: "all", label: (t: TFunction) => t("calendar.allDates"), sub: (t: TFunction) => t("calendar.allDatesText") },
  // Demo dates match lib/eventsData.ts (November).
  { id: "today", label: (t: TFunction) => t("calendar.todayLabel", { date: t("date.dayMonth", { day: 14, month: monthGenitive(10, t) }) }), sub: (t: TFunction) => t("calendar.todayText") },
  { id: "weekend", label: (t: TFunction) => t("calendar.weekend"), sub: (t: TFunction) => t("date.dayMonth", { day: "16 — 18", month: monthGenitive(10, t) }) },
  { id: "week", label: (t: TFunction) => t("calendar.week"), sub: (t: TFunction) => t("calendar.weekText") },
];

export function EventCalendarModal({
  visible,
  selectedDate,
  onClose,
  onSelectDate,
}: EventCalendarModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons
                name="calendar"
                size={20}
                color={c.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.title}>{t("calendar.title")}</Text>
            </View>
            <Pressable hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>

          {/* Options */}
          <View style={styles.optionsWrap}>
            {DATE_OPTIONS.map((opt) => {
              const isSelected = selectedDate === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                  ]}
                  onPress={() => {
                    hapticSelection();
                    onSelectDate(opt.id);
                    hapticSuccess();
                    onClose();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {opt.label(t)}
                    </Text>
                    <Text style={styles.optionSub}>{opt.sub(t)}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={c.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.screenHorizontal,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: c.glassBackground,
    borderRadius: radii.modal,
    borderWidth: 1,
    borderColor: c.subtle,
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: c.textPrimary,
  },
  optionsWrap: {
    gap: 10,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.hairline,
    borderRadius: radii.smallChip,
    padding: 14,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  optionItemSelected: {
    backgroundColor: "rgba(0, 201, 104, 0.12)",
    borderColor: c.primary,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: c.textPrimary,
  },
  optionLabelSelected: {
    color: c.primary,
  },
  optionSub: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
});
