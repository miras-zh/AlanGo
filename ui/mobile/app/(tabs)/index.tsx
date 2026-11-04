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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n";
import { getSessionUser, subscribeAuth } from "@/lib/auth";
import { listPublicItems, ItemEntity } from "@/lib/items";
import { trackCoreAction, trackFirstValueOnce } from "@/lib/analytics";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser());
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return subscribeAuth(() => setUser(getSessionUser()));
  }, []);

  const loadFeed = useCallback(async () => {
    try {
      const res = await listPublicItems({ limit: 20 });
      setItems(res.items || []);
    } catch {
      // ignore offline error on initial load
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleQuickAction = async () => {
    await trackFirstValueOnce({ source: "home_hero" });
    await trackCoreAction({ action: "open_items_from_home" });
    router.push("/(tabs)/items");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.brand, { color: colors.accent }]}>{SITE_NAME}</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>{SITE_TAGLINE}</Text>
        </View>
        {!user ? (
          <Pressable
            onPress={() => router.push("/login")}
            style={[styles.loginChip, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.loginChipText}>{t("auth.signIn")}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push("/settings")}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </Pressable>
        )}
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          {user ? `Привет, ${user.name}!` : "Готовый каркас приложения"}
        </Text>
        <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
          Авторизация (JWT + Apple + Google), пуши, realtime WebSocket, аналитика воронки и CRUD уже подключены.
        </Text>
        <Pressable
          onPress={handleQuickAction}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Перейти к записям</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Публичная лента</Text>

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
                loadFeed();
              }}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Пока нет опубликованных записей. Создайте первую во вкладке «Записи»!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardCategory, { color: colors.accent }]}>
                  {item.category.toUpperCase()}
                </Text>
                {item.price > 0 && (
                  <Text style={[styles.cardPrice, { color: colors.text }]}>
                    {item.price.toLocaleString("ru-RU")} ₸
                  </Text>
                )}
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              {!!item.description && (
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                  {item.description}
                </Text>
              )}
            </View>
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  brand: { fontSize: 24, fontWeight: "800" },
  tagline: { fontSize: 13, marginTop: 2 },
  loginChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  loginChipText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroTitle: { fontSize: 18, fontWeight: "700" },
  heroDesc: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardCategory: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  cardPrice: { fontSize: 14, fontWeight: "700" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
