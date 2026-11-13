import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppTheme } from "@/theme/ThemeProvider";
import { updateMyProfile } from "@/lib/user";
import { loginWithApple } from "@/lib/registration";
import { getErrorMessage } from "@/lib/errorMessage";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

export default function AppleNameScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
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
      Alert.alert(t("account.nameRequiredTitle"), t("appleName.requiredText"));
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
      Alert.alert(t("common.error"), getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{t("appleName.title")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("appleName.subtitle")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("account.namePlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.primaryBtnText}>{saving ? t("common.saving") : t("common.continue")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
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
  primaryBtnText: { color: c.textPrimary, fontWeight: "700", fontSize: 15 },
});
