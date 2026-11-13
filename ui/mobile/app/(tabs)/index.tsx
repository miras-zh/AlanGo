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
import { formatNumber, useT, type MessageKey } from "@/lib/i18n";
import { categoryLabel, cityLabel, dayMonth, sportLabel, weekdayShort } from "@/lib/dataLabels";
import { CityPickerModal } from "@/components/CityPickerModal";
import { LiveMatchIsland } from "@/components/LiveMatchIsland";
import { HomeBannerSlider } from "@/components/HomeBannerSlider";
import {
  SportSearchFiltersModal,
  SportFilterState,
  DEFAULT_FILTERS,
} from "@/components/SportSearchFiltersModal";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const { width } = Dimensions.get("window");
const FAVORITES_STORAGE_KEY = "alango_user_favorites";

type CategoryItem = {
  id: string;
  name: MessageKey;
  icon: keyof typeof Ionicons.glyphMap;
};

const CATEGORIES: CategoryItem[] = [
  { id: "all", name: "sport.all", icon: "grid-outline" },
  { id: "Футбол", name: "sport.football", icon: "football-outline" },
  { id: "Теннис", name: "sport.tennis", icon: "tennisball-outline" },
  { id: "Баскетбол", name: "sport.basketball", icon: "basketball-outline" },
  { id: "Сквош и падл", name: "sport.padel", icon: "fitness-outline" },
  { id: "Волейбол", name: "sport.volleyball", icon: "baseball-outline" },
];

