import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  cancelSubscriptionRequest,
  fetchMySubscription,
  requestSubscriptionPlan,
  type SubscriptionInfo,
  type SubscriptionPlan,
} from "@/lib/user";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, tr, useT } from "@/lib/i18n";
import { dayMonthYear } from "@/lib/dataLabels";

// Business subscription: the current plan, the plan catalog and a request to
// switch. Paid plans are activated by an administrator after the request;
// clients have no subscription (the backend answers 403 for them).

function formatPrice(plan: SubscriptionPlan): string {
  if (plan.price_on_request) return tr("sub.onRequest");
  if (plan.price === 0) return tr("sub.free");
  return tr("sub.perMonth", { price: formatNumber(plan.price) });
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dayMonthYear(d);
}

export default function BusinessSubscriptionScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSub(await fetchMySubscription());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, t("sub.loadError")));
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

  const pending = sub?.pending_request?.status === "pending" ? sub.pending_request : null;
  const currentPlan = sub?.plans.find((p) => p.id === sub.current);
  const pendingPlan = pending ? sub?.plans.find((p) => p.id === pending.requested_plan) : undefined;
  const expires = formatDate(sub?.expires_at);

  const handleRequest = (plan: SubscriptionPlan) => {
    hapticSelection();
    Alert.alert(
      t("sub.planTitle", { name: plan.name }),
      t("sub.planText", { price: formatPrice(plan) }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("sub.sendRequest"),
          onPress: async () => {
            setBusyPlan(plan.id);
            try {
              await requestSubscriptionPlan(plan.id);
              await load();
              hapticSuccess();
              Alert.alert(t("sub.sentTitle"), t("sub.sentText"));
            } catch (err) {
              Alert.alert(t("sub.sendError"), getErrorMessage(err));
            } finally {
              setBusyPlan(null);
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    hapticSelection();
    Alert.alert(t("sub.cancelTitle"), undefined, [
      { text: t("common.no"), style: "cancel" },
      {
        text: t("sub.cancel"),
        style: "destructive",
        onPress: async () => {
          try {
            await cancelSubscriptionRequest();
            await load();
          } catch (err) {
            Alert.alert(t("common.error"), getErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          hitSlop={10}
          onPress={() => {
            hapticSelection();
            if (router.canGoBack()) router.back();
            else router.replace("/business");
          }}
        >
          <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("sub.title")}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : error && !sub ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={c.primary}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {/* Current plan */}
          <View style={styles.currentCard}>
            <View style={styles.currentIcon}>
              <Ionicons name="ribbon" size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.currentLabel}>{t("sub.current")}</Text>
              <Text style={styles.currentName}>{currentPlan?.name ?? sub?.current}</Text>
              <Text style={styles.currentSub}>
                {expires ? t("sub.validUntil", { date: expires }) : currentPlan ? formatPrice(currentPlan) : ""}
              </Text>
            </View>
          </View>

          {/* Pending request */}
          {pending ? (
            <View style={styles.pendingCard}>
              <Ionicons name="time-outline" size={20} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>
                  {t("sub.pendingFor", { name: pendingPlan?.name ?? pending.requested_plan })}
                </Text>
                <Text style={styles.pendingSub}>{t("sub.pendingText")}</Text>
              </View>
              <Pressable onPress={handleCancel} hitSlop={8} style={styles.pendingCancel}>
                <Text style={styles.pendingCancelText}>{t("sub.cancel")}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>{t("sub.plans")}</Text>
          {sub?.plans.map((plan) => {
            const isCurrent = plan.id === sub.current;
            const isPending = pending?.requested_plan === plan.id;
            return (
              <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardActive]}>
                <View style={styles.planHead}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
                </View>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={c.primary} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
                {isCurrent ? (
                  <View style={[styles.planBtn, styles.planBtnGhost]}>
                    <Text style={styles.planBtnGhostText}>{t("sub.yourPlan")}</Text>
                  </View>
                ) : isPending ? (
                  <View style={[styles.planBtn, styles.planBtnGhost]}>
                    <Text style={styles.planBtnGhostText}>{t("sub.underReview")}</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.planBtn, pressed && { opacity: 0.85 }]}
                    disabled={busyPlan !== null}
                    onPress={() => handleRequest(plan)}
                  >
                    {busyPlan === plan.id ? (
                      <ActivityIndicator color={c.onPrimary} />
                    ) : (
                      <Text style={styles.planBtnText}>{t("sub.sendRequest")}</Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}

          <Text style={styles.footnote}>
            {t("sub.footnote")}
          </Text>
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
      backgroundColor: c.surface,
    },
    headerTitle: {
      ...typography.sectionTitle,
      fontWeight: "800",
      color: c.textPrimary,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.screenHorizontal,
      gap: spacing.md,
    },
    errorText: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: "center",
    },
    retryBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radii.button,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    retryText: {
      ...typography.button,
      color: c.textPrimary,
    },
    scroll: {
      padding: spacing.screenHorizontal,
      paddingBottom: spacing.xxl * 2,
      gap: spacing.card,
    },
    currentCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.surface,
    },
    currentIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceElevated,
    },
    currentLabel: {
      ...typography.caption,
      color: c.textSecondary,
    },
    currentName: {
      ...typography.sectionTitle,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: 2,
    },
    currentSub: {
      ...typography.caption,
      color: c.primary,
      marginTop: 2,
    },
    pendingCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
    },
    pendingTitle: {
      ...typography.cardTitle,
      color: c.textPrimary,
    },
    pendingSub: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 2,
    },
    pendingCancel: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.error,
    },
    pendingCancelText: {
      ...typography.caption,
      fontWeight: "700",
      color: c.error,
    },
    sectionLabel: {
      ...typography.caption,
      fontWeight: "700",
      color: c.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
    },
    planCard: {
      padding: spacing.lg,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      gap: spacing.sm,
    },
    planCardActive: {
      borderColor: c.primary,
    },
    planHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    planName: {
      ...typography.sectionTitle,
      fontWeight: "800",
      color: c.textPrimary,
    },
    planPrice: {
      ...typography.cardTitle,
      color: c.primary,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    featureText: {
      ...typography.body,
      color: c.textSecondary,
      flex: 1,
    },
    planBtn: {
      marginTop: spacing.sm,
      height: 46,
      borderRadius: radii.button,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary,
    },
    planBtnText: {
      ...typography.button,
      color: c.onPrimary,
    },
    planBtnGhost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.border,
    },
    planBtnGhostText: {
      ...typography.button,
      color: c.textSecondary,
    },
    footnote: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: spacing.sm,
    },
  });
