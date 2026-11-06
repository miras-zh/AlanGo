import { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Booking } from "@/lib/sportRentData";
import { hapticSelection, hapticImpact } from "@/lib/haptics";

interface RejectBookingModalProps {
  visible: boolean;
  booking: Booking | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const REASONS = [
  "Техническое обслуживание зала / ремонт",
  "Слот занят постоянной командой / лигой",
  "Не удалось подтвердить по телефону",
  "Аварийное отключение электричества / воды",
  "Другая причина",
];

export function RejectBookingModal({
  visible,
  booking,
  onClose,
  onConfirm,
}: RejectBookingModalProps) {
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [customComment, setCustomComment] = useState("");

  const handleConfirm = () => {
    hapticImpact();
    const finalReason =
      selectedReason === "Другая причина" && customComment.trim()
        ? customComment.trim()
        : selectedReason;
    onConfirm(finalReason);
    onClose();
  };

  if (!booking) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="close-circle" size={22} color="#EF4444" />
              <Text style={styles.headerTitle}>Отклонить заявку</Text>
            </View>
            <Pressable
              onPress={() => {
                hapticSelection();
                onClose();
              }}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color="#8E9B94" />
            </Pressable>
          </View>

          <View style={styles.body}>
            {/* Booking summary box */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryHall}>{booking.hallTitle}</Text>
              <Text style={styles.summaryDetails}>
                {booking.clientName} · {booking.date}, {booking.timeSlot}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Укажите причину отклонения:</Text>
            <View style={styles.reasonsList}>
              {REASONS.map((r) => {
                const active = selectedReason === r;
                return (
                  <Pressable
                    key={r}
                    style={[styles.reasonRow, active && styles.reasonRowActive]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedReason(r);
                    }}
                  >
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={active ? "#EF4444" : "#6B7C72"}
                    />
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedReason === "Другая причина" && (
              <TextInput
                style={styles.customInput}
                value={customComment}
                onChangeText={setCustomComment}
                placeholder="Напишите причину для клиента..."
                placeholderTextColor="#6B7C72"
                multiline
              />
            )}
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.rejectBtn} onPress={handleConfirm}>
              <Ionicons name="close" size={18} color="#FFFFFF" />
              <Text style={styles.rejectBtnText}>Отклонить бронь</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#111714",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2621",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A231F",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: "#161E1A",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222D27",
  },
  summaryHall: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryDetails: {
    color: "#8E9B94",
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    color: "#B2BFB8",
    fontSize: 13,
    fontWeight: "600",
  },
  reasonsList: {
    gap: 8,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#141A17",
    borderWidth: 1,
    borderColor: "#1E2722",
  },
  reasonRowActive: {
    borderColor: "rgba(239, 68, 68, 0.4)",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
  },
  reasonText: {
    color: "#C4D0C9",
    fontSize: 13,
  },
  reasonTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  customInput: {
    backgroundColor: "#161E1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222D27",
    padding: 12,
    color: "#FFFFFF",
    fontSize: 13,
    minHeight: 60,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 14 : 20,
    borderTopWidth: 1,
    borderTopColor: "#1C2621",
  },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 14,
  },
  rejectBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

