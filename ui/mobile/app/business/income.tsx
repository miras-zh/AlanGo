import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { appAlert } from "@/lib/alert";
import { useMyArenaId } from "@/lib/business";
import {
  calculateIncomeStats,
  createArenaExpense,
  deleteArenaExpense,
  type ExpenseCategory,
  type IncomeBreakdown,
} from "@/lib/businessCrmData";
import { KeyboardSheetView } from "@/components/KeyboardSheetView";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useT, type MessageKey } from "@/lib/i18n";
import { displayDate } from "@/lib/dataLabels";
import { getErrorMessage } from "@/lib/errorMessage";

const PERIODS: { key: "today" | "week" | "month" | "all"; label: MessageKey }[] = [
  { key: "today", label: "income.today" },
  { key: "week", label: "income.week" },
  { key: "month", label: "income.month" },
  { key: "all", label: "income.all" },
];

const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: MessageKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "rent", label: "expenses.catRent", icon: "business-outline" },
  { key: "salary", label: "expenses.catSalary", icon: "people-outline" },
  { key: "utilities", label: "expenses.catUtilities", icon: "flash-outline" },
  { key: "equipment", label: "expenses.catEquipment", icon: "basketball-outline" },
  { key: "marketing", label: "expenses.catMarketing", icon: "megaphone-outline" },
  { key: "other", label: "expenses.catOther", icon: "receipt-outline" },
];

