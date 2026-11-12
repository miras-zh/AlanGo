import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Booking } from "@/lib/sportRentData";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

interface PaymentModalProps {
  visible: boolean;
  booking: Booking | null;
  onClose: () => void;
  onSavePayment: (bookingId: string, paidAmount: number) => Promise<void>;
}

export function PaymentModal({
  visible,
  booking,
  onClose,
  onSavePayment,
}: PaymentModalProps) {
  const [amountStr, setAmountStr] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (booking) {
      setAmountStr(String(booking.paidAmount ?? 0));
    }
  }, [booking]);

  if (!booking) return null;

  const total = booking.totalPrice || 0;
  const currentPaid = Math.max(0, parseInt(amountStr || "0", 10) || 0);
  const remaining = Math.max(0, total - currentPaid);

  const handleQuickPreset = (amount: number) => {
    hapticSelection();
    setAmountStr(String(Math.min(amount, total)));
  };

  const handleSave = async () => {
    hapticImpact();
    setSaving(true);
    try {
      await onSavePayment(booking.id, currentPaid);
      hapticSuccess();
      onClose();
    } catch {
      Alert.alert("Ошибка", "Не удалось обновить оплату");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="card" size={20} color="#22C55E" />
              </View>
              <View>
                <Text style={styles.title}>Учет оплаты брони</Text>
                <Text style={styles.subTitle}>
                  Запись #{booking.id} • {booking.clientName}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8E9B94" />
            </Pressable>
          </View>

          {/* Price Overview Banner */}
          <View style={styles.overviewBox}>
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabel}>Общая сумма</Text>
              <Text style={styles.overviewTotal}>{total.toLocaleString("ru-RU")} ₸</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabel}>Внесено</Text>
              <Text style={styles.overviewPaid}>
                {currentPaid.toLocaleString("ru-RU")} ₸
              </Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabel}>Остаток</Text>
              <Text
                style={[
                  styles.overviewRemaining,
                  remaining === 0 ? styles.remainingZero : styles.remainingDue,
                ]}
              >
                {remaining.toLocaleString("ru-RU")} ₸
              </Text>
            </View>
          </View>

          {/* Quick Preset Buttons */}
          <Text style={styles.sectionLabel}>Быстрый выбор суммы:</Text>
          <View style={styles.presetsGrid}>
            <Pressable
              style={[
                styles.presetBtn,
                currentPaid === total && styles.presetBtnActive,
              ]}
              onPress={() => handleQuickPreset(total)}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={currentPaid === total ? "#0B0F0D" : "#22C55E"}
              />
              <Text
                style={[
                  styles.presetBtnText,
                  currentPaid === total && styles.presetBtnTextActive,
                ]}
              >
                100% (Вся сумма)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.presetBtn,
                currentPaid === Math.round(total / 2) && styles.presetBtnActive,
              ]}
              onPress={() => handleQuickPreset(Math.round(total / 2))}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  currentPaid === Math.round(total / 2) && styles.presetBtnTextActive,
                ]}
              >
                50% ({Math.round(total / 2).toLocaleString("ru-RU")} ₸)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.presetBtn,
                currentPaid === 2000 && styles.presetBtnActive,
              ]}
              onPress={() => handleQuickPreset(2000)}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  currentPaid === 2000 && styles.presetBtnTextActive,
                ]}
              >
                Предоплата 2 000 ₸
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.presetBtn,
                currentPaid === 0 && styles.presetBtnActive,
              ]}
              onPress={() => handleQuickPreset(0)}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  currentPaid === 0 && styles.presetBtnTextActive,
                ]}
              >
                Сброс (0 ₸)
              </Text>
            </Pressable>
          </View>

          {/* Manual Input */}
          <Text style={styles.sectionLabel}>Сумма фактически оплачена (₸):</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={amountStr}
              onChangeText={(txt) => setAmountStr(txt.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#6B7C72"
            />
            <Text style={styles.currencyTag}>₸</Text>
          </View>

          {/* Status preview tag */}
          <View style={styles.statusPreviewRow}>
            <Text style={styles.statusPreviewLabel}>Итоговый статус:</Text>
            {remaining === 0 && total > 0 ? (
              <View style={[styles.statusBadge, styles.statusBadgePaid]}>
                <Ionicons name="checkmark-done" size={14} color="#22C55E" />
                <Text style={styles.statusBadgeTextPaid}>Оплачено 100%</Text>
              </View>
            ) : currentPaid > 0 ? (
              <View style={[styles.statusBadge, styles.statusBadgePartial]}>
                <Ionicons name="pie-chart" size={14} color="#F59E0B" />
                <Text style={styles.statusBadgeTextPartial}>
                  Предоплата ({currentPaid.toLocaleString("ru-RU")} ₸)
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, styles.statusBadgeNotPaid]}>
                <Ionicons name="time-outline" size={14} color="#EF4444" />
                <Text style={styles.statusBadgeTextNotPaid}>Не оплачено</Text>
              </View>
            )}
          </View>

          {/* Save Button */}
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            disabled={saving}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Сохранение..." : "Сохранить оплату"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#141A17",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#223128",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
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
    color: "#FFFFFF",
  },
  subTitle: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1C2420",
    alignItems: "center",
    justifyContent: "center",
  },
  overviewBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#1A221E",
    borderWidth: 1,
    borderColor: "#25332A",
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  overviewCol: {
    alignItems: "center",
  },
  overviewLabel: {
    fontSize: 11,
    color: "#8E9B94",
    marginBottom: 4,
  },
  overviewTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  overviewPaid: {
    fontSize: 15,
    fontWeight: "700",
    color: "#22C55E",
  },
  overviewRemaining: {
    fontSize: 15,
    fontWeight: "700",
  },
  remainingZero: {
    color: "#22C55E",
  },
  remainingDue: {
    color: "#F59E0B",
  },
  overviewDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#2B3A30",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9EABA3",
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1B2420",
    borderWidth: 1,
    borderColor: "#28372D",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  presetBtnActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D1D5DB",
  },
  presetBtnTextActive: {
    color: "#0B0F0D",
    fontWeight: "700",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A221E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#25332A",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  currencyTag: {
    fontSize: 16,
    fontWeight: "700",
    color: "#22C55E",
  },
  statusPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  statusPreviewLabel: {
    fontSize: 13,
    color: "#8E9B94",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusBadgePaid: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  statusBadgeTextPaid: {
    fontSize: 12,
    fontWeight: "700",
    color: "#22C55E",
  },
  statusBadgePartial: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusBadgeTextPartial: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F59E0B",
  },
  statusBadgeNotPaid: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  statusBadgeTextNotPaid: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444",
  },
  saveBtn: {
    backgroundColor: "#22C55E",
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
    color: "#0B0F0D",
  },
});
