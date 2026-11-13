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
import { tr, useT } from "@/lib/i18n";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

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
  if (bytes < 1024) return tr("settings.bytes", { n: bytes });
  if (bytes < 1024 * 1024) return tr("settings.kb", { n: (bytes / 1024).toFixed(1) });
  return tr("settings.mb", { n: (bytes / 1024 / 1024).toFixed(1) });
}

function openMail(subject: string, body = "") {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert(tr("settings.mailNotSet"), tr("settings.mailWriteUs", { email: SUPPORT_EMAIL })),
  );
}

export default function SettingsScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
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
      t("settings.clearCacheTitle"),
      t("settings.clearCacheText"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.clear"),
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove(await cacheKeys());
            await refresh();
            Alert.alert(SITE_NAME, t("settings.cacheCleared"));
          },
        },
      ],
    );
  };

  const user = getSessionUser();
  const notifLabel =
    notifStatus === "granted" ? t("settings.notifOn") : notifStatus === "denied" ? t("settings.notifOff") : t("settings.notifUnset");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          hitSlop={10}
          onPress={() => {
            hapticSelection();
            // After a reload the stack can be empty; fall back to the parent screen.
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/profile");
          }}
        >
          <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>{t("settings.general")}</Text>
        <View style={styles.card}>
          <Row
            icon="notifications-outline"
            title={t("settings.notifications")}
            subtitle={t("settings.notificationsDesc")}
            value={notifLabel}
            onPress={handleNotifications}
          />
          <Row
            icon="calendar-outline"
            title={t("settings.calendar")}
            subtitle={t("settings.calendarDesc")}
            value={t("settings.soon")}
            disabled
          />
          <Row
            icon="phone-portrait-outline"
            title={t("settings.haptics")}
            subtitle={t("settings.hapticsDesc")}
            // The whole row toggles: a Switch inside a disabled Pressable
            // didn't receive taps reliably.
            onPress={() => toggleHaptics(!hapticsOn)}
            right={
              <Switch
                value={hapticsOn}
                onValueChange={toggleHaptics}
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor={c.textPrimary}
              />
            }
          />
          <Row
            icon="trash-bin-outline"
            title={t("settings.cache")}
            subtitle={cacheSize === null ? t("settings.savedData") : t("settings.savedDataSize", { size: formatBytes(cacheSize) })}
            value={t("settings.clear")}
            onPress={handleClearCache}
            last
          />
        </View>

        <Text style={styles.sectionLabel}>{t("settings.help")}</Text>
        <View style={styles.card}>
          <Row
            icon="help-circle-outline"
            title={t("settings.faq")}
            subtitle={t("settings.faqDesc")}
            onPress={() => {
              hapticSelection();
              router.push("/settings/faq");
            }}
          />
          <Row
            icon="chatbubbles-outline"
            title={t("settings.support")}
            subtitle={SUPPORT_EMAIL}
            onPress={() => {
              hapticSelection();
              openMail(
                t("settings.supportSubject", { site: SITE_NAME }),
                t("settings.supportBody", { account: user?.email ?? t("settings.guest"), version: `${version}${build ? ` (${build})` : ""}` }),
              );
            }}
          />
          <Row
            icon="create-outline"
            title={t("settings.feedback")}
            subtitle={t("settings.feedbackDesc")}
            onPress={() => {
              hapticSelection();
              openMail(t("settings.feedbackSubject", { site: SITE_NAME }));
            }}
            last
          />
        </View>

        <Text style={styles.sectionLabel}>{t("settings.about")}</Text>
        <View style={styles.card}>
          <Row
            icon="information-circle-outline"
            title={t("settings.version")}
            value={`${version}${build ? ` (${build})` : ""}`}
            disabled
          />
          <Row
            icon="shield-checkmark-outline"
            title={t("settings.privacy")}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <Row
            icon="document-text-outline"
            title={t("settings.terms")}
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
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={disabled ? c.textSecondary : c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, disabled && !value && { color: c.textSecondary }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (
        <>
          {value ? <Text style={[styles.rowValue, disabled && { color: c.textSecondary }]}>{value}</Text> : null}
          {onPress && !disabled ? (
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
          ) : null}
        </>
      )}
    </Pressable>
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
    paddingBottom: spacing.xxl * 2,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: c.textSecondary,
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
    borderColor: c.border,
    backgroundColor: c.surface,
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
    borderBottomColor: c.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
  },
  rowTitle: {
    ...typography.cardTitle,
    color: c.textPrimary,
  },
  rowSub: {
    ...typography.caption,
    color: c.textSecondary,
    marginTop: 2,
  },
  rowValue: {
    ...typography.caption,
    fontWeight: "600",
    color: c.primary,
  },
});
