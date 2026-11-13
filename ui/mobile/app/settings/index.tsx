import { useCallback, useState } from "react";
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
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { isHapticsEnabled, setHapticsEnabled, hapticSelection } from "@/lib/haptics";
import { requestNotificationPermissions } from "@/lib/pushNotificationsService";
import { PRIVACY_URL, SITE_NAME, SUPPORT_EMAIL, TERMS_URL } from "@/lib/site";
import { getSessionUser } from "@/lib/auth";
import { colors, radii, spacing, typography } from "@/constants/theme";

// Cached API data that can be re-downloaded. Session, theme, language,
// favorites and other preferences are intentionally kept.
const CACHE_KEYS = [
  "sportrent.arenas.v1",
  "sportrent.halls.v1",
  "sportrent.bookings.v1",
  "alango_chat_dialogs_v1",
];
const SCHEDULES_PREFIX = "sportrent.schedules.v1";

async function cacheKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all.filter((k) => CACHE_KEYS.includes(k) || k.startsWith(SCHEDULES_PREFIX));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function openMail(subject: string, body = "") {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert("Почта не настроена", `Напишите нам на ${SUPPORT_EMAIL}`),
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [hapticsOn, setHapticsOn] = useState(true);
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const build = Constants.expoConfig?.ios?.buildNumber;

  const refresh = useCallback(async () => {
    setHapticsOn(await isHapticsEnabled());
    try {
      const perm = await Notifications.getPermissionsAsync();
      setNotifStatus(perm.status as typeof notifStatus);
    } catch {
      setNotifStatus("undetermined");
    }
    try {
      const keys = await cacheKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      setCacheSize(pairs.reduce((sum, [, v]) => sum + (v?.length ?? 0), 0));
    } catch {
      setCacheSize(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const toggleHaptics = async (val: boolean) => {
    setHapticsOn(val);
    await setHapticsEnabled(val);
    if (val) hapticSelection();
  };

  const handleNotifications = async () => {
    hapticSelection();
    if (notifStatus === "undetermined") {
      const ok = await requestNotificationPermissions();
      setNotifStatus(ok ? "granted" : "denied");
      return;
    }
    // Granted or denied: iOS only lets the user change it in system settings.
    Linking.openSettings();
  };

  const handleClearCache = () => {
    hapticSelection();
    Alert.alert(
      "Очистить кэш?",
      "Сохранённые списки залов, броней и графиков будут загружены заново. Вход в аккаунт и настройки сохранятся.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Очистить",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove(await cacheKeys());
            await refresh();
            Alert.alert(SITE_NAME, "Кэш очищен");
          },
        },
      ],
    );
  };

  const user = getSessionUser();
  const notifLabel =
    notifStatus === "granted" ? "Включены" : notifStatus === "denied" ? "Выключены" : "Не настроены";

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
        <Text style={styles.headerTitle}>Настройки</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>Общие</Text>
        <View style={styles.card}>
          <Row
            icon="notifications-outline"
            title="Уведомления"
            subtitle="Напоминания о бронях и сообщения"
            value={notifLabel}
            onPress={handleNotifications}
          />
          <Row
            icon="calendar-outline"
            title="Календарь"
            subtitle="Синхронизация с Google Calendar"
            value="Скоро"
            disabled
          />
          <Row
            icon="phone-portrait-outline"
            title="Тактильный отклик"
            subtitle="Вибрация при нажатиях и переключениях"
            right={
              <Switch
                value={hapticsOn}
                onValueChange={toggleHaptics}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Row
            icon="trash-bin-outline"
            title="Кэш приложения"
            subtitle={cacheSize === null ? "Сохранённые данные" : `Сохранённые данные · ${formatBytes(cacheSize)}`}
            value="Очистить"
            onPress={handleClearCache}
            last
          />
        </View>

        <Text style={styles.sectionLabel}>Помощь и отзывы</Text>
        <View style={styles.card}>
          <Row
            icon="help-circle-outline"
            title="Частые вопросы"
            subtitle="Бронирование, оплата, бизнес-аккаунт"
            onPress={() => {
              hapticSelection();
              router.push("/settings/faq");
            }}
          />
          <Row
            icon="chatbubbles-outline"
            title="Служба поддержки"
            subtitle={SUPPORT_EMAIL}
            onPress={() => {
              hapticSelection();
              openMail(
                `${SITE_NAME}: обращение в поддержку`,
                `\n\n—\nАккаунт: ${user?.email ?? "гость"}\nВерсия: ${version}${build ? ` (${build})` : ""}`,
              );
            }}
          />
          <Row
            icon="create-outline"
            title="Написать отзыв"
            subtitle="Что улучшить в приложении"
            onPress={() => {
              hapticSelection();
              openMail(`${SITE_NAME}: отзыв о приложении`);
            }}
            last
          />
        </View>

        <Text style={styles.sectionLabel}>О приложении</Text>
        <View style={styles.card}>
          <Row
            icon="information-circle-outline"
            title="Версия"
            value={`${version}${build ? ` (${build})` : ""}`}
            disabled
          />
          <Row
            icon="shield-checkmark-outline"
            title="Политика конфиденциальности"
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <Row
            icon="document-text-outline"
            title="Условия использования"
            onPress={() => Linking.openURL(TERMS_URL)}
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  title,
  subtitle,
  value,
  right,
  onPress,
  disabled,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={disabled ? colors.textSecondary : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, disabled && !value && { color: colors.textSecondary }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (
        <>
          {value ? <Text style={[styles.rowValue, disabled && { color: colors.textSecondary }]}>{value}</Text> : null}
          {onPress && !disabled ? (
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          ) : null}
        </>
      )}
    </Pressable>
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
    paddingBottom: spacing.xxl * 2,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.section,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  rowTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  rowSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowValue: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.primary,
  },
});
