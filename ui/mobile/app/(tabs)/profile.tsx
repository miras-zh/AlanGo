import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser, MOCK_USER, subscribeAuth, switchTestAccount } from "@/lib/auth";
import {
  changeMySubscriptionPlan,
  fetchMySubscription,
  SubscriptionInfo,
  updateMyProfile,
} from "@/lib/user";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser() || MOCK_USER);
  const [name, setName] = useState(user?.name || "Мико Аскаров");
  const [phone, setPhone] = useState(user?.phone || "+7 (777) 123-45-67");
  const [city, setCity] = useState(user?.city || "Астана");
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<SubscriptionInfo | null>({
    plan: "pro",
    status: "active",
    expires_at: "через 25 дней",
  });

  useEffect(() => {
    return subscribeAuth(() => {
      const u = getSessionUser() || MOCK_USER;
      setUser(u);
      setName(u.name || "");
      setPhone(u.phone || "");
      setCity(u.city || "");
    });
  }, []);

  useEffect(() => {
    fetchMySubscription()
      .then((s) => setSub(s))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({ name: name.trim(), phone: phone.trim(), city: city.trim() });
      hapticSuccess();
      Alert.alert("Успешно", "Данные профиля обновлены!");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = async (newPlan: string) => {
    hapticSelection();
    try {
      const updated = await changeMySubscriptionPlan(newPlan);
      setSub(updated);
      Alert.alert("Тариф обновлен", `Вы перешли на тариф ${newPlan.toUpperCase()}`);
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]} edges={["top"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Мой профиль</Text>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => {
            hapticSelection();
            router.push("/settings");
          }}
        >
          <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User Card */}
        <View style={styles.userCard}>
          <Image
            source={{
              uri:
                user?.avatar_url ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
            }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{name}</Text>
              <View style={styles.proBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#22C55E" />
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>
            <Text style={styles.userEmail}>{user?.email || "miko@sportrent.kz"}</Text>
            <Text style={styles.userLocation}>📍 {city}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>14</Text>
            <Text style={styles.statLabel}>Игр сыграно</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>28 ч</Text>
            <Text style={styles.statLabel}>На корте</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>★ 4.9</Text>
            <Text style={styles.statLabel}>Рейтинг</Text>
          </View>
        </View>

        {/* Subscription Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="flash" size={20} color="#22C55E" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>SportRent Club</Text>
              <Text style={styles.cardSubtitle}>
                Скидка 15% на дневные слоты и приоритетное бронирование
              </Text>
            </View>
          </View>

          <View style={styles.planSelector}>
            {[
              { id: "standard", name: "Базовый", price: "0 ₸" },
              { id: "pro", name: "PRO Клуб", price: "4 990 ₸ / мес" },
              { id: "vip", name: "VIP Безлимит", price: "12 990 ₸ / мес" },
            ].map((p) => {
              const active = (sub?.plan || "pro") === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.planChip, active && styles.planChipActive]}
                  onPress={() => handlePlanChange(p.id)}
                >
                  <Text style={[styles.planName, active && styles.planNameActive]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.planPrice, active && styles.planPriceActive]}>
                    {p.price}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sports Subscriptions Card */}
        <Pressable
          style={[styles.card, { borderColor: "#059669", backgroundColor: "#111814" }]}
          onPress={() => {
            hapticSelection();
            router.push("/subscriptions");
          }}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Ionicons name="ticket" size={20} color="#10b981" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Спортивные абонементы</Text>
              <Text style={styles.cardSubtitle}>
                Пакеты игр (8-12 тренировок), экономия до 25% и QR-пропуск
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#10b981" />
          </View>
        </Pressable>

        {/* Business Arena Switcher Card */}
        <View style={[styles.card, { borderColor: "rgba(34, 197, 94, 0.3)", backgroundColor: "#111814" }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
              <Ionicons name="business" size={20} color="#22C55E" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Бизнес-кабинет (Аренда залов)</Text>
              <Text style={styles.cardSubtitle}>
                Управление спорткомплексом, залами, ценами и графиком
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: "#8E9B94", marginTop: 8, marginBottom: 12 }}>
            Быстрый вход в тестовые бизнес-аккаунты (3 зала: Футбол, Баскетбол, Теннис):
          </Text>

          <View style={{ gap: 8 }}>
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#161F1A",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(34, 197, 94, 0.3)",
                gap: 10,
              }}
              onPress={async () => {
                hapticSelection();
                await switchTestAccount("dev.arena1");
                router.push("/business");
              }}
            >
              <Ionicons name="business-outline" size={20} color="#22C55E" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>
                  🏢 dev.arena1 (Astana Arena Sport)
                </Text>
                <Text style={{ fontSize: 11, color: "#6B7C72" }}>
                  Пароль: 12345 • 3 зала • ул. Нур-Султан 12
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#22C55E" />
            </Pressable>

            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#161F1A",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(96, 165, 250, 0.3)",
                gap: 10,
              }}
              onPress={async () => {
                hapticSelection();
                await switchTestAccount("dev.arena2");
                router.push("/business");
              }}
            >
              <Ionicons name="business-outline" size={20} color="#60A5FA" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>
                  🏢 dev.arena2 (Nomad Pro Complex)
                </Text>
                <Text style={{ fontSize: 11, color: "#6B7C72" }}>
                  Пароль: 12345 • 3 зала • пр. Туран 54
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#60A5FA" />
            </Pressable>

            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#161F1A",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(156, 163, 175, 0.3)",
                gap: 10,
              }}
              onPress={async () => {
                hapticSelection();
                await switchTestAccount("guest");
              }}
            >
              <Ionicons name="sparkles" size={20} color="#9CA3AF" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>
                  Войти как гость
                </Text>
                <Text style={{ fontSize: 11, color: "#6B7C72" }}>
                  Свободный просмотр 5 экранов без роли бизнеса
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>

            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1B221E",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(34, 197, 94, 0.4)",
                gap: 10,
                marginTop: 4,
              }}
              onPress={() => {
                hapticSelection();
                router.push("/login");
              }}
            >
              <Ionicons name="log-in-outline" size={20} color="#22C55E" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#22C55E" }}>
                  Экран входа / Авторизация
                </Text>
                <Text style={{ fontSize: 11, color: "#8E9B94" }}>
                  Вход по логину или выбор тестового аккаунта
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#22C55E" />
            </Pressable>
          </View>
        </View>

        {/* Edit Profile Form */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Персональные данные</Text>

          <Text style={styles.label}>ФИО</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#6B7C72"
          />

          <Text style={styles.label}>Телефон</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            placeholderTextColor="#6B7C72"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Город</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            style={styles.input}
            placeholderTextColor="#6B7C72"
          />

          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "Сохраняем..." : "Сохранить изменения"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  topBarTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#161D19",
    borderWidth: 1,
    borderColor: "#232F28",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 16,
  },

  // User Card
  userCard: {
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "#22C55E",
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#22C55E",
  },
  userEmail: {
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 3,
  },
  userLocation: {
    fontSize: 12,
    color: "#6B7C72",
    marginTop: 3,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#141A17",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2823",
    paddingVertical: 14,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#8E9B94",
  },

  // Generic Card
  card: {
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#182B1F",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  planSelector: {
    gap: 8,
  },
  planChip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#19221C",
    borderWidth: 1,
    borderColor: "#253329",
  },
  planChipActive: {
    backgroundColor: "#132E1D",
    borderColor: "#22C55E",
  },
  planName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E9B94",
  },
  planNameActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  planPrice: {
    fontSize: 13,
    color: "#6B7C72",
  },
  planPriceActive: {
    color: "#22C55E",
    fontWeight: "700",
  },

  // Form
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#19221C",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#253329",
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  saveBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B0F0D",
  },
});
