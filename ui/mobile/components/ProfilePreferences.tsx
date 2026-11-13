import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, type ThemeMode } from "@/theme/ThemeProvider";
import { useI18n, type AppLocale, type MessageKey } from "@/lib/i18n";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { hapticSelection } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const THEMES: { id: ThemeMode; labelKey: MessageKey }[] = [
  { id: "system", labelKey: "prefs.themeSystem" },
  { id: "light", labelKey: "prefs.themeLight" },
  { id: "dark", labelKey: "prefs.themeDark" },
];

// Language names are always shown in their own language.

const LANGUAGES: { id: AppLocale; label: string }[] = [
  { id: "kk", label: "Қазақша" },
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => {
              hapticSelection();
              onChange(o.id);
            }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Profile block (as in Vison): theme, language, invite a friend and the
// entry to account settings (personal data, logout, delete account).
export function ProfilePreferences({ signedIn }: { signedIn: boolean }) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { mode, setMode } = useAppTheme();
  // Root-context updates (theme / language) from inside an iOS native tab are
  // only mounted on the next touch; a local state bump right after forces the
  // commit so the switch is visible immediately.
  const [, setTick] = useState(0);
  const flush = () => requestAnimationFrame(() => setTick((t) => t + 1));
  const { locale, setLocale, t } = useI18n();
  const themeOptions = THEMES.map((o) => ({ id: o.id, label: t(o.labelKey) }));

  const invite = async () => {
    hapticSelection();
    try {
      await Share.share({
        message: t("prefs.inviteMessage", { site: SITE_NAME, url: SITE_URL }),
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.label}>{t("prefs.theme")}</Text>
        <Segmented options={themeOptions} value={mode} onChange={(m) => {
            setMode(m);
            flush();
          }}
        />
        <Text style={[styles.label, { marginTop: spacing.lg }]}>{t("prefs.language")}</Text>
        <Segmented options={LANGUAGES} value={locale} onChange={(l) => {
            setLocale(l);
            flush();
          }}
        />
      </View>

      <View style={styles.card}>
        {signedIn ? (
          <Row
            icon="person-circle-outline"
            title={t("prefs.account")}
            subtitle={t("prefs.accountDesc")}
            onPress={() => {
              hapticSelection();
              router.push("/settings/account");
            }}
          />
        ) : null}
        <Row
          icon="gift-outline"
          title={t("prefs.invite")}
          subtitle={t("prefs.inviteDesc", { site: SITE_NAME })}
          onPress={invite}
          last
        />
      </View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  wrap: {
    gap: spacing.card,
    marginBottom: spacing.card,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  label: {
    ...typography.caption,
    fontWeight: "700",
    color: c.textSecondary,
    marginBottom: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: c.textSecondary,
    marginTop: spacing.sm,
  },
  segment: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: radii.button,
    backgroundColor: c.background,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: radii.smallChip,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: {
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.primary,
  },
  segmentText: {
    ...typography.caption,
    fontWeight: "600",
    color: c.textSecondary,
  },
  segmentTextActive: {
    color: c.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
});
