import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser } from "@/lib/auth";
import { fetchMyBusiness, type BusinessArena } from "@/lib/business";
import {
  Arena,
  Booking,
  getStoredArenas,
  getOwnArenaBookings,
  getStoredHalls,
  Hall,
  updateBookingStatus,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useT } from "@/lib/i18n";
import { cityLabel, displayDate, sportLabel, surfaceLabel } from "@/lib/dataLabels";

export default function BusinessDashboardScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser());
  const [arena, setArena] = useState<Arena | null>(null);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const currentUser = getSessionUser();
    setUser(currentUser);

    // Real business owners: resolve *their* arena on the server. The old
    // fallback to arena #1 showed someone else's complex to every new owner.
    let ownArena: BusinessArena | null = null;
    if (currentUser && !String(currentUser.id).startsWith("staff_") && currentUser.role === "business") {
      try {
        ownArena = (await fetchMyBusiness()).arena;
      } catch {
        // offline — fall back to the cached session arenaId below
      }
    }
    const arenaId = ownArena?.id ?? currentUser?.arenaId;

    const [allArenas, allHalls, allBookings] = await Promise.all([
      getStoredArenas(),
      getStoredHalls(),
      arenaId ? getOwnArenaBookings().catch(() => [] as Booking[]) : Promise.resolve([] as Booking[]),
    ]);

    const listed = arenaId ? allArenas.find((a) => a.id === arenaId) : undefined;
    const myArena: Arena | null =
      listed ??
      (ownArena
        ? {
            id: ownArena.id,
            ownerId: Number(currentUser?.id) || 0,
            ownerEmail: currentUser?.email ?? "",
            title: ownArena.title,
            category: ownArena.category,
            city: ownArena.city,
            address: ownArena.address,
            phone: "",
            rating: 0,
            reviewsCount: 0,
            imageUrl: "",
            description: "",
            features: [],
            workingHours: "",
            hallsCount: ownArena.halls_count,
            sports: ownArena.sports as Arena["sports"],
          }
        : null);
    const myHalls = arenaId ? allHalls.filter((h) => h.arenaId === arenaId) : [];
    const myBookings = arenaId ? allBookings.filter((b) => b.arenaId === arenaId) : [];

    setArena(myArena);
    setHalls(myHalls);
    setBookings(myBookings);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todayRevenue = bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.badgeLabel}>
            {user?.staffRole ? t("bizHome.staffBadge") : t("bizHome.badge")}
          </Text>
          <Text style={styles.arenaTitle} numberOfLines={1}>
            {arena?.title || t("bizHome.myComplex")}
          </Text>
          <View style={styles.cityRow}>
            <Ionicons name="location-sharp" size={13} color={c.primary} />
            <Text style={styles.cityText}>{arena?.address || (arena?.city ? t("bizHome.cityPrefix", { city: cityLabel(arena.city, t) }) : t("bizHome.noAddress"))}</Text>
            {user?.staffMemberId && (
              <View style={styles.staffActivePill}>
                <Ionicons name="person-circle" size={13} color={c.primary} />
                <Text style={styles.staffActivePillText}>{user.name}</Text>
              </View>
            )}
          </View>
        </View>

        <Pressable
          style={styles.previewBtn}
          onPress={() => {
            hapticSelection();
            if (arena) router.push(`/arena/${arena.id}`);
          }}
        >
          <Ionicons name="eye-outline" size={18} color={c.primary} />
          <Text style={styles.previewBtnText}>{t("bizHome.clientView")}</Text>
        </Pressable>
      </View>

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
        {/* KPI Cards Grid */}
        <View style={styles.kpiRow}>
          <Pressable
            style={styles.kpiCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/income");
            }}
          >
            <View style={styles.kpiIconWrap}>
              <Ionicons name="cash-outline" size={20} color={c.primary} />
            </View>
            <Text style={styles.kpiValue}>
              {formatNumber(todayRevenue)} ₸
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={styles.kpiTitle}>{t("bizHome.revenue")}</Text>
              <Ionicons name="chevron-forward" size={10} color={c.textMuted} />
            </View>
          </Pressable>

          <Pressable
            style={styles.kpiCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/bookings");
            }}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.kpiValue}>{t("bizHome.bookingsCount", { count: bookings.length })}</Text>
            <Text style={styles.kpiTitle}>{t("bizHome.orders")}</Text>
          </Pressable>

          <Pressable
            style={styles.kpiCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/clients");
            }}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Ionicons name="people-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.kpiValue}>CRM</Text>
            <Text style={styles.kpiTitle}>{t("bizHome.clients")}</Text>
          </Pressable>
        </View>

        {/* CRM & Financial Intelligence Section */}
        <Text style={styles.sectionTitle}>{t("bizHome.crmSection")}</Text>
        <View style={styles.actionsGrid}>
          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/income");
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
              <Ionicons name="cash" size={24} color={c.primary} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.finance")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("bizHome.financeText")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/clients");
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <Ionicons name="people" size={24} color="#3B82F6" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.crm")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("bizHome.crmText")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/staff");
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
              <Ionicons name="id-card" size={24} color="#A855F7" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.staff")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("bizHome.staffText")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/promotions");
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Ionicons name="pricetags" size={24} color="#F59E0B" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.promo")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("bizHome.promoText")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/subscription");
            }}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="ribbon" size={24} color={c.primary} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.subscription")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("bizHome.subscriptionText")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        </View>

        {/* Quick Management Shortcuts */}
        <Text style={styles.sectionTitle}>{t("bizHome.manageSection")}</Text>
        <View style={styles.actionsGrid}>
          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/halls");
            }}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="basketball-outline" size={24} color={c.primary} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.halls")}</Text>
              <Text style={styles.actionSubtitle}>
                {halls.length > 0
                  ? t("bizHome.hallsText", {
                      halls: t("common.hallsCount", { count: halls.length }),
                      sports: [...new Set(halls.map((h) => sportLabel(h.sportType, t)))].join(", "),
                    })
                  : t("bizHome.noHalls")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/schedule");
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <Ionicons name="time-outline" size={24} color="#3B82F6" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.schedule")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("bizHome.scheduleText")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/bookings");
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
              <Ionicons name="receipt-outline" size={24} color="#A855F7" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{t("bizHome.bookings")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("bizHome.bookingsText", { count: bookings.length })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        </View>

        {/* Halls Status */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t("bizHome.venues", { n: halls.length })}</Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              router.push("/business/halls");
            }}
          >
            <Text style={styles.linkText}>{t("bizHome.configure")}</Text>
          </Pressable>
        </View>

        {halls.map((hall) => (
          <View key={hall.id} style={styles.hallRowCard}>
            <Image source={{ uri: hall.imageUrl }} style={styles.hallThumb} />
            <View style={styles.hallInfo}>
              <View style={styles.hallBadgeRow}>
                <View style={styles.sportBadge}>
                  <Text style={styles.sportBadgeText}>{sportLabel(hall.sportType, t)}</Text>
                </View>
                <View style={styles.statusDotRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{t("bizHome.free")}</Text>
                </View>
              </View>
              <Text style={styles.hallName}>{hall.title}</Text>
              <Text style={styles.hallSurface} numberOfLines={1}>
                {surfaceLabel(hall.surfaceType, t)}
              </Text>
              <Text style={styles.hallPrice}>
                {formatNumber(hall.pricePerHour)} ₸ <Text style={styles.perHour}>{t("common.perHour")}</Text>
              </Text>
            </View>
          </View>
        ))}

        {/* Incoming Bookings Preview */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>{t("bizHome.upcoming")}</Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              router.push("/business/bookings");
            }}
          >
            <Text style={styles.linkText}>{t("home.allCount", { n: bookings.length })}</Text>
          </Pressable>
        </View>

        {bookings.slice(0, 3).map((b) => (
          <View key={b.id} style={styles.bookingCard}>
            <View style={styles.bookingTop}>
              <View>
                <Text style={styles.bookingClient}>{b.clientName}</Text>
                <Text style={styles.bookingPhone}>{b.clientPhone}</Text>
              </View>
              <View
                style={[
                  styles.bookingBadge,
                  b.status === "confirmed" ? styles.badgeConfirmed : styles.badgePending,
                ]}
              >
                <Text
                  style={[
                    styles.bookingBadgeText,
                    b.status === "confirmed" ? styles.badgeTextConfirmed : styles.badgeTextPending,
                  ]}
                >
                  {b.status === "confirmed" ? t("status.confirmed") : t("status.pending")}
                </Text>
              </View>
            </View>

            <View style={styles.bookingDetails}>
              <View style={styles.bookingDetailItem}>
                <Ionicons name="football-outline" size={14} color={c.textMuted} />
                <Text style={styles.bookingDetailText}>{b.hallTitle}</Text>
              </View>
              <View style={styles.bookingDetailItem}>
                <Ionicons name="time-outline" size={14} color={c.textMuted} />
                <Text style={styles.bookingDetailText}>
                  {displayDate(b.date, t)}, {b.timeSlot}
                </Text>
              </View>
            </View>

            <View style={styles.bookingFooter}>
              <Text style={styles.bookingPrice}>
                {t("bizHome.total")} <Text style={styles.bookingPriceBold}>{formatNumber(b.totalPrice)} ₸</Text>
              </Text>
              {b.status !== "confirmed" && (
                <Pressable
                  style={styles.confirmBtn}
                  onPress={async () => {
                    await updateBookingStatus(b.id, "confirmed");
                    hapticSuccess();
                    loadData();
                    Alert.alert(t("status.confirmed"), t("bizHome.confirmedText", { id: b.id }));
                  }}
                >
                  <Text style={styles.confirmBtnText}>{t("common.confirm")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: c.primary,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  arenaTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  cityText: {
    fontSize: 12,
    color: c.textSecondary,
  },
  staffActivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  staffActivePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: c.primary,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.primary,
  },
  scroll: {
    padding: 16,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  kpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: "800",
    color: c.textPrimary,
    marginBottom: 2,
  },
  kpiTitle: {
    fontSize: 11,
    color: c.textMuted,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.primary,
  },
  actionsGrid: {
    gap: 10,
    marginBottom: 10,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 3,
  },
  actionSubtitle: {
    fontSize: 11,
    color: c.textMuted,
    lineHeight: 15,
  },
  hallRowCard: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  hallThumb: {
    width: 78,
    height: 78,
    borderRadius: 10,
    backgroundColor: "#1E2621",
    marginRight: 12,
  },
  hallInfo: {
    flex: 1,
    justifyContent: "center",
  },
  hallBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sportBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sportBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: c.primary,
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },
  statusText: {
    fontSize: 10,
    color: c.primary,
    fontWeight: "600",
  },
  hallName: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 2,
  },
  hallSurface: {
    fontSize: 11,
    color: c.textMuted,
    marginBottom: 4,
  },
  hallPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: c.primary,
  },
  perHour: {
    fontSize: 11,
    fontWeight: "400",
    color: c.textMuted,
  },
  bookingCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  bookingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  bookingClient: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  bookingPhone: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 2,
  },
  bookingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeConfirmed: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  badgePending: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  bookingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeTextConfirmed: {
    color: c.primary,
  },
  badgeTextPending: {
    color: "#EAB308",
  },
  bookingDetails: {
    gap: 4,
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
  bookingDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingDetailText: {
    fontSize: 12,
    color: c.textSecondary,
  },
  bookingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
  bookingPrice: {
    fontSize: 12,
    color: c.textMuted,
  },
  bookingPriceBold: {
    fontSize: 14,
    fontWeight: "800",
    color: c.textPrimary,
  },
  confirmBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: c.background,
  },
});

