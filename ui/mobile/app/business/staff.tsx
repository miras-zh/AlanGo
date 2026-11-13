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
import { useMyArenaId } from "@/lib/business";
import { getSessionUser, loginAsStaff } from "@/lib/auth";
import {
  StaffMember,
  getStoredStaff,
  addStaffMember,
  removeStaffMember,
} from "@/lib/businessCrmData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { tr, useT, type MessageKey } from "@/lib/i18n";

const ROLES: { key: StaffMember["role"]; label: MessageKey; color: string }[] = [
  { key: "admin_senior", label: "staff.adminSenior", color: "#00C968" },
  { key: "manager_shift", label: "staff.managerShift", color: "#3B82F6" },
  { key: "duty_coach", label: "staff.dutyCoach", color: "#A855F7" },
  { key: "maintenance", label: "staff.maintenance", color: "#EAB308" },
];

export default function BusinessStaffScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(getSessionUser());
  const { arenaId, loading: arenaLoading } = useMyArenaId();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add staff modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<StaffMember["role"]>("manager_shift");
  const [newShifts, setNewShifts] = useState(() => tr("staff.defaultShifts"));

  const loadData = useCallback(async () => {
    if (arenaLoading) return;
    const list = arenaId ? await getStoredStaff(arenaId) : [];
    setStaff(list);
    setCurrentUser(getSessionUser());
    setLoading(false);
    setRefreshing(false);
  }, [arenaId, arenaLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSwitchToStaff = async (member: StaffMember) => {
    hapticSuccess();
    const updated = await loginAsStaff(member);
    setCurrentUser(updated);
    Alert.alert(
      t("staff.switchedTitle"),
      t("staff.switchedText", {
        name: member.name,
        role:
          member.role === "admin_senior"
            ? t("staff.roleAdmin")
            : member.role === "manager_shift"
            ? t("staff.roleManager")
            : t("staff.roleCoach"),
      })
    );
  };

  const handleCall = (phone: string) => {
    hapticImpact();
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert(t("chat.call"), t("staff.phone", { phone }));
    });
  };

  const handleRemove = (id: string, name: string) => {
    hapticImpact();
    Alert.alert(
      t("staff.deleteTitle"),
      t("staff.deleteText", { name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
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
      Alert.alert(t("common.error"), t("staff.required"));
      return;
    }

    if (!arenaId) return;
    hapticSuccess();
    await addStaffMember(arenaId, {
      arenaId,
      name: newName.trim(),
      phone: newPhone.trim(),
      role: newRole,
      shiftDays: newShifts.trim() || t("staff.bySchedule"),
      isActive: true,
    });

    setModalOpen(false);
    setNewName("");
    setNewPhone("");
    await loadData();
    Alert.alert(t("common.success"), t("staff.added"));
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
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle}>{t("staff.title")}</Text>
          <Text style={styles.headerSub}>
            {t("staff.count", { count: staff.length })}
          </Text>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setModalOpen(true);
          }}
        >
          <Ionicons name="add" size={18} color={c.background} />
          <Text style={styles.addBtnText}>{t("common.add")}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={c.primary} size="small" />
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
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="person-add-outline" size={48} color={c.border} />
              <Text style={styles.emptyTitle}>{t("staff.empty")}</Text>
              <Text style={styles.emptySub}>
                {t("staff.emptyText")}
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
                      <Ionicons name="person" size={20} color={c.primary} />
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
                  <Ionicons name="calendar-outline" size={14} color={c.textSecondary} />
                  <Text style={styles.shiftText}>{t("staff.shifts", { shifts: item.shiftDays })}</Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {isCurrent ? (
                    <View style={styles.activeSessionBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={c.primary} />
                      <Text style={styles.activeSessionText}>{t("staff.signedIn")}</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.switchBtn}
                      onPress={() => handleSwitchToStaff(item)}
                    >
                      <Ionicons name="log-in-outline" size={14} color={c.primary} />
                      <Text style={styles.switchBtnText}>{t("staff.signIn")}</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.callBtn}
                    onPress={() => handleCall(item.phone)}
                  >
                    <Ionicons name="call" size={14} color={c.textPrimary} />
                    <Text style={styles.callBtnText}>{t("staff.call")}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => handleRemove(item.id, item.name)}
                  >
                    <Ionicons name="trash-outline" size={14} color={c.error} />
                    <Text style={styles.removeBtnText}>{t("staff.revoke")}</Text>
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
              <Text style={styles.modalTitle}>{t("staff.newTitle")}</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>{t("staff.name")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("staff.namePlaceholder")}
                placeholderTextColor={c.textMuted}
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.inputLabel}>{t("staff.phoneLabel")}</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="+7 (701) 000-00-00"
                placeholderTextColor={c.textMuted}
                value={newPhone}
                onChangeText={setNewPhone}
              />

              <Text style={styles.inputLabel}>{t("staff.role")}</Text>
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
                        {t(r.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>{t("staff.schedule")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("staff.schedulePlaceholder")}
                placeholderTextColor={c.textMuted}
                value={newShifts}
                onChangeText={setNewShifts}
              />

              <Pressable style={styles.submitBtn} onPress={handleAddStaff}>
                <Text style={styles.submitBtnText}>{t("staff.save")}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.background,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 16,
    paddingBottom: 110,
    gap: 12,
  },
  staffCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: c.hairline,
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
    color: c.textPrimary,
  },
  staffPhone: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: c.hairline,
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
    backgroundColor: c.background,
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  shiftText: {
    fontSize: 12,
    color: c.textSecondary,
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
    color: c.primary,
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
    borderColor: c.primary,
  },
  activeSessionText: {
    fontSize: 12,
    fontWeight: "800",
    color: c.primary,
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: c.subtle,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textPrimary,
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
    color: c.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: c.subtle,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.subtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
  },
  modalScroll: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: c.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: c.subtle,
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
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  roleChipActive: {
    borderColor: c.primary,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  roleChipText: {
    fontSize: 12,
    color: c.textSecondary,
    fontWeight: "600",
  },
  roleChipTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: c.background,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});

