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
import { useMyArenaId } from "@/lib/business";
import { getSessionUser } from "@/lib/auth";
import {
  Booking,
  getOwnArenaBookings,
  getStoredHalls,
  Hall,
  updateBookingStatus,
  rejectBookingWithReason,
  setBookingGameOutcome,
  updateBookingPayment,
  updateBookingDetails,
  isBookingFinished,
  rateBookingClient,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";
import { spacing } from "@/constants/theme";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import { ManualBookingModal } from "@/components/ManualBookingModal";
import { RejectBookingModal } from "@/components/RejectBookingModal";
import { PaymentModal } from "@/components/PaymentModal";
import { EditBookingModal } from "@/components/EditBookingModal";
import {
  notifyBookingConfirmed,
  notifyBookingRejected,
} from "@/lib/pushNotificationsService";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useT, type MessageKey } from "@/lib/i18n";
import { displayDate } from "@/lib/dataLabels";

// Internal filter ids (Russian) → display keys.
const STATUS_FILTERS = ["Все", "Подтверждено", "В ожидании", "Отменено / Отклонено"];
const STATUS_FILTER_LABEL: Record<string, MessageKey> = {
  "Все": "bookings.filterAll",
  "Подтверждено": "bookings.filterConfirmed",
  "В ожидании": "bookings.filterPending",
  "Отменено / Отклонено": "bookings.filterCancelled",
};

const OUTCOME_LABELS: Record<string, { label: MessageKey; color: string }> = {
  completed: { label: "bookings.outcomeCompleted", color: "#00C968" },
  no_show: { label: "bookings.outcomeNoShow", color: "#EF4444" },
};

