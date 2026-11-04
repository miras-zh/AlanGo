import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getStoredHalls,
  getStoredSchedule,
  Hall,
  INITIAL_HALLS,
  saveNewBooking,
  ScheduleDay,
} from "@/lib/sportRentData";
import { getSessionUser } from "@/lib/auth";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

const { width } = Dimensions.get("window");

const DAYS = [
  { id: "Сегодня", label: "Сегодня", dayOfWeek: new Date().getDay() },
  { id: "Завтра", label: "Завтра", dayOfWeek: (new Date().getDay() + 1) % 7 },
  { id: "Пт, 7 ноя", label: "Пт, 7 ноя", dayOfWeek: 5 },
  { id: "Сб, 8 ноя", label: "Сб, 8 ноя", dayOfWeek: 6 },
  { id: "Вс, 9 ноя", label: "Вс, 9 ноя", dayOfWeek: 0 },
];

export default function HallDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [hall, setHall] = useState<Hall | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [selectedDate, setSelectedDate] = useState("Сегодня");
  const [selectedSlot, setSelectedSlot] = useState("19:00 - 20:00");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    (async () => {
      const halls = await getStoredHalls();
      const match = halls.find((h) => String(h.id) === String(id)) || INITIAL_HALLS[0];
      setHall(match);
      const sched = await getStoredSchedule(match.arenaId);
      setSchedule(sched);
    })();
  }, [id]);

  if (!hall) return null;

  // Generate slots for selected day based on schedule
  const currentDayObj = DAYS.find((d) => d.id === selectedDate) || DAYS[0];
  const schedDay = schedule.find((s) => s.dayOfWeek === currentDayObj.dayOfWeek);

  const isClosedDay = schedDay?.isClosed || false;
  const startHour = schedDay ? parseInt(schedDay.startTime.split(":")[0]) : 8;
  const endHour = schedDay ? parseInt(schedDay.endTime.split(":")[0]) : 23;

  const generatedSlots: string[] = [];
  if (!isClosedDay) {
    for (let h = Math.max(9, startHour); h < Math.min(23, endHour); h++) {
      const from = `${String(h).padStart(2, "0")}:00`;
      const to = `${String(h + 1).padStart(2, "0")}:00`;
      generatedSlots.push(`${from} - ${to}`);
    }
  }

  const handleBook = async () => {
    hapticSelection();
    const user = getSessionUser();
    setBookingLoading(true);
    try {
      await saveNewBooking({
        hallId: hall.id,
        hallTitle: hall.title,
        sportType: hall.sportType,
        arenaId: hall.arenaId,
        arenaTitle: hall.arenaTitle,
        clientName: user?.name || "Гость",
        clientPhone: user?.phone || "+7 (777) 123-45-67",
        date: selectedDate,
        timeSlot: selectedSlot,
        durationMinutes: 60,
        totalPrice: hall.pricePerHour,
        status: "confirmed",
      });
      hapticSuccess();
      Alert.alert(
        "Бронирование подтверждено! 🎉",
        `Вы успешно забронировали "${hall.title}" в ${hall.arenaTitle}\n\nДата: ${selectedDate}\nВремя: ${selectedSlot}\nСумма: ${hall.pricePerHour.toLocaleString("ru-RU")} ₸\n\nАдминистратор ждет вас за 10 минут до начала.`,
        [
          {
            text: "Мои брони",
            onPress: () => router.push("/(tabs)/notifications"),
          },
          { text: "ОК", style: "cancel" },
        ],
      );
    } catch {
      Alert.alert("Ошибка", "Не удалось сохранить бронь");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]} edges={["top"]}>
      {/* Top Floating Bar */}
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.roundBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topNavTitle} numberOfLines={1}>
          {hall.title}
        </Text>
        <Pressable onPress={() => setIsFav(!isFav)} style={styles.roundBtn}>
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={20}
            color={isFav ? "#EF4444" : "#FFFFFF"}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Main Image */}
        <View style={styles.imageWrap}>
          <Image source={{ uri: hall.imageUrl }} style={styles.heroImage} />
          <View style={styles.badgeRow}>
            <View style={styles.sportBadge}>
              <Text style={styles.sportBadgeText}>{hall.sportType}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color="#22C55E" />
              <Text style={styles.ratingText}>
                {hall.rating} ({hall.reviewsCount})
              </Text>
            </View>
          </View>
        </View>

        {/* Hall Title & Price */}
        <View style={styles.titleSection}>
          <Text style={styles.hallTitle}>{hall.title}</Text>
          <View style={styles.arenaLinkRow}>
            <Ionicons name="location-sharp" size={16} color="#22C55E" />
            <Text style={styles.addressText}>{hall.arenaAddress}</Text>
          </View>
        </View>

        {/* Arena Card (clickable to view arena profile) */}
        <Pressable
          style={styles.arenaCard}
          onPress={() => {
            hapticSelection();
            router.push(`/arena/${hall.arenaId}`);
          }}
        >
          <View style={styles.arenaIconWrap}>
            <Ionicons name="business" size={22} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.arenaCardTitle}>{hall.arenaTitle}</Text>
            <Text style={styles.arenaCardSub}>Перейти на страницу спорткомплекса →</Text>
          </View>
        </Pressable>

        {/* Surface & Capacity specs */}
        <View style={styles.specsRow}>
          <View style={styles.specBox}>
            <Ionicons name="layers-outline" size={20} color="#22C55E" />
            <Text style={styles.specLabel}>Покрытие</Text>
            <Text style={styles.specValue}>{hall.surfaceType}</Text>
          </View>

          <View style={styles.specBox}>
            <Ionicons name="people-outline" size={20} color="#3B82F6" />
            <Text style={styles.specLabel}>Вместимость</Text>
            <Text style={styles.specValue}>{hall.capacity}</Text>
          </View>
        </View>

        {/* Equipment & Features */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Оснащение зала</Text>
          <View style={styles.equipmentGrid}>
            {hall.equipment.map((item, idx) => (
              <View key={idx} style={styles.equipItem}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={styles.equipText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Описание</Text>
          <Text style={styles.descText}>{hall.description}</Text>
        </View>

        {/* Schedule & Slot Selection */}
        <View style={styles.card}>
          <View style={styles.schedHeaderRow}>
            <Text style={styles.sectionHeader}>Выберите дату и время</Text>
            <Text style={styles.schedHours}>
              {schedDay ? `${schedDay.startTime} - ${schedDay.endTime}` : "08:00 - 23:00"}
            </Text>
          </View>

          {/* Days picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
            {DAYS.map((d) => {
              const active = selectedDate === d.id;
              return (
                <Pressable
                  key={d.id}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedDate(d.id);
                  }}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Slots grid */}
          {isClosedDay ? (
            <View style={styles.closedWrap}>
              <Ionicons name="time-outline" size={24} color="#EF4444" />
              <Text style={styles.closedText}>Зал закрыт в этот день по расписанию арены</Text>
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {generatedSlots.map((slot) => {
                const active = selectedSlot === slot;
                return (
                  <Pressable
                    key={slot}
                    style={[styles.slotChip, active && styles.slotChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedSlot(slot);
                    }}
                  >
                    <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Booking Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomPriceLabel}>Стоимость аренды:</Text>
          <Text style={styles.bottomPriceValue}>
            {hall.pricePerHour.toLocaleString("ru-RU")} ₸ <Text style={styles.bottomPriceSub}>/ час</Text>
          </Text>
        </View>

        <Pressable
          style={[styles.bookBtn, isClosedDay && { opacity: 0.5 }]}
          disabled={isClosedDay || bookingLoading}
          onPress={handleBook}
        >
          <Text style={styles.bookBtnText}>
            {bookingLoading ? "Бронируем..." : "Забронировать"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0B0F0D",
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#161D19",
    alignItems: "center",
    justifyContent: "center",
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  scroll: {
    paddingBottom: 110,
  },
  imageWrap: {
    width: "100%",
    height: 220,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  badgeRow: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sportBadge: {
    backgroundColor: "rgba(11, 15, 13, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  sportBadgeText: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "700",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(11, 15, 13, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  hallTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  arenaLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  addressText: {
    fontSize: 13,
    color: "#8E9B94",
  },
  arenaCard: {
    marginHorizontal: 16,
    backgroundColor: "#141A17",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  arenaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#172A1E",
    alignItems: "center",
    justifyContent: "center",
  },
  arenaCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  arenaCardSub: {
    fontSize: 12,
    color: "#22C55E",
    marginTop: 2,
  },
  specsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 14,
  },
  specBox: {
    flex: 1,
    backgroundColor: "#141A17",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 14,
  },
  specLabel: {
    fontSize: 11,
    color: "#8E9B94",
    marginTop: 6,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: "#141A17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  equipmentGrid: {
    gap: 8,
  },
  equipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  equipText: {
    fontSize: 13,
    color: "#D1D5DB",
  },
  descText: {
    fontSize: 13,
    color: "#8E9B94",
    lineHeight: 19,
  },
  schedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  schedHours: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
  },
  daysScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  dayChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#1A231E",
    borderWidth: 1,
    borderColor: "#243329",
  },
  dayChipActive: {
    backgroundColor: "#162E20",
    borderColor: "#22C55E",
  },
  dayChipText: {
    fontSize: 13,
    color: "#8E9B94",
    fontWeight: "600",
  },
  dayChipTextActive: {
    color: "#22C55E",
    fontWeight: "800",
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    width: (width - 80) / 3,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#18201B",
    borderWidth: 1,
    borderColor: "#25332A",
    alignItems: "center",
  },
  slotChipActive: {
    backgroundColor: "#183624",
    borderColor: "#22C55E",
  },
  slotChipText: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "600",
  },
  slotChipTextActive: {
    color: "#22C55E",
    fontWeight: "800",
  },
  closedWrap: {
    paddingVertical: 18,
    alignItems: "center",
    gap: 6,
  },
  closedText: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111714",
    borderTopWidth: 1,
    borderTopColor: "#1F2B22",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomPriceLabel: {
    fontSize: 11,
    color: "#8E9B94",
  },
  bottomPriceValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  bottomPriceSub: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "400",
  },
  bookBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  bookBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B0F0D",
  },
});

