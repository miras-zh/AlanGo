import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Booking, Hall } from "@/lib/sportRentData";
import { radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

interface EditBookingModalProps {
  visible: boolean;
  booking: Booking | null;
  halls: Hall[];
  onClose: () => void;
  onSave: (bookingId: string, updates: Partial<Booking>) => Promise<void>;
}

const COMMON_SLOTS = [
  "09:00 - 10:30",
  "10:30 - 12:00",
  "14:00 - 15:30",
  "17:00 - 18:30",
  "18:00 - 19:30",
  "19:00 - 20:00",
  "19:00 - 20:30",
  "20:00 - 21:30",
  "21:30 - 23:00",
];

const STATUS_OPTIONS: { id: Booking["status"]; label: string; color: string }[] = [
  { id: "confirmed", label: "Подтверждено", color: "#00C968" },
  { id: "pending", label: "В ожидании", color: "#F59E0B" },
  { id: "cancelled", label: "Отменено", color: "#EF4444" },
];

export function EditBookingModal({
  visible,
  booking,
  halls,
  onClose,
  onSave,
}: EditBookingModalProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedHallId, setSelectedHallId] = useState<number>(0);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [totalPriceStr, setTotalPriceStr] = useState("0");
  const [paidAmountStr, setPaidAmountStr] = useState("0");
  const [status, setStatus] = useState<Booking["status"]>("confirmed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (booking) {
      setClientName(booking.clientName || "");
      setClientPhone(booking.clientPhone || "");
      setSelectedHallId(booking.hallId);
      setDate(booking.date || "Сегодня");
      setTimeSlot(booking.timeSlot || "19:00 - 20:00");
      setTotalPriceStr(String(booking.totalPrice || 0));
      setPaidAmountStr(String(booking.paidAmount ?? 0));
      setStatus(booking.status || "confirmed");
      setNotes(booking.notes || "");
    }
  }, [booking]);

  if (!booking) return null;

  const total = Math.max(0, parseInt(totalPriceStr || "0", 10) || 0);
  const paid = Math.max(0, parseInt(paidAmountStr || "0", 10) || 0);
  const remaining = Math.max(0, total - paid);

  const handleSave = async () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      Alert.alert("Ошибка", "Укажите имя и телефон клиента");
      return;
    }

    const selectedHall = halls.find((h) => h.id === selectedHallId) || halls[0];

    hapticImpact();
    setSaving(true);
    try {
      await onSave(booking.id, {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        hallId: selectedHall?.id || booking.hallId,
        hallTitle: selectedHall?.title || booking.hallTitle,
        sportType: selectedHall?.sportType || booking.sportType,
        date: date.trim() || booking.date,
        timeSlot: timeSlot.trim() || booking.timeSlot,
        totalPrice: total,
        paidAmount: paid,
        status,
        notes: notes.trim(),
      });
      hapticSuccess();
      onClose();
    } catch {
      Alert.alert("Ошибка", "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="create-outline" size={20} color={c.primary} />
              </View>
              <View>
                <Text style={styles.title}>Редактирование брони</Text>
                <Text style={styles.subTitle}>Номер записи: #{booking.id}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={c.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* 1. Client Information */}
            <Text style={styles.sectionTitle}>Данные клиента</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Имя клиента</Text>
              <TextInput
                style={styles.input}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Имя Фамилия"
                placeholderTextColor={c.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Телефон</Text>
              <TextInput
                style={styles.input}
                value={clientPhone}
                onChangeText={setClientPhone}
                placeholder="+7 (7XX) XXX-XX-XX"
                placeholderTextColor={c.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            {/* 2. Hall Selector */}
            {halls.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Спортивный зал / Поле</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {halls.map((h) => {
                    const active = selectedHallId === h.id;
                    return (
                      <Pressable
                        key={h.id}
                        style={[styles.hallChip, active && styles.hallChipActive]}
                        onPress={() => {
                          hapticSelection();
                          setSelectedHallId(h.id);
                        }}
                      >
                        <Text style={[styles.hallChipText, active && styles.hallChipTextActive]}>
                          {h.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 3. Date & Time */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Дата</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="Сегодня"
                  placeholderTextColor={c.textMuted}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Время слота</Text>
                <TextInput
                  style={styles.input}
                  value={timeSlot}
                  onChangeText={setTimeSlot}
                  placeholder="19:00 - 20:00"
                  placeholderTextColor={c.textMuted}
                />
              </View>
            </View>

            {/* Quick time slot chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {COMMON_SLOTS.map((slot) => {
                const active = timeSlot === slot;
                return (
                  <Pressable
                    key={slot}
                    style={[styles.slotChip, active && styles.slotChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setTimeSlot(slot);
                    }}
                  >
                    <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 4. Payment & Price */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Стоимость и оплата</Text>
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Общая сумма (₸)</Text>
                <TextInput
                  style={styles.input}
                  value={totalPriceStr}
                  onChangeText={(txt) => setTotalPriceStr(txt.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Оплачено (₸)</Text>
                <TextInput
                  style={[styles.input, { color: c.primary }]}
                  value={paidAmountStr}
                  onChangeText={(txt) => setPaidAmountStr(txt.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                />
              </View>
            </View>

            {/* Live Payment Summary Box */}
            <View style={styles.paymentSummaryBox}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>К доплате (остаток):</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    remaining === 0 ? styles.remainingZero : styles.remainingDue,
                  ]}
                >
                  {remaining.toLocaleString("ru-RU")} ₸
                </Text>
              </View>
              <View style={styles.quickPaymentRow}>
                <Pressable
                  style={styles.quickFillBtn}
                  onPress={() => {
                    hapticSelection();
                    setPaidAmountStr(String(total));
                  }}
                >
                  <Text style={styles.quickFillText}>Оплачено 100%</Text>
                </Pressable>
                <Pressable
                  style={styles.quickFillBtn}
                  onPress={() => {
                    hapticSelection();
                    setPaidAmountStr("2000");
                  }}
                >
                  <Text style={styles.quickFillText}>Предоплата 2 000 ₸</Text>
                </Pressable>
                <Pressable
                  style={styles.quickFillBtn}
                  onPress={() => {
                    hapticSelection();
                    setPaidAmountStr("0");
                  }}
                >
                  <Text style={styles.quickFillText}>Сброс (0 ₸)</Text>
                </Pressable>
              </View>
            </View>

            {/* 5. Status Selector */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Статус бронирования</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.statusSelectBtn,
                      active && {
                        backgroundColor: `${opt.color}20`,
                        borderColor: opt.color,
                      },
                    ]}
                    onPress={() => {
                      hapticSelection();
                      setStatus(opt.id);
                    }}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: active ? opt.color : c.textMuted },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusSelectText,
                        active && { color: opt.color, fontWeight: "700" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 6. Notes */}
            <View style={[styles.fieldGroup, { marginTop: 14 }]}>
              <Text style={styles.label}>Заметки администратора</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Например: Kaspi предоплата 2 000 ₸, просят 2 манишки..."
                placeholderTextColor={c.textMuted}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </Text>
            </Pressable>
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
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#223128",
    maxHeight: "90%",
    paddingBottom: 24,
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: c.textPrimary,
  },
  subTitle: {
    fontSize: 12,
    color: c.textSecondary,
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
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: c.textPrimary,
    fontWeight: "600",
  },
  notesInput: {
    height: 64,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  chipsScroll: {
    marginBottom: 12,
  },
  hallChip: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  hallChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  hallChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  hallChipTextActive: {
    color: c.background,
    fontWeight: "700",
  },
  slotChip: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 6,
  },
  slotChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: c.primary,
  },
  slotChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: c.textSecondary,
  },
  slotChipTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  paymentSummaryBox: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: c.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  remainingZero: {
    color: c.primary,
  },
  remainingDue: {
    color: "#F59E0B",
  },
  quickPaymentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  quickFillBtn: {
    backgroundColor: "#222D26",
    borderWidth: 1,
    borderColor: "#2D3D32",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickFillText: {
    fontSize: 11,
    fontWeight: "600",
    color: c.primary,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusSelectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveBtn: {
    backgroundColor: c.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: c.background,
  },
});
