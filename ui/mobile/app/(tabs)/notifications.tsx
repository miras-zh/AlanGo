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
import {
  AppNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  MOCK_NOTIFICATIONS,
} from "@/lib/notifications";
import { hapticSelection } from "@/lib/haptics";

type TabType = "chats" | "notifications";

const MOCK_CHATS = [
  {
    id: "1",
    name: "Футбольный зал Arena",
    avatar: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200",
    lastMessage: "Здравствуйте! Раздевалка №3 подготовлена для вашей команды к 19:00.",
    time: "15:42",
    unread: 1,
    online: true,
  },
  {
    id: "2",
    name: "Баскетбольный зал Pro",
    avatar: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=200",
    lastMessage: "Мячи Spalding уже у администратора на стойке.",
    time: "Вчера",
    unread: 0,
    online: false,
  },
  {
    id: "3",
    name: "Поддержка SportRent",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
    lastMessage: "Ваш кешбэк 500 ₸ начислен на бонусный счет.",
    time: "2 ноя",
    unread: 0,
    online: true,
  },
];

export default function NotificationsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("chats");
  const [items, setItems] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listNotifications(50, 0);
      setItems(res.items || MOCK_NOTIFICATIONS);
    } catch {
      setItems(MOCK_NOTIFICATIONS);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleTap = async (n: AppNotification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]} edges={["top"]}>
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
            <Text style={[styles.tabBtnText, activeTab === "chats" && styles.tabBtnTextActive]}>
              Сообщения
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === "notifications" && styles.tabBtnActive]}
            onPress={() => {
              hapticSelection();
              setActiveTab("notifications");
            }}
          >
            <Text style={[styles.tabBtnText, activeTab === "notifications" && styles.tabBtnTextActive]}>
              Уведомления
            </Text>
            {items.some((i) => !i.is_read) && <View style={styles.tabBadgeDot} />}
          </Pressable>
        </View>

        {activeTab === "notifications" && items.some((i) => !i.is_read) && (
          <Pressable onPress={handleMarkAll} hitSlop={10}>
            <Text style={styles.readAllText}>Прочитано</Text>
          </Pressable>
        )}
      </View>

      {/* CHATS LIST */}
      {activeTab === "chats" ? (
        <FlatList
          data={MOCK_CHATS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.chatCard}>
              <View style={styles.avatarWrap}>
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                {item.online && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.chatBody}>
                <View style={styles.chatTitleRow}>
                  <Text style={styles.chatName}>{item.name}</Text>
                  <Text style={styles.chatTime}>{item.time}</Text>
                </View>
                <View style={styles.chatMsgRow}>
                  <Text style={styles.chatMessage} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                  {item.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unread}</Text>
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
                load();
              }}
              tintColor="#22C55E"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.notifCard,
                !item.is_read && styles.notifCardUnread,
              ]}
              onPress={() => handleTap(item)}
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
                  size={24}
                  color={!item.is_read ? "#22C55E" : "#8E9B94"}
                />
              </View>

              <View style={styles.notifBody}>
                <View style={styles.notifHeaderRow}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  {!item.is_read && <View style={styles.unreadGreenDot} />}
                </View>
                <Text style={styles.notifDesc}>{item.body}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#161D19",
    borderWidth: 1,
    borderColor: "#232F28",
  },
  tabBtnActive: {
    backgroundColor: "#142A1D",
    borderColor: "#22C55E",
  },
  tabBtnText: {
    fontSize: 14,
    color: "#8E9B94",
    fontWeight: "600",
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
  readAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22C55E",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },

  // Chats
  chatCard: {
    backgroundColor: "#141A17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    borderColor: "#141A17",
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
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0B0F0D",
  },

  // Notifications
  notifCard: {
    backgroundColor: "#141A17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: "#122018",
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  notifIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#19241E",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  notifBody: {
    flex: 1,
  },
  notifHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  unreadGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginLeft: 6,
  },
  notifDesc: {
    fontSize: 13,
    color: "#8E9B94",
    lineHeight: 18,
  },
});
