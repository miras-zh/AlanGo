import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radii, spacing, typography } from "@/constants/theme";
import {
  getStoredHalls,
  getStoredSchedule,
  Hall,
  INITIAL_HALLS,
  saveNewBooking,
  ScheduleDay,
} from "@/lib/sportRentData";
import { getSessionUser } from "@/lib/auth";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

const { width } = Dimensions.get("window");

const DAYS = [
  { id: "Сегодня", label: "Сегодня", dayOfWeek: new Date().getDay() },
  { id: "Завтра", label: "Завтра", dayOfWeek: (new Date().getDay() + 1) % 7 },
  { id: "Пт, 7 ноя", label: "Пт, 7 ноя", dayOfWeek: 5 },
  { id: "Сб, 8 ноя", label: "Сб, 8 ноя", dayOfWeek: 6 },
  { id: "Вс, 9 ноя", label: "Вс, 9 ноя", dayOfWeek: 0 },
];

const AMENITIES_LIST = [
  { key: "parking", label: "Парковка", icon: "car-outline" },
  { key: "locker", label: "Раздевалка", icon: "shirt-outline" },
  { key: "shower", label: "Душ", icon: "water-outline" },
  { key: "wifi", label: "Wi-Fi", icon: "wifi-outline" },
];

const REVIEWS_MOCK = [
  {
    id: 1,
    name: "Азамат К.",
    rating: 5,
    date: "Вчера",
    text: "Отличный газон, освещение топ! Душевые чистые, администратор встретил вовремя.",
  },
  {
    id: 2,
    name: "Данияр М.",
    rating: 5,
    date: "3 дня назад",
    text: "Играем тут каждую среду. Удобная парковка прямо перед входом.",
  },
  {
    id: 3,
    name: "Ерлан С.",
    rating: 4.8,
    date: "Неделю назад",
    text: "Хороший крытый манеж, температура комфортная даже вечером.",
  },
];

const FAVORITES_STORAGE_KEY = "alango_favorite_halls";

