import { useState } from "react";
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
import { useI18n } from "@/lib/i18n";
import { registerWithEmail } from "@/lib/registration";
import { PasswordInput } from "@/components/PasswordInput";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSuccess } from "@/lib/haptics";

export default function RegisterScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert("Ошибка", "Заполните имя, email и пароль (минимум 6 символов)");
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      hapticSuccess();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Ошибка регистрации", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]}>{t("auth.signUp")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Создайте новый аккаунт за пару секунд
        </Text>

        <View style={styles.form}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("auth.name")}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.email")}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />

          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.password")}
          />

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? t("common.loading") : t("auth.signUp")}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.replace("/login")} style={styles.switchBtn}>
          <Text style={{ color: colors.textSecondary }}>
            Уже есть аккаунт? <Text style={{ color: colors.accent, fontWeight: "700" }}>{t("auth.signIn")}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  closeBtn: { alignSelf: "flex-end", padding: 4 },
  title: { fontSize: 28, fontWeight: "800", marginTop: 8 },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 24 },
  form: { gap: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  switchBtn: { marginTop: 28, alignItems: "center" },
});
