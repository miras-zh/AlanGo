import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Linking,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser } from "@/lib/auth";
import { ClientProfile, getClientProfiles } from "@/lib/businessCrmData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

const STATUS_FILTERS = [
  { key: "all", label: "Все клиенты" },
  { key: "vip", label: "⭐ VIP" },
  { key: "regular", label: "Постоянные" },
  { key: "new", label: "Новички" },
];

export default function BusinessClientsScreen() {
  const router = useRouter();
  const user = getSessionUser();
  const arenaId = user?.arenaId || 1;

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const list = await getClientProfiles(arenaId);
    setClients(list);
    setLoading(false);
    setRefreshing(false);
  }, [arenaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredClients = clients.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    if (!matchSearch) return false;
    if (selectedFilter === "all") return true;
    if (selectedFilter === "vip") return c.status === "vip";
    if (selectedFilter === "regular") return c.status === "regular";
    if (selectedFilter === "new") return c.status === "new";
    return true;
  });

  const handleCall = (phone: string) => {
    hapticImpact();
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert("Звонок", `Номер клиента: ${phone}`);
    });
  };

  const handleWhatsApp = (phone: string, clientName: string) => {
    hapticSelection();
    const cleanPhone = phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(
      `Здравствуйте, ${clientName}! Вас беспокоит администратор спорткомплекса. Напоминаем о возможности бронирования залов в AlanGo!`
    );
    const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${text}`;

    Linking.canOpenURL(waUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(waUrl);
        } else {
          Linking.openURL(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`);
        }
      })
      .catch(() => {
        Alert.alert("WhatsApp", `Номер клиента: ${phone}`);
      });
  };

  const handleOpenChat = () => {
    hapticSelection();
    router.push("/chat/1");
  };

  const totalClientsCount = clients.length;
  const totalLtv = clients.reduce((sum, c) => sum + c.totalSpent, 0);

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
          <Text style={styles.headerTitle}>Клиентская база (CRM)</Text>
          <Text style={styles.headerSub}>
            {totalClientsCount} игроков • LTV {totalLtv.toLocaleString("ru-RU")} ₸
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7C72" style={{ marginLeft: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по имени или номеру телефона..."
          placeholderTextColor="#6B7C72"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#6B7C72" />
          </Pressable>
        )}
      </View>

      {/* Segment Filters */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const active = selectedFilter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => {
                hapticSelection();
                setSelectedFilter(f.key);
              }}
            >
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {f.label}
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
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={48} color="#2A352E" />
              <Text style={styles.emptyTitle}>Клиенты не найдены</Text>
              <Text style={styles.emptySub}>
                Попробуйте изменить поисковый запрос или фильтр.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isVip = item.status === "vip";
            const isRegular = item.status === "regular";
            const isNew = item.status === "new";

            return (
              <View style={styles.clientCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.clientName}>{item.name}</Text>
                    <Text style={styles.clientPhone}>{item.phone}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isVip && styles.statusBadgeVip,
                      isRegular && styles.statusBadgeRegular,
                      isNew && styles.statusBadgeNew,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isVip && { color: "#F59E0B" },
                        isRegular && { color: "#22C55E" },
                        isNew && { color: "#3B82F6" },
                      ]}
                    >
                      {isVip
                        ? "⭐ VIP"
                        : isRegular
                        ? "Постоянный"
                        : isNew
                        ? "Новый"
                        : "Ненадежный"}
                    </Text>
                  </View>
                </View>

                {/* Metrics */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Броней</Text>
                    <Text style={styles.metricVal}>{item.totalBookings}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Общий оборот</Text>
                    <Text style={[styles.metricVal, { color: "#22C55E" }]}>
                      {item.totalSpent.toLocaleString("ru-RU")} ₸
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Посл. активность</Text>
                    <Text style={styles.metricVal}>{item.lastBookingDate}</Text>
                  </View>
                </View>

                {item.notes && (
                  <View style={styles.notesBox}>
                    <Ionicons name="document-text-outline" size={13} color="#8E9B94" />
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.cardActionsRow}>
                  <Pressable
                    style={styles.callBtn}
                    onPress={() => handleCall(item.phone)}
                  >
                    <Ionicons name="call" size={15} color="#FFFFFF" />
                    <Text style={styles.callBtnText}>Позвонить</Text>
                  </Pressable>

                  <Pressable
                    style={styles.whatsappBtn}
                    onPress={() => handleWhatsApp(item.phone, item.name)}
                  >
                    <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                    <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                  </Pressable>

                  <Pressable style={styles.chatBtn} onPress={handleOpenChat}>
                    <Ionicons name="chatbubble-ellipses" size={15} color="#22C55E" />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#131916",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#FFFFFF",
    marginLeft: 8,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#131916",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#22C55E",
  },
  filterText: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  clientCard: {
    backgroundColor: "#131916",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  clientName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  clientPhone: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  statusBadgeVip: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusBadgeRegular: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  statusBadgeNew: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: "#0B0F0D",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    justifyContent: "space-between",
  },
  metricItem: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: "#6B7C72",
  },
  metricVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  notesText: {
    fontSize: 11,
    color: "#8E9B94",
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#25D366",
    paddingVertical: 8,
    borderRadius: 8,
  },
  whatsappBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  chatBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: "#6B7C72",
    marginTop: 4,
  },
});

