import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/constants/theme";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

interface EventCalendarModalProps {
  visible: boolean;
  selectedDate: string;
  onClose: () => void;
  onSelectDate: (dateKey: string) => void;
}

const DATE_OPTIONS = [
  { id: "all", label: "Все даты", sub: "Показать все предстоящие события" },
  { id: "today", label: "14 Ноября (Сегодня)", sub: "Ближайшие матчи и турниры" },
  { id: "weekend", label: "В эти выходные", sub: "16 — 18 Ноября" },
  { id: "week", label: "На этой неделе", sub: "Все события до конца недели" },
];

export function EventCalendarModal({
  visible,
  selectedDate,
  onClose,
  onSelectDate,
}: EventCalendarModalProps) {
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
                color={colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.title}>Выберите дату</Text>
            </View>
            <Pressable hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                      {opt.label}
                    </Text>
                    <Text style={styles.optionSub}>{opt.sub}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
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

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(18, 26, 22, 0.96)",
    borderRadius: radii.modal,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
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
    color: colors.textPrimary,
  },
  optionsWrap: {
    gap: 10,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: radii.smallChip,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  optionItemSelected: {
    backgroundColor: "rgba(0, 201, 104, 0.12)",
    borderColor: colors.primary,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  optionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
