import { useState, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Booking, Hall, SportType } from "@/lib/sportRentData";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

interface ManualBookingModalProps {
  visible: boolean;
  halls: Hall[];
  arenaTitle: string;
  arenaId: number;
  onClose: () => void;
  onCreated: (booking: Booking) => void;
}

const COMMON_SLOTS = [
  "09:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "14:00 - 15:00",
  "17:00 - 18:00",
  "18:00 - 19:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
  "21:00 - 22:00",
  "22:00 - 23:00",
];

const DATES = ["Сегодня", "Завтра", "Послезавтра"];

export function ManualBookingModal({
  visible,
  halls,
  arenaTitle,
  arenaId,
  onClose,
  onCreated,
}: ManualBookingModalProps) {
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+7 (7");
  const [selectedDate, setSelectedDate] = useState("Сегодня");
  const [timeSlot, setTimeSlot] = useState("19:00 - 20:00");
  const [priceInput, setPriceInput] = useState("");
  const [paidInput, setPaidInput] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (halls.length > 0 && !selectedHallId) {
      setSelectedHallId(halls[0].id);
      setPriceInput(String(halls[0].pricePerHour));
    }
  }, [halls, selectedHallId, visible]);

  const selectedHall = halls.find((h) => h.id === selectedHallId) || halls[0];

  const handleHallChange = (hall: Hall) => {
    hapticSelection();
    setSelectedHallId(hall.id);
    setPriceInput(String(hall.pricePerHour));
  };

  const handleSave = () => {
    if (!clientName.trim()) {
      Alert.alert("Ошибка", "Укажите имя клиента");
      return;
    }
    if (clientPhone.trim().length < 8) {
      Alert.alert("Ошибка", "Укажите корректный номер телефона");
      return;
    }

    hapticSuccess();
    const finalPrice = parseInt(priceInput, 10) || selectedHall?.pricePerHour || 15000;
    const finalPaid = Math.max(0, parseInt(paidInput || "0", 10) || 0);
    let paymentStatus: "not_paid" | "partial" | "paid" = "not_paid";
    if (finalPaid >= finalPrice && finalPrice > 0) {
      paymentStatus = "paid";
    } else if (finalPaid > 0) {
      paymentStatus = "partial";
    }

    const newBooking: Booking = {
      id: `SR-${Date.now().toString().slice(-4)}`,
      hallId: selectedHall?.id || 101,
      hallTitle: selectedHall?.title || "Зал",
      sportType: (selectedHall?.sportType as SportType) || "Футбол",
      arenaId,
      arenaTitle,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      date: selectedDate,
      timeSlot,
      durationMinutes: 60,
      totalPrice: finalPrice,
      paidAmount: finalPaid,
      paymentStatus,
      status: "confirmed",
      source: "manual",
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onCreated(newBooking);
    onClose();

    // Reset fields
    setClientName("");
    setClientPhone("+7 (7");
    setPaidInput("0");
    setNotes("");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="call" size={16} color="#22C55E" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Быстрая запись</Text>
                <Text style={styles.headerSub}>Запись клиента по звонку / ресепшн</Text>
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
              <Ionicons name="close" size={22} color="#8E9B94" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* 1. Выбор зала */}
            <Text style={styles.sectionLabel}>Спортивный зал / корт</Text>
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
                      color={active ? "#22C55E" : "#8E9B94"}
                    />
                    <Text style={[styles.hallChipText, active && styles.hallChipTextActive]}>
                      {h.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 2. Дата */}
            <Text style={styles.sectionLabel}>День записи</Text>
            <View style={styles.chipsRow}>
              {DATES.map((d) => {
                const active = selectedDate === d;
                return (
                  <Pressable
                    key={d}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedDate(d);
                    }}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3. Время слота */}
            <Text style={styles.sectionLabel}>Слот времени</Text>
            <View style={styles.slotsWrap}>
              {COMMON_SLOTS.map((s) => {
                const active = timeSlot === s;
                return (
                  <Pressable
                    key={s}
                    style={[styles.slotChip, active && styles.slotChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setTimeSlot(s);
                    }}
                  >
                    <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 4. Контактные данные */}
            <Text style={styles.sectionLabel}>Данные клиента</Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="#6B7C72" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Имя клиента (например, Азамат)"
                  placeholderTextColor="#6B7C72"
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color="#6B7C72" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={clientPhone}
                  onChangeText={setClientPhone}
                  placeholder="+7 (777) 000-00-00"
                  placeholderTextColor="#6B7C72"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* 5. Сумма и комментарий */}
            <View style={styles.priceRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.sectionLabel}>Стоимость аренды (₸)</Text>
                <TextInput
                  style={styles.priceInput}
                  value={priceInput}
                  onChangeText={setPriceInput}
                  placeholder="15 000"
                  placeholderTextColor="#6B7C72"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1.5, marginLeft: 8 }}>
                <Text style={styles.sectionLabel}>Заметка (инвентарь / мячи)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Нужен комплект манишек"
                  placeholderTextColor="#6B7C72"
                />
              </View>
            </View>

            {/* 6. Оплата при записи (Предоплата / 100%) */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.sectionLabel}>Оплата при бронировании (₸)</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={[styles.priceInput, { color: "#22C55E", flex: 1 }]}
                  value={paidInput}
                  onChangeText={(txt) => setPaidInput(txt.replace(/[^\d]/g, ""))}
                  placeholder="0"
                  placeholderTextColor="#6B7C72"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.quickPaymentRow}>
                <Pressable
                  style={styles.quickFillBtn}
                  onPress={() => {
                    hapticSelection();
                    setPaidInput(priceInput || "15000");
                  }}
                >
                  <Text style={styles.quickFillText}>Оплачено 100%</Text>
                </Pressable>
                <Pressable
                  style={styles.quickFillBtn}
                  onPress={() => {
                    hapticSelection();
                    setPaidInput("2000");
                  }}
                >
                  <Text style={styles.quickFillText}>Предоплата 2 000 ₸</Text>
                </Pressable>
                <Pressable
                  style={styles.quickFillBtn}
                  onPress={() => {
                    hapticSelection();
                    setPaidInput("0");
                  }}
                >
                  <Text style={styles.quickFillText}>Не оплачено (0 ₸)</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Button */}
          <View style={styles.bottomBar}>
            <Pressable style={styles.submitBtn} onPress={handleSave}>
              <Ionicons name="checkmark-done" size={20} color="#0B0F0D" />
              <Text style={styles.submitBtnText}>Зафиксировать бронь</Text>
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
    borderBottomColor: "#1C2621",
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
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSub: {
    color: "#8E9B94",
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A231F",
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
    color: "#B2BFB8",
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
    backgroundColor: "#17211C",
    borderWidth: 1,
    borderColor: "#223129",
  },
  hallChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22C55E",
  },
  hallChipText: {
    color: "#C2CEC7",
    fontSize: 13,
    fontWeight: "500",
  },
  hallChipTextActive: {
    color: "#22C55E",
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
    backgroundColor: "#17211C",
    borderWidth: 1,
    borderColor: "#223129",
  },
  dateChipActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  dateChipText: {
    color: "#C2CEC7",
    fontSize: 13,
    fontWeight: "600",
  },
  dateChipTextActive: {
    color: "#0B0F0D",
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
    backgroundColor: "#161E1A",
    borderWidth: 1,
    borderColor: "#202C26",
  },
  slotChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22C55E",
  },
  slotChipText: {
    color: "#D4DDD7",
    fontSize: 12,
    fontWeight: "500",
  },
  slotChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  inputGroup: {
    gap: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161E1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222D27",
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceInput: {
    backgroundColor: "#161E1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222D27",
    paddingHorizontal: 12,
    height: 48,
    color: "#22C55E",
    fontSize: 16,
    fontWeight: "700",
  },
  notesInput: {
    backgroundColor: "#161E1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222D27",
    paddingHorizontal: 12,
    height: 48,
    color: "#FFFFFF",
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
    color: "#22C55E",
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 14 : 20,
    borderTopWidth: 1,
    borderTopColor: "#1C2621",
    backgroundColor: "#111714",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22C55E",
    paddingVertical: 15,
    borderRadius: 16,
  },
  submitBtnText: {
    color: "#0B0F0D",
    fontSize: 16,
    fontWeight: "700",
  },
});

