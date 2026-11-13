import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { requestPasswordReset } from "@/lib/registration";
import { getErrorMessage } from "@/lib/errorMessage";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export default function ForgotPasswordScreen() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Ошибка", "Введите ваш Email");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      Alert.alert(
        "Проверьте почту",
        "Если аккаунт с таким Email существует, мы отправили инструкцию по сбросу пароля.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]}>Восстановление пароля</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Укажите Email вашего аккаунта, и мы пришлём ссылку для смены пароля.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? "Отправка..." : "Отправить ссылку"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 14 },
  closeBtn: { alignSelf: "flex-end", padding: 4 },
  title: { fontSize: 24, fontWeight: "800", marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
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
  primaryBtnText: { color: c.textPrimary, fontWeight: "700", fontSize: 15 },
});
