import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  Linking,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser, loginAsStaff } from "@/lib/auth";
import {
  StaffMember,
  getStoredStaff,
  addStaffMember,
  removeStaffMember,
} from "@/lib/businessCrmData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

const ROLES: { key: StaffMember["role"]; label: string; color: string }[] = [
  { key: "admin_senior", label: "Старший админ 🔑", color: "#22C55E" },
  { key: "manager_shift", label: "Менеджер смены 📋", color: "#3B82F6" },
  { key: "duty_coach", label: "Дежурный тренер ⚽️", color: "#A855F7" },
  { key: "maintenance", label: "Техник / Инвентарь 🔧", color: "#EAB308" },
];

export default function BusinessStaffScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(getSessionUser());
  const arenaId = currentUser?.arenaId || 1;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add staff modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<StaffMember["role"]>("manager_shift");
  const [newShifts, setNewShifts] = useState("Пн - Пт (09:00 - 18:00)");

  const loadData = useCallback(async () => {
    const list = await getStoredStaff(arenaId);
    setStaff(list);
    setCurrentUser(getSessionUser());
    setLoading(false);
    setRefreshing(false);
  }, [arenaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSwitchToStaff = async (member: StaffMember) => {
    hapticSuccess();
    const updated = await loginAsStaff(member);
    setCurrentUser(updated);
    Alert.alert(
      "Сессия переключена 👤",
      `Вы успешно вошли под сотрудником:\n${member.name} (${
        member.role === "admin_senior"
          ? "Старший админ"
          : member.role === "manager_shift"
          ? "Менеджер смены"
          : "Дежурный тренер"
      }).\n\nТеперь действия и смены фиксируются от его имени.`
    );
  };

  const handleCall = (phone: string) => {
    hapticImpact();
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert("Звонок", `Номер сотрудника: ${phone}`);
    });
  };

  const handleRemove = (id: string, name: string) => {
    hapticImpact();
    Alert.alert(
      "Удаление сотрудника",
      `Вы действительно хотите отозвать доступ у сотрудника ${name}?`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            await removeStaffMember(id);
            await loadData();
          },
        },
      ]
    );
  };

  const handleAddStaff = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert("Ошибка", "Пожалуйста, введите имя и номер телефона сотрудника.");
      return;
    }

    hapticSuccess();
    await addStaffMember(arenaId, {
      arenaId,
      name: newName.trim(),
      phone: newPhone.trim(),
      role: newRole,
      shiftDays: newShifts.trim() || "По графику",
      isActive: true,
    });

    setModalOpen(false);
    setNewName("");
    setNewPhone("");
    await loadData();
    Alert.alert("Успешно", "Сотрудник добавлен в команду комплекса.");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle}>Персонал и смены</Text>
          <Text style={styles.headerSub}>
            {staff.length} сотрудников спорткомплекса
          </Text>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setModalOpen(true);
          }}
        >
          <Ionicons name="add" size={18} color="#0B0F0D" />
          <Text style={styles.addBtnText}>Добавить</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#22C55E" size="small" />
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor="#22C55E"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="person-add-outline" size={48} color="#2A352E" />
              <Text style={styles.emptyTitle}>Нет сотрудников</Text>
              <Text style={styles.emptySub}>
                Нажмите «Добавить», чтобы назначить дежурных менеджеров арены.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const roleMeta =
              ROLES.find((r) => r.key === item.role) || ROLES[1];
            const isCurrent =
              currentUser?.staffMemberId === item.id ||
              currentUser?.name === item.name ||
              (item.phone && currentUser?.phone === item.phone);

            return (
              <View style={styles.staffCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatarBox}>
                      <Ionicons name="person" size={20} color="#22C55E" />
                    </View>
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.staffName}>{item.name}</Text>
                    <Text style={styles.staffPhone}>{item.phone}</Text>
                  </View>

                  <View
                    style={[
                      styles.roleBadge,
                      { borderColor: roleMeta.color },
                    ]}
                  >
                    <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>
                      {roleMeta.label}
                    </Text>
                  </View>
                </View>

                {/* Shift Info */}
                <View style={styles.shiftBox}>
                  <Ionicons name="calendar-outline" size={14} color="#8E9B94" />
                  <Text style={styles.shiftText}>Смены: {item.shiftDays}</Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {isCurrent ? (
                    <View style={styles.activeSessionBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.activeSessionText}>Вы вошли</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.switchBtn}
                      onPress={() => handleSwitchToStaff(item)}
                    >
                      <Ionicons name="log-in-outline" size={14} color="#10B981" />
                      <Text style={styles.switchBtnText}>Войти</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.callBtn}
                    onPress={() => handleCall(item.phone)}
                  >
                    <Ionicons name="call" size={14} color="#FFFFFF" />
                    <Text style={styles.callBtnText}>Позвонить</Text>
                  </Pressable>

                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => handleRemove(item.id, item.name)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    <Text style={styles.removeBtnText}>Отозвать</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Staff Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новый сотрудник арены</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>ФИО сотрудника *</Text>
              <TextInput
                style={styles.input}
                placeholder="Например: Арман Сериков"
                placeholderTextColor="#6B7C72"
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.inputLabel}>Номер телефона *</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="+7 (701) 000-00-00"
                placeholderTextColor="#6B7C72"
                value={newPhone}
                onChangeText={setNewPhone}
              />

              <Text style={styles.inputLabel}>Роль в комплексе</Text>
              <View style={styles.rolesGrid}>
                {ROLES.map((r) => {
                  const sel = newRole === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      style={[styles.roleChip, sel && styles.roleChipActive]}
                      onPress={() => {
                        hapticSelection();
                        setNewRole(r.key);
                      }}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          sel && styles.roleChipTextActive,
                        ]}
                      >
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>График смен</Text>
              <TextInput
                style={styles.input}
                placeholder="Например: Пн, Ср, Пт (08:00 - 16:00)"
                placeholderTextColor="#6B7C72"
                value={newShifts}
                onChangeText={setNewShifts}
              />

              <Pressable style={styles.submitBtn} onPress={handleAddStaff}>
                <Text style={styles.submitBtnText}>Сохранить сотрудника</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  backBtn: {
    paddingRight: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  staffCard: {
    backgroundColor: "#131916",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {},
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  staffName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  staffPhone: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  shiftBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0B0F0D",
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  shiftText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  switchBtn: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981",
  },
  activeSessionBadge: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  activeSessionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#10B981",
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  removeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#131916",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalScroll: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E9B94",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0B0F0D",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 14,
  },
  rolesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#0B0F0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  roleChipActive: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  roleChipText: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "600",
  },
  roleChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B0F0D",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: "#6B7C72",
    marginTop: 4,
    textAlign: "center",
  },
});

