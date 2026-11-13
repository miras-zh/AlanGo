import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
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
} from "@/lib/sportRentData";
import { getSelectedCity, setSelectedCity } from "@/lib/cities";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { VenueCard } from "@/components/VenueCard";
import { ArenaCard, arenaMinPrice } from "@/components/ArenaCard";
import { ALL_SPORTS, SportCategoryTiles, sportMatches } from "@/components/SportCategoryTiles";
import { capacityLabel } from "@/lib/hallOptions";
import { FilterModal, FilterState } from "@/components/FilterModal";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT, type MessageKey } from "@/lib/i18n";
import { cityLabel, sportLabel, surfaceLabel } from "@/lib/dataLabels";

type CatalogTab = "halls" | "arenas";

const HALL_SORTS = [
  { key: "popular", label: "halls.sortPopular" as MessageKey },
  { key: "price_asc", label: "halls.sortCheap" as MessageKey },
  { key: "price_desc", label: "halls.sortExpensive" as MessageKey },
  { key: "rating", label: "halls.sortRating" as MessageKey },
];

const ARENA_SORTS = [
  { key: "rating", label: "arenas.sortRating" as MessageKey },
  { key: "halls", label: "arenas.sortHalls" as MessageKey },
  { key: "price", label: "arenas.sortPrice" as MessageKey },
];

const CITIES = ["Астана", "Алматы", "Шымкент", "Караганда", "Актобе"];

const FAVORITES_STORAGE_KEY = "alango_favorite_halls";

const DEFAULT_FILTERS: FilterState = {
  sport: "Все",
  facilityType: "all",
  maxPrice: 50000,
  amenities: [],
};

// FilterModal sport keys → sport tile ids.
function tileIdFromFilterSport(sport: string): string {
  if (sport === "Все") return ALL_SPORTS;
  if (sport === "Сквош" || sport === "Падл") return "Сквош и падл";
  return sport;
}

const TAB_ACTIVE_SIZE = 28;
const TAB_INACTIVE_SIZE = 17;

/** "Залы | Спорткомплексы" — text tabs; the active one is large with a green underline. */
function CatalogTabs({ tab, onChange }: { tab: CatalogTab; onChange: (tab: CatalogTab) => void }) {
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const progress = useRef(new Animated.Value(tab === "halls" ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: tab === "halls" ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [tab, progress]);

  const size = (active: 0 | 1) =>
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: active === 0 ? [TAB_ACTIVE_SIZE, TAB_INACTIVE_SIZE] : [TAB_INACTIVE_SIZE, TAB_ACTIVE_SIZE],
    });
  const underline = (active: 0 | 1) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: active === 0 ? [1, 0] : [0, 1] });

  const item = (key: CatalogTab, idx: 0 | 1, label: string) => {
    const active = tab === key;
    return (
      <Pressable
        onPress={() => {
          if (active) return;
          hapticSelection();
          onChange(key);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        hitSlop={8}
        style={[styles.tabItem, active ? styles.tabItemActive : styles.tabItemInactive]}
      >
        <Animated.Text
          style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextInactive, { fontSize: size(idx) }]}
          numberOfLines={1}
          adjustsFontSizeToFit={active}
          minimumFontScale={0.75}
        >
          {label}
        </Animated.Text>
        <Animated.View style={[styles.tabUnderline, { opacity: underline(idx) }]} />
      </Pressable>
    );
  };

  return (
    <View style={styles.tabsRow} accessibilityRole="tablist">
      {item("halls", 0, t("halls.title"))}
      <View style={styles.tabDivider} />
      {item("arenas", 1, t("arenas.title"))}
    </View>
  );
}

