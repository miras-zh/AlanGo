import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/theme/ThemeProvider";
import { getSessionUser, subscribeAuth } from "@/lib/auth";
import {
  AppNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const [user, setUser] = useState(getSessionUser());
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return subscribeAuth(() => setUser(getSessionUser()));
  }, []);

  const load = useCallback(async () => {
    if (!getSessionUser()) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await listNotifications(50, 0);
      setItems(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, user]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Уведомления</Text>
        {items.some((i) => !i.is_read) && (
          <Pressable onPress={handleMarkAll}>
            <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 }}>
              Прочитать все
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Уведомлений пока нет</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleTap(item)}
              style={[
                styles.card,
                {
                  backgroundColor: item.is_read ? colors.surface : colors.accentSoft,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{item.body}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 24, fontWeight: "800" },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  card: { padding: 15, borderRadius: 14, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardBody: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  emptyCard: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
