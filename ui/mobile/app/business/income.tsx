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
import { plural } from "@/lib/plural";
import {
  IncomeBreakdown,
  calculateIncomeStats,
} from "@/lib/businessCrmData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

const PERIODS: { key: "today" | "week" | "month" | "all"; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "7 дней" },
  { key: "month", label: "30 дней" },
  { key: "all", label: "Все время" },
];

export default function BusinessIncomeScreen() {
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
        message: `📊 Финансовый отчет спорткомплекса (за ${
          selectedPeriod === "today"
            ? "сегодня"
            : selectedPeriod === "week"
            ? "неделю"
            : "месяц"
        }):\nОбщая выручка: ${stats.totalRevenue.toLocaleString(
          "ru-RU"
        )} ₸\nПодтвержденных броней: ${
          stats.confirmedBookingsCount
        }\nСредний чек/час: ${(stats.averageCheckPerHour ?? 0).toLocaleString(
          "ru-RU"
        )} ₸\nЗагрузка кортов: ${stats.utilizationRate}%\nСформировано в AlanGo.`,
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
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle}>Финансы и выручка</Text>
          <Text style={styles.headerSub}>Аналитика доходов спорткомплекса</Text>
        </View>

        <Pressable style={styles.shareBtn} onPress={handleShareReport} hitSlop={10}>
          <Ionicons name="share-outline" size={20} color="#22C55E" />
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
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#22C55E" size="small" />
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
              tintColor="#22C55E"
            />
          }
        >
          {/* Main Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>Фактическая выручка</Text>
              {stats?.growthPercent != null ? (
                <View style={styles.growthBadge}>
                  <Ionicons
                    name={stats.growthPercent >= 0 ? "trending-up" : "trending-down"}
                    size={13}
                    color={stats.growthPercent >= 0 ? "#22C55E" : "#EF4444"}
                  />
                  <Text style={[styles.growthText, stats.growthPercent < 0 && { color: "#EF4444" }]}>
                    {stats.growthPercent >= 0 ? "+" : ""}
                    {stats.growthPercent}%
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.heroAmount}>
              {(stats?.totalRevenue || 0).toLocaleString("ru-RU")} ₸
            </Text>

            <Text style={styles.heroSub}>
              {stats?.confirmedBookingsCount
                ? `По ${stats.confirmedBookingsCount} ${plural(stats.confirmedBookingsCount, ["подтверждённой брони", "подтверждённым броням", "подтверждённым броням"])}`
                : "Подтверждённых броней за период пока нет"}
            </Text>
          </View>

          {/* 3 KPI Cards */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
                <Ionicons name="time" size={16} color="#22C55E" />
              </View>
              <Text style={styles.kpiValue}>
                {(stats?.hoursPlayed ?? 0).toLocaleString("ru-RU")} ч
              </Text>
              <Text style={styles.kpiTitle}>Сыграно часов</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                <Ionicons name="cash" size={16} color="#3B82F6" />
              </View>
              <Text style={styles.kpiValue}>
                {stats?.averageCheckPerHour != null
                  ? `${stats.averageCheckPerHour.toLocaleString("ru-RU")} ₸`
                  : "—"}
              </Text>
              <Text style={styles.kpiTitle}>Ср. чек / час</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "rgba(234, 179, 8, 0.15)" }]}>
                <Ionicons name="pie-chart" size={16} color="#EAB308" />
              </View>
              <Text style={styles.kpiValue}>{stats?.period === "all" ? "—" : `${stats?.utilizationRate ?? 0}%`}</Text>
              <Text style={styles.kpiTitle}>Загрузка кортов</Text>
            </View>
          </View>

          {/* Breakdown By Halls */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Выручка по площадкам</Text>
            <View style={styles.hallsList}>
              {!stats?.hallRevenues.length ? (
                <Text style={styles.emptyNote}>Добавьте залы — здесь появится выручка по каждой площадке.</Text>
              ) : null}
              {stats?.hallRevenues.map((h) => {
                const total = stats.totalRevenue;
                const percent = total > 0 ? Math.min(100, Math.round((h.revenue / total) * 100)) : 0;

                return (
                  <View key={h.hallId} style={styles.hallRevenueItem}>
                    <View style={styles.hallHeaderRow}>
                      <Text style={styles.hallTitle}>{h.hallTitle}</Text>
                      <Text style={styles.hallAmount}>
                        {h.revenue.toLocaleString("ru-RU")} ₸
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
                        {h.hoursCount.toLocaleString("ru-RU")} ч аренды
                      </Text>
                      <Text style={styles.hallPercent}>{percent}% от выручки</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Recent Paid Transactions */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Недавние поступления</Text>
            <View style={styles.txList}>
              {!stats?.recentTransactions.length ? (
                <Text style={styles.emptyNote}>Пока нет поступлений за выбранный период.</Text>
              ) : null}
              {stats?.recentTransactions.map((tx) => (
                <View key={tx.id} style={styles.txItem}>
                  <View style={styles.txIconBox}>
                    <Ionicons name="card-outline" size={18} color="#22C55E" />
                  </View>

                  <View style={styles.txInfo}>
                    <Text style={styles.txClient}>{tx.clientName}</Text>
                    <Text style={styles.txMeta}>
                      {tx.hallTitle} • {tx.timeSlot}
                    </Text>
                  </View>

                  <View style={styles.txAmountWrap}>
                    <Text style={styles.txAmount}>
                      +{tx.amount.toLocaleString("ru-RU")} ₸
                    </Text>
                    <Text style={styles.txDate}>{tx.date}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  backBtn: {
    paddingRight: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 12,
    color: "#8E9B94",
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
    backgroundColor: "#131916",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  periodChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#0B0F0D",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  periodChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#22C55E",
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E9B94",
  },
  periodTextActive: {
    color: "#22C55E",
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
    backgroundColor: "#131916",
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
    color: "#8E9B94",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  emptyNote: {
    fontSize: 13,
    color: "#8E9B94",
    lineHeight: 19,
  },
  txDate: {
    fontSize: 11,
    color: "#8E9B94",
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
    color: "#22C55E",
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 8,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    color: "#6B7C72",
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#FFFFFF",
  },
  kpiTitle: {
    fontSize: 11,
    color: "#8E9B94",
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: "#131916",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
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
    color: "#FFFFFF",
  },
  hallAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22C55E",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  hallSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hallSubText: {
    fontSize: 11,
    color: "#8E9B94",
  },
  hallPercent: {
    fontSize: 11,
    color: "#6B7C72",
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
    color: "#FFFFFF",
  },
  txMeta: {
    fontSize: 11,
    color: "#8E9B94",
    marginTop: 2,
  },
  txAmountWrap: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22C55E",
  },
  txMethodBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  txMethodText: {
    fontSize: 10,
    color: "#8E9B94",
    fontWeight: "600",
  },
});

