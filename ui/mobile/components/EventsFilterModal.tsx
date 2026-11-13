import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { useT, type MessageKey } from "@/lib/i18n";
import {
  DEFAULT_EVENT_FILTERS,
  EVENT_SPORTS,
  type EventFilterState,
  type EventSport,
  type EventType,
  type PriceRange,
} from "@/lib/eventsData";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const EVENT_TYPES: { id: EventType; label: MessageKey }[] = [
  { id: "tournament", label: "events.tournaments" },
  { id: "open_game", label: "events.openGames" },
  { id: "master_class", label: "events.masterClasses" },
];

const PRICE_RANGES: { id: PriceRange; label: MessageKey }[] = [
  { id: "all", label: "price.any" },
  { id: "under5", label: "price.under5" },
  { id: "5to15", label: "price.5to15" },
  { id: "above15", label: "price.above15" },
];

interface EventsFilterModalProps {
  visible: boolean;
  filters: EventFilterState;
  // Count of events the draft filters would show (for the apply button).
  countFor: (draft: EventFilterState) => number;
  onClose: () => void;
  onApply: (filters: EventFilterState) => void;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/**
 * Advanced event filters. Works on a draft: closing without "Show results"
 * keeps the previously applied filters.
 */
export function EventsFilterModal({ visible, filters, countFor, onClose, onApply }: EventsFilterModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<EventFilterState>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const count = useMemo(() => countFor(draft), [countFor, draft]);

  const chip = (selected: boolean, label: string, onPress: () => void) => (
    <Pressable
      key={label}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t("common.close")} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t("events.filtersTitle")}</Text>
            <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("common.close")}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>{t("filters.sport")}</Text>
            <View style={styles.chipsRow}>
              {EVENT_SPORTS.map((s) =>
                chip(draft.sports.includes(s.id), t(s.label), () =>
                  setDraft((d) => ({ ...d, sports: toggle<EventSport>(d.sports, s.id) })),
                ),
              )}
            </View>

            <Text style={styles.sectionLabel}>{t("events.format")}</Text>
            <View style={styles.chipsRow}>
              {EVENT_TYPES.map((ty) =>
                chip(draft.types.includes(ty.id), t(ty.label), () =>
                  setDraft((d) => ({ ...d, types: toggle<EventType>(d.types, ty.id) })),
                ),
              )}
            </View>

            <Text style={styles.sectionLabel}>{t("events.participationCost")}</Text>
            <View style={styles.chipsRow}>
              {PRICE_RANGES.map((p) =>
                chip(draft.priceRange === p.id, t(p.label), () => setDraft((d) => ({ ...d, priceRange: p.id }))),
              )}
            </View>

            <Pressable
              style={styles.toggleRow}
              onPress={() => {
                hapticSelection();
                setDraft((d) => ({ ...d, onlyWithSpots: !d.onlyWithSpots }));
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.onlyWithSpots }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>{t("events.onlyFree")}</Text>
                <Text style={styles.toggleSub}>{t("events.onlyFreeText")}</Text>
              </View>
              <View style={[styles.checkbox, draft.onlyWithSpots && styles.checkboxActive]}>
                {draft.onlyWithSpots ? <Ionicons name="checkmark" size={16} color={c.onPrimary} /> : null}
              </View>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                hapticImpact();
                setDraft(DEFAULT_EVENT_FILTERS);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.resetText}>{t("filters.reset")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.9 }]}
              onPress={() => {
                hapticSuccess();
                onApply(draft);
                onClose();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.applyText}>{t("events.showResults", { n: count })}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
      maxHeight: "85%",
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
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    content: {
      flexGrow: 0,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      marginBottom: spacing.sm,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    chip: {
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
