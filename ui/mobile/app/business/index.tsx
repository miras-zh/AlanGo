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
import { getSessionUser, switchTestAccount } from "@/lib/auth";
import { fetchMyBusiness, type BusinessArena } from "@/lib/business";
import {
  Arena,
  Booking,
  getStoredArenas,
  getStoredBookings,
  getStoredHalls,
  Hall,
  updateBookingStatus,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

export default function BusinessDashboardScreen() {
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
      getStoredBookings(),
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

  const handleAccountSwitch = async (account: "dev.arena1" | "dev.arena2" | "dev.client") => {
    hapticImpact();
    const updated = await switchTestAccount(account);
    setUser(updated);
    if (account === "dev.client") {
      router.replace("/(tabs)");
    } else {
      loadData();
    }
  };

  const todayRevenue = bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.badgeLabel}>
            {user?.staffRole ? `СОТРУДНИК СМЕНЫ 🔑` : "БИЗНЕС-КАБИНЕТ"}
          </Text>
          <Text style={styles.arenaTitle} numberOfLines={1}>
            {arena?.title || "Мой спорткомплекс"}
          </Text>
          <View style={styles.cityRow}>
            <Ionicons name="location-sharp" size={13} color="#22C55E" />
            <Text style={styles.cityText}>{arena?.address || (arena?.city ? `г. ${arena.city}` : "Адрес не указан")}</Text>
            {user?.staffMemberId && (
              <View style={styles.staffActivePill}>
                <Ionicons name="person-circle" size={13} color="#10B981" />
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
          <Ionicons name="eye-outline" size={18} color="#22C55E" />
          <Text style={styles.previewBtnText}>Вид для клиентов</Text>
        </Pressable>
      </View>

      {/* Dev Switcher Bar — development builds only (mock accounts) */}
      {__DEV__ && (
      <View style={styles.devBar}>
        <Text style={styles.devBarLabel}>Тестовый вход:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devChips}>
          <Pressable
            style={[
              styles.devChip,
              user?.email?.includes("arena1") && styles.devChipActive,
            ]}
            onPress={() => handleAccountSwitch("dev.arena1")}
          >
            <Text
              style={[
                styles.devChipText,
                user?.email?.includes("arena1") && styles.devChipTextActive,
              ]}
            >
              🏢 dev.arena1 (Astana)
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.devChip,
              user?.email?.includes("arena2") && styles.devChipActive,
            ]}
            onPress={() => handleAccountSwitch("dev.arena2")}
          >
            <Text
              style={[
                styles.devChipText,
                user?.email?.includes("arena2") && styles.devChipTextActive,
              ]}
            >
              🏢 dev.arena2 (Nomad)
            </Text>
          </Pressable>

          <Pressable
            style={styles.devChipClient}
            onPress={() => handleAccountSwitch("dev.client")}
          >
            <Text style={styles.devChipClientText}>👤 Режим Клиента</Text>
          </Pressable>
        </ScrollView>
      </View>
      )}

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
              <Ionicons name="cash-outline" size={20} color="#22C55E" />
            </View>
            <Text style={styles.kpiValue}>
              {todayRevenue > 0 ? todayRevenue.toLocaleString("ru-RU") : "36 000"} ₸
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={styles.kpiTitle}>Выручка</Text>
              <Ionicons name="chevron-forward" size={10} color="#6B7C72" />
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
            <Text style={styles.kpiValue}>{bookings.length} брони</Text>
            <Text style={styles.kpiTitle}>Заказов</Text>
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
            <Text style={styles.kpiTitle}>Клиенты</Text>
          </Pressable>
        </View>

        {/* CRM & Financial Intelligence Section */}
        <Text style={styles.sectionTitle}>Спортивная CRM и Аналитика</Text>
        <View style={styles.actionsGrid}>
          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/income");
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
              <Ionicons name="cash" size={24} color="#22C55E" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Финансы и выручка</Text>
              <Text style={styles.actionSubtitle}>
                Калькуляция доходов за день/неделю/месяц, средний чек и загрузка
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
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
              <Text style={styles.actionTitle}>Клиентская база (CRM)</Text>
              <Text style={styles.actionSubtitle}>
                Капитаны команд, постоянные игроки, LTV, звонки и WhatsApp
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
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
              <Text style={styles.actionTitle}>Персонал и смены</Text>
              <Text style={styles.actionSubtitle}>
                Администраторы, смены, дежурные тренеры и доступ к кассе
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
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
              <Text style={styles.actionTitle}>Акции и маркетинг</Text>
              <Text style={styles.actionSubtitle}>
                Счастливые часы (-20%), горящие слоты, управление скидками
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
          </Pressable>
        </View>

        {/* Quick Management Shortcuts */}
        <Text style={styles.sectionTitle}>Управление комплексом</Text>
        <View style={styles.actionsGrid}>
          <Pressable
            style={styles.actionCard}
            onPress={() => {
              hapticSelection();
              router.push("/business/halls");
            }}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="basketball-outline" size={24} color="#22C55E" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Управление залами</Text>
              <Text style={styles.actionSubtitle}>
                3 зала: Футбол, Баскетбол, Теннис. Цены и инвентарь.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
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
              <Text style={styles.actionTitle}>График работы</Text>
              <Text style={styles.actionSubtitle}>
                Режим работы по дням, время и длительность слотов
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
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
              <Text style={styles.actionTitle}>Журнал броней</Text>
              <Text style={styles.actionSubtitle}>
                {bookings.length} записей: подтверждение и контакты клиентов
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7C72" />
          </Pressable>
        </View>

        {/* Halls Status */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Площадки комплекса ({halls.length})</Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              router.push("/business/halls");
            }}
          >
            <Text style={styles.linkText}>Настроить</Text>
          </Pressable>
        </View>

        {halls.map((hall) => (
          <View key={hall.id} style={styles.hallRowCard}>
            <Image source={{ uri: hall.imageUrl }} style={styles.hallThumb} />
            <View style={styles.hallInfo}>
              <View style={styles.hallBadgeRow}>
                <View style={styles.sportBadge}>
                  <Text style={styles.sportBadgeText}>{hall.sportType}</Text>
                </View>
                <View style={styles.statusDotRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Свободен</Text>
                </View>
              </View>
              <Text style={styles.hallName}>{hall.title}</Text>
              <Text style={styles.hallSurface} numberOfLines={1}>
                {hall.surfaceType}
              </Text>
              <Text style={styles.hallPrice}>
                {hall.pricePerHour.toLocaleString("ru-RU")} ₸ <Text style={styles.perHour}>/ час</Text>
              </Text>
            </View>
          </View>
        ))}

        {/* Incoming Bookings Preview */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Ближайшие брони</Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              router.push("/business/bookings");
            }}
          >
            <Text style={styles.linkText}>Все ({bookings.length})</Text>
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
                  {b.status === "confirmed" ? "Подтверждено" : "Ожидает"}
                </Text>
              </View>
            </View>

            <View style={styles.bookingDetails}>
              <View style={styles.bookingDetailItem}>
                <Ionicons name="football-outline" size={14} color="#6B7C72" />
                <Text style={styles.bookingDetailText}>{b.hallTitle}</Text>
              </View>
              <View style={styles.bookingDetailItem}>
                <Ionicons name="time-outline" size={14} color="#6B7C72" />
                <Text style={styles.bookingDetailText}>
                  {b.date}, {b.timeSlot}
                </Text>
              </View>
            </View>

            <View style={styles.bookingFooter}>
              <Text style={styles.bookingPrice}>
                Итого: <Text style={styles.bookingPriceBold}>{b.totalPrice.toLocaleString("ru-RU")} ₸</Text>
              </Text>
              {b.status !== "confirmed" && (
                <Pressable
                  style={styles.confirmBtn}
                  onPress={async () => {
                    await updateBookingStatus(b.id, "confirmed");
                    hapticSuccess();
                    loadData();
                    Alert.alert("Подтверждено", `Бронь ${b.id} успешно подтверждена!`);
                  }}
                >
                  <Text style={styles.confirmBtnText}>Подтвердить</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#22C55E",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  arenaTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  cityText: {
    fontSize: 12,
    color: "#8E9B94",
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
    color: "#10B981",
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
    color: "#22C55E",
  },
  devBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  devBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7C72",
    marginBottom: 6,
  },
  devChips: {
    flexDirection: "row",
    gap: 8,
  },
  devChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  devChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#22C55E",
  },
  devChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E9B94",
  },
  devChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  devChipClient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.4)",
  },
  devChipClientText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#60A5FA",
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
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#FFFFFF",
    marginBottom: 2,
  },
  kpiTitle: {
    fontSize: 11,
    color: "#6B7C72",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
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
    color: "#22C55E",
  },
  actionsGrid: {
    gap: 10,
    marginBottom: 10,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#FFFFFF",
    marginBottom: 3,
  },
  actionSubtitle: {
    fontSize: 11,
    color: "#6B7C72",
    lineHeight: 15,
  },
  hallRowCard: {
    flexDirection: "row",
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#22C55E",
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
    backgroundColor: "#22C55E",
  },
  statusText: {
    fontSize: 10,
    color: "#22C55E",
    fontWeight: "600",
  },
  hallName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  hallSurface: {
    fontSize: 11,
    color: "#6B7C72",
    marginBottom: 4,
  },
  hallPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#22C55E",
  },
  perHour: {
    fontSize: 11,
    fontWeight: "400",
    color: "#6B7C72",
  },
  bookingCard: {
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#FFFFFF",
  },
  bookingPhone: {
    fontSize: 12,
    color: "#6B7C72",
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
    color: "#22C55E",
  },
  badgeTextPending: {
    color: "#EAB308",
  },
  bookingDetails: {
    gap: 4,
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  bookingDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingDetailText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  bookingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  bookingPrice: {
    fontSize: 12,
    color: "#6B7C72",
  },
  bookingPriceBold: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  confirmBtn: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0B0F0D",
  },
});

