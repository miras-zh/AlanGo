import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { ArenaCard, arenaMinPrice } from "@/components/ArenaCard";
import { StandaloneTabBar } from "@/components/LiquidGlassTabBar";
import { ArenaWithHalls, getArenasWithHalls } from "@/lib/sportRentData";
import { getSelectedCity } from "@/lib/cities";
import { plural } from "@/lib/plural";
import { hapticSelection } from "@/lib/haptics";
import { colors, radii, spacing, typography } from "@/constants/theme";

const SPORTS = ["Все", "Футбол", "Мини-футбол", "Баскетбол", "Волейбол", "Теннис", "Сквош и падл", "Хоккей"];

const SORTS = [
  { key: "rating", label: "Рейтинг" },
  { key: "halls", label: "Больше залов" },
  { key: "price", label: "Дешевле" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

// Sports complexes (arenas) — separate from the halls catalog: each card is
// a whole venue with several halls inside.
export default function ArenasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sport?: string }>();
  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState(params.sport && SPORTS.includes(params.sport) ? params.sport : "Все");
  const [sort, setSort] = useState<SortKey>("rating");

  const load = useCallback(async () => {
    try {
      const [list, selectedCity] = await Promise.all([getArenasWithHalls(), getSelectedCity()]);
      setArenas(list);
      setCity(selectedCity);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = arenas.filter((a) => {
      if (city && a.city && a.city.toLowerCase() !== city.toLowerCase()) return false;
      if (sport !== "Все" && !a.availableSports.some((s) => s.toLowerCase() === sport.toLowerCase())) return false;
      if (q && !`${a.title} ${a.address}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "halls") return b.halls.length - a.halls.length;
      if (sort === "price") {
        const pa = arenaMinPrice(a) ?? Number.MAX_SAFE_INTEGER;
        const pb = arenaMinPrice(b) ?? Number.MAX_SAFE_INTEGER;
        return pa - pb;
      }
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [arenas, city, sport, query, sort]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          hitSlop={10}
          onPress={() => {
            hapticSelection();
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Спорткомплексы</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {city ? `г. ${city} · ` : ""}
            {visible.length} {plural(visible.length, ["комплекс", "комплекса", "комплексов"])}
          </Text>
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.filters}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Название или адрес"
                placeholderTextColor={colors.textSecondary}
                style={styles.searchInput}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SPORTS.map((s) => {
                const active = s === sport;
                return (
                  <Pressable
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      hapticSelection();
                      setSport(s);
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Сортировка:</Text>
              {SORTS.map((o) => {
                const active = o.key === sort;
                return (
                  <Pressable
                    key={o.key}
                    hitSlop={6}
                    onPress={() => {
                      hapticSelection();
                      setSort(o.key);
                    }}
                  >
                    <Text style={[styles.sortOption, active && styles.sortOptionActive]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.card }} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={44} color={colors.border} />
              <Text style={styles.emptyTitle}>Спорткомплексы не найдены</Text>
              <Text style={styles.emptySub}>Попробуйте другой вид спорта или запрос.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ArenaCard
            arena={item}
            onPress={() => router.push(`/arena/${item.id}`)}
            onHallPress={(h) => router.push(`/hall/${h.id}`)}
          />
        )}
      />
      <StandaloneTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.screenTitle,
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: spacing.bottomScrollPadding,
  },
  filters: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  chips: {
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.primary,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sortLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sortOption: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  sortOptionActive: {
    color: colors.primary,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  emptySub: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
