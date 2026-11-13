import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { resolveMyArenaId } from "@/lib/business";
import {
  DEFAULT_WEEK_SCHEDULE,
  getHallSchedule,
  getStoredHalls,
  Hall,
  saveHallSchedule,
  ScheduleDay,
} from "@/lib/sportRentData";
import { getErrorMessage } from "@/lib/errorMessage";
import { radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const TIME_PRESETS = [
  { label: "08:00 - 23:00", start: "08:00", end: "23:00" },
  { label: "08:00 - 24:00", start: "08:00", end: "24:00" },
  { label: "07:00 - 23:00", start: "07:00", end: "23:00" },
  { label: "09:00 - 22:00", start: "09:00", end: "22:00" },
  { label: "24 часа", start: "00:00", end: "24:00" },
];

const DURATION_OPTIONS = [60, 90, 120];

function formatTime(val: string): string {
  const cleaned = val.replace(/[^0-9:]/g, "").slice(0, 5);
  if (!cleaned.includes(":") && cleaned.length >= 3) {
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
  }
  return cleaned;
}

export default function BusinessScheduleScreen() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_WEEK_SCHEDULE);
  // Opened from a hall card: "/business/schedule?hallId=12".
  const { hallId: hallIdParam } = useLocalSearchParams<{ hallId?: string }>();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [hallId, setHallId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeDayIdx, setActiveDayIdx] = useState<number | null>(null);

  // Each hall has its own schedule (and its own booking slots).
  const loadHalls = useCallback(async () => {
    const arenaId = await resolveMyArenaId();
    const all = arenaId ? await getStoredHalls() : [];
    const mine = arenaId ? all.filter((h) => h.arenaId === arenaId) : [];
    setHalls(mine);
    setHallId((prev) => (prev && mine.some((h) => h.id === prev) ? prev : mine[0]?.id ?? null));
    setLoaded(true);
    return mine;
  }, []);

  useEffect(() => {
    loadHalls();
  }, [loadHalls]);

  // Select the hall passed from the card (the tab stays mounted, so react to
  // every new param; reload the list first in case the hall was just created).
  useEffect(() => {
    const wanted = Number(hallIdParam);
    if (!wanted) return;
    (async () => {
      const mine = halls.some((h) => h.id === wanted) ? halls : await loadHalls();
      if (mine.some((h) => h.id === wanted)) {
        setActiveDayIdx(null);
        setHallId(wanted);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hallIdParam]);

  useEffect(() => {
    if (!hallId) return;
    getHallSchedule(hallId)
      .then(setSchedule)
      .catch((err) => Alert.alert("Ошибка", getErrorMessage(err, "Не удалось загрузить график зала")));
  }, [hallId]);

  const toggleDayClosed = (index: number) => {
    hapticImpact();
    setSchedule((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isClosed: !copy[index].isClosed };
      return copy;
    });
  };

  const setDayTimes = (index: number, start: string, end: string) => {
    hapticSelection();
    setSchedule((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], startTime: start, endTime: end, isClosed: false };
      return copy;
    });
  };

  const toggleSlotDuration = (dayIndex: number, duration: number) => {
    hapticSelection();
    setSchedule((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex].slotDurations || [60];
      let updated: number[];
      if (current.includes(duration)) {
        if (current.length === 1) {
          Alert.alert("Внимание", "Должен быть выбран хотя бы один интервал слота");
          return prev;
        }
        updated = current.filter((d) => d !== duration);
      } else {
        updated = [...current, duration].sort((a, b) => a - b);
      }
      copy[dayIndex] = { ...copy[dayIndex], slotDurations: updated };
      return copy;
    });
  };

  const toggleCascade = (index: number) => {
    hapticSelection();
    setSchedule((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        cascadeEnabled: !copy[index].cascadeEnabled,
        cascadeStepHours: copy[index].cascadeStepHours || 2,
        cascadeInitialEndTime: copy[index].cascadeInitialEndTime || "14:00",
        cascadeSecondBoundaryEnabled: true,
        cascadeSecondBoundaryTime: copy[index].cascadeSecondBoundaryTime || "18:00",
        cascadeCutoffTime: copy[index].cascadeCutoffTime || "22:00",
      };
      return copy;
    });
  };

  const setCascadeStep = (index: number, step: number) => {
    hapticSelection();
    setSchedule((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], cascadeStepHours: step };
      return copy;
    });
  };

  const applyMondayToAll = () => {
    hapticImpact();
    const monday = schedule[0];
    Alert.alert(
      "Синхронизация графика",
      `Применить настройки понедельника (${monday.startTime} - ${monday.endTime}, слоты ${monday.slotDurations.join(", ")} мин, каскад: ${monday.cascadeEnabled ? "Вкл" : "Выкл"}) ко всем дням недели?`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Применить ко всем",
          onPress: () => {
            setSchedule((prev) =>
              prev.map((d) => ({
                ...d,
                isClosed: monday.isClosed,
                startTime: monday.startTime,
                endTime: monday.endTime,
                slotDurations: [...monday.slotDurations],
                cascadeEnabled: monday.cascadeEnabled,
                cascadeStepHours: monday.cascadeStepHours,
                cascadeInitialEndTime: monday.cascadeInitialEndTime,
                cascadeSecondBoundaryEnabled: monday.cascadeSecondBoundaryEnabled,
                cascadeSecondBoundaryTime: monday.cascadeSecondBoundaryTime,
                cascadeCutoffTime: monday.cascadeCutoffTime,
              }))
            );
            hapticSuccess();
          },
        },
      ]
    );
  };

  const currentHall = halls.find((h) => h.id === hallId);

  const handleSave = async () => {
    if (!hallId) return;
    setSaving(true);
    try {
      setSchedule(await saveHallSchedule(hallId, schedule));
      hapticSuccess();
      Alert.alert("Сохранено", `График зала «${currentHall?.title ?? ""}» обновлён.`);
    } catch (err) {
      Alert.alert("Не удалось сохранить график", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const copyToAllHalls = () => {
    if (!hallId || halls.length < 2) return;
    hapticImpact();
    Alert.alert(
      "Скопировать на все залы?",
      `График зала «${currentHall?.title ?? ""}» заменит графики остальных залов (${halls.length - 1}).`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Скопировать",
          onPress: async () => {
            setSaving(true);
            try {
              for (const h of halls) {
                await saveHallSchedule(h.id, schedule);
              }
              hapticSuccess();
              Alert.alert("Готово", "График применён ко всем залам.");
            } catch (err) {
              Alert.alert("Не удалось скопировать график", getErrorMessage(err));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, flexShrink: 1, marginRight: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            График работы
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            У каждого зала свои часы и слоты брони
          </Text>
        </View>
        <Pressable
          style={[styles.saveTopBtn, (saving || !hallId) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving || !hallId}
        >
          <Ionicons name="checkmark-done" size={16} color={c.background} />
          <Text style={styles.saveTopBtnText}>Сохранить</Text>
        </Pressable>
      </View>

      {loaded && halls.length === 0 ? (
        <View style={styles.noHalls}>
          <Ionicons name="layers-outline" size={44} color={c.border} />
          <Text style={styles.noHallsTitle}>Сначала добавьте зал</Text>
          <Text style={styles.noHallsSub}>
            График настраивается для каждого зала отдельно — добавьте первый зал во вкладке «Залы».
          </Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hall picker */}
        <Text style={styles.sectionHeader}>Зал</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hallChips}>
          {halls.map((h) => {
            const active = h.id === hallId;
            return (
              <Pressable
                key={h.id}
                style={[styles.hallChip, active && styles.hallChipActive]}
                onPress={() => {
                  hapticSelection();
                  setActiveDayIdx(null);
                  setHallId(h.id);
                }}
              >
                <Text style={[styles.hallChipText, active && styles.hallChipTextActive]} numberOfLines={1}>
                  {h.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {halls.length > 1 ? (
          <Pressable style={styles.copyAllBtn} onPress={copyToAllHalls} disabled={saving}>
            <Ionicons name="git-network-outline" size={15} color={c.primary} />
            <Text style={styles.copyAllText}>Скопировать этот график на все залы</Text>
          </Pressable>
        ) : null}

        {/* Banner with sync button */}
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <Ionicons name="time" size={24} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Быстрая настройка</Text>
              <Text style={styles.bannerSub}>
                Сгенерируйте слоты 60/90 мин по шаблону
              </Text>
            </View>
          </View>
          <Pressable style={styles.syncBtn} onPress={applyMondayToAll}>
            <Ionicons name="copy-outline" size={14} color={c.primary} />
            <Text style={styles.syncBtnText}>Ко всем дням</Text>
          </Pressable>
        </View>

        {/* Days List */}
        <Text style={styles.sectionHeader}>Дни недели</Text>

        {schedule.map((day, idx) => (
          <View key={`${day.dayOfWeek ?? idx}-${idx}`} style={styles.dayCard}>
            <View style={styles.dayTopRow}>
              <View style={styles.dayTitleWrap}>
                <Text style={styles.dayName}>{day.dayName}</Text>
                <Text
                  style={[
                    styles.dayStatusText,
                    day.isClosed ? styles.statusClosed : styles.statusOpen,
                  ]}
                >
                  {day.isClosed ? "Выходной" : `${day.startTime} — ${day.endTime}`}
                </Text>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  {day.isClosed ? "Закрыто" : "Открыто"}
                </Text>
                <Switch
                  value={!day.isClosed}
                  onValueChange={() => toggleDayClosed(idx)}
                  trackColor={{ false: c.border, true: c.primary }}
                  thumbColor={c.textPrimary}
                />
              </View>
            </View>

            {!day.isClosed && (
              <View style={styles.daySettings}>
                {/* Presets Chips */}
                <Text style={styles.subLabel}>Шаблоны часов:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.presetsRow}
                >
                  {TIME_PRESETS.map((p) => {
                    const active =
                      day.startTime === p.start && day.endTime === p.end;
                    return (
                      <Pressable
                        key={p.label}
                        style={[
                          styles.presetChip,
                          active && styles.presetChipActive,
                        ]}
                        onPress={() => setDayTimes(idx, p.start, p.end)}
                      >
                        <Text
                          style={[
                            styles.presetText,
                            active && styles.presetTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Custom Time Range Inputs */}
                <View style={styles.timeInputsRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.timeLabel}>Открытие</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={day.startTime}
                      placeholder="08:00"
                      placeholderTextColor={c.textMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      returnKeyType="done"
                      onChangeText={(val) => {
                        const copy = [...schedule];
                        copy[idx].startTime = formatTime(val);
                        setSchedule(copy);
                      }}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.timeLabel}>Закрытие</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={day.endTime}
                      placeholder="23:00"
                      placeholderTextColor={c.textMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      returnKeyType="done"
                      onChangeText={(val) => {
                        const copy = [...schedule];
                        copy[idx].endTime = formatTime(val);
                        setSchedule(copy);
                      }}
                    />
                  </View>
                </View>

                {/* Slot durations selector (Vison feature) */}
                <Text style={styles.subLabel}>
                  Доступная длительность слотов брони:
                </Text>
                <View style={styles.durationsRow}>
                  {DURATION_OPTIONS.map((dur) => {
                    const active = day.slotDurations?.includes(dur);
                    return (
                      <Pressable
                        key={dur}
                        style={[
                          styles.durationChip,
                          active && styles.durationChipActive,
                        ]}
                        onPress={() => toggleSlotDuration(idx, dur)}
                      >
                        <Ionicons
                          name={active ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={active ? c.primary : c.textMuted}
                        />
                        <Text
                          style={[
                            styles.durationText,
                            active && styles.durationTextActive,
                          ]}
                        >
                          {dur} мин
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Cascade Booking Settings (Vison Cascade Pattern) */}
                <View style={styles.cascadeCard}>
                  <View style={styles.cascadeHeader}>
                    <View style={styles.cascadeHeaderLeft}>
                      <Ionicons name="git-merge-outline" size={18} color={c.primary} />
                      <Text style={styles.cascadeTitle}>Каскадный график</Text>
                    </View>
                    <Switch
                      value={!!day.cascadeEnabled}
                      onValueChange={() => toggleCascade(idx)}
                      trackColor={{ false: c.border, true: c.primary }}
                      thumbColor={c.textPrimary}
                    />
                  </View>
                  <Text style={styles.cascadeHelp}>
                    Слоты открываются последовательно: новые часы становятся доступны только после заполнения предыдущих окон. Исключает простои и «дыры» в расписании.
                  </Text>

                  {day.cascadeEnabled && (
                    <View style={styles.cascadeBody}>
                      {/* Шаг каскада */}
                      <Text style={styles.cascadeLabel}>Шаг раскрытия слотов:</Text>
                      <View style={styles.cascadeStepsRow}>
                        {[1, 2, 3, 4].map((step) => {
                          const active = (day.cascadeStepHours || 2) === step;
                          return (
                            <Pressable
                              key={step}
                              style={[styles.stepChip, active && styles.stepChipActive]}
                              onPress={() => setCascadeStep(idx, step)}
                            >
                              <Text style={[styles.stepChipText, active && styles.stepChipTextActive]}>
                                +{step} {step === 1 ? "час" : step < 5 ? "часа" : "часов"}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Границы каскада */}
                      <View style={styles.cascadeBoundariesRow}>
                        <View style={{ flex: 1, marginRight: 5 }}>
                          <Text style={styles.cascadeFieldLabel}>Верхняя граница</Text>
                          <TextInput
                            style={styles.cascadeInput}
                            value={day.cascadeInitialEndTime || "14:00"}
                            placeholder="14:00"
                            placeholderTextColor={c.textMuted}
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                            returnKeyType="done"
                            onChangeText={(val) => {
                              const copy = [...schedule];
                              copy[idx].cascadeInitialEndTime = formatTime(val);
                              setSchedule(copy);
                            }}
                          />
                        </View>

                        <View style={{ flex: 1, marginHorizontal: 5 }}>
                          <Text style={styles.cascadeFieldLabel}>Нижняя граница</Text>
                          <TextInput
                            style={styles.cascadeInput}
                            value={day.cascadeSecondBoundaryTime || "18:00"}
                            placeholder="18:00"
                            placeholderTextColor={c.textMuted}
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                            returnKeyType="done"
                            onChangeText={(val) => {
                              const copy = [...schedule];
                              copy[idx].cascadeSecondBoundaryTime = formatTime(val);
                              setSchedule(copy);
                            }}
                          />
                        </View>

                        <View style={{ flex: 1, marginLeft: 5 }}>
                          <Text style={styles.cascadeFieldLabel}>Потолок приёма</Text>
                          <TextInput
                            style={styles.cascadeInput}
                            value={day.cascadeCutoffTime || "22:00"}
                            placeholder="22:00"
                            placeholderTextColor={c.textMuted}
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                            returnKeyType="done"
                            onChangeText={(val) => {
                              const copy = [...schedule];
                              copy[idx].cascadeCutoffTime = formatTime(val);
                              setSchedule(copy);
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        ))}

        <Pressable
          style={[styles.bigSaveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.bigSaveBtnText}>
            {saving ? "Сохранение..." : "Сохранить график работы"}
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  noHalls: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  noHallsTitle: {
    ...typography.cardTitle,
    color: c.textPrimary,
    marginTop: spacing.sm,
  },
  noHallsSub: {
    ...typography.body,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  hallChips: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  hallChip: {
    maxWidth: 200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  hallChipActive: {
    borderColor: c.primary,
    backgroundColor: c.surfaceElevated,
  },
  hallChipText: {
    ...typography.body,
    color: c.textSecondary,
    fontWeight: "600",
  },
  hallChipTextActive: {
    color: c.primary,
  },
  copyAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    marginBottom: spacing.lg,
  },
  copyAllText: {
    ...typography.caption,
    fontWeight: "600",
    color: c.primary,
  },
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  saveTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  saveTopBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 110,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    marginBottom: 20,
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  bannerSub: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 2,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: c.primary,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 12,
  },
  dayCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  dayTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayTitleWrap: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
  },
  dayStatusText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  statusOpen: {
    color: c.primary,
  },
  statusClosed: {
    color: c.error,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: {
    fontSize: 11,
    color: c.textMuted,
  },
  daySettings: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: c.textSecondary,
    marginBottom: 6,
  },
  presetsRow: {
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  presetChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: c.primary,
  },
  presetText: {
    fontSize: 11,
    color: c.textSecondary,
  },
  presetTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  timeInputsRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  timeLabel: {
    fontSize: 10,
    color: c.textMuted,
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: c.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: c.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: c.subtle,
  },
  durationsRow: {
    flexDirection: "row",
    gap: 8,
  },
  durationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  durationChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: c.primary,
  },
  durationText: {
    fontSize: 12,
    color: c.textSecondary,
  },
  durationTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  // Cascade Card Styles
  cascadeCard: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.subtle,
  },
  cascadeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cascadeHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cascadeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  cascadeHelp: {
    fontSize: 11,
    color: c.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },
  cascadeBody: {
    marginTop: 10,
    gap: 10,
  },
  cascadeLabel: {
    fontSize: 12,
    color: c.textSecondary,
    fontWeight: "600",
  },
  cascadeFieldLabel: {
    fontSize: 11,
    color: c.textSecondary,
    marginBottom: 4,
  },
  cascadeStepsRow: {
    flexDirection: "row",
    gap: 8,
  },
  stepChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  stepChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: c.primary,
  },
  stepChipText: {
    fontSize: 12,
    color: c.textSecondary,
    fontWeight: "500",
  },
  stepChipTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  cascadeBoundariesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cascadeInput: {
    backgroundColor: c.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    color: c.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: c.subtle,
    textAlign: "center",
  },
  bigSaveBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  bigSaveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: c.background,
  },
});

