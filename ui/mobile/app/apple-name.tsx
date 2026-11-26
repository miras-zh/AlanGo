import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { appAlert } from "@/lib/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { updateMyProfile } from "@/lib/user";
import { loginWithApple } from "@/lib/registration";
import { getErrorMessage } from "@/lib/errorMessage";
import { radii } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

export default function AppleNameScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
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
      appAlert(t("account.nameRequiredTitle"), t("appleName.requiredText"));
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
      appAlert(t("common.error"), getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
            <Text style={styles.title}>{t("appleName.title")}</Text>
            <Text style={styles.subtitle}>{t("appleName.subtitle")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("account.namePlaceholder")}
              placeholderTextColor={c.textMuted}
              style={styles.input}
            />
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>{saving ? t("common.saving") : t("common.continue")}</Text>
            </Pressable>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  content: { padding: 24, gap: 14 },
  title: { fontSize: 24, fontWeight: "800", color: c.textPrimary },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8, color: c.textSecondary },
  input: {
    borderWidth: 1,
    borderRadius: radii.smallChip,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    paddingVertical: 14,
    borderRadius: radii.button,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: c.onPrimary, fontWeight: "700", fontSize: 15 },
});
