import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import {
  BUSINESS_SPORTS,
  VENUE_TYPES,
  onboardBusiness,
  type VenueType,
} from "@/lib/business";
import { getRefreshToken, getSessionUser, getToken } from "@/lib/auth";
import { KZ_CITIES, TOP_CITIES, getSelectedCity } from "@/lib/cities";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT, type MessageKey } from "@/lib/i18n";
import { cityLabel, cityMatches, sportLabel } from "@/lib/dataLabels";

const TOTAL_STEPS = 5;
const MAX_TITLE = 120;

const TITLE_PLACEHOLDER: Record<VenueType, MessageKey> = {
  complex: "onb.placeholderComplex",
  single: "onb.placeholderSingle",
  outdoor: "onb.placeholderOutdoor",
};

// Business account wizard: venue type → name → sports → city → confirm,
// then a congratulations screen and a jump into the business cabinet.
// Everything else (address, halls, prices, schedule) is filled later in
// the cabinet's settings.
export default function BusinessOnboardingScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [venueType, setVenueType] = useState<VenueType | null>(null);
  const [title, setTitle] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const congratsScale = useRef(new Animated.Value(0.6)).current;

  const promptLogin = (onCancel?: () => void) => {
    Alert.alert(
      t("biz.authRequired"),
      t("onb.sessionMissing"),
      [
        { text: t("common.cancel"), style: "cancel", onPress: onCancel },
        { text: t("login.submit"), onPress: () => router.replace("/login") },
      ],
    );
  };

  const hasValidSession = async () => {
    const user = getSessionUser();
    if (!user || user.role === "guest") return false;
    const [token, refreshToken] = await Promise.all([getToken(), getRefreshToken()]);
    return Boolean(token || refreshToken);
  };

  useEffect(() => {
    hasValidSession().then((ok) => {
      if (!ok) {
        promptLogin(() => router.back());
      }
    });
    getSelectedCity()
      .then((c) => setCity((prev) => prev || c))
      .catch(() => {});
  }, []);

  const cities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    const all = [...TOP_CITIES, ...KZ_CITIES.filter((c) => !TOP_CITIES.includes(c))];
    return q ? all.filter((c) => cityMatches(c, q, t)) : all;
  }, [citySearch, t]);

  const canNext =
    (step === 1 && venueType !== null) ||
    (step === 2 && title.trim().length > 0) ||
    (step === 3 && sports.length > 0) ||
    (step === 4 && city.length > 0) ||
    step === 5;

  const goBack = () => {
    hapticSelection();
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  const goNext = () => {
    if (!canNext) return;
    hapticSelection();
    setStep(step + 1);
  };

  const toggleSport = (sport: string) => {
    hapticSelection();
    setSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  };

  const handleConfirm = async () => {
    if (!venueType) return;
    if (!(await hasValidSession())) {
      promptLogin();
      return;
    }
    setSubmitting(true);
    try {
      await onboardBusiness({ venue_type: venueType, title: title.trim(), sports, city });
      hapticSuccess();
      setDone(true);
      Animated.spring(congratsScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
      setTimeout(() => router.replace("/business"), 2200);
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        promptLogin();
      } else {
        Alert.alert(t("onb.openError"), getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={[styles.container, styles.congrats]}>
        <Animated.View style={[styles.congratsIcon, { transform: [{ scale: congratsScale }] }]}>
          <Ionicons name="trophy" size={44} color={c.background} />
        </Animated.View>
        <Text style={styles.congratsTitle}>{t("onb.congrats")}</Text>
        <Text style={styles.congratsText}>{t("onb.congratsText", { title: title.trim() })}</Text>
        <Text style={styles.congratsHint}>{t("onb.opening")}</Text>
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    );
  }

  const venue = VENUE_TYPES.find((v) => v.id === venueType);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
            <Ionicons name={step > 1 ? "chevron-back" : "close"} size={22} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.stepLabel}>
            {t("onb.step", { step, total: TOTAL_STEPS })}
          </Text>
          <View style={styles.backBtnSpacer} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <Text style={styles.title}>{t("onb.q1")}</Text>
              <Text style={styles.subtitle}>{t("onb.q1Text")}</Text>
              {VENUE_TYPES.map((v) => {
                const selected = venueType === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      hapticSelection();
                      setVenueType(v.id);
                    }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                      <Ionicons
                        name={v.icon}
                        size={22}
                        color={selected ? c.background : c.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{t(v.titleKey)}</Text>
                      <Text style={styles.optionDesc}>{t(v.descriptionKey)}</Text>
                    </View>
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={selected ? c.primary : c.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.title}>{t("onb.q2")}</Text>
              <Text style={styles.subtitle}>{t("onb.q2Text")}</Text>
              <TextInput
                value={title}
                onChangeText={(t) => setTitle(t.slice(0, MAX_TITLE))}
                placeholder={venueType ? t(TITLE_PLACEHOLDER[venueType]) : t("onb.namePlaceholder")}
                placeholderTextColor={c.textSecondary}
                style={styles.input}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={goNext}
              />
              <Text style={styles.counter}>
                {title.length}/{MAX_TITLE}
              </Text>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.title}>{t("onb.q3")}</Text>
              <Text style={styles.subtitle}>{t("onb.q3Text")}</Text>
              <View style={styles.chips}>
                {BUSINESS_SPORTS.map((sport) => {
                  const selected = sports.includes(sport);
                  return (
                    <Pressable
                      key={sport}
                      onPress={() => toggleSport(sport)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      {selected ? (
                        <Ionicons name="checkmark" size={14} color={c.background} />
                      ) : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sportLabel(sport, t)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.title}>{t("onb.q4")}</Text>
              <Text style={styles.subtitle}>{t("onb.q4Text")}</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={c.textSecondary} />
                <TextInput
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder={t("onb.findCity")}
                  placeholderTextColor={c.textSecondary}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.chips}>
                {cities.map((c) => {
                  const selected = city === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        hapticSelection();
                        setCity(c);
                      }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{cityLabel(c, t)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 5 && (
            <>
              <Text style={styles.title}>{t("onb.q5")}</Text>
              <Text style={styles.subtitle}>
                {t("onb.q5Text")}
              </Text>
              <View style={styles.summary}>
                <SummaryRow label={t("onb.format")} value={venue ? t(venue.titleKey) : ""} onEdit={() => setStep(1)} />
                <SummaryRow label={t("onb.name")} value={title.trim()} onEdit={() => setStep(2)} />
                <SummaryRow label={t("onb.sports")} value={sports.map((s) => sportLabel(s, t)).join(", ")} onEdit={() => setStep(3)} />
                <SummaryRow label={t("onb.city")} value={cityLabel(city, t)} onEdit={() => setStep(4)} last />
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {step < TOTAL_STEPS ? (
            <Pressable
              onPress={goNext}
              disabled={!canNext}
              style={[styles.primaryBtn, !canNext && styles.disabled]}
            >
              <Text style={styles.primaryBtnText}>{t("onb.next")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleConfirm}
              disabled={submitting}
              style={[styles.primaryBtn, submitting && styles.disabled]}
            >
              {submitting ? (
                <ActivityIndicator color={c.background} />
              ) : (
                <Text style={styles.primaryBtnText}>{t("onb.confirm")}</Text>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
  last,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  last?: boolean;
}) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onEdit} style={[styles.summaryRow, !last && styles.summaryDivider]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
      <Ionicons name="create-outline" size={18} color={c.textSecondary} />
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
    justifyContent: "space-between",
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
  backBtnSpacer: {
    width: 40,
  },
  stepLabel: {
    ...typography.body,
    color: c.textSecondary,
  },
  progressTrack: {
    height: 4,
    marginHorizontal: spacing.screenHorizontal,
    borderRadius: 2,
    backgroundColor: c.surfaceElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.primary,
  },
  content: {
    padding: spacing.screenHorizontal,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.card,
  },
  title: {
    ...typography.screenTitle,
    fontSize: 26,
    color: c.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: c.textSecondary,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  optionSelected: {
    borderColor: c.primary,
    backgroundColor: c.surfaceElevated,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
  },
  optionIconSelected: {
    backgroundColor: c.primary,
  },
  optionTitle: {
    ...typography.cardTitle,
    color: c.textPrimary,
  },
  optionDesc: {
    ...typography.caption,
    color: c.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  input: {
    height: 52,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.lg,
    color: c.textPrimary,
    fontSize: 16,
  },
  counter: {
    ...typography.caption,
    color: c.textSecondary,
    textAlign: "right",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipSelected: {
    borderColor: c.primary,
    backgroundColor: c.primary,
  },
  chipText: {
    ...typography.body,
    color: c.textPrimary,
  },
  chipTextSelected: {
    color: c.background,
    fontWeight: "600",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 46,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: c.textPrimary,
    fontSize: 15,
  },
  summary: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  summaryDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  summaryLabel: {
    ...typography.caption,
    color: c.textSecondary,
  },
  summaryValue: {
    ...typography.cardTitle,
    color: c.textPrimary,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primary,
  },
  primaryBtnText: {
    ...typography.button,
    fontSize: 16,
    color: c.background,
  },
  disabled: {
    opacity: 0.45,
  },
  congrats: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  congratsIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primary,
    marginBottom: spacing.xxl,
  },
  congratsTitle: {
    ...typography.screenTitle,
    color: c.textPrimary,
  },
  congratsText: {
    ...typography.body,
    fontSize: 16,
    color: c.textPrimary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  congratsHint: {
    ...typography.body,
    color: c.textSecondary,
    marginTop: spacing.xl,
  },
});
