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
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser } from "@/lib/auth";
import {
  DEFAULT_WEEK_SCHEDULE,
  getStoredSchedule,
  saveStoredSchedule,
  ScheduleDay,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

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
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_WEEK_SCHEDULE);
  const [arenaId, setArenaId] = useState(1);
  const [saving, setSaving] = useState(false);
  const [activeDayIdx, setActiveDayIdx] = useState<number | null>(null);

  const loadSchedule = useCallback(async () => {
    const user = getSessionUser();
    const id = user?.arenaId || 1;
    setArenaId(id);
    const data = await getStoredSchedule(id);
    setSchedule(data);
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

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

  const applyMondayToAll = () => {
    hapticImpact();
    const monday = schedule[0];
    Alert.alert(
      "Синхронизация графика",
      `Применить настройки понедельника (${monday.startTime} - ${monday.endTime}, слоты ${monday.slotDurations.join(", ")} мин) ко всем дням недели?`,
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
              }))
            );
            hapticSuccess();
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStoredSchedule(arenaId, schedule);
      hapticSuccess();
      Alert.alert("Сохранено", "График работы спорткомплекса успешно обновлен!");
    } catch {
      Alert.alert("Ошибка", "Не удалось сохранить график");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>График работы</Text>
          <Text style={styles.headerSubtitle}>
            Настройка доступных слотов и рабочих часов арены
          </Text>
        </View>
        <Pressable
          style={[styles.saveTopBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-done" size={18} color="#0B0F0D" />
          <Text style={styles.saveTopBtnText}>Сохранить</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Banner with sync button */}
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <Ionicons name="time" size={24} color="#22C55E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Быстрая настройка</Text>
              <Text style={styles.bannerSub}>
                Сгенерируйте слоты 60/90 мин по шаблону
              </Text>
            </View>
          </View>
          <Pressable style={styles.syncBtn} onPress={applyMondayToAll}>
            <Ionicons name="copy-outline" size={14} color="#22C55E" />
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
                  trackColor={{ false: "#2A352E", true: "#22C55E" }}
                  thumbColor="#FFFFFF"
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
                      placeholderTextColor="#6B7C72"
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
                      placeholderTextColor="#6B7C72"
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
                          color={active ? "#22C55E" : "#6B7C72"}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
    maxWidth: "80%",
  },
  saveTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveTopBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  scroll: {
    padding: 16,
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
    color: "#FFFFFF",
  },
  bannerSub: {
    fontSize: 11,
    color: "#8E9B94",
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
    color: "#22C55E",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  dayCard: {
    backgroundColor: "#131916",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
    color: "#FFFFFF",
  },
  dayStatusText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  statusOpen: {
    color: "#22C55E",
  },
  statusClosed: {
    color: "#EF4444",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: {
    fontSize: 11,
    color: "#6B7C72",
  },
  daySettings: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  subLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E9B94",
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
    backgroundColor: "#0B0F0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  presetChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#22C55E",
  },
  presetText: {
    fontSize: 11,
    color: "#8E9B94",
  },
  presetTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  timeInputsRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  timeLabel: {
    fontSize: 10,
    color: "#6B7C72",
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: "#0B0F0D",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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
    backgroundColor: "#0B0F0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  durationChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22C55E",
  },
  durationText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  durationTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  bigSaveBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  bigSaveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B0F0D",
  },
});

