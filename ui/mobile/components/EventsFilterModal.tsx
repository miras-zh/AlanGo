import React, { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/constants/theme";
import { EventFilterState, EventType } from "@/lib/eventsData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

interface EventsFilterModalProps {
  visible: boolean;
  filters: EventFilterState;
  matchedCount: number;
  onClose: () => void;
  onApply: (filters: EventFilterState) => void;
  onReset: () => void;
}

const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: "all", label: "Все форматы" },
  { id: "tournament", label: "Турниры" },
  { id: "open_game", label: "Открытые игры" },
  { id: "master_class", label: "Мастер-классы" },
];

const PRICE_RANGES: { id: EventFilterState["priceRange"]; label: string }[] = [
  { id: "all", label: "Любая цена" },
  { id: "under5", label: "До 5 000 ₸" },
  { id: "5to15", label: "5 000 — 15 000 ₸" },
  { id: "above15", label: "От 15 000 ₸" },
];

export function EventsFilterModal({
  visible,
  filters,
  matchedCount,
  onClose,
  onApply,
  onReset,
}: EventsFilterModalProps) {
  const [draft, setDraft] = useState<EventFilterState>(filters);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [visible, filters]);

  const handleApply = () => {
    hapticSuccess();
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    hapticImpact();
    onReset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Drag Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Фильтры событий</Text>
            <Pressable hitSlop={8} onPress={handleReset}>
              <Text style={styles.resetText}>Сбросить</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 1. Format / Type */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Формат события</Text>
              <View style={styles.chipsRow}>
                {EVENT_TYPES.map((t) => {
                  const selected = draft.eventType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.chip,
                        selected && styles.chipSelected,
                      ]}
                      onPress={() => {
                        hapticSelection();
                        setDraft((prev) => ({ ...prev, eventType: t.id }));
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Price Range */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Стоимость участия</Text>
              <View style={styles.chipsRow}>
                {PRICE_RANGES.map((pr) => {
                  const selected = draft.priceRange === pr.id;
                  return (
                    <Pressable
                      key={pr.id}
                      style={[
                        styles.chip,
                        selected && styles.chipSelected,
                      ]}
                      onPress={() => {
                        hapticSelection();
                        setDraft((prev) => ({ ...prev, priceRange: pr.id }));
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {pr.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3. Availability Toggle */}
            <View style={styles.section}>
              <Pressable
                style={styles.toggleRow}
                onPress={() => {
                  hapticSelection();
                  setDraft((prev) => ({
                    ...prev,
                    onlyWithSpots: !prev.onlyWithSpots,
                  }));
                }}
              >
                <View>
                  <Text style={styles.toggleTitle}>Только со свободными местами</Text>
                  <Text style={styles.toggleSub}>Скрыть события, где запись завершена</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    draft.onlyWithSpots && styles.checkboxActive,
                  ]}
                >
                  {draft.onlyWithSpots && (
                    <Ionicons name="checkmark" size={16} color={colors.background} />
                  )}
                </View>
              </Pressable>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.applyBtn,
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleApply}
            >
              <Text style={styles.applyBtnText}>
                Показать результаты ({matchedCount})
              </Text>
            </Pressable>
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
    justifyContent: "flex-end",
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "rgba(18, 26, 22, 0.96)",
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingBottom: 34,
    maxHeight: "80%",
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  resetText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  chipSelected: {
    backgroundColor: "rgba(0, 201, 104, 0.16)",
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  toggleSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.background,
  },
});
