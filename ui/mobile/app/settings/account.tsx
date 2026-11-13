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
import { colors, radii, spacing, typography } from "@/constants/theme";

// Account settings: personal data (moved out of the profile screen), logout
// and account deletion (App Store Guideline 5.1.1(v)).
export default function AccountSettingsScreen() {
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
      Alert.alert("Укажите имя", "Имя видят администраторы площадок при бронировании.");
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({ name: name.trim(), phone: phone.trim(), city: city.trim() });
      hapticSuccess();
      Alert.alert("Сохранено", "Данные аккаунта обновлены.");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    hapticImpact();
    Alert.alert("Выход из аккаунта", "Вы действительно хотите выйти?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
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
      "Удаление аккаунта",
      "Аккаунт, брони и персональные данные будут удалены без возможности восстановления.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить навсегда",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccountApi();
              hapticSuccess();
              Alert.alert("Аккаунт удалён", "Ваш аккаунт и данные удалены.");
              router.replace("/login");
            } catch (e) {
              Alert.alert("Ошибка", getErrorMessage(e));
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
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Настройки аккаунта</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Персональные данные</Text>
            {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

            <Text style={styles.label}>ФИО</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Ваше имя"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Телефон</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholder="+7 (___) ___-__-__"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Город</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholder="Город"
              placeholderTextColor={colors.textSecondary}
            />

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.saveBtnText}>Сохранить изменения</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.logoutText}>Выйти из аккаунта</Text>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={17} color={colors.error} />
              <Text style={styles.deleteText}>Удалить аккаунт</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.sectionTitle,
    fontWeight: "800",
    color: colors.textPrimary,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  email: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  input: {
    height: 50,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
  },
  saveBtn: {
    height: 50,
    marginTop: spacing.md,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.background,
  },
  logoutBtn: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
  },
  logoutText: {
    ...typography.button,
    color: colors.textPrimary,
  },
  deleteBtn: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteText: {
    ...typography.button,
    color: colors.error,
  },
});