function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BusinessIncomeScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { arenaId, loading: arenaLoading } = useMyArenaId();

  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "all">("month");
  const [activeTab, setActiveTab] = useState<"overview" | "expenses">("overview");
  const [stats, setStats] = useState<IncomeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Expense Modal
  const [expenseModal, setExpenseModal] = useState(false);
  const [expCat, setExpCat] = useState<ExpenseCategory>("other");
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(todayISODate);
  const [expNotes, setExpNotes] = useState("");
  const [savingExp, setSavingExp] = useState(false);

  const loadData = useCallback(async () => {
    if (arenaLoading) return;
    if (!arenaId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await calculateIncomeStats(arenaId, selectedPeriod);
      setStats(data);
    } catch {
      // keep previous stats
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [arenaId, arenaLoading, selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const catLabel = (cat: ExpenseCategory): string => {
    const found = EXPENSE_CATEGORIES.find((x) => x.key === cat);
    return found ? t(found.label) : cat;
  };

  const handleShareReport = async () => {
    hapticImpact();
    if (!stats) return;
    try {
      await Share.share({
        message: t("income.reportPnl", {
          period:
            selectedPeriod === "today"
              ? t("income.periodToday")
              : selectedPeriod === "week"
              ? t("income.periodWeek")
              : t("income.periodMonth"),
          revenue: formatNumber(stats.totalRevenue),
          collected: formatNumber(stats.collectedAmount),
          expenses: formatNumber(stats.totalExpenses),
          profit: formatNumber(stats.netProfit),
          count: stats.confirmedBookingsCount,
          util: stats.utilizationRate,
        }),
      });
    } catch {}
  };

  const handleCreateExpense = async () => {
    const amountNum = Number(expAmount.replace(/\D/g, ""));
    setSavingExp(true);
    try {
      await createArenaExpense({
        category: expCat,
        title: expTitle.trim(),
        amount: amountNum,
        expense_date: expDate.trim() || todayISODate(),
        notes: expNotes.trim(),
      });
      setExpenseModal(false);
      setExpTitle("");
      setExpAmount("");
      setExpNotes("");
      hapticSuccess();
      await loadData();
      appAlert(t("common.success"), t("income.expenseAdded"));
    } catch (err) {
      appAlert(t("common.error"), getErrorMessage(err));
    } finally {
      setSavingExp(false);
    }
  };

  const handleDeleteExpense = (id: number) => {
    hapticImpact();
    appAlert(t("income.expenseDeleteTitle"), t("income.expenseDeleteText"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteArenaExpense(id);
            await loadData();
          } catch (err) {
            appAlert(t("common.error"), getErrorMessage(err));
          }
        },
      },
    ]);
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
          <Text style={styles.headerTitle}>{t("income.titlePnl")}</Text>
          <Text style={styles.headerSub}>{t("income.subtitlePnl")}</Text>
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

      {/* Tab switcher: Overview vs Expenses */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === "overview" && styles.tabBtnActive]}
          onPress={() => {
            hapticSelection();
            setActiveTab("overview");
          }}
        >
          <Text style={[styles.tabBtnText, activeTab === "overview" && styles.tabBtnTextActive]}>
            {t("income.tabOverview")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "expenses" && styles.tabBtnActive]}
          onPress={() => {
            hapticSelection();
            setActiveTab("expenses");
          }}
        >
          <Text style={[styles.tabBtnText, activeTab === "expenses" && styles.tabBtnTextActive]}>
            {t("income.tabExpenses")} ({stats?.expenses.length ?? 0})
          </Text>
        </Pressable>
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
          {/* Main P&L Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>{t("income.netProfit")}</Text>
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

            <Text
              style={[
                styles.heroAmount,
                (stats?.netProfit ?? 0) < 0 && { color: c.error },
              ]}
            >
              {formatNumber(stats?.netProfit || 0)} ₸
            </Text>

            <View style={styles.pnlMiniRow}>
              <View style={styles.pnlMiniCol}>
                <Text style={styles.pnlMiniLabel}>{t("income.actual")}</Text>
                <Text style={styles.pnlMiniVal}>{formatNumber(stats?.totalRevenue || 0)} ₸</Text>
              </View>
              <View style={styles.pnlMiniCol}>
                <Text style={styles.pnlMiniLabel}>{t("income.collected")}</Text>
                <Text style={[styles.pnlMiniVal, { color: c.primary }]}>
                  {formatNumber(stats?.collectedAmount || 0)} ₸
                </Text>
              </View>
              <View style={styles.pnlMiniCol}>
                <Text style={styles.pnlMiniLabel}>{t("income.expensesTotal")}</Text>
                <Text style={[styles.pnlMiniVal, { color: c.error }]}>
                  -{formatNumber(stats?.totalExpenses || 0)} ₸
                </Text>
              </View>
            </View>

            {(stats?.unpaidAmount ?? 0) > 0 ? (
              <Text style={[styles.heroSub, { color: c.warning, marginTop: 8 }]}>
                {t("income.unpaidDebt")}: {formatNumber(stats?.unpaidAmount || 0)} ₸
              </Text>
            ) : (
              <Text style={styles.heroSub}>
                {stats?.confirmedBookingsCount
                  ? t("income.byBookings", { count: stats.confirmedBookingsCount })
                  : t("income.noBookings")}
              </Text>
            )}
          </View>

          {activeTab === "overview" ? (
            <>
              {/* 3 KPI Cards */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIcon, { backgroundColor: c.primarySoft }]}>
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
                  <View style={[styles.kpiIcon, { backgroundColor: c.warningSoft }]}>
                    <Ionicons name="pie-chart" size={16} color={c.warning} />
                  </View>
                  <Text style={styles.kpiValue}>
                    {stats?.period === "all" ? "—" : `${stats?.utilizationRate ?? 0}%`}
                  </Text>
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
                          <Text style={styles.hallAmount}>{formatNumber(h.revenue)} ₸</Text>
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
                          <Text style={styles.hallPercent}>
                            {t("income.percentOfRevenue", { n: percent })}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Recent Transactions */}
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
                        <Text style={styles.txAmount}>+{formatNumber(tx.amount)} ₸</Text>
                        <Text style={styles.txDate}>{displayDate(tx.date, t)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <>
              <Pressable
                style={styles.addExpenseBtn}
                onPress={() => {
                  hapticSelection();
                  setExpenseModal(true);
                }}
              >
                <Ionicons name="add-circle" size={18} color={c.onPrimary} />
                <Text style={styles.addExpenseBtnText}>{t("income.addExpense")}</Text>
              </Pressable>

              {(stats?.expenseCategories.length ?? 0) > 0 ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>{t("expenses.category")}</Text>
                  <View style={styles.hallsList}>
                    {stats?.expenseCategories.map((cat) => {
                      const pct =
                        stats.totalExpenses > 0
                          ? Math.min(100, Math.round((cat.amount / stats.totalExpenses) * 100))
                          : 0;
                      return (
                        <View key={cat.category} style={styles.hallRevenueItem}>
                          <View style={styles.hallHeaderRow}>
                            <Text style={styles.hallTitle}>{catLabel(cat.category)}</Text>
                            <Text style={[styles.hallAmount, { color: c.error }]}>
                              -{formatNumber(cat.amount)} ₸
                            </Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressBar,
                                { backgroundColor: c.error, width: `${Math.max(4, pct)}%` },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{t("income.tabExpenses")}</Text>
                <View style={styles.txList}>
                  {!stats?.expenses.length ? (
                    <Text style={styles.emptyNote}>{t("income.noExpenses")}</Text>
                  ) : null}
                  {stats?.expenses.map((exp) => (
                    <View key={exp.id} style={styles.txItem}>
                      <View style={[styles.txIconBox, { backgroundColor: "rgba(240,68,82,0.14)" }]}>
                        <Ionicons name="trending-down" size={18} color={c.error} />
                      </View>
                      <View style={styles.txInfo}>
                        <Text style={styles.txClient}>{exp.title}</Text>
                        <Text style={styles.txMeta}>
                          {catLabel(exp.category)} • {displayDate(exp.expense_date, t)}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={[styles.txAmount, { color: c.error }]}>
                          -{formatNumber(exp.amount)} ₸
                        </Text>
                        <Pressable onPress={() => handleDeleteExpense(exp.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={15} color={c.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Add Expense Modal */}
      <Modal
        visible={expenseModal}
        animationType="slide"
        transparent
        onRequestClose={() => setExpenseModal(false)}
      >
        <KeyboardSheetView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("income.addExpense")}</Text>
              <Pressable onPress={() => setExpenseModal(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <Text style={styles.inputLabel}>{t("expenses.category")}</Text>
              <View style={styles.catGrid}>
                {EXPENSE_CATEGORIES.map((cat) => {
                  const active = expCat === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      style={[styles.catChip, active && styles.catChipActive]}
                      onPress={() => setExpCat(cat.key)}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={14}
                        color={active ? c.primary : c.textSecondary}
                      />
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                        {t(cat.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>{t("expenses.title")}</Text>
              <TextInput
                style={styles.input}
                value={expTitle}
                onChangeText={setExpTitle}
                placeholder={t("expenses.titlePlaceholder")}
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("expenses.amount")}</Text>
              <TextInput
                style={styles.input}
                value={expAmount}
                onChangeText={setExpAmount}
                keyboardType="numeric"
                placeholder="25000"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("expenses.date")}</Text>
              <TextInput
                style={styles.input}
                value={expDate}
                onChangeText={setExpDate}
                placeholder={todayISODate()}
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("expenses.notes")}</Text>
              <TextInput
                style={styles.input}
                value={expNotes}
                onChangeText={setExpNotes}
                placeholder={t("expenses.notes")}
                placeholderTextColor={c.textMuted}
              />

              <Pressable
                style={[styles.saveExpBtn, savingExp && { opacity: 0.6 }]}
                disabled={savingExp}
                onPress={handleCreateExpense}
              >
                <Text style={styles.saveExpBtnText}>
                  {savingExp ? t("common.saving") : t("common.save")}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardSheetView>
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
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    periodRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 8,
    },
    periodChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    periodChipActive: {
      backgroundColor: c.primarySoft,
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
    tabRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
      gap: 8,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.hairline,
      alignItems: "center",
    },
    tabBtnActive: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    tabBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
    },
    tabBtnTextActive: {
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
      paddingBottom: 40,
    },
    heroCard: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      padding: 18,
      borderWidth: 1,
      borderColor: c.subtle,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroLabel: {
      fontSize: 13,
      color: c.textSecondary,
      fontWeight: "600",
    },
    growthBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    growthText: {
      fontSize: 11,
      fontWeight: "800",
      color: c.primary,
    },
    heroAmount: {
      fontSize: 30,
      fontWeight: "900",
      color: c.textPrimary,
      marginTop: 6,
    },
    pnlMiniRow: {
      flexDirection: "row",
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
      gap: 8,
    },
    pnlMiniCol: {
      flex: 1,
    },
    pnlMiniLabel: {
      fontSize: 11,
      color: c.textMuted,
    },
    pnlMiniVal: {
      fontSize: 13,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: 2,
    },
    heroSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 6,
    },
    kpiRow: {
      flexDirection: "row",
      gap: 10,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: c.hairline,
      gap: 4,
    },
    kpiIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    kpiValue: {
      fontSize: 14,
      fontWeight: "800",
      color: c.textPrimary,
    },
    kpiTitle: {
      fontSize: 11,
      color: c.textMuted,
    },
    sectionCard: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      padding: 16,
      borderWidth: 1,
      borderColor: c.hairline,
      gap: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: c.textPrimary,
    },
    hallsList: {
      gap: 12,
    },
    emptyNote: {
      fontSize: 13,
      color: c.textMuted,
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
      fontSize: 13,
      fontWeight: "700",
      color: c.textPrimary,
    },
    hallAmount: {
      fontSize: 13,
      fontWeight: "800",
      color: c.primary,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.background,
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      backgroundColor: c.primary,
      borderRadius: 3,
    },
    hallSubRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    hallSubText: {
      fontSize: 11,
      color: c.textMuted,
    },
    hallPercent: {
      fontSize: 11,
      color: c.textSecondary,
      fontWeight: "600",
    },
    txList: {
      gap: 10,
    },
    txItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    txIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    txInfo: {
      flex: 1,
    },
    txClient: {
      fontSize: 13,
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
      fontSize: 13,
      fontWeight: "800",
      color: c.primary,
    },
    txDate: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    addExpenseBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: radii.button,
      paddingVertical: 13,
    },
    addExpenseBtnText: {
      fontSize: 14,
      fontWeight: "800",
      color: c.onPrimary,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: c.overlay,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.modal,
      borderTopRightRadius: radii.modal,
      padding: spacing.xl,
      maxHeight: "90%",
      borderTopWidth: 1,
      borderColor: c.glassBorder,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textSecondary,
    },
    catGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    catChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: radii.smallChip,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    catChipActive: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    catChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
    },
    catChipTextActive: {
      color: c.primary,
      fontWeight: "700",
    },
    input: {
      backgroundColor: c.background,
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      color: c.textPrimary,
    },
    saveExpBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.button,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 6,
    },
    saveExpBtnText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.onPrimary,
    },
  });
