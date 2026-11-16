import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/constants/theme";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { monthName, monthShort, weekdayShort } from "@/lib/dataLabels";
import { BOOKING_DAYS_AHEAD, isoDate } from "@/lib/sportRentData";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const CARD_W = 52;
const GAP = spacing.sm;
const STEP = CARD_W + GAP;

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function parseIso(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** The bookable days: today … today + count - 1. */
export function bookableDays(count = BOOKING_DAYS_AHEAD): Date[] {
  const t = startOfToday();
  return Array.from({ length: count }, (_, i) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + i));
}

interface DateStripProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  days?: number; // how many days from today (default: booking window)
}

/**
 * Horizontal day picker over the whole booking window (60 days) with the
 * visible month in the header and a month calendar to jump to a far date.
 */
export function DateStrip({ value, onChange, days = BOOKING_DAYS_AHEAD }: DateStripProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const list = useMemo(() => bookableDays(days), [days]);
  const scrollRef = useRef<ScrollView>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selectedIndex = Math.max(0, list.findIndex((d) => isoDate(d) === value));

  // Keep the selected day in view when it changes from outside (calendar).
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, (selectedIndex - 1) * STEP), animated: true });
  }, [selectedIndex]);

  const header = list[Math.min(visibleIndex, list.length - 1)] ?? list[0];

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.monthTitle}>
          {monthName(header.getMonth(), t)} {header.getFullYear()}
        </Text>
        <Pressable
          style={styles.calendarBtn}
          onPress={() => {
            hapticSelection();
            setCalendarOpen(true);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("dateStrip.openCalendar")}
        >
          <Ionicons name="calendar-outline" size={16} color={c.primary} />
          <Text style={styles.calendarBtnText}>{t("dateStrip.calendar")}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        scrollEventThrottle={32}
        onScroll={(e) => setVisibleIndex(Math.round(e.nativeEvent.contentOffset.x / STEP))}
      >
        {list.map((d, i) => {
          const id = isoDate(d);
          const active = id === value;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <Pressable
              key={id}
              style={[styles.day, active && styles.dayActive]}
              onPress={() => {
                hapticSelection();
                onChange(id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.dayTop, weekend && styles.dayWeekend, active && styles.dayTextActive]}>
                {i === 0 ? t("dateStrip.todayShort") : weekdayShort(d.getDay(), t)}
              </Text>
              <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.getDate()}</Text>
              <Text style={[styles.dayMonth, active && styles.dayTextActive]}>{monthShort(d.getMonth(), t)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <MonthCalendarModal
        visible={calendarOpen}
        value={value}
        days={days}
        onClose={() => setCalendarOpen(false)}
        onSelect={(id) => {
          setCalendarOpen(false);
          onChange(id);
        }}
      />
    </View>
  );
}

interface MonthCalendarModalProps {
  visible: boolean;
  value: string;
  days?: number;
  onClose: () => void;
  onSelect: (date: string) => void;
}

/** Month grid (Monday first) limited to the booking window. */
export function MonthCalendarModal({ visible, value, days = BOOKING_DAYS_AHEAD, onClose, onSelect }: MonthCalendarModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const first = startOfToday();
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + days - 1);
  const [month, setMonth] = useState(() => {
    const v = value ? parseIso(value) : first;
    return new Date(v.getFullYear(), v.getMonth(), 1);
  });

  useEffect(() => {
    if (!visible) return;
    const v = value ? parseIso(value) : first;
    setMonth(new Date(v.getFullYear(), v.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canPrev = month > new Date(first.getFullYear(), first.getMonth(), 1);
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= last;

  // Monday-first grid with leading blanks.
  const lead = (month.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const weekdayHeaders = [1, 2, 3, 4, 5, 6, 0].map((d) => weekdayShort(d, t));
  const todayId = isoDate(first);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.calHeader}>
            <Pressable
              style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
              disabled={!canPrev}
              onPress={() => {
                hapticSelection();
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
              }}
              accessibilityRole="button"
              accessibilityLabel={t("dateStrip.prevMonth")}
            >
              <Ionicons name="chevron-back" size={18} color={c.textPrimary} />
            </Pressable>
            <Text style={styles.calTitle}>
              {monthName(month.getMonth(), t)} {month.getFullYear()}
            </Text>
            <Pressable
              style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
              disabled={!canNext}
              onPress={() => {
                hapticSelection();
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
              }}
              accessibilityRole="button"
              accessibilityLabel={t("dateStrip.nextMonth")}
            >
              <Ionicons name="chevron-forward" size={18} color={c.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {weekdayHeaders.map((w, i) => (
              <Text key={`h${i}`} style={styles.weekHead}>
                {w}
              </Text>
            ))}
            {cells.map((d, i) => {
              if (!d) return <View key={`b${i}`} style={styles.cell} />;
              const id = isoDate(d);
              const disabled = d < first || d > last;
              const active = id === value;
              return (
                <Pressable
                  key={id}
                  style={styles.cell}
                  disabled={disabled}
                  onPress={() => {
                    hapticSelection();
                    onSelect(id);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected: active }}
                >
                  <View style={[styles.cellInner, id === todayId && styles.cellToday, active && styles.cellActive]}>
                    <Text style={[styles.cellText, disabled && styles.cellTextDisabled, active && styles.cellTextActive]}>
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint}>{t("dateStrip.windowHint", { n: days })}</Text>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>{t("common.close")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    wrap: {
      marginBottom: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    monthTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: c.textPrimary,
      textTransform: "capitalize",
    },
    calendarBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.smallChip,
      backgroundColor: c.primarySoft,
    },
    calendarBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.primary,
    },
    strip: {
      gap: GAP,
      paddingRight: spacing.sm,
    },
    day: {
      width: CARD_W,
      paddingVertical: spacing.sm,
      alignItems: "center",
      borderRadius: radii.smallChip,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    dayActive: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    dayTop: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textSecondary,
    },
    dayWeekend: {
      color: c.accent,
    },
    dayNum: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
      marginVertical: 2,
    },
    dayMonth: {
      fontSize: 11,
      color: c.textMuted,
    },
    dayTextActive: {
      color: c.primary,
    },
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center",
      paddingHorizontal: spacing.screenHorizontal,
    },
    sheet: {
      backgroundColor: c.surface,
      borderRadius: radii.modal,
      borderWidth: 1,
      borderColor: c.glassBorder,
      padding: spacing.lg,
    },
    calHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    calTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: c.textPrimary,
      textTransform: "capitalize",
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.subtle,
    },
    navBtnDisabled: {
      opacity: 0.3,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    weekHead: {
      width: `${100 / 7}%`,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: c.textMuted,
      paddingBottom: spacing.sm,
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      padding: 2,
    },
    cellInner: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.smallChip,
    },
    cellToday: {
      borderWidth: 1,
      borderColor: c.primary,
    },
    cellActive: {
      backgroundColor: c.primary,
    },
    cellText: {
      fontSize: 15,
      fontWeight: "600",
      color: c.textPrimary,
    },
    cellTextDisabled: {
      color: c.textMuted,
      opacity: 0.4,
    },
    cellTextActive: {
      color: c.onPrimary,
      fontWeight: "800",
    },
    hint: {
      fontSize: 12,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
    },
    closeBtn: {
      marginTop: spacing.md,
      height: 44,
      borderRadius: radii.button,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.subtle,
    },
    closeText: {
      fontSize: 15,
      fontWeight: "700",
      color: c.textPrimary,
    },
  });
}
