import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, type ThemeMode } from "@/theme/ThemeProvider";
import { useI18n, type AppLocale } from "@/lib/i18n";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { hapticSelection } from "@/lib/haptics";
import { colors, radii, spacing, typography } from "@/constants/theme";

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "Системная" },
  { id: "light", label: "Светлая" },
  { id: "dark", label: "Тёмная" },
];

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
  const router = useRouter();
  const { mode, setMode } = useAppTheme();
  const { locale, setLocale } = useI18n();

  const invite = async () => {
    hapticSelection();
    try {
      await Share.share({
        message: `Бронирую спортзалы и площадки в ${SITE_NAME} — попробуй и ты: ${SITE_URL}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.label}>Тема оформления</Text>
        <Segmented options={THEMES} value={mode} onChange={setMode} />
        <Text style={[styles.label, { marginTop: spacing.lg }]}>Язык приложения</Text>
        <Segmented options={LANGUAGES} value={locale} onChange={setLocale} />
        {locale === "kk" ? (
          <Text style={styles.note}>Қазақша аударма дайындалуда — әзірге мәтіндер орыс тілінде.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        {signedIn ? (
          <Row
            icon="person-circle-outline"
            title="Настройки аккаунта"
            subtitle="Имя, телефон, город, выход и удаление"
            onPress={() => {
              hapticSelection();
              router.push("/settings/account");
            }}
          />
        ) : null}
        <Row
          icon="gift-outline"
          title="Пригласить друга"
          subtitle={`Поделитесь ${SITE_NAME} с командой`}
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
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.card,
    marginBottom: spacing.card,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  segment: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: radii.button,
    backgroundColor: colors.background,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: radii.smallChip,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  segmentText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
});
