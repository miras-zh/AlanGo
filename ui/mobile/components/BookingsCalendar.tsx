import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Booking, Hall } from "@/lib/sportRentData";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

const { width } = Dimensions.get("window");

export type CalendarViewMode = "day" | "week" | "month";

interface BookingsCalendarProps {
  bookings: Booking[];
  halls: Hall[];
  onSelectBooking: (booking: Booking) => void;
  onAddManualBooking: () => void;
  onStatusChange: (bookingId: string, status: "confirmed" | "cancelled") => void;
  onRejectBooking: (booking: Booking) => void;
  onOutcomeChange?: (bookingId: string, outcome: "completed" | "no_show") => void;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function BookingsCalendar({
  bookings,
  halls,
  onSelectBooking,
  onAddManualBooking,
  onStatusChange,
  onRejectBooking,
  onOutcomeChange,
}: BookingsCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("day");
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = Сегодня, 1 = Завтра ...

  const currentDateObj = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + selectedDayOffset);
    return d;
  }, [selectedDayOffset]);

  const dateLabel = useMemo(() => {
    if (selectedDayOffset === 0) return "Сегодня";
    if (selectedDayOffset === 1) return "Завтра";
    if (selectedDayOffset === -1) return "Вчера";
    return currentDateObj.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  }, [selectedDayOffset, currentDateObj]);

  // Current Week Days (7 days centered on selected or starting Monday)
  const weekDays = useMemo(() => {
    const list = [];
    const base = new Date();
    // Monday of current week
    const dayOfWeek = base.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base);
    monday.setDate(base.getDate() + distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday =
        d.getDate() === base.getDate() &&
        d.getMonth() === base.getMonth() &&
        d.getFullYear() === base.getFullYear();
      list.push({
        dayName: WEEKDAYS[i],
        dayNumber: d.getDate(),
        dateStr: d.toISOString().split("T")[0],
        isToday,
        dateObj: d,
        offset: Math.round((d.getTime() - base.getTime()) / (1000 * 3600 * 24)),
      });
    }
    return list;
  }, []);

  // Filter bookings for active day
  const activeDayBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (selectedDayOffset === 0 && (b.date === "Сегодня" || !b.date)) return true;
      if (selectedDayOffset === 1 && b.date === "Завтра") return true;
      const targetIso = currentDateObj.toISOString().split("T")[0];
      return b.date === targetIso || (selectedDayOffset === 0 && b.date === "Сегодня");
    });
  }, [bookings, selectedDayOffset, currentDateObj]);

  const timelineHours = useMemo(() => {
    return [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
    ];
  }, []);

  const getStatusColor = (status: Booking["status"]) => {
    switch (status) {
      case "confirmed":
        return "#22C55E";
      case "pending":
        return "#EAB308";
      case "rejected":
      case "cancelled":
        return "#EF4444";
      default:
        return "#8E9B94";
    }
  };

  const getStatusLabel = (status: Booking["status"]) => {
    switch (status) {
      case "confirmed":
        return "Подтверждена";
      case "pending":
        return "Ожидает ответа";
      case "rejected":
        return "Отклонена";
      case "cancelled":
        return "Отменена";
      default:
        return status;
    }
  };

  return (
    <View style={styles.calendarContainer}>
      {/* 1. Mode Switcher (День / Неделя / Месяц) */}
      <View style={styles.modeSwitchRow}>
        <View style={styles.modeTabs}>
          {(["day", "week", "month"] as CalendarViewMode[]).map((mode) => {
            const active = viewMode === mode;
            const label = mode === "day" ? "День" : mode === "week" ? "Неделя" : "Месяц";
            return (
              <Pressable
                key={mode}
                style={[styles.modeTab, active && styles.modeTabActive]}
                onPress={() => {
                  hapticSelection();
                  setViewMode(mode);
                }}
              >
                <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.quickAddBtn}
          onPress={() => {
            hapticSelection();
            onAddManualBooking();
          }}
        >
          <Ionicons name="add" size={18} color="#0B0F0D" />
          <Text style={styles.quickAddBtnText}>Записать</Text>
        </Pressable>
      </View>

      {/* 2. Date Navigation Bar */}
      <View style={styles.dateNavRow}>
        <Pressable
          style={styles.navArrow}
          onPress={() => {
            hapticSelection();
            setSelectedDayOffset((prev) => prev - (viewMode === "week" ? 7 : 1));
          }}
        >
          <Ionicons name="chevron-back" size={18} color="#C4D0C9" />
        </Pressable>

        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateTitleText}>
            {viewMode === "month"
              ? currentDateObj.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
              : `${dateLabel}, ${currentDateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`}
          </Text>
          <Text style={styles.dateSubText}>
            {activeDayBookings.length} {activeDayBookings.length === 1 ? "запись" : "записей"} на этот период
          </Text>
        </View>

        <Pressable
          style={styles.navArrow}
          onPress={() => {
            hapticSelection();
            setSelectedDayOffset((prev) => prev + (viewMode === "week" ? 7 : 1));
          }}
        >
          <Ionicons name="chevron-forward" size={18} color="#C4D0C9" />
        </Pressable>
      </View>

      {/* 3. Horizontal Week Strip */}
      <View style={styles.weekStrip}>
        {weekDays.map((w, idx) => {
          const isSelected = selectedDayOffset === w.offset;
          // Count bookings for this day
          const dayBookingsCount = bookings.filter((b) => {
            if (w.offset === 0 && (b.date === "Сегодня" || !b.date)) return true;
            return b.date === w.dateStr;
          }).length;

          return (
            <Pressable
              key={idx}
              style={[styles.weekDayItem, isSelected && styles.weekDayItemActive]}
              onPress={() => {
                hapticSelection();
                setSelectedDayOffset(w.offset);
              }}
            >
              <Text style={[styles.weekDayName, isSelected && styles.weekDayNameActive]}>
                {w.dayName}
              </Text>
              <View style={[styles.dayNumCircle, w.isToday && styles.dayNumToday, isSelected && styles.dayNumSelected]}>
                <Text style={[styles.weekDayNumber, isSelected && styles.weekDayNumberActive]}>
                  {w.dayNumber}
                </Text>
              </View>
              {dayBookingsCount > 0 && (
                <View style={styles.dotsRow}>
                  {Array.from({ length: Math.min(dayBookingsCount, 3) }).map((_, dIdx) => (
                    <View key={dIdx} style={styles.bookingDot} />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 4. MODE: DAY TIMELINE VIEW */}
      {viewMode === "day" && (
        <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
          {timelineHours.map((hour) => {
            // Check if any booking starts at or covers this hour
            const hourBookings = activeDayBookings.filter((b) => b.timeSlot.startsWith(hour));

            return (
              <View key={hour} style={styles.timelineHourRow}>
                <View style={styles.hourCol}>
                  <Text style={styles.hourText}>{hour}</Text>
                </View>

                <View style={styles.slotContentCol}>
                  <View style={styles.hourHairline} />
                  {hourBookings.length > 0 ? (
                    hourBookings.map((b) => (
                      <Pressable
                        key={b.id}
                        style={[
                          styles.bookingBlock,
                          {
                            borderLeftColor: getStatusColor(b.status),
                            backgroundColor:
                              b.status === "confirmed"
                                ? "rgba(34, 197, 94, 0.08)"
                                : b.status === "pending"
                                ? "rgba(234, 179, 8, 0.08)"
                                : "rgba(239, 68, 68, 0.08)",
                          },
                        ]}
                        onPress={() => {
                          hapticSelection();
                          onSelectBooking(b);
                        }}
                      >
                        <View style={styles.bookingBlockHeader}>
                          <View style={styles.bookingTitleRow}>
                            <Ionicons name="time" size={13} color="#22C55E" />
                            <Text style={styles.bookingSlotTime}>{b.timeSlot}</Text>
                            {b.source === "manual" && (
                              <View style={styles.sourceManualBadge}>
                                <Text style={styles.sourceManualText}>Ручная</Text>
                              </View>
                            )}
                          </View>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: `${getStatusColor(b.status)}22` },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: getStatusColor(b.status) },
                              ]}
                            >
                              {getStatusLabel(b.status)}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.bookingHallName}>{b.hallTitle}</Text>

                        <View style={styles.bookingClientRow}>
                          <Ionicons name="person-circle-outline" size={16} color="#8E9B94" />
                          <Text style={styles.bookingClientName}>{b.clientName}</Text>
                          <Text style={styles.bookingPrice}>
                            {b.totalPrice.toLocaleString("ru-RU")} ₸
                          </Text>
                        </View>

                        {/* Quick action buttons for pending bookings */}
                        {b.status === "pending" && (
                          <View style={styles.quickActionsRow}>
                            <Pressable
                              style={styles.quickConfirmBtn}
                              onPress={() => {
                                hapticSuccess();
                                onStatusChange(b.id, "confirmed");
                              }}
                            >
                              <Ionicons name="checkmark" size={14} color="#0B0F0D" />
                              <Text style={styles.quickConfirmText}>Подтвердить</Text>
                            </Pressable>

                            <Pressable
                              style={styles.quickRejectBtn}
                              onPress={() => {
                                hapticSelection();
                                onRejectBooking(b);
                              }}
                            >
                              <Ionicons name="close" size={14} color="#EF4444" />
                              <Text style={styles.quickRejectText}>Отклонить</Text>
                            </Pressable>

                            <Pressable
                              style={styles.quickCallBtn}
                              onPress={() => {
                                Linking.openURL(`tel:${b.clientPhone.replace(/[^0-9+]/g, "")}`);
                              }}
                            >
                              <Ionicons name="call" size={13} color="#22C55E" />
                            </Pressable>
                          </View>
                        )}

                        {/* Match outcome buttons for confirmed bookings */}
                        {b.status === "confirmed" && onOutcomeChange && (
                          <View style={styles.outcomeRow}>
                            <Text style={styles.outcomeLabel}>Факт игры:</Text>
                            <Pressable
                              style={[
                                styles.outcomeChip,
                                b.gameOutcome === "completed" && styles.outcomeChipActiveGreen,
                              ]}
                              onPress={() => {
                                hapticSuccess();
                                onOutcomeChange(b.id, "completed");
                              }}
                            >
                              <Text style={styles.outcomeChipText}>Матч сыгран</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.outcomeChip,
                                b.gameOutcome === "no_show" && styles.outcomeChipActiveRed,
                              ]}
                              onPress={() => {
                                hapticSelection();
                                onOutcomeChange(b.id, "no_show");
                              }}
                            >
                              <Text style={styles.outcomeChipText}>Не явились</Text>
                            </Pressable>
                          </View>
                        )}
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.freeSlotLine}>
                      <Text style={styles.freeSlotText}>Свободно</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* 5. MODE: WEEK VIEW */}
      {viewMode === "week" && (
        <ScrollView style={styles.weekViewContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.weekOverviewTitle}>Расписание на неделю</Text>
          {weekDays.map((w) => {
            const dayBookings = bookings.filter((b) => {
              if (w.offset === 0 && (b.date === "Сегодня" || !b.date)) return true;
              return b.date === w.dateStr;
            });
            const confirmedCount = dayBookings.filter((b) => b.status === "confirmed").length;
            const revenue = dayBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

            return (
              <Pressable
                key={w.dayName}
                style={styles.weekOverviewCard}
                onPress={() => {
                  hapticSelection();
                  setSelectedDayOffset(w.offset);
                  setViewMode("day");
                }}
              >
                <View style={styles.weekCardLeft}>
                  <Text style={styles.weekCardDay}>{w.dayName}</Text>
                  <Text style={styles.weekCardDate}>{w.dayNumber}</Text>
                </View>

                <View style={styles.weekCardMid}>
                  <Text style={styles.weekCardStats}>
                    {dayBookings.length > 0
                      ? `${confirmedCount} подтверждено из ${dayBookings.length}`
                      : "Нет записей"}
                  </Text>
                  {revenue > 0 && (
                    <Text style={styles.weekCardRevenue}>
                      Выручка: {revenue.toLocaleString("ru-RU")} ₸
                    </Text>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* 6. MODE: MONTH VIEW */}
      {viewMode === "month" && (
        <View style={styles.monthViewContainer}>
          <View style={styles.monthStatsCard}>
            <View style={styles.monthStatCol}>
              <Text style={styles.monthStatNum}>{bookings.length}</Text>
              <Text style={styles.monthStatLabel}>Всего броней</Text>
            </View>
            <View style={styles.monthDivider} />
            <View style={styles.monthStatCol}>
              <Text style={[styles.monthStatNum, { color: "#22C55E" }]}>
                {bookings.filter((b) => b.status === "confirmed").length}
              </Text>
              <Text style={styles.monthStatLabel}>Сыграно</Text>
            </View>
            <View style={styles.monthDivider} />
            <View style={styles.monthStatCol}>
              <Text style={[styles.monthStatNum, { color: "#EAB308" }]}>
                {bookings.filter((b) => b.status === "pending").length}
              </Text>
              <Text style={styles.monthStatLabel}>Заявки</Text>
            </View>
          </View>

          <Text style={styles.monthHelpText}>
            Выберите день в верхней панели недели или переключитесь в режим «День» для подробного таймлайна слотов.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendarContainer: {
    flex: 1,
  },
  modeSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: "#131916",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: "#22C55E",
  },
  modeTabText: {
    color: "#8E9B94",
    fontSize: 13,
    fontWeight: "600",
  },
  modeTabTextActive: {
    color: "#0B0F0D",
    fontWeight: "700",
  },
  quickAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#22C55E",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
  },
  quickAddBtnText: {
    color: "#0B0F0D",
    fontSize: 13,
    fontWeight: "700",
  },
  dateNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#161E1A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  dateLabelWrap: {
    alignItems: "center",
  },
  dateTitleText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  dateSubText: {
    color: "#8E9B94",
    fontSize: 11,
    marginTop: 2,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 6,
  },
  weekDayItem: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 42,
  },
  weekDayItemActive: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  weekDayName: {
    color: "#8E9B94",
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 4,
  },
  weekDayNameActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  dayNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumToday: {
    backgroundColor: "#1F2B24",
  },
  dayNumSelected: {
    backgroundColor: "#22C55E",
  },
  weekDayNumber: {
    color: "#D4DDD7",
    fontSize: 13,
    fontWeight: "700",
  },
  weekDayNumberActive: {
    color: "#0B0F0D",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 4,
  },
  bookingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#22C55E",
  },
  timelineScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  timelineHourRow: {
    flexDirection: "row",
    minHeight: 56,
  },
  hourCol: {
    width: 46,
    paddingTop: 0,
  },
  hourText: {
    color: "#6B7C72",
    fontSize: 12,
    fontWeight: "600",
  },
  slotContentCol: {
    flex: 1,
    paddingLeft: 8,
    position: "relative",
  },
  hourHairline: {
    position: "absolute",
    left: 8,
    right: 0,
    top: 6,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  bookingBlock: {
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#131A16",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  bookingBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  bookingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  bookingSlotTime: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  sourceManualBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sourceManualText: {
    color: "#D4DDD7",
    fontSize: 10,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  bookingHallName: {
    color: "#D4DDD7",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  bookingClientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingClientName: {
    color: "#8E9B94",
    fontSize: 12,
    flex: 1,
  },
  bookingPrice: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "700",
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  quickConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickConfirmText: {
    color: "#0B0F0D",
    fontSize: 11,
    fontWeight: "700",
  },
  quickRejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  quickRejectText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  quickCallBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  outcomeLabel: {
    color: "#8E9B94",
    fontSize: 10,
  },
  outcomeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#161E1A",
  },
  outcomeChipActiveGreen: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  outcomeChipActiveRed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  outcomeChipText: {
    color: "#C4D0C9",
    fontSize: 10,
    fontWeight: "600",
  },
  freeSlotLine: {
    paddingVertical: 6,
  },
  freeSlotText: {
    color: "#38433D",
    fontSize: 11,
  },
  weekViewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  weekOverviewTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  weekOverviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  weekCardLeft: {
    width: 44,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.08)",
    paddingRight: 10,
    marginRight: 12,
  },
  weekCardDay: {
    color: "#8E9B94",
    fontSize: 11,
    fontWeight: "600",
  },
  weekCardDate: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  weekCardMid: {
    flex: 1,
  },
  weekCardStats: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  weekCardRevenue: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  monthViewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  monthStatsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131916",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  monthStatCol: {
    flex: 1,
    alignItems: "center",
  },
  monthStatNum: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  monthStatLabel: {
    color: "#8E9B94",
    fontSize: 11,
    marginTop: 4,
  },
  monthDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  monthHelpText: {
    color: "#8E9B94",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 20,
  },
});

