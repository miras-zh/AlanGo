import { useCallback, useEffect, useMemo, useState } from "react";
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
import { listPublicItems, ItemEntity } from "@/lib/items";
import { ArenaWithHalls, getArenasWithHalls } from "@/lib/sportRentData";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getSelectedCity, subscribeCityChange } from "@/lib/cities";
import { CityPickerModal } from "@/components/CityPickerModal";
import { LiveMatchIsland } from "@/components/LiveMatchIsland";
import {
  SportSearchFiltersModal,
  SportFilterState,
  DEFAULT_FILTERS,
} from "@/components/SportSearchFiltersModal";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2;

type CategoryItem = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  borderColor: string;
};

const CATEGORIES: CategoryItem[] = [
  {
    id: "Футбол",
    name: "Футбол",
    icon: "football-outline",
    color: "#22C55E",
    bgColor: "#14221A",
    borderColor: "#1E3327",
  },
  {
    id: "Теннис",
    name: "Теннис",
    icon: "tennisball-outline",
    color: "#22C55E",
    bgColor: "#14221A",
    borderColor: "#1E3327",
  },
  {
    id: "Баскетбол",
    name: "Баскетбол",
    icon: "basketball-outline",
    color: "#EF4444",
    bgColor: "#261616",
    borderColor: "#3D2020",
  },
  {
    id: "Волейбол",
    name: "Волейбол",
    icon: "baseball-outline",
    color: "#FFFFFF",
    bgColor: "#1A221E",
    borderColor: "#28342D",
  },
  {
    id: "Сквош и падл",
    name: "Сквош\nи падл",
    icon: "fitness-outline",
    color: "#22C55E",
    bgColor: "#14221A",
    borderColor: "#1E3327",
  },
  {
    id: "all",
    name: "Другое",
    icon: "grid-outline",
    color: "#8E9B94",
    bgColor: "#1A221E",
    borderColor: "#28342D",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});

  // City & Sport Filters State
  const [currentCity, setCurrentCity] = useState("Астана");
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sportFilters, setSportFilters] = useState<SportFilterState>(DEFAULT_FILTERS);

  // Booking Modal State
  const [selectedHall, setSelectedHall] = useState<ItemEntity | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("19:00 - 20:00");
  const [selectedDate, setSelectedDate] = useState<string>("Сегодня");

  useEffect(() => {
    getSelectedCity().then(setCurrentCity);
    const unsubscribe = subscribeCityChange((city) => {
      setCurrentCity(city);
    });
    return unsubscribe;
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count = sportFilters.sports.length + sportFilters.surfaces.length + sportFilters.amenities.length;
    if (sportFilters.priceRange !== "all") count += 1;
    return count;
  }, [sportFilters]);

  const loadHalls = useCallback(async () => {
    try {
      const [res, loadedArenas] = await Promise.all([
        listPublicItems({
          category: selectedCategory === "all" ? undefined : selectedCategory,
          q: searchQuery.trim() || undefined,
          limit: 20,
        }),
        getArenasWithHalls(),
      ]);
      setItems(res.items || []);
      setArenas(loadedArenas);
    } catch {
      // fallback handled in listPublicItems
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadHalls();
  }, [loadHalls]);

  // Filtered Arenas by City, Search, Category, and Sport Filters
  const filteredArenas = useMemo(() => {
    return arenas.filter((arena) => {
      // 1. City filter
      if (currentCity && arena.city && arena.city.toLowerCase() !== currentCity.toLowerCase()) {
        return false;
      }
      // 2. Category match (from quick horizontal icons)
      if (selectedCategory !== "all") {
        const matchesCategory =
          arena.availableSports?.some((s) => s.toLowerCase().includes(selectedCategory.toLowerCase())) ||
          arena.category?.toLowerCase().includes(selectedCategory.toLowerCase());
        if (!matchesCategory) return false;
      }
      // 3. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          arena.title.toLowerCase().includes(q) ||
          arena.address.toLowerCase().includes(q) ||
          (arena.district && arena.district.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }
      // 4. SportFilterState: sports
      if (sportFilters.sports.length > 0) {
        const matchesSport = sportFilters.sports.some((sp) =>
          arena.availableSports?.some((s) => s.toLowerCase().includes(sp.toLowerCase())),
        );
        if (!matchesSport) return false;
      }
      // 5. SportFilterState: priceRange
      if (sportFilters.priceRange !== "all") {
        if (sportFilters.priceRange === "under10" && arena.minPrice > 10000) return false;
        if (sportFilters.priceRange === "10to20" && (arena.minPrice < 10000 || arena.minPrice > 20000)) return false;
        if (sportFilters.priceRange === "above20" && arena.minPrice < 20000) return false;
      }
      // 6. SportFilterState: amenities
      if (sportFilters.amenities.length > 0) {
        const featuresText = (arena.features || []).join(" ").toLowerCase();
        for (const am of sportFilters.amenities) {
          if (am === "parking" && !featuresText.includes("парковк")) return false;
          if (am === "shower" && !featuresText.includes("душ")) return false;
          if (am === "sauna" && !featuresText.includes("саун")) return false;
          if (am === "tribune" && !featuresText.includes("трибун")) return false;
        }
      }
      return true;
    });
  }, [arenas, currentCity, selectedCategory, searchQuery, sportFilters]);

  // Filtered Items (Individual halls)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemCity = item.metadata?.city || (item.metadata?.location ? String(item.metadata.location) : "");
      if (currentCity && itemCity && !itemCity.toLowerCase().includes(currentCity.toLowerCase())) {
        return false;
      }
      if (sportFilters.sports.length > 0) {
        const matchesSport = sportFilters.sports.some((sp) =>
          item.category?.toLowerCase().includes(sp.toLowerCase()),
        );
        if (!matchesSport) return false;
      }
      if (sportFilters.priceRange !== "all") {
        const p = item.price || 0;
        if (sportFilters.priceRange === "under10" && p > 10000) return false;
        if (sportFilters.priceRange === "10to20" && (p < 10000 || p > 20000)) return false;
        if (sportFilters.priceRange === "above20" && p < 20000) return false;
      }
      return true;
    });
  }, [items, currentCity, sportFilters]);

  const toggleFavorite = (id: number) => {
    hapticSelection();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openBooking = (hall: ItemEntity) => {
    hapticSelection();
    setSelectedHall(hall);
  };

  const confirmBooking = () => {
    if (!selectedHall) return;
    hapticSuccess();
    const hallTitle = selectedHall.title;
    setSelectedHall(null);
    Alert.alert(
      "Бронь оформлена! 🎉",
      `Вы успешно забронировали "${hallTitle}" на ${selectedDate} в слот ${selectedSlot}. Ждем вас!`,
      [{ text: "Отлично" }],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHalls();
            }}
            tintColor="#22C55E"
          />
        }
      >
        {/* --- 1. HEADER: Logo + Location --- */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image
              source={require("@/assets/logo.png")}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>
              Alan <Text style={styles.logoTextRed}>Go</Text>
            </Text>
          </View>

          <Pressable
            style={styles.locationPill}
            onPress={() => {
              hapticSelection();
              setCityModalVisible(true);
            }}
          >
            <Ionicons name="location-sharp" size={15} color="#22C55E" />
            <Text style={styles.locationText}>{currentCity}</Text>
            <Ionicons name="chevron-down" size={13} color="#8E9B94" />
          </Pressable>
        </View>

        {/* --- 1.5 LIVE ACTIVITY DYNAMIC ISLAND --- */}
        <LiveMatchIsland />

        {/* --- 2. HERO BANNER --- */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              Арендуйте{"\n"}
              спортивные{"\n"}
              <Text style={styles.heroTitleGreen}>залы</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Футбол, теннис, баскетбол{"\n"}и многое другое
            </Text>
          </View>

          <View style={styles.heroRight}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&q=80",
              }}
              style={styles.heroBallImage}
            />
          </View>
        </View>

        {/* --- 2.5 SPECIAL DEALS: Subscriptions & Happy Hours --- */}
        <View style={styles.promoActionsRow}>
          <Pressable
            style={styles.promoActionCard}
            onPress={() => {
              hapticSelection();
              router.push("/subscriptions");
            }}
          >
            <View style={styles.promoActionIconWrap}>
              <Ionicons name="ticket" size={20} color="#10b981" />
            </View>
            <View style={styles.promoActionTextWrap}>
              <Text style={styles.promoActionTitle}>Абонементы и Пакеты игр</Text>
              <Text style={styles.promoActionSub}>Экономия до 25% на каждом посещении</Text>
            </View>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>-25%</Text>
            </View>
          </Pressable>
        </View>

        {/* --- 3. SEARCH BAR + FILTERS --- */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#6B7C72" style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск залов..."
              placeholderTextColor="#6B7C72"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="#6B7C72" />
              </Pressable>
            )}
          </View>
          <Pressable
            style={[
              styles.filterBtn,
              activeFiltersCount > 0 && styles.filterBtnActive,
            ]}
            onPress={() => {
              hapticSelection();
              setFilterModalVisible(true);
            }}
          >
            <Ionicons
              name={activeFiltersCount > 0 ? "options" : "options-outline"}
              size={20}
              color={activeFiltersCount > 0 ? "#0B0F0D" : "#22C55E"}
            />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* --- 4. CATEGORIES ROW --- */}
        <View style={styles.categoriesRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  hapticSelection();
                  setSelectedCategory(isSelected ? "all" : cat.id);
                }}
                style={styles.categoryItem}
              >
                <View
                  style={[
                    styles.categoryCircle,
                    {
                      backgroundColor: cat.bgColor,
                      borderColor: isSelected ? cat.color : cat.borderColor,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && { color: "#FFFFFF", fontWeight: "700" },
                  ]}
                  numberOfLines={2}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* --- 4.5 SECTION: Спорткомплексы и Арены --- */}
        {filteredArenas.length > 0 ? (
          <View style={styles.arenasSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Спорткомплексы и арены</Text>
                <Text style={styles.sectionSubtitle}>
                  {currentCity ? `Площадки в г. ${currentCity}` : "Спортивные центры с арендой залов"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  hapticSelection();
                  router.push("/(tabs)/items");
                }}
                hitSlop={10}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>Все ({filteredArenas.length})</Text>
                <Ionicons name="chevron-forward" size={14} color="#22C55E" />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.arenasScroll}
            >
              {filteredArenas.map((arena) => (
                <Pressable
                  key={arena.id}
                  style={styles.homeArenaCard}
                  onPress={() => {
                    hapticSelection();
                    router.push(`/arena/${arena.id}`);
                  }}
                >
                  <View style={styles.homeArenaImageWrap}>
                    <Image source={{ uri: arena.imageUrl }} style={styles.homeArenaImage} />
                    <View style={styles.homeArenaBadge}>
                      <Ionicons name="business" size={11} color="#22C55E" />
                      <Text style={styles.homeArenaBadgeText}>
                        {arena.category || "Спорткомплекс"}
                      </Text>
                    </View>
                    <View style={styles.homeArenaRating}>
                      <Ionicons name="star" size={11} color="#22C55E" />
                      <Text style={styles.homeArenaRatingText}>{arena.rating}</Text>
                    </View>
                  </View>

                  <View style={styles.homeArenaBody}>
                    <Text style={styles.homeArenaTitle} numberOfLines={1}>
                      {arena.title}
                    </Text>
                    <View style={styles.homeArenaLocationRow}>
                      <Ionicons name="location-sharp" size={12} color="#22C55E" />
                      <Text style={styles.homeArenaLocationText} numberOfLines={1}>
                        {arena.address}
                      </Text>
                    </View>

                    <View style={styles.homeArenaSportsRow}>
                      {arena.availableSports.slice(0, 3).map((sp) => (
                        <View key={sp} style={styles.homeArenaSportPill}>
                          <Text style={styles.homeArenaSportText}>{sp}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.homeArenaFooter}>
                      <Text style={styles.homeArenaHallsCount}>
                        {arena.hallsCount} {arena.hallsCount === 1 ? "зал" : "зала"}
                      </Text>
                      <Text style={styles.homeArenaPrice}>
                        от {arena.minPrice.toLocaleString("ru-RU")} ₸
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyFilteredBox}>
            <Ionicons name="football-outline" size={32} color="#38433D" />
            <Text style={styles.emptyFilteredTitle}>Площадки не найдены</Text>
            <Text style={styles.emptyFilteredText}>
              В г. {currentCity} нет доступных площадок с выбранными параметрами.
            </Text>
            {(activeFiltersCount > 0 || selectedCategory !== "all" || searchQuery.length > 0) && (
              <Pressable
                style={styles.resetFiltersBtn}
                onPress={() => {
                  hapticSelection();
                  setSportFilters(DEFAULT_FILTERS);
                  setSelectedCategory("all");
                  setSearchQuery("");
                }}
              >
                <Text style={styles.resetFiltersBtnText}>Сбросить фильтры</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* --- 5. SECTION: Популярные залы --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Популярные залы</Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              router.push("/(tabs)/items");
            }}
            hitSlop={10}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Все залы</Text>
            <Ionicons name="chevron-forward" size={14} color="#22C55E" />
          </Pressable>
        </View>

        {/* Grid of Halls */}
        <View style={styles.hallsGrid}>
          {filteredItems.map((hall) => {
            const isFav = !!favorites[hall.id];
            const rating = hall.metadata?.rating || 4.8;
            const reviewsCount = hall.metadata?.reviewsCount || 120;
            const location = hall.metadata?.location || "Астана, ул. Достык 10";

            return (
              <Pressable
                key={hall.id}
                style={styles.hallCard}
                onPress={() => {
                  hapticSelection();
                  router.push(`/hall/${hall.id}`);
                }}
              >
                {/* Image Container with Badges */}
                <View style={styles.hallImageWrap}>
                  <Image source={{ uri: hall.image_url }} style={styles.hallImage} />

                  {/* Favorite button */}
                  <Pressable
                    style={styles.favBtn}
                    onPress={() => toggleFavorite(hall.id)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={isFav ? "heart" : "heart-outline"}
                      size={18}
                      color={isFav ? "#EF4444" : "#FFFFFF"}
                    />
                  </Pressable>

                  {/* Rating Badge */}
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#22C55E" />
                    <Text style={styles.ratingScore}>{rating}</Text>
                    <Text style={styles.ratingCount}>({reviewsCount})</Text>
                  </View>
                </View>

                {/* Hall Details */}
                <View style={styles.hallInfo}>
                  <Text style={styles.hallTitle} numberOfLines={1}>
                    {hall.title}
                  </Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color="#8E9B94" />
                    <Text style={styles.hallLocation} numberOfLines={1}>
                      {location}
                    </Text>
                  </View>

                  {/* Price & Action Button */}
                  <View style={styles.hallBottomRow}>
                    <View>
                      <Text style={styles.pricePrefix}>
                        от{" "}
                        <Text style={styles.priceNumber}>
                          {(hall.price || 15000).toLocaleString("ru-RU")} ₸
                        </Text>
                      </Text>
                      <Text style={styles.priceUnit}>/ час</Text>
                    </View>

                    <Pressable
                      style={styles.arrowBtn}
                      onPress={() => openBooking(hall)}
                    >
                      <Ionicons name="arrow-forward" size={16} color="#0B0F0D" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* --- 6. PROMO BANNER: Спортивные события --- */}
        <Pressable
          style={styles.eventsBanner}
          onPress={() => {
            hapticSelection();
            router.push("/(tabs)/events");
          }}
        >
          <View style={styles.eventsTrophyWrap}>
            <Ionicons name="trophy-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={styles.eventsTextWrap}>
            <Text style={styles.eventsTitle}>Спортивные события</Text>
            <Text style={styles.eventsSubtitle}>Турниры, матчи и многое другое</Text>
          </View>

          <Pressable
            style={styles.eventsActionBtn}
            onPress={() => {
              hapticSelection();
              router.push("/(tabs)/events");
            }}
          >
            <Text style={styles.eventsActionBtnText}>Узнать больше</Text>
          </Pressable>
        </Pressable>
      </ScrollView>

      {/* --- BOOKING MODAL --- */}
      <Modal
        visible={!!selectedHall}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedHall(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedHall(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedHall?.title}</Text>
                <Text style={styles.modalSubtitle}>
                  📍 {selectedHall?.metadata?.location || "г. Астана"}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedHall(null)}
                style={styles.modalCloseBtn}
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

            {/* Price Summary & Book button */}
            <View style={styles.modalFooter}>
              <View>
                <Text style={styles.modalTotalLabel}>Итого к оплате:</Text>
                <Text style={styles.modalTotalPrice}>
                  {(selectedHall?.price || 15000).toLocaleString("ru-RU")} ₸
                </Text>
              </View>
              <Pressable style={styles.modalBookBtn} onPress={confirmBooking}>
                <Text style={styles.modalBookBtnText}>Забронировать зал</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* City Picker Modal */}
      <CityPickerModal
        visible={cityModalVisible}
        selectedCity={currentCity}
        onClose={() => setCityModalVisible(false)}
        onSelect={(city) => setCurrentCity(city)}
      />

      {/* Sport Search Filters Modal */}
      <SportSearchFiltersModal
        visible={filterModalVisible}
        filters={sportFilters}
        matchedCount={filteredArenas.length}
        onClose={() => setFilterModalVisible(false)}
        onApply={(newFilters) => setSportFilters(newFilters)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 30,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  logoTextRed: {
    color: "#EF4444",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Hero Card
  heroCard: {
    backgroundColor: "#111814",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1E2B22",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    marginBottom: 16,
    overflow: "hidden",
    minHeight: 145,
  },
  heroLeft: {
    flex: 1,
    paddingVertical: 18,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroTitleGreen: {
    color: "#22C55E",
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#8E9B94",
    marginTop: 8,
  },
  heroRight: {
    width: 140,
    height: 145,
    justifyContent: "center",
    alignItems: "center",
  },
  heroBallImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    transform: [{ rotate: "15deg" }],
  },

  // Search Bar & Filter Row
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    height: 50,
    backgroundColor: "#141A17",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2823",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#FFFFFF",
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#141A17",
    borderWidth: 1,
    borderColor: "#1F2823",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBtnActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0B0F0D",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyFilteredBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#111714",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1B241F",
    marginVertical: 14,
    gap: 8,
  },
  emptyFilteredTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyFilteredText: {
    color: "#8E9B94",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  resetFiltersBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  resetFiltersBtnText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "600",
  },

  // Categories
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  categoryItem: {
    alignItems: "center",
    width: (width - 32) / 6,
  },
  categoryCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 11,
    lineHeight: 13,
    color: "#8E9B94",
    textAlign: "center",
    fontWeight: "500",
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22C55E",
  },

  // Arenas Section
  arenasSection: {
    marginBottom: 24,
  },
  arenasScroll: {
    gap: 14,
    paddingRight: 16,
  },
  homeArenaCard: {
    width: 250,
    backgroundColor: "#131915",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1E2A22",
    overflow: "hidden",
  },
  homeArenaImageWrap: {
    width: "100%",
    height: 130,
    position: "relative",
  },
  homeArenaImage: {
    width: "100%",
    height: "100%",
  },
  homeArenaBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(11, 15, 13, 0.85)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  homeArenaBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#22C55E",
  },
  homeArenaRating: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(11, 15, 13, 0.85)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  homeArenaRatingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  homeArenaBody: {
    padding: 12,
  },
  homeArenaTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  homeArenaLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  homeArenaLocationText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  homeArenaSportsRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 10,
  },
  homeArenaSportPill: {
    backgroundColor: "#1A241E",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  homeArenaSportText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#22C55E",
  },
  homeArenaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1B241E",
  },
  homeArenaHallsCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E9B94",
  },
  homeArenaPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#22C55E",
  },

  // Halls Grid
  hallsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  hallCard: {
    width: CARD_WIDTH,
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
    overflow: "hidden",
  },
  hallImageWrap: {
    width: "100%",
    height: 125,
    position: "relative",
  },
  hallImage: {
    width: "100%",
    height: "100%",
  },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(11, 15, 13, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(11, 15, 13, 0.8)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  ratingScore: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  ratingCount: {
    fontSize: 10,
    color: "#8E9B94",
  },
  hallInfo: {
    padding: 12,
  },
  hallTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 10,
  },
  hallLocation: {
    fontSize: 11,
    color: "#8E9B94",
    flex: 1,
  },
  hallBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pricePrefix: {
    fontSize: 10,
    color: "#8E9B94",
  },
  priceNumber: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  priceUnit: {
    fontSize: 10,
    color: "#6B7C72",
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },

  // Events Banner
  eventsBanner: {
    backgroundColor: "#161A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2D1D20",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  eventsTrophyWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventsTextWrap: {
    flex: 1,
  },
  eventsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eventsSubtitle: {
    fontSize: 11,
    color: "#9E8C8E",
    marginTop: 2,
  },
  eventsActionBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  eventsActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Modal
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
    borderTopWidth: 1,
    borderTopColor: "#1F2B22",
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1F2B22",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E9B94",
    marginBottom: 10,
    marginTop: 8,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#1B241F",
    borderWidth: 1,
    borderColor: "#28372D",
  },
  slotChipActive: {
    backgroundColor: "#142A1D",
    borderColor: "#22C55E",
  },
  slotChipText: {
    fontSize: 13,
    color: "#8E9B94",
    fontWeight: "500",
  },
  slotChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1F2B22",
  },
  modalTotalLabel: {
    fontSize: 11,
    color: "#8E9B94",
  },
  modalTotalPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalBookBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  modalBookBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  promoActionsRow: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  promoActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13231a",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e3d2a",
    gap: 12,
  },
  promoActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#064e3b",
    alignItems: "center",
    justifyContent: "center",
  },
  promoActionTextWrap: {
    flex: 1,
  },
  promoActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  promoActionSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  promoBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoBadgeText: {
    color: "#052e16",
    fontSize: 12,
    fontWeight: "800",
  },
});