export default function HallDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [hall, setHall] = useState<Hall | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [activeTab, setActiveTab] = useState<"about" | "schedule" | "reviews">("about");
  const [isFav, setIsFav] = useState(false);

  // Booking State
  const [selectedDate, setSelectedDate] = useState("Сегодня");
  const [selectedSlot, setSelectedSlot] = useState("19:00 - 20:00");
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const halls = await getStoredHalls();
      const match = halls.find((h) => String(h.id) === String(id)) || INITIAL_HALLS[0];
      setHall(match);

      if (match) {
        const sched = await getStoredSchedule(match.arenaId);
        setSchedule(sched);

        // Check favorite status
        const favStr = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (favStr) {
          try {
            const favIds: number[] = JSON.parse(favStr);
            setIsFav(favIds.includes(match.id));
          } catch {}
        }
      }
    })();
  }, [id]);

  if (!hall) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Favorite handler
  const handleToggleFav = async () => {
    hapticImpact();
    const nextFav = !isFav;
    setIsFav(nextFav);
    try {
      const favStr = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      let favIds: number[] = favStr ? JSON.parse(favStr) : [];
      if (nextFav) {
        favIds = [...favIds, hall.id];
      } else {
        favIds = favIds.filter((favId) => favId !== hall.id);
      }
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favIds));
    } catch {}
  };

  // Share handler
  const handleShare = async () => {
    hapticSelection();
    try {
      await Share.share({
        title: hall.title,
        message: `Забронируй спортивную площадку "${hall.title}" в Alan Go! Цена от ${hall.pricePerHour} ₸/час: ${hall.arenaAddress}`,
      });
    } catch {}
  };

  // Generate Slots
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

  // Booking Execution
  const handleConfirmBooking = async () => {
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
      setBookingModalOpen(false);
      Alert.alert(
        "Бронирование подтверждено! 🎉",
        `Вы успешно забронировали "${hall.title}" в ${hall.arenaTitle}\n\nДата: ${selectedDate}\nВремя: ${selectedSlot}\nСумма: ${hall.pricePerHour.toLocaleString("ru-RU")} ₸\n\nАдминистратор комплекса уже ожидает вас!`,
        [
          {
            text: "Мои брони",
            onPress: () => router.push("/(tabs)/notifications"),
          },
          { text: "ОК" },
        ],
      );
    } catch {
      Alert.alert("Ошибка", "Не удалось сохранить бронь");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Image Gallery (Screen 4) */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: hall.imageUrl }} style={styles.heroImage} />

          {/* Top Floating Buttons Bar */}
          <SafeAreaView style={styles.floatingTopBar} edges={["top"]}>
            {/* Back Button */}
            <Pressable
              style={styles.circleBtn}
              onPress={() => {
                hapticSelection();
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>

            {/* Right Buttons: Share & Favorite */}
            <View style={styles.topRightBtns}>
              <Pressable style={styles.circleBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={19} color="#FFFFFF" />
              </Pressable>

              <Pressable style={styles.circleBtn} onPress={handleToggleFav}>
                <Ionicons
                  name={isFav ? "heart" : "heart-outline"}
                  size={20}
                  color={isFav ? colors.accent : "#FFFFFF"}
                />
              </Pressable>
            </View>
          </SafeAreaView>

          {/* Photo Count Indicator (Bottom Right) */}
          <View style={styles.photoCountBadge}>
            <Ionicons name="camera-outline" size={13} color="#FFFFFF" />
            <Text style={styles.photoCountText}>1/12</Text>
          </View>
        </View>

        {/* 2. Venue Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.hallTitle}>{hall.title}</Text>

          {/* Rating Row */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={15} color={colors.primary} />
            <Text style={styles.ratingText}>
              {hall.rating.toFixed(1)}{" "}
              <Text style={styles.reviewCountText}>
                ({hall.reviewsCount} отзыва)
              </Text>
            </Text>
          </View>

          {/* Sport & Facility Attributes */}
          <View style={styles.tagsRow}>
            <View style={styles.attributeChip}>
              <Ionicons name="football-outline" size={13} color={colors.primary} />
              <Text style={styles.attributeChipText}>{hall.sportType}</Text>
            </View>

            <View style={styles.attributeChip}>
              <Ionicons name="grid-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.attributeChipText}>
                {hall.capacity || "5×5"}
              </Text>
            </View>

            <View style={styles.attributeChip}>
              <Ionicons name="home-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.attributeChipText}>Крытый</Text>
            </View>
          </View>

          {/* Location & Distance */}
          <View style={styles.locationRow}>
            <View style={styles.addressLeft}>
              <Ionicons
                name="location-outline"
                size={15}
                color={colors.textSecondary}
              />
              <Text style={styles.addressText} numberOfLines={1}>
                {hall.arenaAddress || "Астана, ул. Нур-Султан 12"}
              </Text>
            </View>
            <Text style={styles.distanceText}>2,4 км</Text>
          </View>

          {/* 3. Segmented Tabs: [О зале] [Расписание] [Отзывы] */}
          <View style={styles.segmentedTabsWrap}>
            <Pressable
              style={[
                styles.segmentTab,
                activeTab === "about" && styles.segmentTabActive,
              ]}
              onPress={() => {
                hapticSelection();
                setActiveTab("about");
              }}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  activeTab === "about" && styles.segmentTabTextActive,
                ]}
              >
                О зале
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.segmentTab,
                activeTab === "schedule" && styles.segmentTabActive,
              ]}
              onPress={() => {
                hapticSelection();
                setActiveTab("schedule");
              }}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  activeTab === "schedule" && styles.segmentTabTextActive,
                ]}
              >
                Расписание
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.segmentTab,
                activeTab === "reviews" && styles.segmentTabActive,
              ]}
              onPress={() => {
                hapticSelection();
                setActiveTab("reviews");
              }}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  activeTab === "reviews" && styles.segmentTabTextActive,
                ]}
              >
                Отзывы
              </Text>
            </Pressable>
          </View>

          {/* 4. Tab Content */}
          {activeTab === "about" && (
            <View style={styles.tabContentSection}>
              {/* Description */}
              <Text style={styles.aboutDescription}>
                {hall.description ||
                  "Искусственный газон 60 мм (FIFA Quality Pro). Профессиональный крытый манеж с освещением, раздевалками и душевыми."}
              </Text>

              {/* Amenities Section (Screen 4) */}
              <Text style={styles.amenitiesHeader}>Удобства</Text>
              <View style={styles.amenitiesGrid}>
                {AMENITIES_LIST.map((item) => (
                  <View key={item.key} style={styles.amenityCard}>
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.amenityCardLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Sport Complex link banner */}
              <Pressable
                style={styles.arenaBanner}
                onPress={() => {
                  hapticSelection();
                  router.push(`/arena/${hall.arenaId}`);
                }}
              >
                <View style={styles.arenaBannerIcon}>
                  <Ionicons name="business" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.arenaBannerTitle}>{hall.arenaTitle}</Text>
                  <Text style={styles.arenaBannerSub}>
                    Посмотреть все залы спорткомплекса →
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          {activeTab === "schedule" && (
            <View style={styles.tabContentSection}>
              {/* Day Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.daysScroll}
              >
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
                      <Text
                        style={[
                          styles.dayChipText,
                          active && styles.dayChipTextActive,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Slots */}
              {isClosedDay ? (
                <View style={styles.closedCard}>
                  <Ionicons name="time-outline" size={24} color={colors.accent} />
                  <Text style={styles.closedText}>
                    Зал закрыт в выбранный день
                  </Text>
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
                        <Text
                          style={[
                            styles.slotChipText,
                            active && styles.slotChipTextActive,
                          ]}
                        >
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === "reviews" && (
            <View style={styles.tabContentSection}>
              {REVIEWS_MOCK.map((rev) => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewerName}>{rev.name}</Text>
                    <View style={styles.reviewStars}>
                      <Ionicons name="star" size={13} color={colors.primary} />
                      <Text style={styles.reviewScore}>{rev.rating}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>{rev.date}</Text>
                  <Text style={styles.reviewBody}>{rev.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 5. Sticky Bottom Action Bar (Screen 4) */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerPriceWrap}>
          <Text style={styles.footerPriceLabel}>от </Text>
          <Text style={styles.footerPriceValue}>
            {hall.pricePerHour.toLocaleString("ru-RU")} ₸
          </Text>
          <Text style={styles.footerPriceSuffix}> / час</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.bookButton,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => {
            hapticImpact();
            setBookingModalOpen(true);
          }}
        >
          <Text style={styles.bookButtonText}>Забронировать</Text>
        </Pressable>
      </View>

      {/* Booking Confirmation Sheet */}
      <Modal
        visible={bookingModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setBookingModalOpen(false)}
          />
          <View style={styles.bookingSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Подтверждение брони</Text>
              <Pressable
                onPress={() => setBookingModalOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.modalSummaryBox}>
              <Text style={styles.summaryTitle}>{hall.title}</Text>
              <Text style={styles.summarySub}>{hall.arenaTitle}</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Дата игры:</Text>
                <Text style={styles.summaryValue}>{selectedDate}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Время слота:</Text>
                <Text style={styles.summaryValue}>{selectedSlot}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Итого к оплате:</Text>
                <Text style={styles.summaryTotal}>
                  {hall.pricePerHour.toLocaleString("ru-RU")} ₸
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.confirmBookingBtn,
                bookingLoading && { opacity: 0.5 },
              ]}
              onPress={handleConfirmBooking}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#080D0B" />
              ) : (
                <Text style={styles.confirmBookingBtnText}>
                  Оплатить и подтвердить
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingBottom: 120,
  },
  heroWrap: {
    width: "100%",
    height: 270,
    position: "relative",
    backgroundColor: "#16201B",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  floatingTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 8,
  },
  topRightBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(18, 26, 22, 0.72)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCountBadge: {
    position: "absolute",
    bottom: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(18, 26, 22, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  photoCountText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  infoSection: {
    padding: spacing.screenHorizontal,
  },
  hallTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  reviewCountText: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  attributeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attributeChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  addressLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  segmentedTabsWrap: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentTabActive: {
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  segmentTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  segmentTabTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  tabContentSection: {
    gap: 16,
  },
  aboutDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  amenitiesHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  amenitiesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amenityCard: {
    width: "23%",
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  amenityCardLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  arenaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  arenaBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  arenaBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  arenaBannerSub: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  daysScroll: {
    gap: 8,
    marginBottom: 14,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.smallChip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderColor: colors.primary,
  },
  dayChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  dayChipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  closedCard: {
    padding: 20,
    borderRadius: radii.card,
    backgroundColor: "rgba(240, 68, 82, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(240, 68, 82, 0.3)",
    alignItems: "center",
    gap: 8,
  },
  closedText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    width: "31%",
    paddingVertical: 10,
    borderRadius: radii.smallChip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  slotChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  slotChipTextActive: {
    color: "#080D0B",
    fontWeight: "800",
  },
  reviewCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  reviewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewScore: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  reviewBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 14,
    paddingBottom: 28,
  },
  footerPriceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  footerPriceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerPriceValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  footerPriceSuffix: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.button,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#080D0B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
  },
  bookingSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    padding: spacing.screenHorizontal,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  modalSummaryBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  summarySub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  confirmBookingBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBookingBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#080D0B",
  },
});
