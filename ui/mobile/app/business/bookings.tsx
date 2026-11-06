import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  updateBookingStatus,
  rejectBookingWithReason,
  setBookingGameOutcome,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import { ManualBookingModal } from "@/components/ManualBookingModal";
import { RejectBookingModal } from "@/components/RejectBookingModal";

const STATUS_FILTERS = ["Все", "Подтверждено", "В ожидании", "Отменено / Отклонено"];

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: "Игра состоялась ⚽️", color: "#22C55E" },
  no_show: { label: "Неявка / Срыв ❌", color: "#EF4444" },
};

export default function BusinessBookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("Все");
  const [refreshing, setRefreshing] = useState(false);
  const [screenMode, setScreenMode] = useState<"calendar" | "list">("calendar");

  // Manual & Reject Modals
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);

  const user = getSessionUser();
  const arenaId = user?.arenaId || 1;
  const arenaTitle = user?.name || "Арена";

  const loadData = useCallback(async () => {
    const [allBookings, allHalls] = await Promise.all([
      getStoredBookings(),
      getStoredHalls(),
    ]);

    const myHalls = allHalls.filter((h) => h.arenaId === arenaId);
    const myBookings = allBookings.filter((b) => b.arenaId === arenaId);

    setHalls(myHalls);
    setBookings(myBookings);
    setRefreshing(false);
  }, [arenaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBookings = bookings.filter((b) => {
    if (selectedFilter === "Все") return true;
    if (selectedFilter === "Подтверждено") return b.status === "confirmed";
    if (selectedFilter === "В ожидании") return b.status === "pending";
    if (selectedFilter === "Отменено / Отклонено") {
      return b.status === "cancelled" || b.status === "rejected";
    }
    return true;
  });

  const handleStatusChange = async (
    id: string,
    status: "confirmed" | "cancelled"
  ) => {
    hapticImpact();
    await updateBookingStatus(id, status);
    await loadData();
    Alert.alert(
      status === "confirmed" ? "Бронь подтверждена 🎉" : "Бронь отменена",
      `Статус бронирования ${id} успешно изменен.`
    );
  };

  const handleCall = (phone: string) => {
    hapticSelection();
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert("Звонок", `Номер телефона клиента: ${phone}`);
    });
  };

  const handleManualBookingCreated = (newB: Booking) => {
    hapticSuccess();
    setBookings((prev) => [newB, ...prev]);
    setManualModalOpen(false);
    loadData();
  };

  const handleRejectConfirmed = async (reason: string) => {
    if (!rejectTarget) return;
    hapticImpact();
    await rejectBookingWithReason(rejectTarget.id, reason);
    setRejectTarget(null);
    await loadData();
    Alert.alert("Бронь отклонена", `Причина: ${reason}`);
  };

  const handleOutcomeChange = async (
    bookingId: string,
    outcome: "completed" | "no_show"
  ) => {
    hapticSuccess();
    await setBookingGameOutcome(bookingId, outcome);
    await loadData();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Управление бронями</Text>
          <Text style={styles.headerSubtitle}>
            Календарь, каскады и запись ({bookings.length})
          </Text>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setManualModalOpen(true);
          }}
        >
          <Ionicons name="add" size={18} color="#0B0F0D" />
          <Text style={styles.addBtnText}>Записать</Text>
        </Pressable>
      </View>

      {/* Mode Switcher (Календарь 3-в-1 / Список) */}
      <View style={styles.modeTabsRow}>
        <Pressable
          style={[styles.modeTab, screenMode === "calendar" && styles.modeTabActive]}
          onPress={() => {
            hapticSelection();
            setScreenMode("calendar");
          }}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={screenMode === "calendar" ? "#22C55E" : "#8E9B94"}
          />
          <Text
            style={[
              styles.modeTabText,
              screenMode === "calendar" && styles.modeTabTextActive,
            ]}
          >
            Календарь (3-в-1)
          </Text>
        </Pressable>

        <Pressable
          style={[styles.modeTab, screenMode === "list" && styles.modeTabActive]}
          onPress={() => {
            hapticSelection();
            setScreenMode("list");
          }}
        >
          <Ionicons
            name="list"
            size={16}
            color={screenMode === "list" ? "#22C55E" : "#8E9B94"}
          />
          <Text
            style={[
              styles.modeTabText,
              screenMode === "list" && styles.modeTabTextActive,
            ]}
          >
            Список ({bookings.length})
          </Text>
        </Pressable>
      </View>

      {/* Screen Mode Content */}
      {screenMode === "calendar" ? (
        <BookingsCalendar
          bookings={bookings}
          halls={halls}
          onSelectBooking={(b: Booking) => {}}
          onAddManualBooking={() => setManualModalOpen(true)}
          onStatusChange={(id: string, status: "confirmed" | "cancelled") =>
            handleStatusChange(id, status)
          }
          onRejectBooking={(b: Booking) => setRejectTarget(b)}
          onOutcomeChange={handleOutcomeChange}
        />
      ) : (
        <View style={{ flex: 1 }}>
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
                  В этой категории пока нет бронирований.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isRejected = item.status === "rejected";
              const isConfirmed = item.status === "confirmed";
              const isPending = item.status === "pending";
              const isCancelled = item.status === "cancelled";

              return (
                <View style={styles.bookingCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
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
                        isConfirmed && styles.statusBadgeConfirmed,
                        isPending && styles.statusBadgePending,
                        (isCancelled || isRejected) && styles.statusBadgeCancelled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isConfirmed && styles.textConfirmed,
                          isPending && styles.textPending,
                          (isCancelled || isRejected) && styles.textCancelled,
                        ]}
                      >
                        {isConfirmed
                          ? "Подтверждено"
                          : isPending
                          ? "В ожидании"
                          : isRejected
                          ? "Отклонено"
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

                    {item.rejectionReason && (
                      <View style={styles.reasonBox}>
                        <Ionicons name="alert-circle" size={14} color="#EF4444" />
                        <Text style={styles.reasonText}>
                          Причина: {item.rejectionReason}
                        </Text>
                      </View>
                    )}

                    {item.gameOutcome && OUTCOME_LABELS[item.gameOutcome] && (
                      <View style={styles.outcomeBadge}>
                        <Text
                          style={[
                            styles.outcomeBadgeText,
                            { color: OUTCOME_LABELS[item.gameOutcome].color },
                          ]}
                        >
                          {OUTCOME_LABELS[item.gameOutcome].label}
                        </Text>
                      </View>
                    )}
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

                      {isPending && (
                        <Pressable
                          style={styles.confirmBtn}
                          onPress={() => handleStatusChange(item.id, "confirmed")}
                        >
                          <Ionicons name="checkmark" size={16} color="#0B0F0D" />
                          <Text style={styles.confirmBtnText}>Принять</Text>
                        </Pressable>
                      )}

                      {!isCancelled && !isRejected && (
                        <Pressable
                          style={styles.cancelBtn}
                          onPress={() => {
                            hapticImpact();
                            setRejectTarget(item);
                          }}
                        >
                          <Ionicons name="close" size={16} color="#EF4444" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* Modals */}
      <ManualBookingModal
        visible={manualModalOpen}
        halls={halls}
        arenaTitle={arenaTitle}
        arenaId={arenaId}
        onClose={() => setManualModalOpen(false)}
        onCreated={handleManualBookingCreated}
      />

      <RejectBookingModal
        visible={!!rejectTarget}
        booking={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirmed}
      />
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
  modeTabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#131916",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#0B0F0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modeTabActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22C55E",
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E9B94",
  },
  modeTabTextActive: {
    color: "#22C55E",
    fontWeight: "700",
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
  reasonBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  reasonText: {
    fontSize: 12,
    color: "#EF4444",
    flex: 1,
  },
  outcomeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  outcomeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
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
});
