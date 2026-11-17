import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getHallAvailability, type Booking, type HallAvailability, type HallSlot } from "@/lib/sportRentData";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";
import { formatNumber, useT } from "@/lib/i18n";
import { displayDate } from "@/lib/dataLabels";
import { DateStrip } from "@/components/DateStrip";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

interface RescheduleBookingModalProps {
  booking: Booking | null;
  onClose: () => void;
  onSubmit: (b: Booking, data: { date: string; startTime: string; durationMinutes: number }) => Promise<void>;
  useModal?: boolean;
}

/**
 * Business: move a booking to another day/time of the same hall using the
 * hall's real availability. The booking's own current slot is shown as
 * "current" and can be kept with another duration.
 */
export function RescheduleBookingModal({ booking, onClose, onSubmit, useModal = true }: RescheduleBookingModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [availability, setAvailability] = useState<HallAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [slot, setSlot] = useState<HallSlot | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booking) return;
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setDate(booking.date >= todayIso ? booking.date : todayIso);
    setDuration(booking.durationMinutes || null);
    setSlot(null);
  }, [booking]);

  useEffect(() => {
    if (!booking || !date) return;
    let cancelled = false;
    setLoading(true);
    setSlot(null);
    getHallAvailability(booking.hallId, date, duration ?? undefined)
      .then((res) => {
        if (cancelled) return;
        setAvailability(res);
        if (duration === null || !res.slotDurations.includes(duration)) setDuration(res.durationMinutes);
      })
      .catch(() => !cancelled && setAvailability(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [booking, date, duration]);

  if (!booking) return null;
  const b = booking;
  const onSameDay = date === b.date;
  const isOwnSlot = (s: HallSlot) => onSameDay && s.start === (b.startTime || b.timeSlot.split(" - ")[0]);
  const selectable = (s: HallSlot) => s.status === "free" || (isOwnSlot(s) && s.status === "booked");

  const submit = async () => {
    if (!slot || !availability) return;
    hapticImpact();
    setSaving(true);
    try {
      await onSubmit(b, { date, startTime: slot.start, durationMinutes: availability.durationMinutes });
      hapticSuccess();
    } catch (err) {
      Alert.alert(t("reschedule.failed"), getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessible={false} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t("reschedule.title")}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {t("reschedule.current", { hall: b.hallTitle, date: displayDate(b.date, t), time: b.timeSlot })}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t("common.close")}>
              <Ionicons name="close" size={20} color={c.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <DateStrip value={date} onChange={setDate} />

            {availability && availability.slotDurations.length > 1 ? (
              <View style={styles.chips}>
                {availability.slotDurations.map((m) => {
                  const active = (duration ?? availability.durationMinutes) === m;
                  return (
                    <Pressable
                      key={m}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        hapticSelection();
                        setDuration(m);
                      }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {m % 60 === 0 ? t("duration.hours", { h: m / 60 }) : t("duration.hoursMinutes", { h: Math.floor(m / 60), m: m % 60 })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator color={c.primary} style={{ marginVertical: spacing.xl }} />
            ) : !availability ? (
              <Text style={styles.empty}>{t("hall.slotsError")}</Text>
            ) : availability.isClosed ? (
              <Text style={styles.empty}>{t("reschedule.closed")}</Text>
            ) : (
              <View style={styles.chips}>
                {availability.slots.map((s) => {
                  const own = isOwnSlot(s);
                  const can = selectable(s);
                  const active = slot?.start === s.start;
                  return (
                    <Pressable
                      key={s.start}
                      disabled={!can}
                      style={[styles.slot, !can && styles.slotDisabled, own && styles.slotOwn, active && styles.chipActive]}
                      onPress={() => {
                        hapticSelection();
                        setSlot(s);
                      }}
                    >
                      <Text style={[styles.slotText, !can && styles.slotTextDisabled, active && styles.chipTextActive]}>{s.label}</Text>
                      {own ? <Text style={styles.ownTag}>{t("reschedule.ownSlot")}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Text style={styles.hint}>{b.status === "pending" ? t("reschedule.hintPending") : t("reschedule.hint")}</Text>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.submit, (!slot || saving) && styles.submitDisabled]}
              disabled={!slot || saving}
              onPress={submit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !slot, busy: saving }}
            >
              {saving ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={styles.submitText}>
                  {slot && availability
                    ? t("reschedule.submitWith", {
                        date: displayDate(date, t),
                        time: slot.label,
                        price: formatNumber(availability.price),
                      })
                    : t("reschedule.chooseSlot")}
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
  );

  if (!useModal) {
    return <View style={StyleSheet.absoluteFill}>{content}</View>;
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      maxHeight: "92%",
      backgroundColor: c.background,
      borderTopLeftRadius: radii.modal,
      borderTopRightRadius: radii.modal,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: c.textPrimary,
    },
    sub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.subtle,
    },
    body: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.smallChip,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
    },
    chipTextActive: {
      color: c.primary,
      fontWeight: "800",
    },
    slot: {
      minWidth: "30%",
      minHeight: 46,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.smallChip,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    slotOwn: {
      borderStyle: "dashed",
      borderColor: c.warning,
    },
    slotDisabled: {
      opacity: 0.4,
    },
    slotText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textPrimary,
    },
    slotTextDisabled: {
      color: c.textMuted,
    },
    ownTag: {
      fontSize: 10,
      fontWeight: "700",
      color: c.warning,
      marginTop: 2,
    },
    empty: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      marginVertical: spacing.xl,
    },
    hint: {
      fontSize: 12,
      color: c.textSecondary,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
    },
    submit: {
      height: 50,
      borderRadius: radii.button,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary,
      paddingHorizontal: spacing.md,
    },
    submitDisabled: {
      opacity: 0.5,
    },
    submitText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.onPrimary,
      textAlign: "center",
    },
  });
}
