import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { useT, type MessageKey } from "@/lib/i18n";
import { cityLabel, dayMonth } from "@/lib/dataLabels";
import { getSelectedCity, setSelectedCity, subscribeCityChange } from "@/lib/cities";
import {
  activeFilterCount,
  cancelEventRegistration,
  DEFAULT_EVENT_FILTERS,
  EVENT_SPORT_LABEL,
  eventPrice,
  eventTimeRange,
  filterEvents,
  getEvents,
  registerForEvent,
  toggleEventFavorite,
  useEventUserState,
  type EventFilterState,
  type SportEvent,
} from "@/lib/eventsData";
import { EventCard } from "@/components/EventCard";
import { EventsFilterModal } from "@/components/EventsFilterModal";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type ListTab = "upcoming" | "popular" | "mine";

const LIST_TABS: { id: ListTab; label: MessageKey }[] = [
  { id: "upcoming", label: "events.tabUpcoming" },
  { id: "popular", label: "events.tabPopular" },
  { id: "mine", label: "events.tabMine" },
];

export default function EventsScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<EventFilterState>(DEFAULT_EVENT_FILTERS);
  const [tab, setTab] = useState<ListTab>("upcoming");

  const [filterOpen, setFilterOpen] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);

  const { favorites, registered } = useEventUserState();

  const load = useCallback(async () => {
    try {
      setEvents(await getEvents());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const setCity = (city: string) => setFilters((f) => ({ ...f, city }));
    getSelectedCity().then(setCity).catch(() => {});
    return subscribeCityChange(setCity);
  }, [load]);

  const countFor = useCallback(
    (f: EventFilterState) => filterEvents(events, { filters: f, query, t }).length,
    [events, query, t],
  );

  const visible = useMemo(() => {
    if (tab === "popular") return [];
    const list = filterEvents(events, { filters, query, t });
    return tab === "mine" ? list.filter((e) => registered.includes(e.id)) : list;
  }, [tab, events, filters, query, t, registered]);

  const activeCount = activeFilterCount(filters);
  const filtersActive = activeCount > 0;

  const applyFilters = (next: EventFilterState) => {
    if (next.city && next.city !== filters.city) setSelectedCity(next.city);
    setFilters(next);
  };

  const resetFilters = () => {
    hapticSelection();
    setQuery("");
    setFilters((f) => ({ ...DEFAULT_EVENT_FILTERS, city: f.city }));
  };

  const handleRegister = (ev: SportEvent) => {
    if (registered.includes(ev.id)) {
      Alert.alert(t("events.cancelRegTitle"), t("events.cancelRegText", { title: ev.title }), [
        { text: t("common.no"), style: "cancel" },
        {
          text: t("events.cancelReg"),
          style: "destructive",
          onPress: () => {
            hapticImpact();
            cancelEventRegistration(ev.id);
          },
        },
      ]);
      return;
    }
    hapticImpact();
    setRegistering(ev.id);
    // Local registration (no events API yet); short delay keeps the busy state visible.
    setTimeout(() => {
      registerForEvent(ev.id);
      setRegistering(null);
      hapticSuccess();
      Alert.alert(
        t("events.registerTitle"),
        t("events.registeredText", {
          title: ev.title,
          date: dayMonth(ev.startsAt, t),
          time: eventTimeRange(ev),
          location: ev.venue,
        }),
        [{ text: t("home.great") }],
      );
    }, 400);
  };

  const openDetails = (ev: SportEvent) => {
    const price = eventPrice(ev, t);
    Alert.alert(
      ev.title,
      t("events.details", {
        category: t(EVENT_SPORT_LABEL[ev.sport]),
        date: dayMonth(ev.startsAt, t),
        time: eventTimeRange(ev),
        location: `${ev.venue}, ${cityLabel(ev.city, t)}`,
        price: `${price.amount}${price.unit ? ` ${price.unit}` : ""}`,
      }),
    );
  };

  const empty = (() => {
    if (loadError) return { icon: "cloud-offline-outline" as const, title: t("catalog.errorTitle"), text: t("catalog.errorText") };
    if (tab === "popular") return { icon: "flame-outline" as const, title: t("events.popularSoon"), text: t("events.popularSoonText") };
    if (tab === "mine") return { icon: "ticket-outline" as const, title: t("events.mineEmpty"), text: t("events.mineEmptyText") };
    return { icon: "trophy-outline" as const, title: t("events.notFound"), text: t("events.notFoundText") };
  })();
  const canReset = !loadError && tab !== "popular" && (filtersActive || query.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("events.title")}</Text>
          {filtersActive || query.length > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.subtitle} numberOfLines={1}>
                {t("events.foundCount", { count: visible.length })}
                {filters.city ? ` · ${cityLabel(filters.city, t)}` : ""}
              </Text>
              <Pressable onPress={resetFilters} hitSlop={8} accessibilityRole="button">
                <Text style={styles.summaryReset}>{t("filters.reset")}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.subtitle}>
              {t("events.subtitle")}
              {filters.city ? ` · ${cityLabel(filters.city, t)}` : ""}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, filtersActive && styles.roundBtnActive, pressed && { opacity: 0.8 }]}
            onPress={() => {
              hapticSelection();
              setFilterOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("events.filtersTitle")}
          >
            <Ionicons name="options-outline" size={22} color={c.primary} />
            {filtersActive ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{activeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={c.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("events.searchShort")}
          placeholderTextColor={c.textSecondary}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* List tabs */}
      <View style={styles.tabs} accessibilityRole="tablist">
        {LIST_TABS.map((lt) => {
          const active = lt.id === tab;
          return (
            <Pressable
              key={lt.id}
              onPress={() => {
                if (active) return;
                hapticSelection();
                setTab(lt.id);
              }}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              hitSlop={6}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {t(lt.label)}
              </Text>
              <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <EventCard
              event={item}
              isFavorite={favorites.includes(item.id)}
              isRegistered={registered.includes(item.id)}
              registering={registering === item.id}
              onPress={() => openDetails(item)}
              onRegister={() => handleRegister(item)}
              onToggleFavorite={() => toggleEventFavorite(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={empty.icon} size={44} color={c.textSecondary} />
              <Text style={styles.emptyTitle}>{empty.title}</Text>
              <Text style={styles.emptyText}>{empty.text}</Text>
              {loadError ? (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => {
                    setLoading(true);
                    load();
                  }}
                >
                  <Text style={styles.emptyBtnText}>{t("common.retry")}</Text>
                </Pressable>
              ) : canReset ? (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={resetFilters}
                >
                  <Text style={styles.emptyBtnText}>{t("common.resetFilters")}</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}

      <EventsFilterModal
        visible={filterOpen}
        filters={filters}
        countFor={countFor}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
      />
    </SafeAreaView>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: spacing.screenHorizontal,
      paddingTop: spacing.sm,
    },
    headerText: {
      flex: 1,
      marginRight: spacing.md,
    },
    title: {
      fontSize: 30,
      lineHeight: 34,
      fontWeight: "900",
      letterSpacing: -0.5,
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: c.textSecondary,
      marginTop: spacing.xs,
    },
    headerActions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    roundBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    roundBtnActive: {
      borderColor: c.primary,
    },
    countBadge: {
      position: "absolute",
      top: -2,
      right: -2,
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
      fontSize: 13,
      fontWeight: "700",
      color: c.primary,
      marginTop: spacing.xs,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      height: 48,
      marginHorizontal: spacing.screenHorizontal,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.card,
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.textPrimary,
    },
    tabs: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.xl,
      marginHorizontal: spacing.screenHorizontal,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    tab: {
      flexShrink: 1,
    },
    tabText: {
      fontSize: 15,
      fontWeight: "500",
      color: c.textSecondary,
    },
    tabTextActive: {
      fontSize: 17,
      fontWeight: "800",
      color: c.textPrimary,
    },
    tabUnderline: {
      height: 3,
      width: 40,
      borderRadius: 2,
      marginTop: spacing.xs,
      backgroundColor: "transparent",
    },
    tabUnderlineActive: {
      backgroundColor: c.primary,
    },
    list: {
      paddingHorizontal: spacing.screenHorizontal,
      paddingBottom: spacing.bottomScrollPadding,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      alignItems: "center",
      paddingVertical: spacing.xxl * 2,
      paddingHorizontal: spacing.xxl,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: spacing.md,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 13,
      lineHeight: 18,
      color: c.textSecondary,
      marginTop: spacing.xs,
      textAlign: "center",
    },
    emptyBtn: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.button,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    emptyBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.primary,
    },
  });
}
