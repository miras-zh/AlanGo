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

interface ManualBookingModalProps {
  visible: boolean;
  halls: Hall[];
  arenaTitle: string;
  arenaId: number;
  onClose: () => void;
  onCreated: (booking: Booking) => void;
}

const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function nextDays(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()}`;
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
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+7 ");
  const [days] = useState(() => nextDays(7));
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
      Alert.alert("Ошибка", "Выберите свободное время");
      return;
    }
    if (!clientName.trim()) {
      Alert.alert("Ошибка", "Укажите имя клиента");
      return;
    }
    if (clientPhone.replace(/\D/g, "").length < 10) {
      Alert.alert("Ошибка", "Укажите корректный номер телефона");
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
      Alert.alert("Не удалось записать", getErrorMessage(err));
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
              <View style={[styles.chipsRow, { marginBottom: 8 }]}>
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
                        {m} мин
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Text style={styles.sectionLabel}>Слот времени</Text>
            {!availability ? (
              <ActivityIndicator color="#22C55E" style={{ marginVertical: 12 }} />
            ) : availability.isClosed || availability.slots.length === 0 ? (
              <Text style={styles.closedNote}>Зал не работает в этот день</Text>
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

            {/* 5. Комментарий и сумма (сумму считает сервер по цене зала) */}
            <Text style={styles.sectionLabel}>Заметка (инвентарь / мячи)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Например, нужен комплект манишек"
              placeholderTextColor="#6B7C72"
            />
            {availability ? (
              <Text style={styles.priceNote}>
                Стоимость: {availability.price.toLocaleString("ru-RU")} ₸ ({availability.durationMinutes} мин по тарифу зала)
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
                <ActivityIndicator color="#0B0F0D" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#0B0F0D" />
                  <Text style={styles.submitBtnText}>Зафиксировать бронь</Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closedNote: {
    fontSize: 13,
    color: "#8E9B94",
    marginBottom: 12,
  },
  priceNote: {
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 10,
  },
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

