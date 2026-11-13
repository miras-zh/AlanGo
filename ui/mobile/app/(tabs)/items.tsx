import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { radii, spacing, typography } from "@/constants/theme";
import {
  ArenaWithHalls,
  getArenasWithHalls,
  getStoredHalls,
  Hall,
  SportType,
} from "@/lib/sportRentData";
import { getSelectedCity, setSelectedCity, TOP_CITIES } from "@/lib/cities";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { VenueCard } from "@/components/VenueCard";
import { FilterModal, FilterState } from "@/components/FilterModal";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT, type MessageKey } from "@/lib/i18n";
import { cityLabel, sportLabel, surfaceLabel } from "@/lib/dataLabels";

const SPORT_CHIPS = [
  { key: "Все", label: "sport.all" as MessageKey, icon: "apps-outline" },
  { key: "Футбол", label: "sport.football" as MessageKey, icon: "football-outline" },
  { key: "Теннис", label: "sport.tennis" as MessageKey, icon: "tennisball-outline" },
  { key: "Баскетбол", label: "sport.basketball" as MessageKey, icon: "basketball-outline" },
  { key: "Волейбол", label: "sport.volleyball" as MessageKey, icon: "fitness-outline" },
  { key: "Сквош и падл", label: "sport.squashShort" as MessageKey, icon: "disc-outline" },
];

const SORT_OPTIONS = [
  { key: "popular", label: "halls.sortPopular" as MessageKey },
  { key: "price_asc", label: "halls.sortCheap" as MessageKey },
  { key: "price_desc", label: "halls.sortExpensive" as MessageKey },
  { key: "rating", label: "halls.sortRating" as MessageKey },
];

const CITIES = ["Астана", "Алматы", "Шымкент", "Караганда", "Актобе"];

const FAVORITES_STORAGE_KEY = "alango_favorite_halls";

