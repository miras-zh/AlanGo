import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";
import {
  Arena,
  getStoredArenas,
  getStoredHalls,
  getStoredSchedule,
  Hall,
  INITIAL_ARENAS,
  INITIAL_HALLS,
  ScheduleDay,
} from "@/lib/sportRentData";
import { hapticSelection } from "@/lib/haptics";
import { StandaloneTabBar } from "@/components/LiquidGlassTabBar";

const { width } = Dimensions.get("window");

export default function ArenaDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [arena, setArena] = useState<Arena | null>(null);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);

  useEffect(() => {
    (async () => {
      const arenas = await getStoredArenas();
      const match = arenas.find((a) => String(a.id) === String(id)) || INITIAL_ARENAS[0];
      setArena(match);

      const allHalls = await getStoredHalls();
      setHalls(allHalls.filter((h) => h.arenaId === match.id));

      const sched = await getStoredSchedule(match.id);
      setSchedule(sched);
    })();
  }, [id]);

  if (!arena) return null;

  const handleCall = () => {
    hapticSelection();
    Linking.openURL(`tel:${arena.phone.replace(/[^0-9+]/g, "")}`).catch(() => {
      Alert.alert("Контакты", `Телефон арены: ${arena.phone}`);
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Nav */}
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.roundBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topNavTitle} numberOfLines={1}>
          {arena.title}
        </Text>
        <Pressable onPress={handleCall} style={styles.roundBtn}>
          <Ionicons name="call-outline" size={18} color="#22C55E" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Arena Header Image */}
        <View style={styles.imageWrap}>
          <Image source={{ uri: arena.imageUrl }} style={styles.heroImage} />
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={13} color="#22C55E" />
            <Text style={styles.ratingText}>
              {arena.rating}
              {arena.reviewsCount ? ` (${arena.reviewsCount} отзывов)` : ""}
            </Text>
          </View>
        </View>

        {/* Title and Address */}
        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            {arena.logoUrl ? (
              <Image source={{ uri: arena.logoUrl }} style={styles.arenaLogo} />
            ) : null}
            <Text style={[styles.arenaTitle, { flex: 1 }]}>{arena.title}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-sharp" size={15} color="#22C55E" />
            <Text style={styles.addressText}>{arena.city}, {arena.address}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={15} color="#8E9B94" />
            <Text style={styles.hoursText}>{arena.workingHours}</Text>
          </View>

          {/* Quick Chat with Arena / AI Bot */}
          <Pressable
            style={styles.chatActionBtn}
            onPress={() => {
              hapticSelection();
              router.push({
                pathname: "/chat/[id]",
                params: {
                  id: String(arena.id),
                  name: arena.title,
                  avatar: arena.logoUrl || arena.imageUrl,
                },
              });
            }}
          >
            <View style={styles.chatActionLeft}>
              <View style={styles.chatActionIcon}>
                <Ionicons name="chatbubbles" size={18} color="#22C55E" />
              </View>
              <View>
                <Text style={styles.chatActionTitle}>Чат с ареной</Text>
                <Text style={styles.chatActionSub}>
                  AI-бот ответит на вопросы мгновенно 24/7
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#22C55E" />
          </Pressable>
        </View>

        {/* Description */}
        <View style={styles.promoCallout}>
          <View style={styles.promoCalloutIcon}>
            <Ionicons name="sunny" size={20} color="#10b981" />
          </View>
          <View style={styles.promoCalloutTextWrap}>
            <Text style={styles.promoCalloutTitle}>Счастливые часы: -20%</Text>
            <Text style={styles.promoCalloutSub}>
              Дневной тариф с 10:00 до 16:00 в будни рассчитывается со скидкой
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>О спорткомплексе</Text>
          <Text style={styles.descText}>{arena.description}</Text>
        </View>

        {/* Features / Infrastructure */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Инфраструктура и удобства</Text>
          <View style={styles.featuresGrid}>
            {arena.features.map((feat, idx) => (
              <View key={idx} style={styles.featItem}>
                <Ionicons name="checkmark-done" size={16} color="#22C55E" />
                <Text style={styles.featText}>{feat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* HALLS LIST OF THIS ARENA */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Залы арены ({halls.length})</Text>
          </View>

          <View style={styles.hallsList}>
            {halls.map((h) => (
              <Pressable
                key={h.id}
                style={styles.hallItem}
                onPress={() => {
                  hapticSelection();
                  router.push(`/hall/${h.id}`);
                }}
              >
                <Image source={{ uri: h.imageUrl }} style={styles.hallThumb} />
                <View style={styles.hallItemInfo}>
                  <Text style={styles.hallItemTitle}>{h.title}</Text>
                  <Text style={styles.hallItemSurface}>{h.surfaceType}</Text>
                  <Text style={styles.hallItemPrice}>
                    {h.pricePerHour.toLocaleString("ru-RU")} ₸ <Text style={{ fontSize: 11, color: "#8E9B94" }}>/ час</Text>
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#22C55E" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Schedule per day (Vison Pattern) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>График работы по дням</Text>
          <View style={styles.scheduleList}>
            {schedule.map((s, idx) => (
              <View key={`${s.dayOfWeek}-${idx}`} style={styles.scheduleRow}>
                <Text style={styles.scheduleDayName}>{s.dayName}</Text>
                {s.isClosed ? (
                  <Text style={styles.scheduleClosed}>Выходной</Text>
                ) : (
                  <Text style={styles.scheduleTime}>
                    {s.startTime} - {s.endTime}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <StandaloneTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#161D19",
    alignItems: "center",
    justifyContent: "center",
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  scroll: {
    paddingBottom: spacing.bottomScrollPadding,
  },
  imageWrap: {
    width: "100%",
    height: 200,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 12,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(11, 15, 13, 0.85)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  infoSection: {
    padding: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  arenaLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceElevated,
  },
  arenaTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  addressText: {
    fontSize: 13,
    color: "#8E9B94",
  },
  hoursText: {
    fontSize: 13,
    color: "#22C55E",
    fontWeight: "500",
  },
  chatActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#131916",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  chatActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  chatActionSub: {
    fontSize: 11,
    color: "#8E9B94",
    marginTop: 2,
  },
  promoCallout: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13231a",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e3d2a",
    gap: 12,
    marginBottom: 14,
  },
  promoCalloutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#064e3b",
    alignItems: "center",
    justifyContent: "center",
  },
  promoCalloutTextWrap: {
    flex: 1,
  },
  promoCalloutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  promoCalloutSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    lineHeight: 15,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: "#141A17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  descText: {
    fontSize: 13,
    color: "#8E9B94",
    lineHeight: 19,
  },
  featuresGrid: {
    gap: 8,
  },
  featItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featText: {
    fontSize: 13,
    color: "#D1D5DB",
  },
  hallsList: {
    gap: 10,
  },
  hallItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A221E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#243229",
    padding: 10,
    gap: 12,
  },
  hallThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  hallItemInfo: {
    flex: 1,
  },
  hallItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  hallItemSurface: {
    fontSize: 11,
    color: "#8E9B94",
    marginTop: 2,
  },
  hallItemPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#22C55E",
    marginTop: 4,
  },
  scheduleList: {
    gap: 6,
  },
  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1F2823",
  },
  scheduleDayName: {
    fontSize: 13,
    color: "#8E9B94",
  },
  scheduleTime: {
    fontSize: 13,
    color: "#22C55E",
    fontWeight: "600",
  },
  scheduleClosed: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
  },
});

