import React, { useEffect, useState } from "react";
import {
  TextInput,
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
  createHallBooking,
  getHallAvailability,
  getStoredHalls,
  Hall,
  HallAvailability,
  HallSlot,
  INITIAL_HALLS,
  isoDate,
} from "@/lib/sportRentData";
import { getErrorMessage } from "@/lib/errorMessage";
import { PhotoGallery } from "@/components/PhotoGallery";
import { capacityLabel, sizeLabel } from "@/lib/hallOptions";
import { getSessionUser } from "@/lib/auth";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

const { width } = Dimensions.get("window");

const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// Next 7 calendar days with real ISO dates (the API needs YYYY-MM-DD).
function buildDays() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const label =
      i === 0 ? "Сегодня" : i === 1 ? "Завтра" : `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    return { id: isoDate(d), label };
  });
}

const SLOT_STATUS_LABEL: Record<string, string> = {
  booked: "Занято",
  closed: "Не по графику",
  past: "Прошло",
};

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

const HERO_HEIGHT = 270;

export default function HallDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [hall, setHall] = useState<Hall | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "schedule" | "reviews">("about");
  const [isFav, setIsFav] = useState(false);

  // Booking State
  const [days] = useState(buildDays);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [duration, setDuration] = useState<number | null>(null);
  const [availability, setAvailability] = useState<HallAvailability | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<HallSlot | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const sessionUser = getSessionUser();
  const [clientName, setClientName] = useState(sessionUser?.name || "");
  const [clientPhone, setClientPhone] = useState(sessionUser?.phone || "");

  useEffect(() => {
    (async () => {
      const halls = await getStoredHalls();
      const match = halls.find((h) => String(h.id) === String(id)) || INITIAL_HALLS[0];
      setHall(match);

      if (match) {
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

  const dayLabel = days.find((d) => d.id === selectedDate)?.label ?? selectedDate;

  // Real per-hall availability from the server: free / booked / closed / past.
  const loadSlots = async () => {
    if (!hall) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const res = await getHallAvailability(hall.id, selectedDate, duration ?? undefined);
      setAvailability(res);
      if (duration === null) setDuration(res.durationMinutes);
      setSelectedSlot((prev) =>
        prev && res.slots.some((x) => x.start === prev.start && x.status === "free")
          ? res.slots.find((x) => x.start === prev.start) ?? null
          : null,
      );
    } catch (err) {
      setAvailability(null);
      setSlotsError(getErrorMessage(err, "Не удалось загрузить свободное время"));
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hall?.id, selectedDate, duration]);

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


  const handleConfirmBooking = async () => {
    if (!selectedSlot || !availability) return;
    const phoneDigits = clientPhone.replace(/\D/g, "");
    if (!clientName.trim()) {
      Alert.alert("Укажите имя", "Как к вам обращаться администратору?");
      return;
    }
    if (phoneDigits.length < 10) {
      Alert.alert("Укажите телефон", "Администратор свяжется с вами по этому номеру.");
      return;
    }
    hapticSelection();
    setBookingLoading(true);
    try {
      const booking = await createHallBooking({
        hallId: hall.id,
        date: selectedDate,
        startTime: selectedSlot.start,
        durationMinutes: availability.durationMinutes,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
      });
      hapticSuccess();
      setBookingModalOpen(false);
      setSelectedSlot(null);
      loadSlots();
      Alert.alert(
        "Бронирование подтверждено! 🎉",
        `«${hall.title}»\n\nДата: ${dayLabel}\nВремя: ${booking.timeSlot}\nСумма: ${booking.totalPrice.toLocaleString("ru-RU")} ₸\nКод брони: ${booking.id}`,
      );
    } catch (err) {
      Alert.alert("Не удалось забронировать", getErrorMessage(err));
      loadSlots();
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
          <PhotoGallery
            photos={hall.photos?.length ? hall.photos : hall.imageUrl ? [hall.imageUrl] : []}
            height={HERO_HEIGHT}
            overlay={
              <>
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
              </>
            }
          />
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
              <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.attributeChipText}>
                {capacityLabel(hall.maxPeople ?? 0) || hall.capacity || "Вместимость не указана"}
              </Text>
            </View>

            {sizeLabel(hall.lengthM ?? 0, hall.widthM ?? 0) ? (
              <View style={styles.attributeChip}>
                <Ionicons name="resize-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.attributeChipText}>
                  {sizeLabel(hall.lengthM ?? 0, hall.widthM ?? 0)}
                </Text>
              </View>
            ) : null}

            {hall.surfaceType ? (
              <View style={styles.attributeChip}>
                <Ionicons name="layers-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.attributeChipText}>{hall.surfaceType}</Text>
              </View>
            ) : null}
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
                {days.map((d) => {
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

              {/* Duration */}
              {availability && availability.slotDurations.length > 1 ? (
                <View style={styles.durationRow}>
                  {availability.slotDurations.map((m) => {
                    const active = (duration ?? availability.durationMinutes) === m;
                    return (
                      <Pressable
                        key={m}
                        style={[styles.durationChip, active && styles.durationChipActive]}
                        onPress={() => {
                          hapticSelection();
                          setDuration(m);
                        }}
                      >
                        <Text style={[styles.durationText, active && styles.durationTextActive]}>
                          {m % 60 === 0 ? `${m / 60} ч` : `${Math.floor(m / 60)} ч ${m % 60} мин`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Slots: free ones are bright, unavailable ones dimmed */}
              {slotsLoading && !availability ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
              ) : slotsError ? (
                <View style={styles.closedCard}>
                  <Ionicons name="cloud-offline-outline" size={24} color={colors.accent} />
                  <Text style={styles.closedText}>{slotsError}</Text>
                </View>
              ) : availability?.isClosed ? (
                <View style={styles.closedCard}>
                  <Ionicons name="time-outline" size={24} color={colors.accent} />
                  <Text style={styles.closedText}>Зал не работает в выбранный день</Text>
                </View>
              ) : availability && availability.slots.length === 0 ? (
                <View style={styles.closedCard}>
                  <Ionicons name="time-outline" size={24} color={colors.accent} />
                  <Text style={styles.closedText}>На этот день нет слотов</Text>
                </View>
              ) : availability ? (
                <>
                  <Text style={styles.slotsHint}>
                    Работает {availability.startTime}–{availability.endTime}
                  </Text>
                  <View style={styles.slotsGrid}>
                    {availability.slots.map((slot) => {
                      const free = slot.status === "free";
                      const active = selectedSlot?.start === slot.start;
                      return (
                        <Pressable
                          key={slot.start}
                          disabled={!free}
                          style={[
                            styles.slotChip,
                            !free && styles.slotChipDisabled,
                            active && styles.slotChipActive,
                          ]}
                          onPress={() => {
                            hapticSelection();
                            setSelectedSlot(slot);
                          }}
                        >
                          <Text
                            style={[
                              styles.slotChipText,
                              free && styles.slotChipTextFree,
                              active && styles.slotChipTextActive,
                            ]}
                          >
                            {slot.label}
                          </Text>
                          {!free ? (
                            <Text style={styles.slotStatusText}>{SLOT_STATUS_LABEL[slot.status]}</Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
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
            if (!selectedSlot) {
              setActiveTab("schedule");
              Alert.alert("Выберите время", "Во вкладке «Расписание» нажмите на свободный слот.");
              return;
            }
            setBookingModalOpen(true);
          }}
        >
          <Text style={styles.bookButtonText}>
            {selectedSlot ? `Забронировать ${selectedSlot.start}` : "Забронировать"}
          </Text>
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
                <Text style={styles.summaryValue}>{dayLabel}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Время слота:</Text>
                <Text style={styles.summaryValue}>{selectedSlot?.label ?? ""}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Итого к оплате:</Text>
                <Text style={styles.summaryTotal}>
                  {(availability?.price ?? hall.pricePerHour).toLocaleString("ru-RU")} ₸
                </Text>
              </View>
            </View>

            <Text style={styles.contactLabel}>Имя</Text>
            <TextInput
              value={clientName}
              onChangeText={setClientName}
              placeholder="Ваше имя"
              placeholderTextColor={colors.textSecondary}
              style={styles.contactInput}
            />
            <Text style={styles.contactLabel}>Телефон</Text>
            <TextInput
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="+7 (7__) ___-__-__"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              style={styles.contactInput}
            />

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
                  Подтвердить бронь
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
    height: HERO_HEIGHT,
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
  slotChipDisabled: {
    opacity: 0.35,
  },
  slotChipTextFree: {
    color: colors.textPrimary,
  },
  slotStatusText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  slotsHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  durationRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  durationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  durationChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  durationText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  durationTextActive: {
    color: colors.primary,
  },
  contactLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  contactInput: {
    height: 48,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
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
