import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser } from "@/lib/auth";
import {
  Booking,
  getStoredBookings,
  getStoredHalls,
  Hall,
  saveNewBooking,
  updateBookingStatus,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

const STATUS_FILTERS = ["Все", "Подтверждено", "В ожидании", "Отменено"];

export default function BusinessBookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("Все");
  const [refreshing, setRefreshing] = useState(false);

  // Manual Booking Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+7 (7");
  const [date, setDate] = useState("Сегодня");
  const [timeSlot, setTimeSlot] = useState("19:00 - 20:00");
  const [customPrice, setCustomPrice] = useState("");

  const loadData = useCallback(async () => {
    const user = getSessionUser();
    const arenaId = user?.arenaId || 1;

    const [allBookings, allHalls] = await Promise.all([
      getStoredBookings(),
      getStoredHalls(),
    ]);

    const myHalls = allHalls.filter((h) => h.arenaId === arenaId);
    const myBookings = allBookings.filter((b) => b.arenaId === arenaId);

    setHalls(myHalls);
    setBookings(myBookings);
    if (myHalls.length > 0 && !selectedHallId) {
      setSelectedHallId(myHalls[0].id);
      setCustomPrice(String(myHalls[0].pricePerHour));
    }
    setRefreshing(false);
  }, [selectedHallId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBookings = bookings.filter((b) => {
    if (selectedFilter === "Все") return true;
    if (selectedFilter === "Подтверждено") return b.status === "confirmed";
    if (selectedFilter === "В ожидании") return b.status === "pending";
    if (selectedFilter === "Отменено") return b.status === "cancelled";
    return true;
  });

  const handleStatusChange = async (
    id: string,
    status: "confirmed" | "cancelled"
  ) => {
    hapticImpact();
    await updateBookingStatus(id, status);
    loadData();
    Alert.alert(
      status === "confirmed" ? "Бронь подтверждена" : "Бронь отменена",
      `Статус бронирования ${id} успешно изменен.`
    );
  };

  const handleCall = (phone: string) => {
    hapticSelection();
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert("Звонок", `Номер телефона клиента: ${phone}`);
    });
  };

  const handleCreateManualBooking = async () => {
    if (!clientName.trim()) {
      Alert.alert("Ошибка", "Введите имя клиента");
      return;
    }
    const chosenHall = halls.find((h) => h.id === selectedHallId) || halls[0];
    if (!chosenHall) {
      Alert.alert("Ошибка", "Выберите зал для бронирования");
      return;
    }

    try {
      await saveNewBooking({
        hallId: chosenHall.id,
        hallTitle: chosenHall.title,
        sportType: chosenHall.sportType,
        arenaId: chosenHall.arenaId,
        arenaTitle: chosenHall.arenaTitle,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || "+7 (777) 000-00-00",
        date: date.trim() || "Сегодня",
        timeSlot: timeSlot.trim() || "19:00 - 20:00",
        durationMinutes: 60,
        totalPrice: parseInt(customPrice) || chosenHall.pricePerHour,
        status: "confirmed",
      });

      hapticSuccess();
      setModalVisible(false);
      setClientName("");
      loadData();
      Alert.alert("Успешно", "Бронь добавлена в расписание!");
    } catch {
      Alert.alert("Ошибка", "Не удалось создать бронь");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Журнал броней</Text>
          <Text style={styles.headerSubtitle}>
            Входящие брони и ручная запись клиентов ({bookings.length})
          </Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={18} color="#0B0F0D" />
          <Text style={styles.addBtnText}>Записать</Text>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {STATUS_FILTERS.map((f) => {
            const active = selectedFilter === f;
            return (
              <Pressable
                key={f}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  hapticSelection();
                  setSelectedFilter(f);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor="#22C55E"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={48} color="#2A352E" />
            <Text style={styles.emptyTitle}>Нет броней</Text>
            <Text style={styles.emptySub}>
              В этой категории пока нет активных бронирований.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.bookingCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.clientName}>{item.clientName}</Text>
                <Pressable
                  style={styles.phoneRow}
                  onPress={() => handleCall(item.clientPhone)}
                >
                  <Ionicons name="call-outline" size={13} color="#22C55E" />
                  <Text style={styles.clientPhone}>{item.clientPhone}</Text>
                </Pressable>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  item.status === "confirmed" && styles.statusBadgeConfirmed,
                  item.status === "pending" && styles.statusBadgePending,
                  item.status === "cancelled" && styles.statusBadgeCancelled,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    item.status === "confirmed" && styles.textConfirmed,
                    item.status === "pending" && styles.textPending,
                    item.status === "cancelled" && styles.textCancelled,
                  ]}
                >
                  {item.status === "confirmed"
                    ? "Подтверждено"
                    : item.status === "pending"
                    ? "В ожидании"
                    : "Отменено"}
                </Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <Ionicons name="basketball-outline" size={14} color="#60A5FA" />
                <Text style={styles.hallTitle}>{item.hallTitle}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color="#22C55E" />
                <Text style={styles.slotTime}>
                  {item.date}, {item.timeSlot} ({item.durationMinutes} мин)
                </Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.priceLabel}>Стоимость</Text>
                <Text style={styles.priceValue}>
                  {item.totalPrice.toLocaleString("ru-RU")} ₸
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.callIconBtn}
                  onPress={() => handleCall(item.clientPhone)}
                >
                  <Ionicons name="call" size={16} color="#FFFFFF" />
                </Pressable>

                {item.status === "pending" && (
                  <Pressable
                    style={styles.confirmBtn}
                    onPress={() => handleStatusChange(item.id, "confirmed")}
                  >
                    <Ionicons name="checkmark" size={16} color="#0B0F0D" />
                    <Text style={styles.confirmBtnText}>Принять</Text>
                  </Pressable>
                )}

                {item.status !== "cancelled" && (
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => handleStatusChange(item.id, "cancelled")}
                  >
                    <Ionicons name="close" size={16} color="#EF4444" />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      />

      {/* Manual Booking Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новая бронь (ручная)</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Hall Selector */}
              <Text style={styles.inputLabel}>Выберите зал</Text>
              <View style={styles.hallsSelectGrid}>
                {halls.map((h) => {
                  const sel = selectedHallId === h.id;
                  return (
                    <Pressable
                      key={h.id}
                      style={[
                        styles.hallOption,
                        sel && styles.hallOptionActive,
                      ]}
                      onPress={() => {
                        hapticSelection();
                        setSelectedHallId(h.id);
                        setCustomPrice(String(h.pricePerHour));
                      }}
                    >
                      <Text
                        style={[
                          styles.hallOptionTitle,
                          sel && styles.hallOptionTitleActive,
                        ]}
                      >
                        {h.title}
                      </Text>
                      <Text style={styles.hallOptionSub}>
                        {h.sportType} • {h.pricePerHour.toLocaleString("ru-RU")} ₸
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Имя клиента</Text>
              <TextInput
                style={styles.input}
                placeholder="Например: Арман Сериков"
                placeholderTextColor="#6B7C72"
                value={clientName}
                onChangeText={setClientName}
              />

              <Text style={styles.inputLabel}>Телефон клиента</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="+7 (701) 123-45-67"
                placeholderTextColor="#6B7C72"
                value={clientPhone}
                onChangeText={setClientPhone}
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Дата</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Сегодня / 2026-11-05"
                    placeholderTextColor="#6B7C72"
                    value={date}
                    onChangeText={setDate}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Время слота</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="19:00 - 20:00"
                    placeholderTextColor="#6B7C72"
                    value={timeSlot}
                    onChangeText={setTimeSlot}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Сумма бронирования (₸)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="15000"
                placeholderTextColor="#6B7C72"
                value={customPrice}
                onChangeText={setCustomPrice}
              />

              <Pressable
                style={styles.submitBtn}
                onPress={handleCreateManualBooking}
              >
                <Text style={styles.submitBtnText}>Создать бронь</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  filterWrap: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#131916",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  filterChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#22C55E",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E9B94",
  },
  filterChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  clientPhone: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeConfirmed: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  statusBadgePending: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  statusBadgeCancelled: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  textConfirmed: {
    color: "#22C55E",
  },
  textPending: {
    color: "#EAB308",
  },
  textCancelled: {
    color: "#EF4444",
  },
  cardBody: {
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hallTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  slotTime: {
    fontSize: 13,
    color: "#8E9B94",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  priceLabel: {
    fontSize: 10,
    color: "#6B7C72",
  },
  priceValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  callIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  cancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: "#6B7C72",
    marginTop: 4,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#131916",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalScroll: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E9B94",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0B0F0D",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: "row",
  },
  hallsSelectGrid: {
    gap: 8,
    marginBottom: 14,
  },
  hallOption: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#0B0F0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  hallOptionActive: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  hallOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8E9B94",
  },
  hallOptionTitleActive: {
    color: "#22C55E",
  },
  hallOptionSub: {
    fontSize: 11,
    color: "#6B7C72",
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B0F0D",
  },
});