export default function HomeScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
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
  // Day offset from today in the quick-booking modal.
  const [selectedDate, setSelectedDate] = useState<number>(0);

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

  const dayOptionLabel = (offset: number) => {
    if (offset === 0) return t("date.today");
    if (offset === 1) return t("date.tomorrow");
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${weekdayShort(d.getDay(), t)}, ${dayMonth(d, t)}`;
  };

  const confirmBooking = () => {
    if (!selectedHall) return;
    hapticSuccess();
    const hallTitle = selectedHall.title;
    setSelectedHall(null);
    Alert.alert(
      t("home.bookedTitle"),
      t("home.bookedText", { hall: hallTitle, date: dayOptionLabel(selectedDate), slot: selectedSlot }),
      [{ text: t("home.great") }]
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
            tintColor={c.primary}
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
            <Ionicons name="location-sharp" size={14} color={c.primary} />
            <Text style={styles.locationText}>{cityLabel(currentCity, t)}</Text>
            <Ionicons name="chevron-down" size={13} color={c.textSecondary} />
          </Pressable>
        </View>

        {/* --- 1.5 LIVE ACTIVITY DYNAMIC ISLAND --- */}
        <LiveMatchIsland />

        {/* --- 2. HERO BANNER --- */}
        <HomeBannerSlider />

        {/* --- 3. SEARCH BAR + FILTERS + MAP --- */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={18}
              color={c.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("home.searchPlaceholder")}
              placeholderTextColor={c.textSecondary}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={c.textSecondary}
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
            <Ionicons name="map-outline" size={20} color={c.primary} />
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
              color={activeFiltersCount > 0 ? c.background : c.primary}
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
              <Ionicons name="location" size={20} color={c.primary} />
            </View>
            <View style={styles.mapBannerTextWrap}>
              <View style={styles.mapBannerTitleRow}>
                <Text style={styles.mapBannerTitle}>{t("home.mapTitle")}</Text>
                <View style={styles.livePulseDot} />
              </View>
              <Text style={styles.mapBannerSub}>
                {t("home.mapSubtitle", { city: cityLabel(currentCity, t) })}
              </Text>
            </View>
          </View>
          <View style={styles.mapBannerArrowBtn}>
            <Ionicons name="chevron-forward" size={16} color={c.primary} />
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
                    color={isSelected ? c.primary : c.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && styles.categoryLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {t(cat.name)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* --- 4.5 SECTION: Спорткомплексы и Арены --- */}
        {filteredArenas.length > 0 ? (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{t("home.arenasTitle")}</Text>
                <Text style={styles.sectionSubtitle}>
                  {currentCity ? t("home.arenasInCity", { city: cityLabel(currentCity, t) }) : t("home.arenasSubtitle")}
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
                <Text style={styles.seeAllText}>{t("home.allCount", { n: filteredArenas.length })}</Text>
                <Ionicons name="chevron-forward" size={14} color={c.primary} />
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
                      <Ionicons name="business" size={11} color={c.primary} />
                      <Text style={styles.arenaBadgeText}>
                        {categoryLabel(arena.category || "Спорткомплекс", t)}
                      </Text>
                    </View>
                    <View style={styles.arenaRating}>
                      <Ionicons name="star" size={11} color={c.primary} />
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
                        color={c.primary}
                      />
                      <Text style={styles.arenaLocationText} numberOfLines={1}>
                        {arena.address}
                      </Text>
                    </View>

                    <View style={styles.arenaSportsRow}>
                      {arena.availableSports.slice(0, 3).map((sp) => (
                        <View key={sp} style={styles.arenaSportPill}>
                          <Text style={styles.arenaSportText}>{sportLabel(sp, t)}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.arenaFooter}>
                      <Text style={styles.arenaHallsCount}>
                        {t("common.hallsCount", { count: arena.hallsCount })}
                      </Text>
                      <Text style={styles.arenaPrice}>
                        {t("common.priceFrom", { price: formatNumber(arena.minPrice) })}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyFilteredBox}>
            <Ionicons name="football-outline" size={32} color={c.border} />
            <Text style={styles.emptyFilteredTitle}>{t("home.emptyTitle")}</Text>
            <Text style={styles.emptyFilteredText}>
              {t("home.emptyText", { city: cityLabel(currentCity, t) })}
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
                <Text style={styles.resetFiltersBtnText}>{t("common.resetFilters")}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* --- 5. SECTION: Популярные залы (VenueCards) --- */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{t("home.popularTitle")}</Text>
              <Text style={styles.sectionSubtitle}>
                {t("home.popularSubtitle")}
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
              <Text style={styles.seeAllText}>{t("home.allHalls")}</Text>
              <Ionicons name="chevron-forward" size={14} color={c.primary} />
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
                      <Ionicons name="layers-outline" size={22} color={c.textSecondary} />
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
                      color={isFav ? c.accent : c.textPrimary}
                    />
                  </Pressable>
                  <View style={styles.popularBody}>
                    <Text style={styles.popularTitle} numberOfLines={1}>
                      {hall.title}
                    </Text>
                    <Text style={styles.popularMeta} numberOfLines={1}>
                      {hall.category ? sportLabel(hall.category, t) : t("home.sportFallback")}
                    </Text>
                    {hall.price ? (
                      <Text style={styles.popularPrice}>
                        {formatNumber(Number(hall.price))} ₸<Text style={styles.popularMeta}> {t("common.perHour")}</Text>
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
            <Ionicons name="trophy-outline" size={26} color={c.primary} />
          </View>

          <View style={styles.eventsTextWrap}>
            <Text style={styles.eventsTitle}>{t("home.eventsTitle")}</Text>
            <Text style={styles.eventsSubtitle}>
              {t("home.eventsSubtitle")}
            </Text>
          </View>

          <View style={styles.eventsActionBtn}>
            <Text style={styles.eventsActionBtnText}>{t("home.eventsButton")}</Text>
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
                  📍 {selectedHall?.metadata?.location || cityLabel(currentCity, t)}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedHall(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={c.textPrimary} />
              </Pressable>
            </View>

            {/* Date Selection */}
            <Text style={styles.modalSectionLabel}>{t("home.chooseDay")}</Text>
            <View style={styles.slotRow}>
              {[0, 1, 2, 3].map((d) => (
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
                    {dayOptionLabel(d)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Time Slot Selection */}
            <Text style={styles.modalSectionLabel}>{t("home.freeSlots")}</Text>
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
                <Text style={styles.modalTotalLabel}>{t("home.bookingCost")}</Text>
                <Text style={styles.modalTotalPrice}>
                  {formatNumber((selectedHall?.price || 15000))} ₸
                </Text>
              </View>
              <Pressable
                style={styles.modalBookBtn}
                onPress={confirmBooking}
              >
                <Text style={styles.modalBookBtnText}>{t("common.book")}</Text>
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

const createStyles = (c: Palette) =>
  StyleSheet.create({
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
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  popularImage: {
    width: "100%",
    height: 96,
  },
  popularImageEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
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
    color: c.textPrimary,
  },
  popularMeta: {
    ...typography.caption,
    color: c.textSecondary,
  },
  popularPrice: {
    ...typography.body,
    fontWeight: "800",
    color: c.primary,
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: c.background, // #080D0B
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
    color: c.textPrimary,
    letterSpacing: -0.5,
  },
  logoTextAccent: {
    color: c.accent, // #F04452
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.glassBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.smallChip, // 12px
  },
  locationText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textPrimary,
  },

  // Hero Card
  // Promo Actions Card
  promoActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: radii.card, // 18px
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.textPrimary,
  },
  promoActionSub: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  promoBadge: {
    backgroundColor: c.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoBadgeText: {
    color: c.background,
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
    backgroundColor: c.surface,
    borderRadius: radii.button, // 14px
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.textPrimary,
  },
  mapBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.button, // 14px
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.button, // 14px
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: c.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: c.background,
  },
  filterBadgeText: {
    color: c.textPrimary,
    fontSize: 10,
    fontWeight: "700",
  },

  // Nearby Venues Map Banner
  mapBannerCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.textPrimary,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.primary,
  },
  mapBannerSub: {
    fontSize: 11,
    color: c.textSecondary,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categorySquircleSelected: {
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderColor: c.primary,
    borderWidth: 1.5,
  },
  categoryLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: c.textSecondary,
    textAlign: "center",
    fontWeight: "500",
  },
  categoryLabelSelected: {
    color: c.textPrimary,
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
  sectionHeaderText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: c.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: c.textSecondary,
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
    color: c.primary,
  },

  // Arenas Scroll
  arenasScroll: {
    gap: spacing.card, // 12px
    paddingRight: spacing.screenHorizontal,
  },
  arenaCard: {
    width: 250,
    backgroundColor: c.surface,
    borderRadius: radii.card, // 18px
    borderWidth: 1,
    borderColor: c.border,
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
    backgroundColor: c.glassBackground,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 201, 104, 0.3)",
  },
  arenaBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: c.primary,
  },
  arenaRating: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: c.glassBackground,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  arenaRatingText: {
    fontSize: 11,
    fontWeight: "700",
    color: c.textPrimary,
  },
  arenaBody: {
    padding: spacing.md,
  },
  arenaTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: c.textPrimary,
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
    color: c.textSecondary,
    flex: 1,
  },
  arenaSportsRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 10,
  },
  arenaSportPill: {
    backgroundColor: c.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  arenaSportText: {
    fontSize: 10,
    fontWeight: "600",
    color: c.primary,
  },
  arenaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  arenaHallsCount: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  arenaPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: c.primary,
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
    backgroundColor: c.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyFilteredTitle: {
    color: c.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyFilteredText: {
    color: c.textSecondary,
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
    borderColor: c.primary,
  },
  resetFiltersBtnText: {
    color: c.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  // Events Banner
  eventsBanner: {
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.card, // 18px
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.textPrimary,
  },
  eventsSubtitle: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  eventsActionBtn: {
    backgroundColor: c.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.button,
  },
  eventsActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.background,
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
    backgroundColor: c.surfaceElevated,
    borderTopLeftRadius: radii.modal, // 24px
    borderTopRightRadius: radii.modal, // 24px
    borderTopWidth: 1,
    borderTopColor: c.glassBorder,
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
    color: c.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  slotChipActive: {
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderColor: c.primary,
  },
  slotChipText: {
    fontSize: 13,
    color: c.textSecondary,
    fontWeight: "500",
  },
  slotChipTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  modalTotalLabel: {
    fontSize: 11,
    color: c.textSecondary,
  },
  modalTotalPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
  },
  modalBookBtn: {
    backgroundColor: c.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.button, // 14px
  },
  modalBookBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: c.background,
  },
});
