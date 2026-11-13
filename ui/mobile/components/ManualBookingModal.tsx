import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Booking,
  createHallBooking,
  getHallAvailability,
  Hall,
  HallAvailability,
  isoDate,
} from "@/lib/sportRentData";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useT, type TFunction } from "@/lib/i18n";
import { weekdayShort } from "@/lib/dataLabels";

interface ManualBookingModalProps {
  visible: boolean;
  halls: Hall[];
  arenaTitle: string;
  arenaId: number;
  onClose: () => void;
  onCreated: (booking: Booking) => void;
}


function nextDays(count: number, t: TFunction) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const label =
      i === 0
        ? t("date.today")
        : i === 1
          ? t("date.tomorrow")
          : t("date.dayNum", { weekday: weekdayShort(d.getDay(), t), day: d.getDate() });
    return { id: isoDate(d), label };
  });
}

export function ManualBookingModal({
  visible,
  halls,
  arenaTitle,
  arenaId,
  onClose,
  onCreated,
}: ManualBookingModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+7 ");
  const days = useMemo(() => nextDays(7, t), [t]);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [duration, setDuration] = useState<number | null>(null);
  const [availability, setAvailability] = useState<HallAvailability | null>(null);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (halls.length > 0 && !selectedHallId) {
      setSelectedHallId(halls[0].id);
    }
  }, [halls, selectedHallId, visible]);

  const selectedHall = halls.find((h) => h.id === selectedHallId) || halls[0];

  // The owner sees the same per-hall availability as clients.
  useEffect(() => {
    if (!visible || !selectedHall) return;
    let cancelled = false;
    setSlotStart(null);
    getHallAvailability(selectedHall.id, selectedDate, duration ?? undefined)
      .then((res) => {
        if (cancelled) return;
        setAvailability(res);
        if (duration === null) setDuration(res.durationMinutes);
      })
      .catch(() => !cancelled && setAvailability(null));
    return () => {
      cancelled = true;
    };
  }, [visible, selectedHall?.id, selectedDate, duration]);

  const handleHallChange = (hall: Hall) => {
    hapticSelection();
    setSelectedHallId(hall.id);
    setDuration(null);
  };

  const handleSave = async () => {
    if (!selectedHall || !slotStart || !availability) {
      Alert.alert(t("common.error"), t("manual.chooseTime"));
      return;
    }
    if (!clientName.trim()) {
      Alert.alert(t("common.error"), t("manual.nameRequired"));
      return;
    }
    if (clientPhone.replace(/\D/g, "").length < 10) {
      Alert.alert(t("common.error"), t("manual.phoneInvalid"));
      return;
    }
    setSaving(true);
    try {
      const booking = await createHallBooking({
        hallId: selectedHall.id,
        date: selectedDate,
        startTime: slotStart,
        durationMinutes: availability.durationMinutes,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        notes: notes.trim(),
      });
      hapticSuccess();
      onCreated(booking);
      onClose();
      setClientName("");
      setClientPhone("+7 ");
      setNotes("");
      setSlotStart(null);
    } catch (err) {
      Alert.alert(t("manual.error"), getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="call" size={16} color={c.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>{t("manual.title")}</Text>
                <Text style={styles.headerSub}>{t("manual.subtitle")}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                hapticSelection();
                onClose();
              }}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* 1. Выбор зала */}
            <Text style={styles.sectionLabel}>{t("manual.hall")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hallsRow}
            >
              {halls.map((h) => {
                const active = selectedHall?.id === h.id;
                return (
                  <Pressable
                    key={h.id}
                    style={[styles.hallChip, active && styles.hallChipActive]}
                    onPress={() => handleHallChange(h)}
                  >
                    <Ionicons
                      name="football-outline"
                      size={14}
                      color={active ? c.primary : c.textSecondary}
                    />
                    <Text style={[styles.hallChipText, active && styles.hallChipTextActive]}>
                      {h.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 2. Дата */}
            <Text style={styles.sectionLabel}>{t("manual.day")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {days.map((d) => {
                const active = selectedDate === d.id;
                return (
                  <Pressable
                    key={d.id}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedDate(d.id);
                    }}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 3. Длительность и слот (занятые — тусклые) */}
            {availability && availability.slotDurations.length > 1 ? (
              <View style={[styles.chipsRow, { flexWrap: "wrap", marginBottom: 8 }]}>
                {availability.slotDurations.map((m) => {
                  const active = (duration ?? availability.durationMinutes) === m;
                  return (
                    <Pressable
                      key={m}
                      style={[styles.dateChip, active && styles.dateChipActive]}
                      onPress={() => {
                        hapticSelection();
                        setDuration(m);
                      }}
                    >
                      <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                        {m % 60 === 0
                          ? t("duration.hours", { h: m / 60 })
                          : t("duration.hoursMinutes", { h: Math.floor(m / 60), m: m % 60 })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Text style={styles.sectionLabel}>{t("manual.slot")}</Text>
            {!availability ? (
              <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
            ) : availability.isClosed || availability.slots.length === 0 ? (
              <Text style={styles.closedNote}>{t("manual.closed")}</Text>
            ) : (
              <View style={styles.slotsWrap}>
                {availability.slots.map((slot) => {
                  const free = slot.status === "free";
                  const active = slotStart === slot.start;
                  return (
                    <Pressable
                      key={slot.start}
                      disabled={!free}
                      style={[styles.slotChip, !free && { opacity: 0.35 }, active && styles.slotChipActive]}
                      onPress={() => {
                        hapticSelection();
                        setSlotStart(slot.start);
                      }}
                    >
                      <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                        {slot.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* 4. Контактные данные */}
            <Text style={styles.sectionLabel}>{t("edit.client")}</Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder={t("manual.namePlaceholder")}
                  placeholderTextColor={c.textMuted}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={clientPhone}
                  onChangeText={setClientPhone}
                  placeholder="+7 (777) 000-00-00"
                  placeholderTextColor={c.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* 5. Комментарий и сумма (сумму считает сервер по цене зала) */}
            <Text style={styles.sectionLabel}>{t("manual.note")}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t("manual.notePlaceholder")}
              placeholderTextColor={c.textMuted}
            />
            {availability ? (
              <Text style={styles.priceNote}>
                {t("manual.price", { price: formatNumber(availability.price), n: availability.durationMinutes })}
              </Text>
            ) : null}
          </ScrollView>

          {/* Bottom Button */}
          <View style={styles.bottomBar}>
            <Pressable
              style={[styles.submitBtn, (saving || !slotStart) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={c.background} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color={c.background} />
                  <Text style={styles.submitBtnText}>{t("manual.submit")}</Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  closedNote: {
    fontSize: 13,
    color: c.textSecondary,
    marginBottom: 12,
  },
  priceNote: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceElevated,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  headerSub: {
    color: c.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 10,
  },
  sectionLabel: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  hallsRow: {
    gap: 8,
    paddingBottom: 4,
  },
  hallChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
  },
  hallChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: c.primary,
  },
  hallChipText: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  hallChipTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
  },
  dateChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  dateChipText: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  dateChipTextActive: {
    color: c.background,
    fontWeight: "700",
  },
  slotsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: "#202C26",
  },
  slotChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: c.primary,
  },
  slotChipText: {
    color: c.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  slotChipTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  inputGroup: {
    gap: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: c.textPrimary,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceInput: {
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    paddingHorizontal: 12,
    height: 48,
    color: c.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  notesInput: {
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    paddingHorizontal: 12,
    height: 48,
    color: c.textPrimary,
    fontSize: 13,
  },
  quickPaymentRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  quickFillBtn: {
    backgroundColor: "#1A241F",
    borderWidth: 1,
    borderColor: "#28382F",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickFillText: {
    fontSize: 11,
    fontWeight: "600",
    color: c.primary,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 14 : 20,
    borderTopWidth: 1,
    borderTopColor: c.surfaceElevated,
    backgroundColor: c.surface,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 15,
    borderRadius: 16,
  },
  submitBtnText: {
    color: c.background,
    fontSize: 16,
    fontWeight: "700",
  },
});

