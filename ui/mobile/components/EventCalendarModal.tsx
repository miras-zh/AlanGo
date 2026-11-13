import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/constants/theme";
import { hapticSelection } from "@/lib/haptics";
import { useT, type MessageKey } from "@/lib/i18n";
import type { DateFilter } from "@/lib/eventsData";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export const DATE_FILTERS: { id: DateFilter; label: MessageKey; sub: MessageKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "upcoming", label: "events.dateUpcoming", sub: "calendar.allDatesText", icon: "calendar-outline" },
  { id: "today", label: "date.today", sub: "calendar.todayText", icon: "today-outline" },
  { id: "weekend", label: "calendar.weekend", sub: "events.weekendText", icon: "sunny-outline" },
  { id: "week", label: "calendar.week", sub: "calendar.weekText", icon: "calendar-number-outline" },
];

interface EventCalendarModalProps {
  visible: boolean;
  selected: DateFilter;
  onClose: () => void;
  onSelect: (value: DateFilter) => void;
}

/** Date range for the events list. */
export function EventCalendarModal({ visible, selected, onClose, onSelect }: EventCalendarModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t("calendar.title")}</Text>
          {DATE_FILTERS.map((opt) => {
            const active = opt.id === selected;
            return (
              <Pressable
                key={opt.id}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => {
                  hapticSelection();
                  onSelect(opt.id);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={opt.icon} size={18} color={active ? c.primary : c.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, active && styles.labelActive]}>{t(opt.label)}</Text>
                  <Text style={styles.sub}>{t(opt.sub)}</Text>
                </View>
                {active ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
      backgroundColor: c.overlay,
    },
    sheet: {
      backgroundColor: c.surface,
      borderRadius: radii.modal,
      borderWidth: 1,
      borderColor: c.glassBorder,
      padding: spacing.xl,
    },
    title: {
      fontSize: 16,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.smallChip,
    },
    rowActive: {
      backgroundColor: c.primarySoft,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: c.textPrimary,
    },
    labelActive: {
      color: c.primary,
    },
    sub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
  });
}
