import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { getSessionUser, subscribeAuth } from "@/lib/auth";
import { deleteAccountApi, logoutCurrentSession } from "@/lib/registration";
import { updateMyProfile } from "@/lib/user";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

// Account settings: personal data (moved out of the profile screen), logout
// and account deletion (App Store Guideline 5.1.1(v)).
export default function AccountSettingsScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const user = getSessionUser();
  const [name, setName] = useState(user?.name || user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [saving, setSaving] = useState(false);

  useEffect(
    () =>
      subscribeAuth(() => {
        const u = getSessionUser();
        if (!u) router.replace("/(tabs)/profile");
      }),
    [router],
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("account.nameRequiredTitle"), t("account.nameRequiredText"));
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({ name: name.trim(), phone: phone.trim(), city: city.trim() });
      hapticSuccess();
      Alert.alert(t("account.savedTitle"), t("account.savedText"));
    } catch (err) {
      Alert.alert(t("common.error"), getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    hapticImpact();
    Alert.alert(t("account.logoutTitle"), t("account.logoutText"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.logout"),
        style: "destructive",
        onPress: async () => {
          await logoutCurrentSession();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    hapticImpact();
    Alert.alert(
      t("account.deleteTitle"),
      t("account.deleteText"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("account.deleteForever"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccountApi();
              hapticSuccess();
              Alert.alert(t("account.deletedTitle"), t("account.deletedText"));
              router.replace("/login");
            } catch (e) {
              Alert.alert(t("common.error"), getErrorMessage(e));
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          hitSlop={10}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
        >
          <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("account.title")}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("account.personal")}</Text>
            {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

            <Text style={styles.label}>{t("account.fullName")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder={t("account.namePlaceholder")}
              placeholderTextColor={c.textSecondary}
            />

            <Text style={styles.label}>{t("account.phone")}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholder="+7 (___) ___-__-__"
              placeholderTextColor={c.textSecondary}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t("account.city")}</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholder={t("account.city")}
              placeholderTextColor={c.textSecondary}
            />

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={c.background} />
              ) : (
                <Text style={styles.saveBtnText}>{t("account.saveChanges")}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={c.textPrimary} />
              <Text style={styles.logoutText}>{t("account.logoutFull")}</Text>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={17} color={c.error} />
              <Text style={styles.deleteText}>{t("account.delete")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  headerTitle: {
    ...typography.sectionTitle,
    fontWeight: "800",
    color: c.textPrimary,
  },
  scroll: {
    padding: spacing.screenHorizontal,
    gap: spacing.card,
    paddingBottom: spacing.xxl * 2,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    fontWeight: "700",
    color: c.textPrimary,
  },
  email: {
    ...typography.caption,
    color: c.textSecondary,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: "600",
    color: c.textSecondary,
    marginTop: spacing.sm,
  },
  input: {
    height: 50,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    paddingHorizontal: spacing.lg,
    color: c.textPrimary,
    fontSize: 15,
  },
  saveBtn: {
    height: 50,
    marginTop: spacing.md,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primary,
  },
  saveBtnText: {
    ...typography.button,
    color: c.background,
  },
  logoutBtn: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.button,
    backgroundColor: c.surfaceElevated,
  },
  logoutText: {
    ...typography.button,
    color: c.textPrimary,
  },
  deleteBtn: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: c.error,
  },
  deleteText: {
    ...typography.button,
    color: c.error,
  },
});
