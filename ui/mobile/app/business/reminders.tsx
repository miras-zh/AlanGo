import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { appAlert } from "@/lib/alert";
import {
  createArenaReminder,
  deleteArenaReminder,
  getRemindersDashboard,
  updateArenaReminder,
  type RemindersDashboard,
} from "@/lib/businessCrmData";
import { KeyboardSheetView } from "@/components/KeyboardSheetView";
import {
  NativeTimePickerPanel,
  formatHHMM,
  parseHHMM,
} from "@/components/TimePickerField";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing } from "@/constants/theme";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";
import { displayDate } from "@/lib/dataLabels";
import { getErrorMessage } from "@/lib/errorMessage";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BusinessRemindersScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const [data, setData] = useState<RemindersDashboard>({ smart: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayISO);
  const [dueTime, setDueTime] = useState("10:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [remindPush, setRemindPush] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getRemindersDashboard();
      setData(res);
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createArenaReminder({
        title: title.trim(),
        due_date: dueDate.trim() || todayISO(),
        due_time: dueTime,
        notes: notes.trim(),
        remind_push: remindPush,
      });
      setModalVisible(false);
      setTitle("");
      setNotes("");
      hapticSuccess();
      await load();
    } catch (err) {
      appAlert(t("common.error"), getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (id: number, currentStatus: "pending" | "done") => {
    hapticSelection();
    const next = currentStatus === "done" ? "pending" : "done";
    try {
      const updated = await updateArenaReminder(id, { status: next });
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => (task.id === id ? updated : task)),
      }));
    } catch (err) {
      appAlert(t("common.error"), getErrorMessage(err));
    }
  };

  const handleDelete = (id: number) => {
    hapticImpact();
    appAlert(t("reminders.deleteTitle"), t("reminders.deleteText"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteArenaReminder(id);
            setData((prev) => ({
              ...prev,
              tasks: prev.tasks.filter((task) => task.id !== id),
            }));
          } catch (err) {
            appAlert(t("common.error"), getErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle}>{t("reminders.title")}</Text>
          <Text style={styles.headerSub}>{t("reminders.subtitle")}</Text>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addBtnText}>{t("reminders.addBtn")}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="small" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={c.primary}
            />
          }
        >
          {/* Smart Alerts */}
          <Text style={styles.sectionTitle}>{t("reminders.smartSection")}</Text>
          {data.smart.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color={c.primary} />
              <Text style={styles.emptyText}>{t("reminders.emptySmart")}</Text>
            </View>
          ) : (
            <View style={styles.listGap}>
              {data.smart.map((item, idx) => {
                const isPending = item.kind === "pending_request";
                const isUnpaid = item.kind === "unpaid_booking";
                const icon = isPending
                  ? "mail-unread-outline"
                  : isUnpaid
                  ? "wallet-outline"
                  : "refresh-outline";
                const tint = isPending ? c.warning : isUnpaid ? c.error : "#3B82F6";

                return (
                  <View key={`${item.kind}-${idx}`} style={styles.smartCard}>
                    <View style={styles.smartTop}>
                      <View style={[styles.iconBox, { backgroundColor: `${tint}22` }]}>
                        <Ionicons name={icon} size={18} color={tint} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.smartTitle}>{item.title}</Text>
                        <Text style={styles.smartSub}>{item.subtitle}</Text>
                      </View>
                    </View>
                    <View style={styles.smartActions}>
                      {isPending || isUnpaid ? (
                        <Pressable
                          style={styles.smallBtn}
                          onPress={() =>
                            router.push(
                              isPending
                                ? "/business/bookings?mode=requests"
                                : "/business/bookings"
                            )
                          }
                        >
                          <Ionicons name="calendar-outline" size={14} color={c.primary} />
                          <Text style={[styles.smallBtnText, { color: c.primary }]}>
                            {t("reminders.openBookings")}
                          </Text>
                        </Pressable>
                      ) : null}
                      {item.phone ? (
                        <Pressable
                          style={styles.smallBtn}
                          onPress={() =>
                            Linking.openURL(
                              `tel:${item.phone!.replace(/[^\d+]/g, "")}`
                            ).catch(() => {})
                          }
                        >
                          <Ionicons name="call-outline" size={14} color={c.textPrimary} />
                          <Text style={styles.smallBtnText}>{t("reminders.call")}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Custom Tasks */}
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
            {t("reminders.tasksSection")}
          </Text>
          {data.tasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-outline" size={22} color={c.textSecondary} />
              <Text style={styles.emptyText}>{t("reminders.emptyTasks")}</Text>
            </View>
          ) : (
            <View style={styles.listGap}>
              {data.tasks.map((task) => {
                const done = task.status === "done";
                return (
                  <View key={task.id} style={[styles.taskCard, done && { opacity: 0.6 }]}>
                    <Pressable
                      style={[styles.checkbox, done && styles.checkboxDone]}
                      onPress={() => handleToggleDone(task.id, task.status)}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={14} color={c.onPrimary} />
                      ) : null}
                    </Pressable>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>
                        {task.title}
                      </Text>
                      <Text style={styles.taskMeta}>
                        {displayDate(task.due_date, t)} · {task.due_time}
                        {task.remind_push ? " · Push" : ""}
                      </Text>
                      {task.notes ? (
                        <Text style={styles.taskNotes}>{task.notes}</Text>
                      ) : null}
                    </View>

                    <Pressable onPress={() => handleDelete(task.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={17} color={c.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Create Reminder Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowTimePicker(false);
          setModalVisible(false);
        }}
      >
        <KeyboardSheetView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("reminders.modalTitle")}</Text>
              <Pressable
                onPress={() => {
                  setShowTimePicker(false);
                  setModalVisible(false);
                }}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <Text style={styles.inputLabel}>{t("reminders.taskTitle")}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t("reminders.taskPlaceholder")}
                placeholderTextColor={c.textMuted}
                maxLength={200}
              />

              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t("reminders.date")}</Text>
                  <TextInput
                    style={styles.input}
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder={todayISO()}
                    placeholderTextColor={c.textMuted}
                  />
                </View>

                <View style={{ width: 120 }}>
                  <Text style={styles.inputLabel}>{t("reminders.time")}</Text>
                  <Pressable
                    style={[
                      styles.timeBtn,
                      showTimePicker && { borderColor: c.primary, backgroundColor: c.primarySoft },
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      hapticSelection();
                      setShowTimePicker((prev) => !prev);
                    }}
                  >
                    <Text style={styles.timeBtnText}>{dueTime}</Text>
                    <Ionicons name="time-outline" size={15} color={c.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {showTimePicker && Platform.OS !== "android" ? (
                <NativeTimePickerPanel
                  inline
                  value={dueTime}
                  title={t("reminders.time")}
                  minuteInterval={5}
                  onCancel={() => setShowTimePicker(false)}
                  onConfirm={(next) => {
                    setDueTime(next);
                    setShowTimePicker(false);
                  }}
                />
              ) : null}

              {showTimePicker && Platform.OS === "android" ? (
                <DateTimePicker
                  value={parseHHMM(dueTime, "10:00")}
                  mode="time"
                  display="default"
                  is24Hour
                  minuteInterval={5}
                  onChange={(event: DateTimePickerEvent, selected?: Date) => {
                    setShowTimePicker(false);
                    if (event.type === "set" && selected) {
                      setDueTime(formatHHMM(selected));
                    }
                  }}
                />
              ) : null}

              <Text style={styles.inputLabel}>{t("reminders.notes")}</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t("reminders.notes")}
                placeholderTextColor={c.textMuted}
                multiline
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("reminders.pushSwitch")}</Text>
                <Switch
                  value={remindPush}
                  onValueChange={setRemindPush}
                  trackColor={{ false: c.border, true: c.primary }}
                  thumbColor={c.textPrimary}
                />
              </View>

              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={handleCreate}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? t("common.saving") : t("reminders.save")}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardSheetView>
      </Modal>
    </SafeAreaView>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    backBtn: {
      paddingRight: 6,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    headerSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    addBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.primary,
    },
    addBtnText: {
      fontSize: 13,
      fontWeight: "800",
      color: c.onPrimary,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      padding: 16,
      paddingBottom: 40,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 10,
    },
    listGap: {
      gap: 10,
    },
    emptyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      padding: 14,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    emptyText: {
      flex: 1,
      fontSize: 13,
      color: c.textSecondary,
    },
    smartCard: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      padding: 14,
      borderWidth: 1,
      borderColor: c.subtle,
      gap: 10,
    },
    smartTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    smartTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textPrimary,
    },
    smartSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    smartActions: {
      flexDirection: "row",
      gap: 8,
    },
    smallBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    smallBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textPrimary,
    },
    taskCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      padding: 14,
      borderWidth: 1,
      borderColor: c.subtle,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxDone: {
      backgroundColor: c.primary,
    },
    taskTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textPrimary,
    },
    taskTitleDone: {
      textDecorationLine: "line-through",
      color: c.textSecondary,
    },
    taskMeta: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    taskNotes: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 4,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: c.overlay,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.modal,
      borderTopRightRadius: radii.modal,
      padding: spacing.xl,
      maxHeight: "90%",
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
      marginBottom: 4,
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
    dateRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-end",
    },
    timeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.background,
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    timeBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: c.textPrimary,
      fontVariant: ["tabular-nums"],
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 4,
    },
    switchLabel: {
      flex: 1,
      fontSize: 13,
      color: c.textSecondary,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.button,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 4,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.onPrimary,
    },
  });