export default function ItemsScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ openFilter?: string; sport?: string; tab?: string }>();

  const [tab, setTab] = useState<CatalogTab>(searchParams.tab === "arenas" ? "arenas" : "halls");
  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Each tab searches its own entities.
  const [hallSearch, setHallSearch] = useState("");
  const [arenaSearch, setArenaSearch] = useState("");
  const search = tab === "halls" ? hallSearch : arenaSearch;
  const setSearch = tab === "halls" ? setHallSearch : setArenaSearch;

  // Sport tile filter is shared by both tabs.
  const [sport, setSport] = useState<string>(ALL_SPORTS);
  const [currentCity, setCurrentCity] = useState("Астана");
  const [favorites, setFavorites] = useState<number[]>([]);

  // Advanced (hall-only) filters.
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [hallSort, setHallSort] = useState("popular");
  const [arenaSort, setArenaSort] = useState("rating");
  const sortOptions = tab === "halls" ? HALL_SORTS : ARENA_SORTS;
  const currentSort = tab === "halls" ? hallSort : arenaSort;
  const sortChanged = currentSort !== (tab === "halls" ? "popular" : "rating");

  const [cityModalOpen, setCityModalOpen] = useState(false);

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
      setLoadError(false);
      if (storedCity) setCurrentCity(storedCity);
      if (favData) {
        try {
          setFavorites(JSON.parse(favData));
        } catch {}
      }
    } catch {
      setLoadError(true);
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
      setSport(tileIdFromFilterSport(searchParams.sport));
      setFilters((prev) => ({ ...prev, sport: searchParams.sport as string }));
    }
  }, [searchParams.sport]);

  useEffect(() => {
    if (searchParams.tab === "arenas" || searchParams.tab === "halls") setTab(searchParams.tab);
  }, [searchParams.tab]);

  const toggleFavorite = async (hallId: number) => {
    const nextFavs = favorites.includes(hallId)
      ? favorites.filter((id) => id !== hallId)
      : [...favorites, hallId];
    setFavorites(nextFavs);
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavs));
  };

  const handleSelectCity = async (city: string) => {
    hapticSelection();
    setCurrentCity(city);
    await setSelectedCity(city);
    setCityModalOpen(false);
  };

  const handleSelectSport = (id: string) => {
    setSport(id);
    setFilters((prev) => ({ ...prev, sport: id === ALL_SPORTS ? "Все" : id }));
  };

  // Badge counts only hall-specific filters (sport has its own tiles).
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.facilityType !== "all") count += 1;
    if (filters.maxPrice < 50000) count += 1;
    if (filters.amenities.length > 0) count += filters.amenities.length;
    return count;
  }, [filters]);

  const arenaCity = useMemo(() => {
    const map = new Map<number, string>();
    arenas.forEach((a) => map.set(a.id, a.city));
    return map;
  }, [arenas]);

  const cityOk = (city?: string) => !currentCity || !city || city.toLowerCase() === currentCity.toLowerCase();

  const filteredHalls = useMemo(() => {
    const q = hallSearch.trim().toLowerCase();
    const list = halls.filter((h) => {
      if (!cityOk(arenaCity.get(h.arenaId))) return false;
      if (!sportMatches(sport, h.sportType)) return false;
      if (filters.maxPrice < 50000 && h.pricePerHour > filters.maxPrice) return false;
      if (
        q &&
        ![h.title, h.arenaTitle, h.arenaAddress, h.sportType, sportLabel(h.sportType, t), h.surfaceType]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
    if (hallSort === "price_asc") list.sort((a, b) => a.pricePerHour - b.pricePerHour);
    else if (hallSort === "price_desc") list.sort((a, b) => b.pricePerHour - a.pricePerHour);
    else if (hallSort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halls, hallSearch, sport, filters.maxPrice, hallSort, currentCity, arenaCity, t]);

  const filteredArenas = useMemo(() => {
    const q = arenaSearch.trim().toLowerCase();
    const list = arenas.filter((a) => {
      if (!cityOk(a.city)) return false;
      if (sport !== ALL_SPORTS && !a.availableSports.some((s) => sportMatches(sport, s))) return false;
      if (q && !`${a.title} ${a.address}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (arenaSort === "halls") return b.halls.length - a.halls.length;
      if (arenaSort === "price") {
        return (arenaMinPrice(a) ?? Number.MAX_SAFE_INTEGER) - (arenaMinPrice(b) ?? Number.MAX_SAFE_INTEGER);
      }
      return (b.rating || 0) - (a.rating || 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenas, arenaSearch, sport, arenaSort, currentCity]);

  const resetAll = () => {
    setSearch("");
    setSport(ALL_SPORTS);
    setFilters(DEFAULT_FILTERS);
  };

  const isFiltered = search.trim().length > 0 || sport !== ALL_SPORTS || activeFiltersCount > 0;
  const subtitle =
    tab === "halls"
      ? isFiltered
        ? t("halls.found", { count: filteredHalls.length })
        : t("halls.subtitle")
      : isFiltered
        ? t("arenas.count", { count: filteredArenas.length })
        : t("arenas.subtitle");

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadData();
      }}
      tintColor={c.primary}
    />
  );

  const emptyState = (
    <View style={styles.emptyWrap}>
      <Ionicons name={loadError ? "cloud-offline-outline" : "search-outline"} size={48} color={c.textSecondary} />
      <Text style={styles.emptyTitle}>
        {loadError ? t("catalog.errorTitle") : tab === "halls" ? t("halls.emptyTitle") : t("arenas.empty")}
      </Text>
      <Text style={styles.emptySub}>
        {loadError ? t("catalog.errorText") : tab === "halls" ? t("halls.emptyText") : t("arenas.emptyText")}
      </Text>
      <Pressable
        style={styles.emptyResetBtn}
        onPress={() => {
          hapticSelection();
          if (loadError) {
            setLoading(true);
            loadData();
          } else {
            resetAll();
          }
        }}
      >
        <Text style={styles.emptyResetBtnText}>{loadError ? t("common.retry") : t("halls.resetAll")}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 1. Header: text tabs + map / filters */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <CatalogTabs tab={tab} onChange={setTab} />
          <Text style={styles.screenSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              hapticSelection();
              router.push("/map");
            }}
            accessibilityRole="button"
            accessibilityLabel={t("map.title")}
          >
            <Ionicons name="location-outline" size={20} color={c.textPrimary} />
          </Pressable>

        </View>
      </View>

      {/* 2. Search + sort + advanced filters */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={c.textSecondary} style={{ marginRight: spacing.sm }} />
          <TextInput
            placeholder={tab === "halls" ? t("halls.searchPlaceholder") : t("arenas.searchPlaceholder")}
            placeholderTextColor={c.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.squareBtn, sortChanged && styles.squareBtnActive, pressed && { opacity: 0.8 }]}
          onPress={() => {
            hapticSelection();
            setSortModalOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("halls.sort")}
        >
          <Ionicons name="swap-vertical" size={20} color={sortChanged ? c.primary : c.textPrimary} />
        </Pressable>

        {/* Advanced filters (price, amenities) exist for halls only; dimmed on complexes
            so the row doesn't jump between tabs. */}
        <Pressable
          style={({ pressed }) => [
            styles.squareBtn,
            tab === "halls" && activeFiltersCount > 0 && styles.squareBtnActive,
            tab !== "halls" && styles.squareBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
          disabled={tab !== "halls"}
          onPress={() => {
            hapticImpact();
            setFilterModalOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("filters.title")}
          accessibilityState={{ disabled: tab !== "halls" }}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={tab === "halls" && activeFiltersCount > 0 ? c.primary : c.textPrimary}
          />
          {tab === "halls" && activeFiltersCount > 0 ? <View style={styles.filterDot} /> : null}
        </Pressable>
      </View>

      {/* 3. City + sport tiles (one scrolling row) */}
      <SportCategoryTiles
        variant="compact"
        selected={sport}
        onSelect={handleSelectSport}
        style={styles.categories}
        leading={
          <Pressable
            style={styles.cityPill}
            onPress={() => {
              hapticSelection();
              setCityModalOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("halls.chooseCity")}
          >
            <Ionicons name="location-sharp" size={16} color={c.primary} />
            <Text style={styles.cityPillText} numberOfLines={1}>
              {cityLabel(currentCity, t)}
            </Text>
            <Ionicons name="chevron-down" size={14} color={c.textSecondary} />
          </Pressable>
        }
      />

      {/* 5. Catalog of the active tab */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={c.primary} size="large" />
          <Text style={styles.loadingText}>{t("halls.loading")}</Text>
        </View>
      ) : tab === "halls" ? (
        <FlatList
          key="halls"
          data={filteredHalls}
          keyExtractor={(item) => `h-${item.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ListEmptyComponent={emptyState}
          renderItem={({ item }) => {
            // Characteristics line from real hall data only.
            const specsList: string[] = [];
            if (item.sportType) specsList.push(sportLabel(item.sportType, t));
            if (item.maxPeople) specsList.push(capacityLabel(item.maxPeople));
            else if (item.capacity) {
              const shortCap = item.capacity.split("(")[0].trim();
              if (shortCap) specsList.push(shortCap);
            }
            if (item.surfaceType) specsList.push(surfaceLabel(item.surfaceType, t));
            const specsText = specsList.length > 0 ? specsList.slice(0, 3).join(" · ") : undefined;

            return (
              <VenueCard
                id={item.id}
                title={item.title}
                arenaTitle={item.arenaTitle}
                imageUrl={item.imageUrl}
                address={item.arenaAddress}
                rating={item.rating}
                reviewsCount={item.reviewsCount}
                pricePerHour={item.pricePerHour}
                sportType={item.sportType}
                specs={specsText}
                isFavorite={favorites.includes(item.id)}
                onPress={() => router.push(`/hall/${item.id}`)}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            );
          }}
        />
      ) : (
        <FlatList
          key="arenas"
          data={filteredArenas}
          keyExtractor={(item) => `a-${item.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ListEmptyComponent={emptyState}
          renderItem={({ item }) => (
            <ArenaCard
              arena={item}
              onPress={() => router.push(`/arena/${item.id}`)}
              onHallPress={(h) => router.push(`/hall/${h.id}`)}
            />
          )}
        />
      )}

      <FilterModal
        visible={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setSport(tileIdFromFilterSport(newFilters.sport));
        }}
        onReset={() => setSport(ALL_SPORTS)}
        totalResultsCount={filteredHalls.length}
      />

      {/* Sort options of the active tab */}
      <Modal visible={sortModalOpen} animationType="fade" transparent onRequestClose={() => setSortModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortModalOpen(false)}>
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>{t("halls.sort")}</Text>
            {sortOptions.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.sortOptionRow, currentSort === opt.key && styles.sortOptionRowActive]}
                onPress={() => {
                  hapticSelection();
                  if (tab === "halls") setHallSort(opt.key);
                  else setArenaSort(opt.key);
                  setSortModalOpen(false);
                }}
              >
                <Text style={[styles.sortOptionText, currentSort === opt.key && styles.sortOptionTextActive]}>
                  {t(opt.label)}
                </Text>
                {currentSort === opt.key && <Ionicons name="checkmark" size={18} color={c.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={cityModalOpen} animationType="fade" transparent onRequestClose={() => setCityModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCityModalOpen(false)}>
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>{t("halls.chooseCity")}</Text>
            {CITIES.map((cityName) => (
              <Pressable
                key={cityName}
                style={[styles.sortOptionRow, currentCity === cityName && styles.sortOptionRowActive]}
                onPress={() => handleSelectCity(cityName)}
              >
                <Text style={[styles.sortOptionText, currentCity === cityName && styles.sortOptionTextActive]}>
                  {cityLabel(cityName, t)}
                </Text>
                {currentCity === cityName && <Ionicons name="checkmark" size={18} color={c.primary} />}
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 44,
  },
  tabItem: {
    alignItems: "flex-start",
  },
  tabItemActive: {
    flexShrink: 1,
  },
  tabItemInactive: {
    flexShrink: 0,
  },
  tabText: {
    letterSpacing: -0.5,
  },
  tabTextActive: {
    fontWeight: "800",
    color: c.textPrimary,
  },
  tabTextInactive: {
    fontWeight: "500",
    color: c.textSecondary,
    marginBottom: spacing.xs,
  },
  tabUnderline: {
    alignSelf: "stretch",
    height: 3,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: c.primary,
  },
  tabDivider: {
    width: 1,
    height: 20,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: c.border,
  },
  screenSubtitle: {
    ...typography.caption,
    color: c.textSecondary,
    marginTop: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.button,
    backgroundColor: c.glassBackground,
    borderWidth: 1,
    borderColor: c.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconBtnActive: {
    borderColor: c.primary,
    backgroundColor: c.primarySoft,
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenHorizontal,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.glassBackground,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderWidth: 1,
    borderColor: c.glassBorder,
  },
  squareBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.glassBackground,
    borderWidth: 1,
    borderColor: c.glassBorder,
  },
  squareBtnActive: {
    borderColor: c.primary,
    backgroundColor: c.primarySoft,
  },
  squareBtnDisabled: {
    opacity: 0.4,
  },
  searchInput: {
    flex: 1,
    color: c.textPrimary,
    fontSize: 14,
  },
  categories: {
    // This screen has no container padding, so cancel the tiles' edge-to-edge offset.
    marginHorizontal: 0,
    marginBottom: spacing.md,
  },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 40,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: c.glassBackground,
    borderWidth: 1,
    borderColor: c.glassBorder,
  },
  cityPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
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
    backgroundColor: c.overlay,
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
    backgroundColor: c.primarySoft,
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
