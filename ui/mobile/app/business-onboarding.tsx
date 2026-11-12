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
import { KZ_CITIES, TOP_CITIES, getSelectedCity } from "@/lib/cities";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { colors, radii, spacing, typography } from "@/constants/theme";

const TOTAL_STEPS = 5;
const MAX_TITLE = 120;

const TITLE_PLACEHOLDER: Record<VenueType, string> = {
  complex: "Например, Astana Arena Sport",
  single: "Например, Зал «Олимп»",
  outdoor: "Например, Поле у парка Жастар",
};

// Business account wizard: venue type → name → sports → city → confirm,
// then a congratulations screen and a jump into the business cabinet.
// Everything else (address, halls, prices, schedule) is filled later in
// the cabinet's settings.
export default function BusinessOnboardingScreen() {
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

  useEffect(() => {
    getSelectedCity()
      .then((c) => setCity((prev) => prev || c))
      .catch(() => {});
  }, []);

  const cities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    const all = [...TOP_CITIES, ...KZ_CITIES.filter((c) => !TOP_CITIES.includes(c))];
    return q ? all.filter((c) => c.toLowerCase().includes(q)) : all;
  }, [citySearch]);

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
    setSubmitting(true);
    try {
      await onboardBusiness({ venue_type: venueType, title: title.trim(), sports, city });
      hapticSuccess();
      setDone(true);
      Animated.spring(congratsScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
      setTimeout(() => router.replace("/business"), 2200);
    } catch (err) {
      Alert.alert("Не удалось открыть бизнес-аккаунт", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={[styles.container, styles.congrats]}>
        <Animated.View style={[styles.congratsIcon, { transform: [{ scale: congratsScale }] }]}>
          <Ionicons name="trophy" size={44} color={colors.background} />
        </Animated.View>
        <Text style={styles.congratsTitle}>Поздравляем!</Text>
        <Text style={styles.congratsText}>Вы открыли бизнес-аккаунт «{title.trim()}»</Text>
        <Text style={styles.congratsHint}>Открываем бизнес-кабинет…</Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
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
            <Ionicons name={step > 1 ? "chevron-back" : "close"} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.stepLabel}>
            Шаг {step} из {TOTAL_STEPS}
          </Text>
          <View style={styles.backBtnSpacer} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <Text style={styles.title}>Что вы сдаёте в аренду?</Text>
              <Text style={styles.subtitle}>Выберите формат — от него зависят настройки кабинета.</Text>
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
                        color={selected ? colors.background : colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{v.title}</Text>
                      <Text style={styles.optionDesc}>{v.description}</Text>
                    </View>
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.title}>Как называется ваша площадка?</Text>
              <Text style={styles.subtitle}>Так её увидят клиенты в каталоге и на карте.</Text>
              <TextInput
                value={title}
                onChangeText={(t) => setTitle(t.slice(0, MAX_TITLE))}
                placeholder={venueType ? TITLE_PLACEHOLDER[venueType] : "Название"}
                placeholderTextColor={colors.textSecondary}
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
              <Text style={styles.title}>Какие виды спорта?</Text>
              <Text style={styles.subtitle}>Можно выбрать несколько — по ним вас найдут клиенты.</Text>
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
                        <Ionicons name="checkmark" size={14} color={colors.background} />
                      ) : null}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sport}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.title}>В каком городе?</Text>
              <Text style={styles.subtitle}>Адрес и район можно указать позже в настройках.</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder="Найти город"
                  placeholderTextColor={colors.textSecondary}
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
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 5 && (
            <>
              <Text style={styles.title}>Проверьте данные</Text>
              <Text style={styles.subtitle}>
                После подтверждения аккаунт переключится в бизнес-режим. Отключить его можно в профиле.
              </Text>
              <View style={styles.summary}>
                <SummaryRow label="Формат" value={venue?.title ?? ""} onEdit={() => setStep(1)} />
                <SummaryRow label="Название" value={title.trim()} onEdit={() => setStep(2)} />
                <SummaryRow label="Виды спорта" value={sports.join(", ")} onEdit={() => setStep(3)} />
                <SummaryRow label="Город" value={city} onEdit={() => setStep(4)} last />
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
              <Text style={styles.primaryBtnText}>Далее</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleConfirm}
              disabled={submitting}
              style={[styles.primaryBtn, submitting && styles.disabled]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryBtnText}>Подтвердить и переключиться</Text>
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
  return (
    <Pressable onPress={onEdit} style={[styles.summaryRow, !last && styles.summaryDivider]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
      <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
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
    backgroundColor: colors.surface,
  },
  backBtnSpacer: {
    width: 40,
  },
  stepLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 4,
    marginHorizontal: spacing.screenHorizontal,
    borderRadius: 2,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
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
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  optionIconSelected: {
    backgroundColor: colors.primary,
  },
  optionTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  optionDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  input: {
    height: 52,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 16,
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.background,
    fontWeight: "600",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 46,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  summary: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.cardTitle,
    color: colors.textPrimary,
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
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    ...typography.button,
    fontSize: 16,
    color: colors.background,
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
    backgroundColor: colors.primary,
    marginBottom: spacing.xxl,
  },
  congratsTitle: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  congratsText: {
    ...typography.body,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  congratsHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
});
