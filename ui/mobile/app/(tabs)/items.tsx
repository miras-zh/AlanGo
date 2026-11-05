import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import {
  ArenaWithHalls,
  getArenasWithHalls,
  getStoredHalls,
  Hall,
  saveNewBooking,
  saveNewHall,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";

const { width } = Dimensions.get("window");

const DISTRICTS = ["Все", "Есиль", "Нура", "Алматы"];
const SPORT_CATEGORIES = ["Все", "Футбол", "Баскетбол", "Теннис", "Сквош и падл", "Волейбол"];

export default function ItemsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  // Mode: "arenas" (Спорткомплексы/Здания бизнесов) | "halls" (Отдельные залы)
  const [activeTab, setActiveTab] = useState<"arenas" | "halls">("arenas");

  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState("Все");
  const [selectedDistrict, setSelectedDistrict] = useState("Все");

  // Booking Modal
  const [bookingHall, setBookingHall] = useState<Hall | null>(null);
  const [selectedDate, setSelectedDate] = useState("Сегодня");
  const [selectedSlot, setSelectedSlot] = useState("19:00 - 20:00");
  const [bookingLoading, setBookingLoading] = useState(false);

  // Add Hall Modal (for business owners)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSport, setNewSport] = useState("Футбол");
  const [newPrice, setNewPrice] = useState("15000");
  const [newAddress, setNewAddress] = useState("г. Астана");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [arenasData, hallsData] = await Promise.all([
        getArenasWithHalls(),
        getStoredHalls(),
      ]);
      setArenas(arenasData);
      setHalls(hallsData);
    } catch {
      // fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Arenas
  const filteredArenas = arenas.filter((arena) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      arena.title.toLowerCase().includes(q) ||
      arena.address.toLowerCase().includes(q) ||
      arena.city.toLowerCase().includes(q) ||
      (arena.district && arena.district.toLowerCase().includes(q)) ||
      (arena.category && arena.category.toLowerCase().includes(q)) ||
      arena.halls.some(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.sportType.toLowerCase().includes(q) ||
          h.surfaceType.toLowerCase().includes(q),
      );

    const matchDistrict =
      selectedDistrict === "Все" ||
      (arena.district && arena.district.toLowerCase() === selectedDistrict.toLowerCase());

    const matchSport =
      selectedSport === "Все" ||
      arena.availableSports.some((s) => s.toLowerCase() === selectedSport.toLowerCase());

    return matchSearch && matchDistrict && matchSport;
  });

  // Filtered Halls
  const filteredHalls = halls.filter((hall) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      hall.title.toLowerCase().includes(q) ||
      hall.arenaTitle.toLowerCase().includes(q) ||
      hall.arenaAddress.toLowerCase().includes(q) ||
      hall.surfaceType.toLowerCase().includes(q);

    const matchSport =
      selectedSport === "Все" ||
      hall.sportType.toLowerCase() === selectedSport.toLowerCase();

    return matchSearch && matchSport;
  });

  // Handle Booking Confirmation
  const handleConfirmBooking = async () => {
    if (!bookingHall) return;
    setBookingLoading(true);
    try {
      await saveNewBooking({
        hallId: bookingHall.id,
        hallTitle: bookingHall.title,
        sportType: bookingHall.sportType,
        arenaId: bookingHall.arenaId,
        arenaTitle: bookingHall.arenaTitle,
        clientName: "Мико Аскаров",
        clientPhone: "+7 (777) 123-45-67",
        date: selectedDate,
        timeSlot: selectedSlot,
        durationMinutes: 60,
        totalPrice: bookingHall.pricePerHour || 15000,
        status: "confirmed",
      });
      hapticSuccess();
      const title = bookingHall.title;
      const arenaTitle = bookingHall.arenaTitle;
      setBookingHall(null);
      Alert.alert(
        "Бронирование подтверждено! 🎉",
        `Вы успешно забронировали "${title}" (${arenaTitle}) на ${selectedDate} в слот ${selectedSlot}. Ждем вас на игре!`,
        [{ text: "Отлично" }],
      );
    } catch (e) {
      Alert.alert("Ошибка", getErrorMessage(e));
    } finally {
      setBookingLoading(false);
    }
  };

  // Handle Create Hall
  const handleCreateHall = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Ошибка", "Введите название зала");
      return;
    }
    setCreating(true);
    try {
      await saveNewHall(1, {
        title: newTitle.trim(),
        sportType: newSport as any,
        pricePerHour: parseInt(newPrice) || 15000,
        description: newDesc.trim() || "Спортивный зал высокого уровня",
        arenaAddress: newAddress.trim() || "г. Астана",
      });
      await loadData();
      setCreateModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      hapticSuccess();
      Alert.alert("Успешно", "Зал добавлен в спорткомплекс!");
    } catch (e) {
      Alert.alert("Ошибка", getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Каталог</Text>
          <Text style={styles.subtitle}>
            {activeTab === "arenas"
              ? "Поиск по спорткомплексам, аренам и зданиям"
              : "Поиск по отдельным залам и площадкам"}
          </Text>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setCreateModalOpen(true);
          }}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color="#0B0F0D" />
        </Pressable>
      </View>

      {/* Main Segment Switcher: Комплексы vs Залы */}
      <View style={styles.tabSwitcher}>
        <Pressable
          style={[styles.tabBtn, activeTab === "arenas" && styles.tabBtnActive]}
          onPress={() => {
            hapticImpact();
            setActiveTab("arenas");
          }}
        >
          <Ionicons
            name="business"
            size={17}
            color={activeTab === "arenas" ? "#22C55E" : "#8E9B94"}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "arenas" && styles.tabBtnTextActive,
            ]}
          >
            Спорткомплексы ({arenas.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === "halls" && styles.tabBtnActive]}
          onPress={() => {
            hapticImpact();
            setActiveTab("halls");
          }}
        >
          <Ionicons
            name="layers"
            size={17}
            color={activeTab === "halls" ? "#22C55E" : "#8E9B94"}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "halls" && styles.tabBtnTextActive,
            ]}
          >
            Отдельные залы ({halls.length})
          </Text>
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={19} color="#6B7C72" style={{ marginRight: 8 }} />
        <TextInput
          placeholder={
            activeTab === "arenas"
              ? "Поиск спорткомплекса, адреса, района..."
              : "Поиск зала по названию или покрытию..."
          }
          placeholderTextColor="#6B7C72"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#6B7C72" />
          </Pressable>
        )}
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {/* Sports Filter */}
          {SPORT_CATEGORIES.map((sport) => {
            const active = selectedSport === sport;
            return (
              <Pressable
                key={sport}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  hapticSelection();
                  setSelectedSport(sport);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {sport === "Все" ? "Все виды спорта" : sport}
                </Text>
              </Pressable>
            );
          })}

          {/* District filter (relevant for Arenas) */}
          {activeTab === "arenas" && (
            <>
              <View style={styles.chipDivider} />
              {DISTRICTS.filter((d) => d !== "Все").map((district) => {
                const active = selectedDistrict === district;
                return (
                  <Pressable
                    key={district}
                    style={[styles.districtChip, active && styles.districtChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedDistrict(active ? "Все" : district);
                    }}
                  >
                    <Ionicons
                      name="location-sharp"
                      size={12}
                      color={active ? "#22C55E" : "#8E9B94"}
                    />
                    <Text
                      style={[
                        styles.districtChipText,
                        active && styles.districtChipTextActive,
                      ]}
                    >
                      р-н {district}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>

      {/* Content List */}
      {activeTab === "arenas" ? (
        /* ================= 1. ARENAS LIST ================= */
        <FlatList
          data={filteredArenas}
          keyExtractor={(item) => String(item.id)}
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
              <Ionicons name="business-outline" size={48} color="#2A3830" />
              <Text style={styles.emptyTitle}>Спорткомплексы не найдены</Text>
              <Text style={styles.emptySub}>
                Попробуйте изменить поисковый запрос или сбросить фильтры
              </Text>
              {(search.length > 0 || selectedSport !== "Все" || selectedDistrict !== "Все") && (
                <Pressable
                  style={styles.resetBtn}
                  onPress={() => {
                    setSearch("");
                    setSelectedSport("Все");
                    setSelectedDistrict("Все");
                  }}
                >
                  <Text style={styles.resetBtnText}>Сбросить фильтры</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item: arena }) => (
            <Pressable
              style={styles.arenaCard}
              onPress={() => {
                hapticSelection();
                router.push(`/arena/${arena.id}`);
              }}
            >
              {/* Complex Image & Badges */}
              <View style={styles.arenaImageWrap}>
                <Image source={{ uri: arena.imageUrl }} style={styles.arenaImage} />
                <View style={styles.imageDarkGradient} />

                {/* Top Badge: Complex Category */}
                <View style={styles.arenaTypeBadge}>
                  <Ionicons name="business" size={12} color="#22C55E" />
                  <Text style={styles.arenaTypeText}>
                    {arena.category || "Спорткомплекс"}
                  </Text>
                </View>

                {/* Rating Badge */}
                <View style={styles.arenaRatingBadge}>
                  <Ionicons name="star" size={13} color="#22C55E" />
                  <Text style={styles.ratingText}>
                    {arena.rating} ({arena.reviewsCount})
                  </Text>
                </View>

                {/* Halls Count overlay pill */}
                <View style={styles.hallsPillOverlay}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.hallsPillText}>
                    {arena.hallsCount} {arena.hallsCount === 1 ? "зал" : arena.hallsCount < 5 ? "зала" : "залов"} в комплексе
                  </Text>
                </View>
              </View>

              {/* Complex Body */}
              <View style={styles.arenaBody}>
                <View style={styles.arenaHeaderRow}>
                  <Text style={styles.arenaTitle}>{arena.title}</Text>
                </View>

                {/* Location with District */}
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={14} color="#22C55E" />
                  <Text style={styles.locationText}>
                    {arena.city}, {arena.address}
                    {arena.district ? ` • р-н ${arena.district}` : ""}
                  </Text>
                </View>

                {/* Sports tags inside this complex */}
                <View style={styles.sportsRow}>
                  {arena.availableSports.map((sp) => (
                    <View key={sp} style={styles.sportBadge}>
                      <Text style={styles.sportBadgeText}>{sp}</Text>
                    </View>
                  ))}
                </View>

                {/* Mini Hall List preview inside this complex */}
                {arena.halls.length > 0 && (
                  <View style={styles.hallsPreviewBox}>
                    <Text style={styles.hallsPreviewTitle}>Площадки в аренду:</Text>
                    {arena.halls.map((h) => (
                      <View key={h.id} style={styles.hallMiniRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                        <Text style={styles.hallMiniTitle} numberOfLines={1}>
                          {h.title}
                        </Text>
                        <Text style={styles.hallMiniPrice}>
                          {h.pricePerHour.toLocaleString("ru-RU")} ₸/ч
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Complex Features */}
                <View style={styles.featuresRow}>
                  <Text style={styles.featuresText} numberOfLines={1}>
                    {arena.features.slice(0, 4).join("  •  ")}
                  </Text>
                </View>

                {/* Footer with Price and CTA */}
                <View style={styles.arenaFooter}>
                  <View>
                    <Text style={styles.fromLabel}>Аренда залов от</Text>
                    <Text style={styles.priceValue}>
                      {arena.minPrice.toLocaleString("ru-RU")} ₸{" "}
                      <Text style={styles.priceSub}>/ час</Text>
                    </Text>
                  </View>

                  <Pressable
                    style={styles.exploreBtn}
                    onPress={() => {
                      hapticSelection();
                      router.push(`/arena/${arena.id}`);
                    }}
                  >
                    <Text style={styles.exploreBtnText}>Выбрать зал</Text>
                    <Ionicons name="arrow-forward" size={16} color="#0B0F0D" />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      ) : (
        /* ================= 2. INDIVIDUAL HALLS LIST ================= */
        <FlatList
          data={filteredHalls}
          keyExtractor={(item) => String(item.id)}
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
              <Ionicons name="layers-outline" size={48} color="#2A3830" />
              <Text style={styles.emptyTitle}>Залы не найдены</Text>
              <Text style={styles.emptySub}>
                Попробуйте изменить поисковый запрос или выбрать другой вид спорта
              </Text>
            </View>
          }
          renderItem={({ item: hall }) => (
            <Pressable
              style={styles.card}
              onPress={() => {
                hapticSelection();
                router.push(`/hall/${hall.id}`);
              }}
            >
              <Image source={{ uri: hall.imageUrl }} style={styles.cardImage} />

              <View style={styles.cardRating}>
                <Ionicons name="star" size={12} color="#22C55E" />
                <Text style={styles.ratingText}>
                  {hall.rating || 4.8} ({hall.reviewsCount || 80})
                </Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{hall.title}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{hall.sportType}</Text>
                  </View>
                </View>

                {/* Clickable link to parent Sport Complex */}
                <Pressable
                  style={styles.complexLinkPill}
                  onPress={(e) => {
                    e.stopPropagation();
                    hapticSelection();
                    router.push(`/arena/${hall.arenaId}`);
                  }}
                >
                  <Ionicons name="business" size={13} color="#22C55E" />
                  <Text style={styles.complexLinkText} numberOfLines={1}>
                    {hall.arenaTitle}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color="#22C55E" />
                </Pressable>

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#8E9B94" />
                  <Text style={styles.locationText}>{hall.arenaAddress}</Text>
                </View>

                <Text style={styles.descText} numberOfLines={2}>
                  Покрытие: {hall.surfaceType}. {hall.description}
                </Text>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceText}>
                      {(hall.pricePerHour || 12000).toLocaleString("ru-RU")} ₸{" "}
                      <Text style={styles.priceSub}>/ час</Text>
                    </Text>
                  </View>

                  <Pressable
                    style={styles.bookBtn}
                    onPress={() => {
                      hapticSelection();
                      setBookingHall(hall);
                    }}
                  >
                    <Text style={styles.bookBtnText}>Забронировать</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* ================= FAST BOOKING MODAL ================= */}
      <Modal
        visible={!!bookingHall}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingHall(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setBookingHall(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {bookingHall?.title}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  🏢 {bookingHall?.arenaTitle} • {bookingHall?.arenaAddress}
                </Text>
              </View>
              <Pressable
                onPress={() => setBookingHall(null)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Date Selection */}
            <Text style={styles.modalSectionLabel}>Выберите день</Text>
            <View style={styles.slotRow}>
              {["Сегодня", "Завтра", "Пт, 7 ноя", "Сб, 8 ноя"].map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.slotChip,
                    selectedDate === d && styles.slotChipActive,
                  ]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedDate(d);
                  }}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      selectedDate === d && styles.slotChipTextActive,
                    ]}
                  >
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Time Slot Selection */}
            <Text style={styles.modalSectionLabel}>Свободные слоты</Text>
            <View style={styles.slotRow}>
              {["17:00 - 18:00", "19:00 - 20:00", "20:00 - 21:00", "21:00 - 22:00"].map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.slotChip,
                    selectedSlot === s && styles.slotChipActive,
                  ]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedSlot(s);
                  }}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      selectedSlot === s && styles.slotChipTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Summary Row */}
            <View style={styles.modalSummaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Итого к оплате:</Text>
                <Text style={styles.summaryPrice}>
                  {(bookingHall?.pricePerHour || 15000).toLocaleString("ru-RU")} ₸
                </Text>
              </View>

              <Pressable
                style={styles.confirmBookingBtn}
                onPress={handleConfirmBooking}
                disabled={bookingLoading}
              >
                <Text style={styles.confirmBookingBtnText}>
                  {bookingLoading ? "Оформление..." : "Забронировать зал"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= CREATE HALL MODAL ================= */}
      <Modal
        visible={createModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCreateModalOpen(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новая спортивная площадка</Text>
              <Pressable
                onPress={() => setCreateModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Название площадки</Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Например: Футбольный манеж 1"
                placeholderTextColor="#6B7C72"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Вид спорта</Text>
              <View style={styles.catPicker}>
                {SPORT_CATEGORIES.filter((c) => c !== "Все").map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setNewSport(c)}
                    style={[styles.catChip, newSport === c && styles.catChipActive]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        newSport === c && styles.catChipTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Стоимость в час (₸)</Text>
              <TextInput
                value={newPrice}
                onChangeText={setNewPrice}
                placeholder="15000"
                placeholderTextColor="#6B7C72"
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Адрес спорткомплекса</Text>
              <TextInput
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="г. Астана, пр. Туран..."
                placeholderTextColor="#6B7C72"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Описание и оснащение</Text>
              <TextInput
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Покрытие, освещение, раздевалка..."
                placeholderTextColor="#6B7C72"
                multiline
                numberOfLines={3}
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              />

              <Pressable
                style={styles.saveBtn}
                onPress={handleCreateHall}
                disabled={creating}
              >
                <Text style={styles.saveBtnText}>
                  {creating ? "Сохранение..." : "Добавить в каталог"}
                </Text>
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },

  // Tab Switcher (Комплексы vs Залы)
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#131915",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#1E2A22",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: "#1A251F",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E9B94",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141A17",
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F2B22",
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },

  // Filter Section
  filterSection: {
    marginBottom: 14,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#141A17",
    borderWidth: 1,
    borderColor: "#202C24",
  },
  chipActive: {
    backgroundColor: "#163321",
    borderColor: "#22C55E",
  },
  chipText: {
    fontSize: 13,
    color: "#8E9B94",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#223127",
    marginHorizontal: 4,
  },
  districtChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#141A17",
    borderWidth: 1,
    borderColor: "#202C24",
  },
  districtChipActive: {
    backgroundColor: "#163321",
    borderColor: "#22C55E",
  },
  districtChipText: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "600",
  },
  districtChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },

  // List
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },

  // Empty state
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: "#8E9B94",
    textAlign: "center",
    lineHeight: 18,
  },
  resetBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#1B2A21",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22C55E",
  },

  // ================= ARENA CARD STYLES =================
  arenaCard: {
    backgroundColor: "#131915",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E2A22",
  },
  arenaImageWrap: {
    width: "100%",
    height: 190,
    position: "relative",
  },
  arenaImage: {
    width: "100%",
    height: "100%",
  },
  imageDarkGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(11, 15, 13, 0.25)",
  },
  arenaTypeBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(11, 15, 13, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  arenaTypeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#22C55E",
  },
  arenaRatingBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(11, 15, 13, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  hallsPillOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(19, 25, 21, 0.9)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  greenPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  hallsPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Arena Body
  arenaBody: {
    padding: 16,
  },
  arenaHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  arenaTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 13,
    color: "#8E9B94",
  },
  sportsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  sportBadge: {
    backgroundColor: "#18241D",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#223528",
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#22C55E",
  },

  // Mini halls inside complex
  hallsPreviewBox: {
    backgroundColor: "#101612",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1A241D",
    gap: 6,
  },
  hallsPreviewTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7C72",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hallMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  hallMiniTitle: {
    fontSize: 13,
    color: "#E5E7EB",
    fontWeight: "600",
    flex: 1,
  },
  hallMiniPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: "#22C55E",
  },

  featuresRow: {
    marginBottom: 14,
  },
  featuresText: {
    fontSize: 12,
    color: "#6B7C72",
  },

  arenaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1B241E",
  },
  fromLabel: {
    fontSize: 11,
    color: "#8E9B94",
    marginBottom: 1,
  },
  priceValue: {
    fontSize: 19,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  priceSub: {
    fontSize: 12,
    fontWeight: "400",
    color: "#8E9B94",
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B0F0D",
  },

  // ================= INDIVIDUAL HALL CARD STYLES =================
  card: {
    backgroundColor: "#131915",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E2A22",
  },
  cardImage: {
    width: "100%",
    height: 170,
  },
  cardRating: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(11, 15, 13, 0.8)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: "#1B2A21",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
  },
  complexLinkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  complexLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#22C55E",
  },
  descText: {
    fontSize: 13,
    color: "#6B7C72",
    lineHeight: 18,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1F2823",
  },
  priceText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  bookBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B0F0D",
  },

  // ================= MODAL STYLES =================
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: "#131915",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: "#1F2B22",
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1E2721",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E9B94",
    marginTop: 10,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#18201B",
    borderWidth: 1,
    borderColor: "#25332A",
  },
  slotChipActive: {
    backgroundColor: "#163321",
    borderColor: "#22C55E",
  },
  slotChipText: {
    fontSize: 13,
    color: "#8E9B94",
    fontWeight: "600",
  },
  slotChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  modalSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1F2823",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#8E9B94",
  },
  summaryPrice: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  confirmBookingBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  confirmBookingBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B0F0D",
  },

  // Create Modal Inputs
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E9B94",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#18201B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#25332A",
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  catPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#18201B",
    borderWidth: 1,
    borderColor: "#25332A",
  },
  catChipActive: {
    backgroundColor: "#1A3324",
    borderColor: "#22C55E",
  },
  catChipText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  catChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B0F0D",
  },
});
