import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppTheme } from "@/theme/ThemeProvider";
import { updateMyProfile } from "@/lib/user";
import { loginWithApple } from "@/lib/registration";
import { getErrorMessage } from "@/lib/errorMessage";

export default function AppleNameScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  // Set when the backend answered 422 (new Apple account without a name):
  // the sign-in is retried with the same, still unused, identity token.
  const { identityToken, authorizationCode } = useLocalSearchParams<{
    identityToken?: string;
    authorizationCode?: string;
  }>();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Укажите имя", "Пожалуйста, введите ваше имя для профиля.");
      return;
    }
    setSaving(true);
    try {
      if (identityToken) {
        const data = await loginWithApple({
          identityToken,
          authorizationCode: authorizationCode || undefined,
          fullName: name.trim(),
        });
        router.replace(data?.user_info?.role === "business" ? "/business" : "/(tabs)");
      } else {
        await updateMyProfile({ name: name.trim() });
        router.replace("/(tabs)");
      }
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Как к вам обращаться?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Завершите настройку профиля после входа через Apple.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ваше имя"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.primaryBtnText}>{saving ? "Сохранение..." : "Продолжить"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 14, flex: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
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
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
