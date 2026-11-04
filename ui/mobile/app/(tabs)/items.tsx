import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { getSessionUser, subscribeAuth } from "@/lib/auth";
import {
  createItem,
  deleteItem,
  ItemEntity,
  ItemStatus,
  listMyItems,
  updateItem,
} from "@/lib/items";
import { confirmDestructive } from "@/lib/confirm";
import { hapticSuccess } from "@/lib/haptics";
import { trackCoreAction, trackFirstValueOnce } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/errorMessage";

export default function ItemsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser());
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEntity | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState<ItemStatus>("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeAuth(() => setUser(getSessionUser()));
  }, []);

  const loadItems = useCallback(async () => {
    if (!getSessionUser()) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await listMyItems({ limit: 50 });
      setItems(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems, user]);

  const openCreateModal = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setEditingItem(null);
    setTitle("");
    setDescription("");
    setCategory("general");
    setStatus("active");
    setModalOpen(true);
  };

  const openEditModal = (item: ItemEntity) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description);
    setCategory(item.category);
    setStatus(item.status);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Ошибка", "Введите название записи");
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          title: title.trim(),
          description: description.trim(),
          category: category.trim() || "general",
          status,
        });
      } else {
        await createItem({
          title: title.trim(),
          description: description.trim(),
          category: category.trim() || "general",
          status,
        });
        await trackFirstValueOnce({ entity: "item" });
      }
      await trackCoreAction({ action: editingItem ? "item_updated" : "item_created" });
      hapticSuccess();
      setModalOpen(false);
      await loadItems();
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ItemEntity) => {
    const ok = await confirmDestructive({
      title: "Удалить запись?",
      message: `«${item.title}» будет удалена безвозвратно.`,
      confirmText: "Удалить",
    });
    if (!ok) return;
    try {
      await deleteItem(item.id);
      hapticSuccess();
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <Text style={[styles.unauthTitle, { color: colors.text }]}>Войдите в аккаунт</Text>
          <Text style={[styles.unauthSub, { color: colors.textSecondary }]}>
            Чтобы создавать и управлять своими записями, войдите или зарегистрируйтесь.
          </Text>
          <Pressable
            onPress={() => router.push("/login")}
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryBtnText}>Войти</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Мои записи</Text>
        <Pressable
          onPress={openCreateModal}
          style={[styles.addBtn, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Создать</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadItems();
              }}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                У вас пока нет записей. Нажмите «Создать», чтобы добавить первую.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.badgeText, { color: colors.accent }]}>{item.status}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => openEditModal(item)} style={styles.actionIcon}>
                    <Ionicons name="create-outline" size={19} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} style={styles.actionIcon}>
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              {!!item.description && (
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.description}</Text>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem ? "Редактировать запись" : "Новая запись"}
            </Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Название"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
            />

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Описание"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                styles.input,
                styles.textarea,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg },
              ]}
            />

            <View style={styles.statusRow}>
              {(["draft", "active", "archived"] as ItemStatus[]).map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setStatus(st)}
                  style={[
                    styles.statusChip,
                    {
                      borderColor: status === st ? colors.accent : colors.border,
                      backgroundColor: status === st ? colors.accentSoft : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: status === st ? colors.accent : colors.textSecondary,
                      fontWeight: "600",
                      fontSize: 12,
                    }}
                  >
                    {st}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setModalOpen(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 24, fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10 },
  actionIcon: { padding: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  emptyBox: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  unauthTitle: { fontSize: 20, fontWeight: "700", marginTop: 12 },
  unauthSub: { fontSize: 14, textAlign: "center", marginTop: 6, marginBottom: 18, lineHeight: 20 },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    padding: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  statusRow: { flexDirection: "row", gap: 8, marginVertical: 4 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
});
