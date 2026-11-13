import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listPublicItems, ItemEntity } from "@/lib/items";
import { ArenaWithHalls, getArenasWithHalls } from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getSelectedCity, subscribeCityChange } from "@/lib/cities";
import { CityPickerModal } from "@/components/CityPickerModal";
import { LiveMatchIsland } from "@/components/LiveMatchIsland";
import {
  SportSearchFiltersModal,
  SportFilterState,
  DEFAULT_FILTERS,
} from "@/components/SportSearchFiltersModal";
import { colors, radii, spacing, typography } from "@/constants/theme";

const { width } = Dimensions.get("window");
const FAVORITES_STORAGE_KEY = "alango_user_favorites";

type CategoryItem = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CATEGORIES: CategoryItem[] = [
  { id: "all", name: "Все", icon: "grid-outline" },
  { id: "Футбол", name: "Футбол", icon: "football-outline" },
  { id: "Теннис", name: "Теннис", icon: "tennisball-outline" },
  { id: "Баскетбол", name: "Баскетбол", icon: "basketball-outline" },
  { id: "Сквош и падл", name: "Падл", icon: "fitness-outline" },
  { id: "Волейбол", name: "Волейбол", icon: "baseball-outline" },
];

export default function HomeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [favorites, setFavorites] = useState<number[]>([]);

  // City & Sport Filters State
  const [currentCity, setCurrentCity] = useState("Астана");
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sportFilters, setSportFilters] = useState<SportFilterState>(DEFAULT_FILTERS);

  // Quick Booking Modal State
  const [selectedHall, setSelectedHall] = useState<ItemEntity | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("19:00 - 20:00");
  const [selectedDate, setSelectedDate] = useState<string>("Сегодня");

  useEffect(() => {
    getSelectedCity().then(setCurrentCity);
    const unsubscribe = subscribeCityChange((city) => {
      setCurrentCity(city);
    });
    // Load favorites from local storage
    AsyncStorage.getItem(FAVORITES_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setFavorites(JSON.parse(data));
        } catch {}
      }
    });
    return unsubscribe;
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count =
      sportFilters.sports.length +
      sportFilters.surfaces.length +
      sportFilters.amenities.length;
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
      if (
        currentCity &&
        arena.city &&
        arena.city.toLowerCase() !== currentCity.toLowerCase()
      ) {
        return false;
      }
      // 2. Category match (from quick horizontal icons)
      if (selectedCategory !== "all") {
        const matchesCategory =
          arena.availableSports?.some((s) =>
            s.toLowerCase().includes(selectedCategory.toLowerCase())
          ) ||
          arena.category
            ?.toLowerCase()
            .includes(selectedCategory.toLowerCase());
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
          arena.availableSports?.some((s) =>
            s.toLowerCase().includes(sp.toLowerCase())
          )
        );
        if (!matchesSport) return false;
      }
      // 5. SportFilterState: priceRange
      if (sportFilters.priceRange !== "all") {
        if (sportFilters.priceRange === "under10" && arena.minPrice > 10000)
          return false;
        if (
          sportFilters.priceRange === "10to20" &&
          (arena.minPrice < 10000 || arena.minPrice > 20000)
        )
          return false;
        if (sportFilters.priceRange === "above20" && arena.minPrice < 20000)
          return false;
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
      const itemCity =
        item.metadata?.city ||
        (item.metadata?.location ? String(item.metadata.location) : "");
      if (
        currentCity &&
        itemCity &&
        !itemCity.toLowerCase().includes(currentCity.toLowerCase())
      ) {
        return false;
      }
      if (sportFilters.sports.length > 0) {
        const matchesSport = sportFilters.sports.some((sp) =>
          item.category?.toLowerCase().includes(sp.toLowerCase())
        );
        if (!matchesSport) return false;
      }
      if (sportFilters.priceRange !== "all") {
        const p = item.price || 0;
        if (sportFilters.priceRange === "under10" && p > 10000) return false;
        if (
          sportFilters.priceRange === "10to20" &&
          (p < 10000 || p > 20000)
        )
          return false;
        if (sportFilters.priceRange === "above20" && p < 20000) return false;
      }
      return true;
    });
  }, [items, currentCity, sportFilters]);

  const toggleFavorite = async (id: number) => {
    hapticSelection();
    const nextFavs = favorites.includes(id)
      ? favorites.filter((favId) => favId !== id)
      : [...favorites, id];
    setFavorites(nextFavs);
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavs));
  };

  const confirmBooking = () => {
    if (!selectedHall) return;
    hapticSuccess();
    const hallTitle = selectedHall.title;
    setSelectedHall(null);
    Alert.alert(
      "Бронь оформлена! 🎉",
      `Вы успешно забронировали "${hallTitle}" на ${selectedDate} в слот ${selectedSlot}. Ждем вас!`,
      [{ text: "Отлично" }]
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
            tintColor={colors.primary}
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
              Alan <Text style={styles.logoTextAccent}>Go</Text>
            </Text>
          </View>

          <Pressable
            style={styles.locationPill}
            onPress={() => {
              hapticSelection();
              setCityModalVisible(true);
            }}
          >
            <Ionicons name="location-sharp" size={14} color={colors.primary} />
            <Text style={styles.locationText}>{currentCity}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
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
              <Text style={styles.heroTitlePrimary}>залы</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Футбол, теннис, баскетбол и многое другое
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

        {/* --- 3. SEARCH BAR + FILTERS + MAP --- */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск залов и площадок..."
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            )}
          </View>

          <Pressable
            style={styles.mapBtn}
            onPress={() => {
              hapticSelection();
              router.push("/map");
            }}
          >
            <Ionicons name="map-outline" size={20} color={colors.primary} />
          </Pressable>

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
              color={activeFiltersCount > 0 ? colors.background : colors.primary}
            />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* --- 3.5 NEARBY VENUES MAP BANNER --- */}
        <Pressable
          style={styles.mapBannerCard}
          onPress={() => {
            hapticSelection();
            router.push("/map");
          }}
        >
          <View style={styles.mapBannerLeft}>
            <View style={styles.mapBannerIconWrap}>
              <Ionicons name="location" size={20} color={colors.primary} />
            </View>
            <View style={styles.mapBannerTextWrap}>
              <View style={styles.mapBannerTitleRow}>
                <Text style={styles.mapBannerTitle}>Залы рядом на карте</Text>
                <View style={styles.livePulseDot} />
              </View>
              <Text style={styles.mapBannerSub}>
                Интерактивная карта площадок, кортов и цены в г. {currentCity}
              </Text>
            </View>
          </View>
          <View style={styles.mapBannerArrowBtn}>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
        </Pressable>

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
                    styles.categorySquircle,
                    isSelected && styles.categorySquircleSelected,
                  ]}
                >
                  <Ionicons
                    name={cat.icon}
                    size={22}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && styles.categoryLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* --- 4.5 SECTION: Спорткомплексы и Арены --- */}
        {filteredArenas.length > 0 ? (
          <View style={styles.sectionContainer}>
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
                  router.push({ pathname: "/arenas", params: selectedCategory !== "all" ? { sport: selectedCategory } : {} });
                }}
                hitSlop={10}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>Все ({filteredArenas.length})</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
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
                  style={styles.arenaCard}
                  onPress={() => {
                    hapticSelection();
                    router.push(`/arena/${arena.id}`);
                  }}
                >
                  <View style={styles.arenaImageWrap}>
                    <Image
                      source={{ uri: arena.imageUrl }}
                      style={styles.arenaImage}
                    />
                    <View style={styles.arenaBadge}>
                      <Ionicons name="business" size={11} color={colors.primary} />
                      <Text style={styles.arenaBadgeText}>
                        {arena.category || "Спорткомплекс"}
                      </Text>
                    </View>
                    <View style={styles.arenaRating}>
                      <Ionicons name="star" size={11} color={colors.primary} />
                      <Text style={styles.arenaRatingText}>{arena.rating}</Text>
                    </View>
                  </View>

                  <View style={styles.arenaBody}>
                    <Text style={styles.arenaTitle} numberOfLines={1}>
                      {arena.title}
                    </Text>
                    <View style={styles.arenaLocationRow}>
                      <Ionicons
                        name="location-sharp"
                        size={12}
                        color={colors.primary}
                      />
                      <Text style={styles.arenaLocationText} numberOfLines={1}>
                        {arena.address}
                      </Text>
                    </View>

                    <View style={styles.arenaSportsRow}>
                      {arena.availableSports.slice(0, 3).map((sp) => (
                        <View key={sp} style={styles.arenaSportPill}>
                          <Text style={styles.arenaSportText}>{sp}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.arenaFooter}>
                      <Text style={styles.arenaHallsCount}>
                        {arena.hallsCount} {arena.hallsCount === 1 ? "зал" : "зала"}
                      </Text>
                      <Text style={styles.arenaPrice}>
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
            <Ionicons name="football-outline" size={32} color={colors.border} />
            <Text style={styles.emptyFilteredTitle}>Площадки не найдены</Text>
            <Text style={styles.emptyFilteredText}>
              В г. {currentCity} нет доступных площадок с выбранными параметрами.
            </Text>
            {(activeFiltersCount > 0 ||
              selectedCategory !== "all" ||
              searchQuery.length > 0) && (
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

        {/* --- 5. SECTION: Популярные залы (VenueCards) --- */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Популярные залы</Text>
              <Text style={styles.sectionSubtitle}>
                Топ площадок с проверенными отзывами
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
              <Text style={styles.seeAllText}>Все залы</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.popularGrid}>
            {filteredItems.slice(0, 4).map((hall) => {
              const isFav = favorites.includes(hall.id);
              return (
                <Pressable
                  key={hall.id}
                  style={({ pressed }) => [styles.popularTile, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    hapticSelection();
                    router.push(`/hall/${hall.id}`);
                  }}
                >
                  {hall.image_url ? (
                    <Image source={{ uri: hall.image_url }} style={styles.popularImage} />
                  ) : (
                    <View style={[styles.popularImage, styles.popularImageEmpty]}>
                      <Ionicons name="layers-outline" size={22} color={colors.textSecondary} />
                    </View>
                  )}
                  <Pressable
                    style={styles.popularFav}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      hapticImpact();
                      toggleFavorite(hall.id);
                    }}
                  >
                    <Ionicons
                      name={isFav ? "heart" : "heart-outline"}
                      size={14}
                      color={isFav ? colors.accent : colors.textPrimary}
                    />
                  </Pressable>
                  <View style={styles.popularBody}>
                    <Text style={styles.popularTitle} numberOfLines={1}>
                      {hall.title}
                    </Text>
                    <Text style={styles.popularMeta} numberOfLines={1}>
                      {hall.category || "Спорт"}
                    </Text>
                    {hall.price ? (
                      <Text style={styles.popularPrice}>
                        {Number(hall.price).toLocaleString("ru-RU")} ₸<Text style={styles.popularMeta}> / час</Text>
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
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
            <Ionicons name="trophy-outline" size={26} color={colors.primary} />
          </View>

          <View style={styles.eventsTextWrap}>
            <Text style={styles.eventsTitle}>Спортивные события</Text>
            <Text style={styles.eventsSubtitle}>
              Турниры, открытые матчи и поиск команды
            </Text>
          </View>

          <View style={styles.eventsActionBtn}>
            <Text style={styles.eventsActionBtnText}>Смотреть</Text>
          </View>
        </Pressable>

        {/* --- 7. SUBSCRIPTIONS & GAME PACKS (bottom) --- */}
        <Pressable
          style={[styles.promoActionCard, { marginTop: spacing.card }]}
          onPress={() => {
            hapticSelection();
            router.push("/subscriptions");
          }}
        >
          <View style={styles.promoActionIconWrap}>
            <Ionicons name="ticket" size={20} color={colors.primary} />
          </View>
          <View style={styles.promoActionTextWrap}>
            <Text style={styles.promoActionTitle}>Абонементы и Пакеты игр</Text>
            <Text style={styles.promoActionSub}>
              Экономия до 25% на регулярных посещениях
            </Text>
          </View>
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>-25%</Text>
          </View>
        </Pressable>

      </ScrollView>

      {/* --- QUICK BOOKING MODAL --- */}
      <Modal
        visible={!!selectedHall}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedHall(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedHall(null)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedHall?.title}
                </Text>
                <Text style={styles.modalSubtitle}>
                  📍 {selectedHall?.metadata?.location || currentCity}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedHall(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
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
              {[
                "17:00 - 18:00",
                "19:00 - 20:00",
                "20:00 - 21:00",
                "21:00 - 22:00",
              ].map((s) => (
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

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <View>
                <Text style={styles.modalTotalLabel}>Стоимость брони</Text>
                <Text style={styles.modalTotalPrice}>
                  {(selectedHall?.price || 15000).toLocaleString("ru-RU")} ₸
                </Text>
              </View>
              <Pressable
                style={styles.modalBookBtn}
                onPress={confirmBooking}
              >
                <Text style={styles.modalBookBtnText}>Забронировать</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- CITY PICKER MODAL --- */}
      <CityPickerModal
        visible={cityModalVisible}
        selectedCity={currentCity}
        onSelect={(city: string) => {
          setCurrentCity(city);
          setCityModalVisible(false);
        }}
        onClose={() => setCityModalVisible(false)}
      />

      {/* --- SPORT FILTERS MODAL --- */}
      <SportSearchFiltersModal
        visible={filterModalVisible}
        filters={sportFilters}
        matchedCount={filteredArenas.length}
        onApply={(f: SportFilterState) => {
          setSportFilters(f);
          setFilterModalVisible(false);
        }}
        onClose={() => setFilterModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  popularGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.card,
  },
  popularTile: {
    width: "48.3%",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  popularImage: {
    width: "100%",
    height: 96,
  },
  popularImageEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  popularFav: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  popularBody: {
    padding: spacing.sm + 2,
    gap: 2,
  },
  popularTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  popularMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  popularPrice: {
    ...typography.body,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background, // #080D0B
  },
  scrollContent: {
    paddingHorizontal: spacing.screenHorizontal, // 16px
    paddingBottom: spacing.bottomScrollPadding, // 110px
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoIcon: {
    width: 32,
    height: 30,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  logoTextAccent: {
    color: colors.accent, // #F04452
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.smallChip, // 12px
  },
  locationText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  // Hero Card
  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card, // 18px
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.card,
    overflow: "hidden",
    minHeight: 140,
  },
  heroLeft: {
    flex: 1,
    paddingVertical: spacing.lg,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  heroTitlePrimary: {
    color: colors.primary, // #00C968
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs + 2,
  },
  heroRight: {
    width: 135,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  heroBallImage: {
    width: 125,
    height: 125,
    borderRadius: 62.5,
    transform: [{ rotate: "15deg" }],
  },

  // Promo Actions Card
  promoActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.card, // 18px
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    marginBottom: spacing.card,
  },
  promoActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.smallChip,
    backgroundColor: "rgba(0, 201, 104, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  promoActionTextWrap: {
    flex: 1,
  },
  promoActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  promoActionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  promoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoBadgeText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "800",
  },

  // Search Bar & Filter Row
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginBottom: spacing.card,
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: radii.button, // 14px
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  mapBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.button, // 14px
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.button, // 14px
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  filterBadgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: "700",
  },

  // Nearby Venues Map Banner
  mapBannerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card, // 18px
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.section, // 20px
  },
  mapBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
    paddingRight: spacing.sm,
  },
  mapBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.smallChip,
    backgroundColor: "rgba(0, 201, 104, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 201, 104, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapBannerTextWrap: {
    flex: 1,
  },
  mapBannerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  mapBannerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mapBannerArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(0, 201, 104, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Categories Row
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.section, // 20px
  },
  categoryItem: {
    alignItems: "center",
    width: (width - 32) / 6,
  },
  categorySquircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categorySquircleSelected: {
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  categoryLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "500",
  },
  categoryLabelSelected: {
    color: colors.textPrimary,
    fontWeight: "700",
  },

  // Section Standard
  sectionContainer: {
    marginBottom: spacing.section, // 20px
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  // Arenas Scroll
  arenasScroll: {
    gap: spacing.card, // 12px
    paddingRight: spacing.screenHorizontal,
  },
  arenaCard: {
    width: 250,
    backgroundColor: colors.surface,
    borderRadius: radii.card, // 18px
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  arenaImageWrap: {
    width: "100%",
    height: 128,
    position: "relative",
  },
  arenaImage: {
    width: "100%",
    height: "100%",
  },
  arenaBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(8, 13, 11, 0.85)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 201, 104, 0.3)",
  },
  arenaBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  arenaRating: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(8, 13, 11, 0.85)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  arenaRatingText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  arenaBody: {
    padding: spacing.md,
  },
  arenaTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  arenaLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  arenaLocationText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  arenaSportsRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 10,
  },
  arenaSportPill: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  arenaSportText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primary,
  },
  arenaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  arenaHallsCount: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  arenaPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },

  // Halls List (VenueCards vertical layout)
  hallsList: {
    gap: spacing.card, // 12px
  },

  // Empty Box
  emptyFilteredBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyFilteredTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyFilteredText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  resetFiltersBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.smallChip,
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resetFiltersBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  // Events Banner
  eventsBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card, // 18px
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  eventsTrophyWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 201, 104, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventsTextWrap: {
    flex: 1,
  },
  eventsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  eventsSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  eventsActionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.button,
  },
  eventsActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.background,
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
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.modal, // 24px
    borderTopRightRadius: radii.modal, // 24px
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.smallChip, // 12px
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipActive: {
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderColor: colors.primary,
  },
  slotChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  slotChipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalTotalLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  modalTotalPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  modalBookBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.button, // 14px
  },
  modalBookBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.background,
  },
});
