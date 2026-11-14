import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
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
  getHallNearestSlots,
  getStoredHalls,
  Hall,
  type HallNearestSlots,
} from "@/lib/sportRentData";
import { getSelectedCity, setSelectedCity } from "@/lib/cities";
import { getFavoriteArenaIds, toggleFavoriteArenaId } from "@/lib/favorites";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { VenueCard } from "@/components/VenueCard";
import { ArenaCard } from "@/components/ArenaCard";
import { ALL_SPORTS } from "@/components/SportCategoryTiles";
import { CatalogFilterModal } from "@/components/CatalogFilterModal";
import {
  activeCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  filterArenas,
  filterHalls,
  type CatalogFilters,
  type CatalogTab,
} from "@/lib/catalogFilters";
import { capacityLabel } from "@/lib/hallOptions";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";
import { cityLabel, sportLabel, surfaceLabel } from "@/lib/dataLabels";

const FAVORITES_STORAGE_KEY = "alango_favorite_halls";

// Old ?sport= values (FilterModal keys) → sport tile ids.
function tileIdFromParam(sport: string): string {
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
  const searchParams = useLocalSearchParams<{ sport?: string; tab?: string }>();

  const [tab, setTab] = useState<CatalogTab>(searchParams.tab === "arenas" ? "arenas" : "halls");
  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [nearestSlotsMap, setNearestSlotsMap] = useState<Record<number, HallNearestSlots>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Each tab searches its own entities.
  const [hallSearch, setHallSearch] = useState("");
  const [arenaSearch, setArenaSearch] = useState("");
  const search = tab === "halls" ? hallSearch : arenaSearch;
  const setSearch = tab === "halls" ? setHallSearch : setArenaSearch;

  // All filtering lives in the filter sheet and is applied from there.
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [arenaFavorites, setArenaFavorites] = useState<number[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [arenasData, hallsData, storedCity, favData, arenaFavs] = await Promise.all([
        getArenasWithHalls(),
        getStoredHalls(),
        getSelectedCity(),
        AsyncStorage.getItem(FAVORITES_STORAGE_KEY),
        getFavoriteArenaIds(),
      ]);
      setArenas(arenasData);
      setHalls(hallsData);
      setArenaFavorites(arenaFavs);
      setLoadError(false);
      if (storedCity) setFilters((f) => ({ ...f, city: storedCity }));
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
    if (searchParams.sport) setFilters((f) => ({ ...f, sport: tileIdFromParam(searchParams.sport as string) }));
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

  const applyFilters = (next: CatalogFilters) => {
    if (next.city !== filters.city) setSelectedCity(next.city);
    setFilters(next);
  };

  const filteredHalls = useMemo(
    () => filterHalls(halls, arenas, filters, hallSearch, t),
    [halls, arenas, filters, hallSearch, t],
  );

  useEffect(() => {
    let cancelled = false;
    const missing = filteredHalls.filter((h) => !(h.id in nearestSlotsMap));
    if (missing.length === 0) return;

    (async () => {
      const BATCH = 4;
      for (let i = 0; i < missing.length; i += BATCH) {
        if (cancelled) return;
        const slice = missing.slice(i, i + BATCH);
        const results = await Promise.all(
          slice.map(async (h) => ({ id: h.id, data: await getHallNearestSlots(h.id) })),
        );
        if (cancelled) return;
        setNearestSlotsMap((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.data) next[r.id] = r.data;
          }
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filteredHalls]);
  const filteredArenas = useMemo(
    () => filterArenas(arenas, filters, arenaSearch),
    [arenas, filters, arenaSearch],
  );

  const countFor = useCallback(
    (draft: CatalogFilters) =>
      tab === "halls"
        ? filterHalls(halls, arenas, draft, hallSearch, t).length
        : filterArenas(arenas, draft, arenaSearch).length,
    [tab, halls, arenas, hallSearch, arenaSearch, t],
  );

  const activeCount = activeCatalogFilters(filters, tab);
  const isFiltered = activeCount > 0 || search.trim().length > 0;

  const resetAll = () => {
    hapticSelection();
    setSearch("");
    setFilters((f) => ({ ...DEFAULT_CATALOG_FILTERS, city: f.city }));
  };

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
      {/* 1. Header: text tabs + map */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <CatalogTabs tab={tab} onChange={setTab} />
          {isFiltered ? (
            <View style={styles.summaryRow}>
              <Text style={styles.screenSubtitle} numberOfLines={1}>
                {tab === "halls"
                  ? t("halls.found", { count: filteredHalls.length })
                  : t("arenas.count", { count: filteredArenas.length })}
                {" · "}
                {cityLabel(filters.city, t)}
              </Text>
              <Pressable onPress={resetAll} hitSlop={8} accessibilityRole="button">
                <Text style={styles.summaryReset}>{t("filters.reset")}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.screenSubtitle} numberOfLines={1}>
              {tab === "halls" ? t("halls.subtitle") : t("arenas.subtitle")}
            </Text>
          )}
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

      {/* 2. Search + one filter button */}
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
          style={({ pressed }) => [styles.squareBtn, activeCount > 0 && styles.squareBtnActive, pressed && { opacity: 0.8 }]}
          onPress={() => {
            hapticImpact();
            setFilterOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("filters.title")}
        >
          <Ionicons name="options-outline" size={20} color={activeCount > 0 ? c.primary : c.textPrimary} />
          {activeCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* 3. Catalog of the active tab */}
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
                nearestSlots={nearestSlotsMap[item.id]?.slots}
                nearestSlotsDay={nearestSlotsMap[item.id]?.day}
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
              isFavorite={arenaFavorites.includes(item.id)}
              onToggleFavorite={async () => {
                setArenaFavorites(await toggleFavoriteArenaId(item.id));
              }}
              onPress={() => router.push(`/arena/${item.id}`)}
              onHallPress={(h) => router.push(`/hall/${h.id}`)}
            />
          )}
        />
      )}

      <CatalogFilterModal
        visible={filterOpen}
        tab={tab}
        filters={filters}
        countFor={countFor}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
      />
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
  countBadge: {
    position: "absolute",
    top: -spacing.xs,
    right: -spacing.xs,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primary,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: c.onPrimary,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryReset: {
    ...typography.caption,
    marginTop: spacing.sm,
    fontWeight: "700",
    color: c.primary,
  },
  searchInput: {
    flex: 1,
    color: c.textPrimary,
    fontSize: 14,
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
});
