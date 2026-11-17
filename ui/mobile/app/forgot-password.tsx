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
import { requestPasswordReset } from "@/lib/registration";
import { getErrorMessage } from "@/lib/errorMessage";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert(t("common.error"), t("forgot.enterEmail"));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      Alert.alert(
        t("forgot.checkMailTitle"),
        t("forgot.checkMailText"),
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert(t("common.error"), getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeBtn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        >
          <Ionicons name="close" size={24} color={c.textPrimary} />
        </Pressable>

        <Text style={styles.title}>{t("forgot.title")}</Text>
        <Text style={styles.subtitle}>
          {t("forgot.subtitle")}
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={c.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? t("forgot.sending") : t("forgot.submit")}
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
  closeBtn: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800", marginTop: 8, color: c.textPrimary },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8, color: c.textSecondary },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  primaryBtn: {
    height: 50,
    backgroundColor: c.primary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: c.onPrimary, fontWeight: "700", fontSize: 15 },
});
