import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, ThemeMode } from "@/theme/ThemeProvider";
import { useI18n, AppLocale } from "@/lib/i18n";
import { clearSession, getSessionUser } from "@/lib/auth";
import { deleteMyAccount } from "@/lib/user";
import { logoutCurrentSession } from "@/lib/registration";
import { isHapticsEnabled, setHapticsEnabled, hapticSelection } from "@/lib/haptics";
import { confirmDestructive } from "@/lib/confirm";
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from "@/lib/site";
import { getErrorMessage } from "@/lib/errorMessage";

export default function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const user = getSessionUser();
  const [hapticsOn, setHapticsOn] = useState(true);

  useEffect(() => {
    isHapticsEnabled().then(setHapticsOn);
  }, []);

  const toggleHaptics = async (val: boolean) => {
    setHapticsOn(val);
    await setHapticsEnabled(val);
    if (val) hapticSelection();
  };

  const handleLogout = async () => {
    await logoutCurrentSession();
    router.replace("/(tabs)");
  };

  const handleDeleteAccount = async () => {
    const ok = await confirmDestructive({
      title: t("settings.deleteAccount"),
      message: t("settings.deleteAccountConfirm"),
      confirmText: t("common.delete"),
      cancelText: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await deleteMyAccount();
      await clearSession();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{t("settings.title")}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("settings.theme")}</Text>
          <View style={styles.chipRow}>
            {(["system", "light", "dark"] as ThemeMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[
                  styles.chip,
                  {
                    borderColor: mode === m ? colors.accent : colors.border,
                    backgroundColor: mode === m ? colors.accentSoft : colors.bg,
                  },
                ]}
              >
                <Text
                  style={{
                    color: mode === m ? colors.accent : colors.textSecondary,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {m.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12 }]}>
            {t("settings.language")}
          </Text>
          <View style={styles.chipRow}>
            {(["ru", "en"] as AppLocale[]).map((loc) => (
              <Pressable
                key={loc}
                onPress={() => setLocale(loc)}
                style={[
                  styles.chip,
                  {
                    borderColor: locale === loc ? colors.accent : colors.border,
                    backgroundColor: locale === loc ? colors.accentSoft : colors.bg,
                  },
                ]}
              >
                <Text
                  style={{
                    color: locale === loc ? colors.accent : colors.textSecondary,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {loc.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t("settings.haptics")}</Text>
            <Switch value={hapticsOn} onValueChange={toggleHaptics} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.linkRow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Политика конфиденциальности</Text>
            <Ionicons name="open-outline" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} style={styles.linkRow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Условия использования</Text>
            <Ionicons name="open-outline" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            style={styles.linkRow}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Поддержка ({SUPPORT_EMAIL})</Text>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {user && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={handleLogout} style={styles.linkRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t("auth.logout")}</Text>
              <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={handleDeleteAccount} style={styles.linkRow}>
              <Text style={[styles.rowLabel, { color: colors.danger, fontWeight: "700" }]}>
                {t("settings.deleteAccount")}
              </Text>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  scroll: { padding: 20, gap: 16 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700" },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
});
