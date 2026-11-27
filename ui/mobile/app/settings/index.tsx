import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { appAlert } from "@/lib/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { isHapticsEnabled, setHapticsEnabled, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { requestNotificationPermissions } from "@/lib/pushNotificationsService";
import { getServerPushStatus, registerForPushNotifications, sendServerTestPush } from "@/lib/push";
import { sendAdminBroadcast, listAdminBroadcasts, type BroadcastCampaign } from "@/lib/notifications";
import { getMe, updateMyProfile } from "@/lib/user";
import { PRIVACY_URL, SITE_NAME, SUPPORT_EMAIL, TERMS_URL } from "@/lib/site";
import { getSessionUser, hasRealSession } from "@/lib/auth";
import { KeyboardSheetView } from "@/components/KeyboardSheetView";
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
    appAlert(tr("settings.mailNotSet"), tr("settings.mailWriteUs", { email: SUPPORT_EMAIL })),
  );
}

export default function SettingsScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [hapticsOn, setHapticsOn] = useState(true);
  const [marketingPushOn, setMarketingPushOn] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [testingPush, setTestingPush] = useState(false);
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [bTitle, setBTitle] = useState("");
  const [bBody, setBBody] = useState("");
  const [bRole, setBRole] = useState<"all" | "client" | "business">("all");
  const [bCity, setBCity] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);

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
    if (hasRealSession()) {
      getMe()
        .then((me) => {
          setMarketingPushOn(me.marketing_push_enabled !== false);
          setIsAdmin(me.type === "admin");
        })
        .catch(() => {});
      getServerPushStatus()
        .then((st) => setMarketingPushOn(st.marketing_push_enabled))
        .catch(() => {});
    } else {
      setIsAdmin(false);
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

  const toggleMarketingPush = async (val: boolean) => {
    hapticSelection();
    setMarketingPushOn(val);
    if (!hasRealSession()) return;
    try {
      await updateMyProfile({ marketing_push_enabled: val });
    } catch {
      setMarketingPushOn(!val);
    }
  };

  const handleTestPush = async () => {
    if (testingPush) return;
    hapticSelection();
    if (!hasRealSession()) {
      appAlert(SITE_NAME, t("settings.pushTestNoToken"));
      return;
    }
    setTestingPush(true);
    try {
      await registerForPushNotifications();
      const res = await sendServerTestPush();
      if (res.sent) {
        hapticSuccess();
        appAlert(SITE_NAME, t("settings.pushTestSent"));
      } else {
        appAlert(SITE_NAME, t("settings.pushTestNoToken"));
      }
    } catch {
      appAlert(SITE_NAME, t("settings.pushTestNoToken"));
    } finally {
      setTestingPush(false);
    }
  };

  const openAdminBroadcast = () => {
    hapticSelection();
    setBroadcastModal(true);
    listAdminBroadcasts().then(setCampaigns).catch(() => {});
  };

  const handleSendAdminBroadcast = async () => {
    if (!bTitle.trim() || !bBody.trim()) {
      appAlert(t("common.error"), t("broadcast.required"));
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await sendAdminBroadcast({
        title: bTitle.trim(),
        body: bBody.trim(),
        role: bRole,
        city: bCity.trim() || undefined,
      });
      hapticSuccess();
      setBTitle("");
      setBBody("");
      setCampaigns((prev) => [res.campaign, ...prev]);
      appAlert(
        t("common.success"),
        t("broadcast.sentSuccess", {
          recipients: res.campaign.recipients_count,
          push: res.campaign.push_sent_count,
        }),
      );
    } catch {
      appAlert(t("common.error"), t("broadcast.required"));
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleNotifications = async () => {
    hapticSelection();
    if (notifStatus === "undetermined") {
      const ok = await requestNotificationPermissions();
      setNotifStatus(ok ? "granted" : "denied");
      if (ok && hasRealSession()) {
        await registerForPushNotifications();
      }
      return;
    }
    Linking.openSettings();
  };

  const handleClearCache = () => {
    hapticSelection();
    appAlert(
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
            appAlert(SITE_NAME, t("settings.cacheCleared"));
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
          {hasRealSession() ? (
            <>
              <Row
                icon="megaphone-outline"
                title={t("settings.broadcastOptIn")}
                subtitle={t("settings.broadcastOptInDesc")}
                onPress={() => toggleMarketingPush(!marketingPushOn)}
                right={
                  <Switch
                    value={marketingPushOn}
                    onValueChange={toggleMarketingPush}
                    trackColor={{ false: c.border, true: c.primary }}
                    thumbColor={c.textPrimary}
                  />
                }
              />
              <Row
                icon="paper-plane-outline"
                title={t("settings.pushTest")}
                subtitle={t("settings.pushTestDesc")}
                value={testingPush ? "..." : t("settings.pushTestAction")}
                onPress={handleTestPush}
              />
            </>
          ) : null}
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

        {isAdmin ? (
          <>
            <Text style={styles.sectionLabel}>{t("settings.adminSection")}</Text>
            <View style={styles.card}>
              <Row
                icon="radio-outline"
                title={t("settings.adminBroadcast")}
                subtitle={t("settings.adminBroadcastDesc")}
                onPress={openAdminBroadcast}
                last
              />
            </View>
          </>
        ) : null}

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

      <Modal visible={broadcastModal} animationType="slide" transparent onRequestClose={() => setBroadcastModal(false)}>
        <KeyboardSheetView style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("broadcast.platformTitle")}</Text>
              <Pressable onPress={() => setBroadcastModal(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
              <Text style={styles.inputLabel}>{t("broadcast.segment")}</Text>
              <View style={styles.chipsRow}>
                {(["all", "client", "business"] as const).map((r) => {
                  const active = bRole === r;
                  const labelKey = r === "all" ? "broadcast.roleAll" : r === "client" ? "broadcast.roleClients" : "broadcast.roleBusiness";
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setBRole(r)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>{t("broadcast.cityOptional")}</Text>
              <TextInput
                style={styles.input}
                value={bCity}
                onChangeText={setBCity}
                placeholder={t("broadcast.cityPlaceholder")}
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("broadcast.titleLabel")}</Text>
              <TextInput
                style={styles.input}
                value={bTitle}
                onChangeText={setBTitle}
                placeholder={t("broadcast.titlePlaceholder")}
                placeholderTextColor={c.textMuted}
                maxLength={160}
              />

              <Text style={styles.inputLabel}>{t("broadcast.bodyLabel")}</Text>
              <TextInput
                style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
                value={bBody}
                onChangeText={setBBody}
                placeholder={t("broadcast.bodyPlaceholder")}
                placeholderTextColor={c.textMuted}
                multiline
                maxLength={2000}
              />

              <Pressable
                style={[styles.submitBtn, sendingBroadcast && { opacity: 0.6 }]}
                disabled={sendingBroadcast}
                onPress={handleSendAdminBroadcast}
              >
                {sendingBroadcast ? (
                  <ActivityIndicator color={c.onPrimary} size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>{t("broadcast.send")}</Text>
                )}
              </Pressable>

              {campaigns.length > 0 ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  <Text style={styles.inputLabel}>{t("broadcast.history")}</Text>
                  {campaigns.slice(0, 5).map((item) => (
                    <View key={item.id} style={styles.historyItem}>
                      <Text style={styles.historyTitle}>{item.title}</Text>
                      <Text style={styles.historyMeta}>
                        {t("broadcast.recipientsSummary", {
                          recipients: item.recipients_count,
                          push: item.push_sent_count,
                        })}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardSheetView>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: c.overlay,
  },
  modalCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    padding: spacing.xl,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: c.glassBorder,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textSecondary,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.smallChip,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
  },
  chipTextActive: {
    color: c.primary,
  },
  input: {
    backgroundColor: c.background,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: c.textPrimary,
  },
  submitBtn: {
    backgroundColor: c.primary,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: c.onPrimary,
  },
  historyItem: {
    backgroundColor: c.background,
    borderRadius: radii.smallChip,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  historyMeta: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
});