export default function ItemsScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ openFilter?: string; sport?: string }>();

  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Categories
  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState("Все");
  const [currentCity, setCurrentCity] = useState("Астана");

  // Favorites
  const [favorites, setFavorites] = useState<number[]>([]);

  // Filter Modal
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    sport: "Все",
    facilityType: "all",
    maxPrice: 50000,
    amenities: [],
  });

  // Sort Menu Modal
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [currentSort, setCurrentSort] = useState("popular");

  // City Picker Modal
  const [cityModalOpen, setCityModalOpen] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const [arenasData, hallsData, storedCity, favData] = await Promise.all([
        getArenasWithHalls(),
        getStoredHalls(),
        getSelectedCity(),
        AsyncStorage.getItem(FAVORITES_STORAGE_KEY),
      ]);
      setArenas(arenasData);
      setHalls(hallsData);
      if (storedCity) setCurrentCity(storedCity);
      if (favData) {
        try {
          setFavorites(JSON.parse(favData));
        } catch {}
      }
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

  useEffect(() => {
    if (searchParams.sport) {
      setSelectedSport(searchParams.sport);
      setFilters((prev) => ({ ...prev, sport: searchParams.sport as string }));
    }
  }, [searchParams.sport]);

  // Toggle Favorite
  const toggleFavorite = async (hallId: number) => {
    const nextFavs = favorites.includes(hallId)
      ? favorites.filter((id) => id !== hallId)
      : [...favorites, hallId];
    setFavorites(nextFavs);
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavs));
  };

  // Change City
  const handleSelectCity = async (city: string) => {
    hapticSelection();
    setCurrentCity(city);
    await setSelectedCity(city);
    setCityModalOpen(false);
  };

  // Count active filters (for badge)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.sport !== "Все") count += 1;
    if (filters.facilityType !== "all") count += 1;
    if (filters.maxPrice < 50000) count += 1;
    if (filters.amenities.length > 0) count += filters.amenities.length;
    return count;
  }, [filters]);

  // Sync category bar with filter modal
  const handleSelectSportCategory = (sportKey: string) => {
    hapticSelection();
    setSelectedSport(sportKey);
    setFilters((prev) => ({
      ...prev,
      sport: sportKey,
    }));
  };

  // Filtered Halls List
  const filteredHalls = useMemo(() => {
    let list = [...halls];

    // Filter by Search Query
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.arenaTitle.toLowerCase().includes(q) ||
          h.arenaAddress.toLowerCase().includes(q) ||
          h.sportType.toLowerCase().includes(q) ||
          h.surfaceType.toLowerCase().includes(q),
      );
    }

    // Filter by Sport
    const effectiveSport = filters.sport !== "Все" ? filters.sport : selectedSport;
    if (effectiveSport !== "Все") {
      list = list.filter((h) => {
        if (effectiveSport === "Сквош и падл") {
          return (
            h.sportType.toLowerCase().includes("сквош") ||
            h.sportType.toLowerCase().includes("падл")
          );
        }
        return h.sportType.toLowerCase() === effectiveSport.toLowerCase();
      });
    }

    // Filter by Max Price
    if (filters.maxPrice < 50000) {
      list = list.filter((h) => h.pricePerHour <= filters.maxPrice);
    }

    // Filter by Amenities
    if (filters.amenities.length > 0) {
      list = list.filter((h) => {
        return filters.amenities.every((amenity) => {
          const matchDesc = h.description.toLowerCase().includes(amenity.toLowerCase());
          const matchEquip = h.equipment.some((e) =>
            e.toLowerCase().includes(amenity.toLowerCase()),
          );
          return matchDesc || matchEquip || true;
        });
      });
    }

    // Sorting
    if (currentSort === "price_asc") {
      list.sort((a, b) => a.pricePerHour - b.pricePerHour);
    } else if (currentSort === "price_desc") {
      list.sort((a, b) => b.pricePerHour - a.pricePerHour);
    } else if (currentSort === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [halls, search, filters, selectedSport, currentSort]);

  const activeSportLabel = filters.sport !== "Все" ? filters.sport : selectedSport;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 1. Header (Screen 1 & Screen 3) */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle}>{t("halls.title")}</Text>
          <Text style={styles.screenSubtitle} numberOfLines={1}>
            {activeFiltersCount > 0 || search.trim()
              ? t("halls.found", { count: filteredHalls.length })
              : t("halls.subtitle")}
          </Text>
        </View>

        {/* Action Buttons Right */}
        <View style={styles.headerActions}>
          {/* Map Button (Mockup: Map Pin) */}
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              hapticSelection();
              router.push("/map");
            }}
          >
            <Ionicons name="location-outline" size={19} color={c.textPrimary} />
          </Pressable>

          {/* Filter Button */}
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              activeFiltersCount > 0 && styles.iconBtnActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              hapticImpact();
              setFilterModalOpen(true);
            }}
          >
            <Ionicons
              name="options-outline"
              size={19}
              color={activeFiltersCount > 0 ? c.primary : c.textPrimary}
            />
            {activeFiltersCount > 0 && <View style={styles.filterDot} />}
          </Pressable>
        </View>
      </View>

      {/* 2. Search Field */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={18}
            color={c.textSecondary}
            style={{ marginRight: 8 }}
          />
          <TextInput
            placeholder={t("halls.searchPlaceholder")}
            placeholderTextColor={c.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={16}
                color={c.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* 3. Horizontal Sport Categories */}
      <View style={styles.categoriesWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {SPORT_CHIPS.map((chip) => {
            const isSelected = activeSportLabel === chip.key;
            return (
              <Pressable
                key={chip.key}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipActive,
                ]}
                onPress={() => handleSelectSportCategory(chip.key)}
              >
                <Ionicons
                  name={chip.icon as any}
                  size={15}
                  color={isSelected ? c.primary : c.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextActive,
                  ]}
                >
                  {t(chip.label)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Controls Row: Sorting & Distance / Active Filter Pill */}
      <View style={styles.controlsRow}>
        {/* Sort Pill */}
        <Pressable
          style={styles.controlPill}
          onPress={() => {
            hapticSelection();
            setSortModalOpen(true);
          }}
        >
          <Text style={styles.controlPillText}>{t("halls.sort")}</Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={c.textSecondary}
            style={{ marginLeft: 4 }}
          />
        </Pressable>

        {/* City Selection Pill */}
        <Pressable
          style={styles.controlPill}
          onPress={() => {
            hapticSelection();
            setCityModalOpen(true);
          }}
        >
          <Ionicons
            name="navigate-outline"
            size={13}
            color={c.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.controlPillText}>{cityLabel(currentCity, t)}</Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={c.textSecondary}
            style={{ marginLeft: 4 }}
          />
        </Pressable>
      </View>

      {/* 5. Venue Cards List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={c.primary} size="large" />
          <Text style={styles.loadingText}>{t("halls.loading")}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHalls}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
              <Ionicons
                name="search-outline"
                size={48}
                color={c.textSecondary}
              />
              <Text style={styles.emptyTitle}>{t("halls.emptyTitle")}</Text>
              <Text style={styles.emptySub}>
                {t("halls.emptyText")}
              </Text>
              <Pressable
                style={styles.emptyResetBtn}
                onPress={() => {
                  setSearch("");
                  setSelectedSport("Все");
                  setFilters({
                    sport: "Все",
                    facilityType: "all",
                    maxPrice: 50000,
                    amenities: [],
                  });
                }}
              >
                <Text style={styles.emptyResetBtnText}>{t("halls.resetAll")}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item, index }) => {
            const isFav = favorites.includes(item.id);
            const distances = ["1.8", "2.4", "3.1", "4.5"].map((n) => t("common.km", { n }));
            const itemDistance = distances[index % distances.length];

            // Build characteristics line from real hall data
            const specsList: string[] = [];
            if (item.sportType) specsList.push(sportLabel(item.sportType, t));
            if (item.capacity) {
              const shortCap = item.capacity.split("(")[0].trim();
              if (shortCap) specsList.push(shortCap);
            }
            if (item.surfaceType && !specsList.includes(item.surfaceType)) {
              specsList.push(surfaceLabel(item.surfaceType, t));
            }
            if (item.equipment?.some((e) => e.toLowerCase().includes("душ"))) {
              specsList.push(t("halls.shower"));
            }
            const specsText = specsList.length > 0 ? specsList.slice(0, 3).join(" · ") : undefined;

            return (
              <VenueCard
                id={item.id}
                title={item.title}
                arenaTitle={item.arenaTitle}
                imageUrl={item.imageUrl}
                address={item.arenaAddress || t("halls.addressFallback", { city: cityLabel(currentCity, t) })}
                distance={itemDistance}
                rating={item.rating || 4.8}
                reviewsCount={item.reviewsCount || 124}
                pricePerHour={item.pricePerHour}
                sportType={item.sportType}
                specs={specsText}
                isFavorite={isFav}
                onPress={() => {
                  router.push(`/hall/${item.id}`);
                }}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            );
          }}
        />
      )}

      {/* Filter Modal Component */}
      <FilterModal
        visible={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setSelectedSport(newFilters.sport);
        }}
        onReset={() => {
          setSelectedSport("Все");
        }}
        totalResultsCount={filteredHalls.length}
      />

      {/* Sort Options Modal */}
      <Modal
        visible={sortModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSortModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSortModalOpen(false)}
        >
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>{t("halls.sort")}</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[
                  styles.sortOptionRow,
                  currentSort === opt.key && styles.sortOptionRowActive,
                ]}
                onPress={() => {
                  hapticSelection();
                  setCurrentSort(opt.key);
                  setSortModalOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    currentSort === opt.key && styles.sortOptionTextActive,
                  ]}
                >
                  {t(opt.label)}
                </Text>
                {currentSort === opt.key && (
                  <Ionicons name="checkmark" size={18} color={c.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* City Picker Modal */}
      <Modal
        visible={cityModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setCityModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCityModalOpen(false)}
        >
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>{t("halls.chooseCity")}</Text>
            {CITIES.map((cityName) => (
              <Pressable
                key={cityName}
                style={[
                  styles.sortOptionRow,
                  currentCity === cityName && styles.sortOptionRowActive,
                ]}
                onPress={() => handleSelectCity(cityName)}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    currentCity === cityName && styles.sortOptionTextActive,
                  ]}
                >
                  {cityLabel(cityName, t)}
                </Text>
                {currentCity === cityName && (
                  <Ionicons name="checkmark" size={18} color={c.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerTitleWrap: {
    flex: 1,
  },
  screenTitle: {
    ...typography.screenTitle,
    color: c.textPrimary,
  },
  screenSubtitle: {
    ...typography.caption,
    color: c.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconBtnActive: {
    borderColor: c.primary,
    backgroundColor: "rgba(0, 201, 104, 0.15)",
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.primary,
  },
  searchContainer: {
    paddingHorizontal: spacing.screenHorizontal,
    marginTop: 10,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: radii.button,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: {
    flex: 1,
    color: c.textPrimary,
    fontSize: 14,
  },
  categoriesWrap: {
    marginBottom: 12,
  },
  categoriesContent: {
    paddingHorizontal: spacing.screenHorizontal,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.smallChip,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
  },
  categoryChipActive: {
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    borderColor: c.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
  },
  categoryTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: 12,
  },
  controlPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: c.border,
  },
  controlPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  activeFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.smallChip,
  },
  activeFilterPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: c.background,
  },
  listContent: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: spacing.bottomScrollPadding,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    color: c.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: c.textPrimary,
    marginTop: 14,
  },
  emptySub: {
    ...typography.body,
    color: c.textSecondary,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 32,
  },
  emptyResetBtn: {
    marginTop: 16,
    backgroundColor: c.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: c.border,
  },
  emptyResetBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: c.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sortSheet: {
    backgroundColor: c.surface,
    borderRadius: radii.modal,
    padding: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  sortTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 14,
  },
  sortOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  sortOptionRowActive: {
    backgroundColor: "rgba(0, 201, 104, 0.08)",
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sortOptionText: {
    fontSize: 14,
    color: c.textSecondary,
    fontWeight: "500",
  },
  sortOptionTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
});
