import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { surfaceLabel } from "@/lib/dataLabels";
import { capacityLabel } from "@/lib/hallOptions";
import {
  getFavoriteArenaIds,
  getFavoriteHallIds,
  pruneFavoritePromotionIds,
  toggleFavoriteArenaId,
  toggleFavoriteHallId,
  toggleFavoritePromotionId,
} from "@/lib/favorites";
import {
  getArenasWithHalls,
  getStoredHalls,
  type ArenaWithHalls,
  type Hall,
} from "@/lib/sportRentData";
import {
  getEvents,
  toggleEventFavorite,
  useEventUserState,
  type SportEvent,
} from "@/lib/eventsData";
import { getPromotions, type Promotion } from "@/lib/promotionsData";
import { VenueCard } from "@/components/VenueCard";
import { ArenaCard } from "@/components/ArenaCard";
import { EventCard } from "@/components/EventCard";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type FavFilter = "all" | "halls" | "arenas" | "events" | "passes";

export default function FavoritesScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const eventState = useEventUserState();
  const [filter, setFilter] = useState<FavFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [halls, setHalls] = useState<Hall[]>([]);
  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [favHallIds, setFavHallIds] = useState<number[]>([]);
  const [favArenaIds, setFavArenaIds] = useState<number[]>([]);
  const [favPromoIds, setFavPromoIds] = useState<string[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [allHalls, allArenas, allEvents, allPromos, hallIds, arenaIds] = await Promise.all([
        getStoredHalls(),
        getArenasWithHalls(),
        getEvents(),
        getPromotions(),
        getFavoriteHallIds(),
        getFavoriteArenaIds(),
      ]);
      const activePromos = allPromos.filter((p) => p.isEnabled);
      const validPromoIds = await pruneFavoritePromotionIds(new Set(activePromos.map((p) => p.id)));

      setHalls(allHalls);
      setArenas(allArenas);
      setEvents(allEvents);
      setPromotions(activePromos);
      setFavHallIds(hallIds);
      setFavArenaIds(arenaIds);
      setFavPromoIds(validPromoIds);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const favHalls = useMemo(
    () => halls.filter((h) => favHallIds.includes(h.id)),
    [halls, favHallIds],
  );
  const favArenas = useMemo(
    () => arenas.filter((a) => favArenaIds.includes(a.id)),
    [arenas, favArenaIds],
  );
  const favEvents = useMemo(
    () => events.filter((e) => eventState.favorites.includes(e.id)),
    [events, eventState.favorites],
  );
  const favPromos = useMemo(
    () => promotions.filter((p) => favPromoIds.includes(p.id)),
    [promotions, favPromoIds],
  );

  const chips: { id: FavFilter; label: string }[] = [
    { id: "all", label: t("favorites.all") },
    { id: "halls", label: t("favorites.halls") },
    { id: "arenas", label: t("favorites.arenas") },
    { id: "events", label: t("favorites.events") },
    { id: "passes", label: t("favorites.passes") },
  ];

  const showHalls = filter === "all" || filter === "halls";
  const showArenas = filter === "all" || filter === "arenas";
  const showEvents = filter === "all" || filter === "events";
  const showPasses = filter === "all" || filter === "passes";

  const visibleCount =
    (showHalls ? favHalls.length : 0) +
    (showArenas ? favArenas.length : 0) +
    (showEvents ? favEvents.length : 0) +
    (showPasses ? favPromos.length : 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("favorites.title")}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {chips.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                hapticSelection();
                setFilter(item.id);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={c.primary}
            />
          }
        >
          {visibleCount === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="heart-outline" size={32} color={c.accent} />
              </View>
              <Text style={styles.emptyTitle}>{t("favorites.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("favorites.emptyText")}</Text>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  hapticSelection();
                  router.replace("/(tabs)/items");
                }}
              >
                <Text style={styles.primaryBtnText}>{t("favorites.goCatalog")}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {showHalls
                ? favHalls.map((item) => {
                    const specsList: string[] = [];
                    if (item.maxPeople) specsList.push(capacityLabel(item.maxPeople));
                    else if (item.capacity) {
                      const shortCap = item.capacity.split("(")[0].trim();
                      if (shortCap) specsList.push(shortCap);
                    }
                    if (item.surfaceType) specsList.push(surfaceLabel(item.surfaceType, t));
                    const specsText = specsList.length > 0 ? specsList.slice(0, 3).join(" · ") : undefined;

                    return (
                      <VenueCard
                        key={`h-${item.id}`}
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
                        isFavorite
                        onPress={() => router.push(`/hall/${item.id}`)}
                        onToggleFavorite={async () => {
                          setFavHallIds(await toggleFavoriteHallId(item.id));
                        }}
                      />
                    );
                  })
                : null}

              {showArenas
                ? favArenas.map((arena) => (
                    <ArenaCard
                      key={`a-${arena.id}`}
                      arena={arena}
                      isFavorite
                      onToggleFavorite={async () => {
                        setFavArenaIds(await toggleFavoriteArenaId(arena.id));
                      }}
                      onPress={() => router.push(`/arena/${arena.id}`)}
                      onHallPress={(h) => router.push(`/hall/${h.id}`)}
                    />
                  ))
                : null}

              {showEvents
                ? favEvents.map((ev) => (
                    <EventCard
                      key={`e-${ev.id}`}
                      event={ev}
                      isFavorite
                      isRegistered={eventState.registered.includes(ev.id)}
                      onPress={() => router.push("/(tabs)/events")}
                      onRegister={() => router.push("/(tabs)/events")}
                      onToggleFavorite={() => toggleEventFavorite(ev.id)}
                    />
                  ))
                : null}

              {showPasses
                ? favPromos.map((promo) => (
                    <View key={`p-${promo.id}`} style={styles.promoCard}>
                      <View style={styles.promoTop}>
                        <View style={styles.promoBadge}>
                          <Text style={styles.promoBadgeText}>{promo.badge || t("favorites.passActive")}</Text>
                        </View>
                        <Pressable
                          onPress={async () => {
                            hapticImpact();
                            setFavPromoIds(await toggleFavoritePromotionId(promo.id));
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="heart" size={18} color={c.accent} />
                        </Pressable>
                      </View>
                      <Text style={styles.promoTitle}>{promo.title}</Text>
                      <Text style={styles.promoTagline}>{promo.tagline}</Text>
                      {promo.promoCode ? (
                        <Text style={styles.promoCode}>
                          {promo.promoCode}
                        </Text>
                      ) : null}
                    </View>
                  ))
                : null}
            </>
          )}
        </ScrollView>
      )}
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
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...typography.sectionTitle,
      color: c.textPrimary,
    },
    chipsScroll: {
      flexGrow: 0,
      marginBottom: spacing.md,
    },
    chipsRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xs + 2,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.smallChip,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: {
      backgroundColor: "rgba(34, 197, 94, 0.12)",
      borderColor: c.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
    },
    chipTextActive: {
      color: c.primary,
      fontWeight: "700",
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      flexGrow: 1,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: c.textPrimary,
      textAlign: "center",
    },
    emptyText: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.button,
      paddingHorizontal: spacing.xl,
      paddingVertical: 12,
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.onPrimary,
    },
    promoCard: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.card,
    },
    promoTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    promoBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.smallChip,
      backgroundColor: "rgba(34, 197, 94, 0.12)",
    },
    promoBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: c.primary,
    },
    promoTitle: {
      ...typography.cardTitle,
      color: c.textPrimary,
    },
    promoTagline: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 4,
    },
    promoCode: {
      marginTop: spacing.sm,
      fontSize: 12,
      fontWeight: "700",
      color: c.primary,
    },
  });

