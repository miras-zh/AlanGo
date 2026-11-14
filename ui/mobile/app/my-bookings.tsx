import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, typography } from "@/constants/theme";
import { hapticSelection } from "@/lib/haptics";
import { formatNumber, useT } from "@/lib/i18n";
import { getMyBookings, type Booking } from "@/lib/sportRentData";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type FilterTab = "upcoming" | "history" | "all";

function localTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isUpcomingBooking(b: Booking, todayISO: string): boolean {
  if (b.status === "cancelled" || b.status === "rejected") return false;
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return true;
  return b.date >= todayISO;
}

export default function MyBookingsScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<FilterTab>("upcoming");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const list = await getMyBookings();
      setBookings(list);
    } catch {
      setError(true);
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

  const todayISO = useMemo(() => localTodayISO(), []);

  const filtered = useMemo(() => {
    if (tab === "all") return bookings;
    if (tab === "upcoming") return bookings.filter((b) => isUpcomingBooking(b, todayISO));
    return bookings.filter((b) => !isUpcomingBooking(b, todayISO));
  }, [bookings, tab, todayISO]);

  const statusMeta = (status: Booking["status"]) => {
    switch (status) {
      case "confirmed":
        return { label: t("status.confirmed"), color: c.primary, bg: "rgba(34, 197, 94, 0.12)" };
      case "pending":
        return { label: t("status.pending"), color: "#EAB308", bg: "rgba(234, 179, 8, 0.12)" };
      case "rejected":
        return { label: t("status.rejected"), color: c.error, bg: "rgba(239, 68, 68, 0.12)" };
      case "cancelled":
      default:
        return { label: t("status.cancelled"), color: c.textMuted, bg: c.surfaceElevated };
    }
  };

  const formatDuration = (mins: number) => {
    if (mins % 60 === 0) return t("duration.hours", { h: mins / 60 });
    return t("duration.hoursMinutes", { h: Math.floor(mins / 60), m: mins % 60 });
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "upcoming", label: t("myBookings.upcoming") },
    { id: "history", label: t("myBookings.history") },
    { id: "all", label: t("myBookings.all") },
  ];

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
        <Text style={styles.headerTitle}>{t("myBookings.title")}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.tabsRow}>
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => {
                hapticSelection();
                setTab(item.id);
              }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={c.textMuted} />
          <Text style={styles.emptyTitle}>{t("myBookings.loadError")}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              hapticSelection();
              load();
            }}
          >
            <Text style={styles.primaryBtnText}>{t("myBookings.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={32} color={c.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t("myBookings.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("myBookings.emptyText")}</Text>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  hapticSelection();
                  router.replace("/(tabs)/items");
                }}
              >
                <Text style={styles.primaryBtnText}>{t("myBookings.findHall")}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const meta = statusMeta(item.status);
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => {
                  if (!item.hallId) return;
                  hapticSelection();
                  router.push(`/hall/${item.hallId}`);
                }}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={styles.hallTitle} numberOfLines={1}>
                      {item.hallTitle}
                    </Text>
                    {item.arenaTitle ? (
                      <Text style={styles.arenaTitle} numberOfLines={1}>
                        {item.arenaTitle}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaList}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color={c.primary} />
                    <Text style={styles.metaText}>
                      {item.date} · {item.timeSlot} ({formatDuration(item.durationMinutes || 60)})
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.codeText}>
                    {t("myBookings.code", { code: item.id })}
                  </Text>
                  <Text style={styles.priceText}>
                    {formatNumber(item.totalPrice || 0)} ₸
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
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
    tabsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    tabChip: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: radii.smallChip,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    tabChipActive: {
      backgroundColor: "rgba(34, 197, 94, 0.12)",
      borderColor: c.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
    },
    tabTextActive: {
      color: c.primary,
      fontWeight: "700",
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      flexGrow: 1,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.card,
    },
    cardPressed: {
      opacity: 0.94,
      borderColor: c.primary,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    hallTitle: {
      ...typography.cardTitle,
      color: c.textPrimary,
    },
    arenaTitle: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radii.smallChip,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "700",
    },
    metaList: {
      marginTop: spacing.sm + 2,
      gap: 4,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaText: {
      fontSize: 13,
      color: c.textSecondary,
      fontWeight: "500",
    },
    cardFooter: {
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    codeText: {
      fontSize: 12,
      color: c.textMuted,
      fontWeight: "600",
    },
    priceText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.textPrimary,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
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
      backgroundColor: "rgba(34, 197, 94, 0.1)",
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
  });
