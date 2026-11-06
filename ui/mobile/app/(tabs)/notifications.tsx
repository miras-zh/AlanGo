import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  MOCK_NOTIFICATIONS,
} from "@/lib/notifications";
import {
  ChatDialog,
  getStoredDialogs,
  subscribeToChats,
} from "@/lib/chatData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

type TabType = "chats" | "notifications";

export default function NotificationsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("chats");
  const [dialogs, setDialogs] = useState<ChatDialog[]>([]);
  const [items, setItems] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [storedDialogs, res] = await Promise.all([
        getStoredDialogs(),
        listNotifications(50, 0).catch(() => ({ items: MOCK_NOTIFICATIONS })),
      ]);
      setDialogs(storedDialogs);
      setItems(res.items || MOCK_NOTIFICATIONS);
    } catch {
      setItems(MOCK_NOTIFICATIONS);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChats(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const handleMarkAll = async () => {
    hapticImpact();
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotificationTap = async (n: AppNotification) => {
    hapticSelection();
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
    }
  };

  const handleOpenChat = (d: ChatDialog) => {
    hapticSelection();
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: d.id,
        name: d.arenaTitle,
        avatar: d.arenaAvatar,
      },
    });
  };

  const totalUnreadChats = dialogs.reduce(
    (sum, d) => sum + (d.unreadCount || 0),
    0
  );
  const totalUnreadNotifs = items.filter((i) => !i.is_read).length;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: "#0B0F0D" }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tabBtn, activeTab === "chats" && styles.tabBtnActive]}
            onPress={() => {
              hapticSelection();
              setActiveTab("chats");
            }}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "chats" && styles.tabBtnTextActive,
              ]}
            >
              Сообщения
            </Text>
            {totalUnreadChats > 0 && (
              <View style={styles.tabBadgeCount}>
                <Text style={styles.tabBadgeCountText}>{totalUnreadChats}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.tabBtn,
              activeTab === "notifications" && styles.tabBtnActive,
            ]}
            onPress={() => {
              hapticSelection();
              setActiveTab("notifications");
            }}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "notifications" && styles.tabBtnTextActive,
              ]}
            >
              Уведомления
            </Text>
            {totalUnreadNotifs > 0 && <View style={styles.tabBadgeDot} />}
          </Pressable>
        </View>

        {activeTab === "notifications" && totalUnreadNotifs > 0 && (
          <Pressable onPress={handleMarkAll} hitSlop={10}>
            <Text style={styles.readAllText}>Прочитано</Text>
          </Pressable>
        )}
      </View>

      {/* CHATS LIST */}
      {activeTab === "chats" ? (
        <FlatList
          data={dialogs}
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
              <Ionicons name="chatbubbles-outline" size={48} color="#2A352E" />
              <Text style={styles.emptyTitle}>Нет диалогов</Text>
              <Text style={styles.emptySub}>
                Напишите спортивному комплексу, чтобы уточнить детали игры.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.chatCard}
              onPress={() => handleOpenChat(item)}
            >
              <View style={styles.avatarWrap}>
                <Image
                  source={{ uri: item.arenaAvatar }}
                  style={styles.avatar}
                />
                {item.online && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.chatBody}>
                <View style={styles.chatTitleRow}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {item.arenaTitle}
                  </Text>
                  <Text style={styles.chatTime}>{item.lastMessageTime}</Text>
                </View>
                <View style={styles.chatMsgRow}>
                  <Text style={styles.chatMessage} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      ) : (
        /* NOTIFICATIONS LIST */
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
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
              <Ionicons
                name="notifications-outline"
                size={48}
                color="#2A352E"
              />
              <Text style={styles.emptyTitle}>Нет уведомлений</Text>
              <Text style={styles.emptySub}>
                Здесь будут статусы ваших броней и важные события.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.notifCard,
                !item.is_read && styles.notifCardUnread,
              ]}
              onPress={() => handleNotificationTap(item)}
            >
              <View style={styles.notifIconWrap}>
                <Ionicons
                  name={
                    item.type === "booking_confirmed"
                      ? "checkmark-circle"
                      : item.type === "promo"
                      ? "flash"
                      : "trophy"
                  }
                  size={20}
                  color={
                    item.type === "booking_confirmed"
                      ? "#22C55E"
                      : item.type === "promo"
                      ? "#EAB308"
                      : "#3B82F6"
                  }
                />
              </View>

              <View style={styles.notifBody}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifText}>{item.body}</Text>
                <Text style={styles.notifDate}>
                  {new Date(item.created_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#131916",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tabBtnActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#22C55E",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E9B94",
  },
  tabBtnTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  tabBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
    marginLeft: 6,
  },
  tabBadgeCount: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabBadgeCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0B0F0D",
  },
  readAllText: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
  },
  list: {
    padding: 16,
    gap: 10,
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#131916",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1F2923",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#131916",
  },
  chatBody: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 11,
    color: "#6B7C72",
  },
  chatMsgRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatMessage: {
    fontSize: 13,
    color: "#8E9B94",
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0B0F0D",
  },
  notifCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#131916",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  notifCardUnread: {
    borderColor: "rgba(34, 197, 94, 0.3)",
    backgroundColor: "rgba(34, 197, 94, 0.05)",
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0B0F0D",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBody: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  notifText: {
    fontSize: 12,
    color: "#8E9B94",
    lineHeight: 18,
  },
  notifDate: {
    fontSize: 10,
    color: "#6B7C72",
    marginTop: 6,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
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
    textAlign: "center",
    maxWidth: 240,
  },
});