export default function BusinessBookingsScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("Все");
  const [refreshing, setRefreshing] = useState(false);
  const [screenMode, setScreenMode] = useState<"calendar" | "list">("calendar");

  // Manual & Reject Modals
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);

  // Edit & Payment Modals
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Booking | null>(null);

  const user = getSessionUser();
  const { arenaId, loading: arenaLoading } = useMyArenaId();
  const arenaTitle = user?.name || t("chat.arenaFallback");

  const loadData = useCallback(async () => {
    if (arenaLoading) return;
    if (!arenaId) {
      setHalls([]);
      setBookings([]);
      setRefreshing(false);
      return;
    }
    const [myBookings, allHalls] = await Promise.all([
      getOwnArenaBookings().catch(() => [] as Booking[]),
      getStoredHalls(),
    ]);

    setHalls(allHalls.filter((h) => h.arenaId === arenaId));
    setBookings(myBookings.filter((b) => b.arenaId === arenaId));
    setRefreshing(false);
  }, [arenaId, arenaLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Business rates the client after the game; the average becomes the
  // client's rating in their profile (5.0 until the first score).
  const handleRateClient = async (booking: Booking, score: number) => {
    if (!booking.dbId) return;
    hapticSelection();
    const prev = booking.clientRating ?? null;
    setBookings((list) => list.map((b) => (b.id === booking.id ? { ...b, clientRating: score } : b)));
    try {
      await rateBookingClient(booking.dbId, score);
      hapticSuccess();
    } catch (err) {
      setBookings((list) => list.map((b) => (b.id === booking.id ? { ...b, clientRating: prev } : b)));
      Alert.alert(t("bookings.rateError"), getErrorMessage(err));
    }
  };

  const handleSavePayment = async (bookingId: string, paidAmount: number) => {
    await updateBookingPayment(bookingId, paidAmount);
    await loadData();
    Alert.alert(t("bookings.paymentUpdated"), t("bookings.paidAmount", { price: formatNumber(paidAmount) }));
  };

  const handleSaveBookingEdit = async (
    bookingId: string,
    updates: Partial<Booking>
  ) => {
    await updateBookingDetails(bookingId, updates);
    await loadData();
    Alert.alert(t("account.savedTitle"), t("bookings.updated"));
  };

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
    const target = bookings.find((b) => b.id === id);
    if (status === "confirmed" && target) {
      notifyBookingConfirmed(
        target.arenaTitle || arenaTitle,
        target.date,
        target.timeSlot
      );
    }
    await loadData();
    Alert.alert(
      status === "confirmed" ? t("bookings.confirmedTitle") : t("bookings.cancelledTitle"),
      t("bookings.statusChanged", { id })
    );
  };

  const handleCall = (phone: string) => {
    hapticSelection();
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert(t("chat.call"), t("bookings.clientPhone", { phone }));
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
    notifyBookingRejected(
      rejectTarget.arenaTitle || arenaTitle,
      reason
    );
    await rejectBookingWithReason(rejectTarget.id, reason);
    setRejectTarget(null);
    await loadData();
    Alert.alert(t("bookings.rejectedTitle"), t("bookings.reason", { reason }));
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
          <Text style={styles.headerTitle}>{t("bookings.title")}</Text>
          <Text style={styles.headerSubtitle}>
            {t("bookings.subtitle", { n: bookings.length })}
          </Text>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setManualModalOpen(true);
          }}
        >
          <Ionicons name="add" size={18} color={c.background} />
          <Text style={styles.addBtnText}>{t("bookings.add")}</Text>
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
            color={screenMode === "calendar" ? c.primary : c.textSecondary}
          />
          <Text
            style={[
              styles.modeTabText,
              screenMode === "calendar" && styles.modeTabTextActive,
            ]}
          >
            {t("bookings.calendarTab")}
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
            color={screenMode === "list" ? c.primary : c.textSecondary}
          />
          <Text
            style={[
              styles.modeTabText,
              screenMode === "list" && styles.modeTabTextActive,
            ]}
          >
            {t("bookings.listTab", { n: bookings.length })}
          </Text>
        </Pressable>
      </View>

      {/* Screen Mode Content */}
      {screenMode === "calendar" ? (
        <BookingsCalendar
          bookings={bookings}
          halls={halls}
          onSelectBooking={(b: Booking) => {
            hapticSelection();
            setEditTarget(b);
          }}
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
                      {t(STATUS_FILTER_LABEL[f])}
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
                tintColor={c.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="calendar-outline" size={48} color={c.border} />
                <Text style={styles.emptyTitle}>
                  {bookings.length === 0 ? t("bookings.emptyAll") : t("bookings.empty")}
                </Text>
                <Text style={styles.emptySub}>
                  {bookings.length === 0
                    ? t("bookings.emptyAllText")
                    : t("bookings.emptyText")}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isRejected = item.status === "rejected";
              const isConfirmed = item.status === "confirmed";
              const isPending = item.status === "pending";
              const isCancelled = item.status === "cancelled";

              const total = item.totalPrice || 0;
              const paid = item.paidAmount ?? 0;
              const remaining = Math.max(0, total - paid);
              const isPaid100 = paid >= total && total > 0;
              const isPartial = paid > 0 && !isPaid100;
              const isNotPaid = paid === 0;

              return (
                <View style={styles.bookingCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.clientName}>{item.clientName}</Text>
                      <Pressable
                        style={styles.phoneRow}
                        onPress={() => handleCall(item.clientPhone)}
                      >
                        <Ionicons name="call-outline" size={13} color={c.primary} />
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
                          ? t("status.confirmed")
                          : isPending
                          ? t("bookings.filterPending")
                          : isRejected
                          ? t("status.rejected")
                          : t("status.cancelled")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Ionicons name="basketball-outline" size={14} color="#60A5FA" />
                      <Text style={styles.hallTitle}>{item.hallTitle}</Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={14} color={c.primary} />
                      <Text style={styles.slotTime}>
                        {t("bookings.slotLine", { date: displayDate(item.date, t), time: item.timeSlot, n: item.durationMinutes })}
                      </Text>
                    </View>

                    {item.notes ? (
                      <View style={styles.notesRow}>
                        <Ionicons name="document-text-outline" size={13} color={c.textSecondary} />
                        <Text style={styles.notesRowText}>{item.notes}</Text>
                      </View>
                    ) : null}

                    {/* Payment Status Bar (Interactive) */}
                    <Pressable
                      style={[
                        styles.paymentBadgeBar,
                        isPaid100 && styles.paymentBarPaid,
                        isPartial && styles.paymentBarPartial,
                        isNotPaid && styles.paymentBarNotPaid,
                      ]}
                      onPress={() => {
                        hapticSelection();
                        setPaymentTarget(item);
                      }}
                    >
                      <Ionicons
                        name={
                          isPaid100
                            ? "checkmark-circle"
                            : isPartial
                            ? "pie-chart"
                            : "wallet-outline"
                        }
                        size={15}
                        color={isPaid100 ? c.primary : isPartial ? "#F59E0B" : c.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.paymentBarTitle,
                            isPaid100 && styles.textPaid,
                            isPartial && styles.textPartial,
                            isNotPaid && styles.textNotPaid,
                          ]}
                        >
                          {isPaid100
                            ? t("bookings.paidFull", { price: formatNumber(total) })
                            : isPartial
                            ? t("bookings.prepaid", { paid: formatNumber(paid), remaining: formatNumber(remaining) })
                            : t("bookings.notPaid", { price: formatNumber(total) })}
                        </Text>
                      </View>
                      <View style={styles.paymentEditTag}>
                        <Ionicons name="card" size={12} color={c.textSecondary} />
                        <Text style={styles.paymentEditText}>{t("bookings.payment")}</Text>
                      </View>
                    </Pressable>

                    {item.rejectionReason && (
                      <View style={styles.reasonBox}>
                        <Ionicons name="alert-circle" size={14} color={c.error} />
                        <Text style={styles.reasonText}>
                          {t("bookings.reason", { reason: item.rejectionReason })}
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
                          {t(OUTCOME_LABELS[item.gameOutcome].label)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.priceLabel}>{t("bookings.cost")}</Text>
                      <Text style={styles.priceValue}>
                        {formatNumber(item.totalPrice)} ₸
                      </Text>
                    </View>

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => {
                          hapticSelection();
                          setEditTarget(item);
                        }}
                      >
                        <Ionicons name="create-outline" size={15} color={c.primary} />
                        <Text style={styles.editBtnText}>{t("bizProfile.edit")}</Text>
                      </Pressable>

                      <Pressable
                        style={styles.callIconBtn}
                        onPress={() => handleCall(item.clientPhone)}
                      >
                        <Ionicons name="call" size={15} color={c.textPrimary} />
                      </Pressable>

                      {isPending && (
                        <Pressable
                          style={styles.confirmBtn}
                          onPress={() => handleStatusChange(item.id, "confirmed")}
                        >
                          <Ionicons name="checkmark" size={16} color={c.background} />
                          <Text style={styles.confirmBtnText}>{t("bookings.accept")}</Text>
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
                          <Ionicons name="close" size={16} color={c.error} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {item.userId && item.dbId && isBookingFinished(item) ? (
                    <View style={styles.rateRow}>
                      <Text style={styles.rateLabel}>
                        {item.clientRating ? t("bookings.clientRating") : t("bookings.rateClient")}
                      </Text>
                      <View style={styles.rateStars}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Pressable
                            key={n}
                            hitSlop={6}
                            onPress={() => handleRateClient(item, n)}
                          >
                            <Ionicons
                              name={(item.clientRating ?? 0) >= n ? "star" : "star-outline"}
                              size={22}
                              color={(item.clientRating ?? 0) >= n ? c.primary : c.textSecondary}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
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
        arenaId={arenaId ?? 0}
        onClose={() => setManualModalOpen(false)}
        onCreated={handleManualBookingCreated}
      />

      <RejectBookingModal
        visible={!!rejectTarget}
        booking={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirmed}
      />

      <PaymentModal
        visible={!!paymentTarget}
        booking={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSavePayment={handleSavePayment}
      />

      <EditBookingModal
        visible={!!editTarget}
        booking={editTarget}
        halls={halls}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveBookingEdit}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.background,
  },
  modeTabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: c.surface,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  modeTabActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: c.primary,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
  },
  modeTabTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  filterWrap: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  filterChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: c.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  filterChipTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.hairline,
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
    color: c.textPrimary,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  clientPhone: {
    fontSize: 12,
    color: c.primary,
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
    color: c.primary,
  },
  textPending: {
    color: "#EAB308",
  },
  textCancelled: {
    color: c.error,
  },
  cardBody: {
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hallTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textPrimary,
  },
  slotTime: {
    fontSize: 13,
    color: c.textSecondary,
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
    color: c.error,
    flex: 1,
  },
  outcomeBadge: {
    alignSelf: "flex-start",
    backgroundColor: c.hairline,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  outcomeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rateLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
  },
  rateStars: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
  priceLabel: {
    fontSize: 10,
    color: c.textMuted,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: "800",
    color: c.textPrimary,
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
    backgroundColor: c.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.background,
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
    color: c.textPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.hairline,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
  },
  notesRowText: {
    fontSize: 12,
    color: c.textSecondary,
    flex: 1,
  },
  paymentBadgeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
  },
  paymentBarPaid: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  paymentBarPartial: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  paymentBarNotPaid: {
    backgroundColor: c.hairline,
    borderColor: c.subtle,
  },
  paymentBarTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  paymentEditTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.subtle,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentEditText: {
    fontSize: 10,
    fontWeight: "600",
    color: c.textSecondary,
  },
  textPaid: {
    color: c.primary,
  },
  textPartial: {
    color: "#F59E0B",
  },
  textNotPaid: {
    color: c.textSecondary,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.primary,
  },
});
