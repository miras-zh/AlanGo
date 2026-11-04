import { useEffect, useState } from "react";
import {
  Alert,
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
import { useAppTheme } from "@/theme/ThemeProvider";
import { getSessionUser, subscribeAuth } from "@/lib/auth";
import {
  changeMySubscriptionPlan,
  fetchMySubscription,
  SubscriptionInfo,
  updateMyProfile,
} from "@/lib/user";
import { trackPaywallView, trackSubscribe } from "@/lib/analytics";
import { hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser());
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    return subscribeAuth(() => {
      const u = getSessionUser();
      setUser(u);
      if (u) {
        setName(u.name || "");
        setPhone(u.phone || "");
        setBio(u.bio || "");
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      fetchMySubscription()
        .then((s) => {
          setSub(s);
          trackPaywallView({ current_plan: s.plan });
        })
        .catch(() => {});
    }
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={56} color={colors.textMuted} />
          <Text style={[styles.unauthTitle, { color: colors.text }]}>Личный кабинет</Text>
          <Text style={[styles.unauthSub, { color: colors.textSecondary }]}>
            Войдите, чтобы управлять профилем, подпиской и настройками приложения.
          </Text>
          <Pressable
            onPress={() => router.push("/login")}
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryBtnText}>Войти / Регистрация</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateMyProfile({ name: name.trim(), phone: phone.trim(), bio: bio.trim() });
      hapticSuccess();
      Alert.alert("Готово", "Профиль сохранён");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPlan = async (plan: "standard" | "pro" | "vip") => {
    try {
      await changeMySubscriptionPlan(plan);
      await trackSubscribe({ plan });
      const updated = await fetchMySubscription();
      setSub(updated);
      hapticSuccess();
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Профиль</Text>
          <Pressable
            onPress={() => router.push("/settings")}
            style={[styles.settingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.emailValue, { color: colors.text }]}>{user.email}</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Имя</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Телефон</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>О себе</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />

          <Pressable
            onPress={handleSaveProfile}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.saveBtnText}>{saving ? "Сохранение..." : "Сохранить профиль"}</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Тарифный план ({sub?.plan?.toUpperCase() || "STANDARD"})
          </Text>
          <View style={styles.planRow}>
            {(["standard", "pro", "vip"] as const).map((plan) => {
              const active = sub?.plan === plan;
              return (
                <Pressable
                  key={plan}
                  onPress={() => handleSelectPlan(plan)}
                  style={[
                    styles.planChip,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.accentSoft : colors.bg,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.accent : colors.text,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {plan.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "800" },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, gap: 10 },
  label: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  emailValue: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  planRow: { flexDirection: "row", gap: 10 },
  planChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  unauthTitle: { fontSize: 20, fontWeight: "700", marginTop: 12 },
  unauthSub: { fontSize: 14, textAlign: "center", marginTop: 6, marginBottom: 18, lineHeight: 20 },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
