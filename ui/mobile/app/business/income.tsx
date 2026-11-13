import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMyArenaId } from "@/lib/business";
import {
  IncomeBreakdown,
  calculateIncomeStats,
} from "@/lib/businessCrmData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useT, type MessageKey } from "@/lib/i18n";
import { displayDate } from "@/lib/dataLabels";

const PERIODS: { key: "today" | "week" | "month" | "all"; label: MessageKey }[] = [
  { key: "today", label: "income.today" },
  { key: "week", label: "income.week" },
  { key: "month", label: "income.month" },
  { key: "all", label: "income.all" },
];

export default function BusinessIncomeScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { arenaId, loading: arenaLoading } = useMyArenaId();

  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "all">("month");
  const [stats, setStats] = useState<IncomeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (arenaLoading) return;
    if (!arenaId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const data = await calculateIncomeStats(arenaId, selectedPeriod);
    setStats(data);
    setLoading(false);
    setRefreshing(false);
  }, [arenaId, arenaLoading, selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShareReport = async () => {
    hapticImpact();
    if (!stats) return;
    try {
      await Share.share({
        message: t("income.report", {
          period:
            selectedPeriod === "today"
              ? t("income.periodToday")
              : selectedPeriod === "week"
              ? t("income.periodWeek")
              : t("income.periodMonth"),
          revenue: formatNumber(stats.totalRevenue),
          count: stats.confirmedBookingsCount,
          avg: formatNumber(stats.averageCheckPerHour ?? 0),
          util: stats.utilizationRate,
        }),
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle}>{t("income.title")}</Text>
          <Text style={styles.headerSub}>{t("income.subtitle")}</Text>
        </View>

        <Pressable style={styles.shareBtn} onPress={handleShareReport} hitSlop={10}>
          <Ionicons name="share-outline" size={20} color={c.primary} />
        </Pressable>
      </View>

      {/* Period Chips */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = selectedPeriod === p.key;
          return (
            <Pressable
              key={p.key}
              style={[styles.periodChip, active && styles.periodChipActive]}
              onPress={() => {
                hapticSelection();
                setSelectedPeriod(p.key);
              }}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {t(p.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={c.primary} size="small" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
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
        >
          {/* Main Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>{t("income.actual")}</Text>
              {stats?.growthPercent != null ? (
                <View style={styles.growthBadge}>
                  <Ionicons
                    name={stats.growthPercent >= 0 ? "trending-up" : "trending-down"}
                    size={13}
                    color={stats.growthPercent >= 0 ? c.primary : c.error}
                  />
                  <Text style={[styles.growthText, stats.growthPercent < 0 && { color: c.error }]}>
                    {stats.growthPercent >= 0 ? "+" : ""}
                    {stats.growthPercent}%
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.heroAmount}>
              {formatNumber(stats?.totalRevenue || 0)} ₸
            </Text>

            <Text style={styles.heroSub}>
              {stats?.confirmedBookingsCount
                ? t("income.byBookings", { count: stats.confirmedBookingsCount })
                : t("income.noBookings")}
            </Text>
          </View>

          {/* 3 KPI Cards */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
                <Ionicons name="time" size={16} color={c.primary} />
              </View>
              <Text style={styles.kpiValue}>
                {t("income.hours", { n: formatNumber(stats?.hoursPlayed ?? 0) })}
              </Text>
              <Text style={styles.kpiTitle}>{t("income.hoursPlayed")}</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                <Ionicons name="cash" size={16} color="#3B82F6" />
              </View>
              <Text style={styles.kpiValue}>
                {stats?.averageCheckPerHour != null
                  ? `${formatNumber(stats.averageCheckPerHour)} ₸`
                  : "—"}
              </Text>
              <Text style={styles.kpiTitle}>{t("income.avgCheck")}</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "rgba(234, 179, 8, 0.15)" }]}>
                <Ionicons name="pie-chart" size={16} color="#EAB308" />
              </View>
              <Text style={styles.kpiValue}>{stats?.period === "all" ? "—" : `${stats?.utilizationRate ?? 0}%`}</Text>
              <Text style={styles.kpiTitle}>{t("income.utilization")}</Text>
            </View>
          </View>

          {/* Breakdown By Halls */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("income.byVenue")}</Text>
            <View style={styles.hallsList}>
              {!stats?.hallRevenues.length ? (
                <Text style={styles.emptyNote}>{t("income.noHalls")}</Text>
              ) : null}
              {stats?.hallRevenues.map((h) => {
                const total = stats.totalRevenue;
                const percent = total > 0 ? Math.min(100, Math.round((h.revenue / total) * 100)) : 0;

                return (
                  <View key={h.hallId} style={styles.hallRevenueItem}>
                    <View style={styles.hallHeaderRow}>
                      <Text style={styles.hallTitle}>{h.hallTitle}</Text>
                      <Text style={styles.hallAmount}>
                        {formatNumber(h.revenue)} ₸
                      </Text>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressBar,
                          { width: `${h.revenue > 0 ? Math.max(4, percent) : 0}%` },
                        ]}
                      />
                    </View>

                    <View style={styles.hallSubRow}>
                      <Text style={styles.hallSubText}>
                        {t("income.rentHours", { n: formatNumber(h.hoursCount) })}
                      </Text>
                      <Text style={styles.hallPercent}>{t("income.percentOfRevenue", { n: percent })}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Recent Paid Transactions */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("income.recent")}</Text>
            <View style={styles.txList}>
              {!stats?.recentTransactions.length ? (
                <Text style={styles.emptyNote}>{t("income.noRecent")}</Text>
              ) : null}
              {stats?.recentTransactions.map((tx) => (
                <View key={tx.id} style={styles.txItem}>
                  <View style={styles.txIconBox}>
                    <Ionicons name="card-outline" size={18} color={c.primary} />
                  </View>

                  <View style={styles.txInfo}>
                    <Text style={styles.txClient}>{tx.clientName}</Text>
                    <Text style={styles.txMeta}>
                      {tx.hallTitle} • {tx.timeSlot}
                    </Text>
                  </View>

                  <View style={styles.txAmountWrap}>
                    <Text style={styles.txAmount}>
                      +{formatNumber(tx.amount)} ₸
                    </Text>
                    <Text style={styles.txDate}>{displayDate(tx.date, t)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  backBtn: {
    paddingRight: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  periodRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.background,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.hairline,
  },
  periodChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: c.primary,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  periodTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 13,
    color: c.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  emptyNote: {
    fontSize: 13,
    color: c.textSecondary,
    lineHeight: 19,
  },
  txDate: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 2,
  },
  growthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  growthText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.primary,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: c.textPrimary,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: "800",
    color: c.textPrimary,
  },
  kpiTitle: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: c.textPrimary,
    marginBottom: 14,
  },
  hallsList: {
    gap: 14,
  },
  hallRevenueItem: {
    gap: 6,
  },
  hallHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hallTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  hallAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: c.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.hairline,
    overflow: "hidden",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },
  hallSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hallSubText: {
    fontSize: 11,
    color: c.textSecondary,
  },
  hallPercent: {
    fontSize: 11,
    color: c.textMuted,
    fontWeight: "600",
  },
  txList: {
    gap: 12,
  },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  txIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: {
    flex: 1,
  },
  txClient: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  txMeta: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 2,
  },
  txAmountWrap: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: c.primary,
  },
  txMethodBadge: {
    backgroundColor: c.hairline,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  txMethodText: {
    fontSize: 10,
    color: c.textSecondary,
    fontWeight: "600",
  },
});

