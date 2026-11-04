import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { listPublicItems, ItemEntity } from "@/lib/items";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2;

type CategoryItem = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  borderColor: string;
};

const CATEGORIES: CategoryItem[] = [
  {
    id: "Футбол",
    name: "Футбол",
    icon: "football-outline",
    color: "#22C55E",
    bgColor: "#14221A",
    borderColor: "#1E3327",
  },
  {
    id: "Теннис",
    name: "Теннис",
    icon: "tennisball-outline",
    color: "#22C55E",
    bgColor: "#14221A",
    borderColor: "#1E3327",
  },
  {
    id: "Баскетбол",
    name: "Баскетбол",
    icon: "basketball-outline",
    color: "#EF4444",
    bgColor: "#261616",
    borderColor: "#3D2020",
  },
  {
    id: "Волейбол",
    name: "Волейбол",
    icon: "baseball-outline",
    color: "#FFFFFF",
    bgColor: "#1A221E",
    borderColor: "#28342D",
  },
  {
    id: "Сквош и падл",
    name: "Сквош\nи падл",
    icon: "fitness-outline",
    color: "#22C55E",
    bgColor: "#14221A",
    borderColor: "#1E3327",
  },
  {
    id: "all",
    name: "Другое",
    icon: "grid-outline",
    color: "#8E9B94",
    bgColor: "#1A221E",
    borderColor: "#28342D",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});

  // Booking Modal State
  const [selectedHall, setSelectedHall] = useState<ItemEntity | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("19:00 - 20:00");
  const [selectedDate, setSelectedDate] = useState<string>("Сегодня");

  const loadHalls = useCallback(async () => {
    try {
      const res = await listPublicItems({
        category: selectedCategory === "all" ? undefined : selectedCategory,
        q: searchQuery.trim() || undefined,
        limit: 20,
      });
      setItems(res.items || []);
    } catch {
      // fallback handled in listPublicItems
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadHalls();
  }, [loadHalls]);

  const toggleFavorite = (id: number) => {
    hapticSelection();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openBooking = (hall: ItemEntity) => {
    hapticSelection();
    setSelectedHall(hall);
  };

  const confirmBooking = () => {
    if (!selectedHall) return;
    hapticSuccess();
    const hallTitle = selectedHall.title;
    setSelectedHall(null);
    Alert.alert(
      "Бронь оформлена! 🎉",
      `Вы успешно забронировали "${hallTitle}" на ${selectedDate} в слот ${selectedSlot}. Ждем вас!`,
      [{ text: "Отлично" }],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHalls();
            }}
            tintColor="#22C55E"
          />
        }
      >
        {/* --- 1. HEADER: Logo + Location --- */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <View style={styles.logoSlashGreen} />
              <View style={styles.logoSlashRed} />
            </View>
            <Text style={styles.logoText}>
              Sport<Text style={styles.logoTextRed}>Rent</Text>
            </Text>
          </View>

          <Pressable
            style={styles.locationPill}
            onPress={() => {
              hapticSelection();
              Alert.alert("Выбор города", "В настоящее время доступен город Астана");
            }}
          >
            <Ionicons name="location-sharp" size={15} color="#22C55E" />
            <Text style={styles.locationText}>Астана</Text>
            <Ionicons name="chevron-down" size={13} color="#8E9B94" />
          </Pressable>
        </View>

        {/* --- 2. HERO BANNER --- */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              Арендуйте{"\n"}
              спортивные{"\n"}
              <Text style={styles.heroTitleGreen}>залы</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Футбол, теннис, баскетбол{"\n"}и многое другое
            </Text>
          </View>

          <View style={styles.heroRight}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&q=80",
              }}
              style={styles.heroBallImage}
            />
          </View>
        </View>

        {/* --- 3. SEARCH BAR --- */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#6B7C72" style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Поиск залов..."
            placeholderTextColor="#6B7C72"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#6B7C72" />
            </Pressable>
          )}
        </View>

        {/* --- 4. CATEGORIES ROW --- */}
        <View style={styles.categoriesRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  hapticSelection();
                  setSelectedCategory(isSelected ? "all" : cat.id);
                }}
                style={styles.categoryItem}
              >
                <View
                  style={[
                    styles.categoryCircle,
                    {
                      backgroundColor: cat.bgColor,
                      borderColor: isSelected ? cat.color : cat.borderColor,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && { color: "#FFFFFF", fontWeight: "700" },
                  ]}
                  numberOfLines={2}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* --- 5. SECTION: Популярные залы --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Популярные залы</Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              router.push("/(tabs)/items");
            }}
            hitSlop={10}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Все залы</Text>
            <Ionicons name="chevron-forward" size={14} color="#22C55E" />
          </Pressable>
        </View>

        {/* Grid of Halls */}
        <View style={styles.hallsGrid}>
          {items.map((hall) => {
            const isFav = !!favorites[hall.id];
            const rating = hall.metadata?.rating || 4.8;
            const reviewsCount = hall.metadata?.reviewsCount || 120;
            const location = hall.metadata?.location || "Астана, ул. Достык 10";

            return (
              <Pressable
                key={hall.id}
                style={styles.hallCard}
                onPress={() => openBooking(hall)}
              >
                {/* Image Container with Badges */}
                <View style={styles.hallImageWrap}>
                  <Image source={{ uri: hall.image_url }} style={styles.hallImage} />

                  {/* Favorite button */}
                  <Pressable
                    style={styles.favBtn}
                    onPress={() => toggleFavorite(hall.id)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={isFav ? "heart" : "heart-outline"}
                      size={18}
                      color={isFav ? "#EF4444" : "#FFFFFF"}
                    />
                  </Pressable>

                  {/* Rating Badge */}
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#22C55E" />
                    <Text style={styles.ratingScore}>{rating}</Text>
                    <Text style={styles.ratingCount}>({reviewsCount})</Text>
                  </View>
                </View>

                {/* Hall Details */}
                <View style={styles.hallInfo}>
                  <Text style={styles.hallTitle} numberOfLines={1}>
                    {hall.title}
                  </Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color="#8E9B94" />
                    <Text style={styles.hallLocation} numberOfLines={1}>
                      {location}
                    </Text>
                  </View>

                  {/* Price & Action Button */}
                  <View style={styles.hallBottomRow}>
                    <View>
                      <Text style={styles.pricePrefix}>
                        от{" "}
                        <Text style={styles.priceNumber}>
                          {(hall.price || 15000).toLocaleString("ru-RU")} ₸
                        </Text>
                      </Text>
                      <Text style={styles.priceUnit}>/ час</Text>
                    </View>

                    <Pressable
                      style={styles.arrowBtn}
                      onPress={() => openBooking(hall)}
                    >
                      <Ionicons name="arrow-forward" size={16} color="#0B0F0D" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* --- 6. PROMO BANNER: Спортивные события --- */}
        <Pressable
          style={styles.eventsBanner}
          onPress={() => {
            hapticSelection();
            router.push("/(tabs)/events");
          }}
        >
          <View style={styles.eventsTrophyWrap}>
            <Ionicons name="trophy-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={styles.eventsTextWrap}>
            <Text style={styles.eventsTitle}>Спортивные события</Text>
            <Text style={styles.eventsSubtitle}>Турниры, матчи и многое другое</Text>
          </View>

          <Pressable
            style={styles.eventsActionBtn}
            onPress={() => {
              hapticSelection();
              router.push("/(tabs)/events");
            }}
          >
            <Text style={styles.eventsActionBtnText}>Узнать больше</Text>
          </Pressable>
        </Pressable>
      </ScrollView>

      {/* --- BOOKING MODAL --- */}
      <Modal
        visible={!!selectedHall}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedHall(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedHall(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedHall?.title}</Text>
                <Text style={styles.modalSubtitle}>
                  📍 {selectedHall?.metadata?.location || "г. Астана"}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedHall(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Date Selection */}
            <Text style={styles.modalSectionLabel}>Выберите день</Text>
            <View style={styles.slotRow}>
              {["Сегодня", "Завтра", "Пт, 7 ноя", "Сб, 8 ноя"].map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.slotChip,
                    selectedDate === d && styles.slotChipActive,
                  ]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedDate(d);
                  }}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      selectedDate === d && styles.slotChipTextActive,
                    ]}
                  >
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Time Slot Selection */}
            <Text style={styles.modalSectionLabel}>Свободные слоты</Text>
            <View style={styles.slotRow}>
              {["17:00 - 18:00", "19:00 - 20:00", "20:00 - 21:00", "21:00 - 22:00"].map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.slotChip,
                    selectedSlot === s && styles.slotChipActive,
                  ]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedSlot(s);
                  }}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      selectedSlot === s && styles.slotChipTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Price Summary & Book button */}
            <View style={styles.modalFooter}>
              <View>
                <Text style={styles.modalTotalLabel}>Итого к оплате:</Text>
                <Text style={styles.modalTotalPrice}>
                  {(selectedHall?.price || 15000).toLocaleString("ru-RU")} ₸
                </Text>
              </View>
              <Pressable style={styles.modalBookBtn} onPress={confirmBooking}>
                <Text style={styles.modalBookBtnText}>Забронировать зал</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBadge: {
    width: 24,
    height: 24,
    justifyContent: "center",
  },
  logoSlashGreen: {
    width: 18,
    height: 5,
    backgroundColor: "#22C55E",
    borderRadius: 3,
    transform: [{ skewX: "-25deg" }],
    marginBottom: 3,
  },
  logoSlashRed: {
    width: 18,
    height: 5,
    backgroundColor: "#EF4444",
    borderRadius: 3,
    transform: [{ skewX: "-25deg" }],
  },
  logoText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  logoTextRed: {
    color: "#EF4444",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Hero Card
  heroCard: {
    backgroundColor: "#111814",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1E2B22",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    marginBottom: 16,
    overflow: "hidden",
    minHeight: 145,
  },
  heroLeft: {
    flex: 1,
    paddingVertical: 18,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroTitleGreen: {
    color: "#22C55E",
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#8E9B94",
    marginTop: 8,
  },
  heroRight: {
    width: 140,
    height: 145,
    justifyContent: "center",
    alignItems: "center",
  },
  heroBallImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    transform: [{ rotate: "15deg" }],
  },

  // Search Bar
  searchBar: {
    height: 50,
    backgroundColor: "#141A17",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2823",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#FFFFFF",
  },

  // Categories
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  categoryItem: {
    alignItems: "center",
    width: (width - 32) / 6,
  },
  categoryCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 11,
    lineHeight: 13,
    color: "#8E9B94",
    textAlign: "center",
    fontWeight: "500",
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22C55E",
  },

  // Halls Grid
  hallsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  hallCard: {
    width: CARD_WIDTH,
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
    overflow: "hidden",
  },
  hallImageWrap: {
    width: "100%",
    height: 125,
    position: "relative",
  },
  hallImage: {
    width: "100%",
    height: "100%",
  },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(11, 15, 13, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(11, 15, 13, 0.8)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  ratingScore: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  ratingCount: {
    fontSize: 10,
    color: "#8E9B94",
  },
  hallInfo: {
    padding: 12,
  },
  hallTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 10,
  },
  hallLocation: {
    fontSize: 11,
    color: "#8E9B94",
    flex: 1,
  },
  hallBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pricePrefix: {
    fontSize: 10,
    color: "#8E9B94",
  },
  priceNumber: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  priceUnit: {
    fontSize: 10,
    color: "#6B7C72",
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },

  // Events Banner
  eventsBanner: {
    backgroundColor: "#161A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2D1D20",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  eventsTrophyWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventsTextWrap: {
    flex: 1,
  },
  eventsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eventsSubtitle: {
    fontSize: 11,
    color: "#9E8C8E",
    marginTop: 2,
  },
  eventsActionBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  eventsActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: "#131915",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: "#1F2B22",
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1F2B22",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E9B94",
    marginBottom: 10,
    marginTop: 8,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#1B241F",
    borderWidth: 1,
    borderColor: "#28372D",
  },
  slotChipActive: {
    backgroundColor: "#142A1D",
    borderColor: "#22C55E",
  },
  slotChipText: {
    fontSize: 13,
    color: "#8E9B94",
    fontWeight: "500",
  },
  slotChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1F2B22",
  },
  modalTotalLabel: {
    fontSize: 11,
    color: "#8E9B94",
  },
  modalTotalPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalBookBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  modalBookBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B0F0D",
  },
});
