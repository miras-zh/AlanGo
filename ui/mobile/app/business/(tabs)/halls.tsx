import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser } from "@/lib/auth";
import {
  getStoredHalls,
  Hall,
  saveNewHall,
  saveUpdatedHall,
  SportType,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

const SPORT_OPTIONS: SportType[] = [
  "Футбол",
  "Баскетбол",
  "Теннис",
  "Волейбол",
  "Сквош и падл",
  "Другое",
];

const PRESET_EQUIPMENT = [
  "LED-освещение",
  "Профессиональные мячи",
  "Сетка / Ворота / Кольца",
  "Электронное табло",
  "Раздевалка с душем",
  "Манишки",
  "Акустическая система",
  "Судейская вышка",
  "Прокат ракеток",
  "Кулер с водой",
];

export default function BusinessHallsScreen() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(getSessionUser());

  // Edit / Create Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [sportType, setSportType] = useState<SportType>("Футбол");
  const [surfaceType, setSurfaceType] = useState("");
  const [pricePerHour, setPricePerHour] = useState("15000");
  const [capacity, setCapacity] = useState("5x5 (до 14 человек)");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [customEquip, setCustomEquip] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const loadHalls = useCallback(async () => {
    const user = getSessionUser();
    setCurrentUser(user);
    const arenaId = user?.arenaId || 1;
    const all = await getStoredHalls();
    const myHalls = all.filter((h) => h.arenaId === arenaId);
    setHalls(myHalls);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadHalls();
  }, [loadHalls]);

  const openCreateModal = () => {
    hapticSelection();
    setIsEditing(false);
    setEditingId(null);
    setTitle("");
    setSportType("Футбол");
    setSurfaceType("Искусственный газон 50 мм");
    setPricePerHour("15000");
    setCapacity("5x5 (до 14 человек)");
    setEquipment(["LED-освещение", "Раздевалка с душем", "Профессиональные мячи"]);
    setDescription("Современный крытый зал с профессиональным покрытием");
    setImageUrl("https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800");
    setModalVisible(true);
  };

  const openEditModal = (hall: Hall) => {
    hapticSelection();
    setIsEditing(true);
    setEditingId(hall.id);
    setTitle(hall.title);
    setSportType(hall.sportType);
    setSurfaceType(hall.surfaceType);
    setPricePerHour(String(hall.pricePerHour));
    setCapacity(hall.capacity);
    setEquipment([...hall.equipment]);
    setDescription(hall.description);
    setImageUrl(hall.imageUrl);
    setModalVisible(true);
  };

  const toggleEquipmentItem = (item: string) => {
    hapticSelection();
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const addCustomEquipment = () => {
    if (!customEquip.trim()) return;
    if (!equipment.includes(customEquip.trim())) {
      setEquipment((prev) => [...prev, customEquip.trim()]);
    }
    setCustomEquip("");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Ошибка", "Укажите название зала");
      return;
    }
    if (!surfaceType.trim()) {
      Alert.alert("Ошибка", "Укажите тип покрытия зала");
      return;
    }
    const numPrice = parseInt(pricePerHour) || 12000;
    const arenaId = currentUser?.arenaId || 1;

    try {
      if (isEditing && editingId) {
        const existing = halls.find((h) => h.id === editingId);
        if (existing) {
          const updated: Hall = {
            ...existing,
            title: title.trim(),
            sportType,
            surfaceType: surfaceType.trim(),
            pricePerHour: numPrice,
            capacity: capacity.trim() || "До 12 человек",
            equipment,
            description: description.trim() || existing.description,
            imageUrl: imageUrl.trim() || existing.imageUrl,
          };
          await saveUpdatedHall(updated);
          hapticSuccess();
          Alert.alert("Успешно", "Параметры зала обновлены!");
        }
      } else {
        await saveNewHall(arenaId, {
          title: title.trim(),
          sportType,
          surfaceType: surfaceType.trim(),
          pricePerHour: numPrice,
          capacity: capacity.trim() || "До 12 человек",
          equipment,
          description: description.trim() || "Новая спортивная площадка",
          imageUrl:
            imageUrl.trim() ||
            "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
        });
        hapticSuccess();
        Alert.alert("Успешно", "Новый зал добавлен в ваш комплекс!");
      }

      setModalVisible(false);
      loadHalls();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message || "Не удалось сохранить");
    }
  };

  const toggleHallStatus = async (hall: Hall) => {
    hapticImpact();
    const nextStatus = hall.status === "active" ? "maintenance" : "active";
    const updated: Hall = { ...hall, status: nextStatus };
    await saveUpdatedHall(updated);
    loadHalls();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Залы комплекса</Text>
          <Text style={styles.headerSubtitle}>
            Управление площадками, типами покрытий и оснащением ({halls.length})
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openCreateModal}>
          <Ionicons name="add" size={20} color="#0B0F0D" />
          <Text style={styles.addBtnText}>Добавить</Text>
        </Pressable>
      </View>

      <FlatList
        data={halls}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHalls();
            }}
            tintColor="#22C55E"
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />

            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <View style={styles.sportTag}>
                  <Text style={styles.sportTagText}>{item.sportType}</Text>
                </View>
                <Pressable
                  style={[
                    styles.statusPill,
                    item.status === "active" ? styles.statusActive : styles.statusMaint,
                  ]}
                  onPress={() => toggleHallStatus(item)}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          item.status === "active" ? "#22C55E" : "#EAB308",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color:
                          item.status === "active" ? "#22C55E" : "#EAB308",
                      },
                    ]}
                  >
                    {item.status === "active" ? "Активен" : "Техобслуживание"}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>

              {/* Surface type */}
              <View style={styles.metaRow}>
                <Ionicons name="layers-outline" size={14} color="#22C55E" />
                <Text style={styles.metaLabel}>Покрытие:</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {item.surfaceType}
                </Text>
              </View>

              {/* Capacity */}
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={14} color="#60A5FA" />
                <Text style={styles.metaLabel}>Вместимость:</Text>
                <Text style={styles.metaValue}>{item.capacity}</Text>
              </View>

              {/* Equipment Tags */}
              <View style={styles.equipWrap}>
                {item.equipment.map((eq, i) => (
                  <View key={i} style={styles.equipChip}>
                    <Text style={styles.equipText}>✓ {eq}</Text>
                  </View>
                ))}
              </View>

              {/* Card Footer: Price & Edit Button */}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.priceLabel}>Тариф аренды</Text>
                  <Text style={styles.priceValue}>
                    {item.pricePerHour.toLocaleString("ru-RU")} ₸{" "}
                    <Text style={styles.priceSub}>/ час</Text>
                  </Text>
                </View>

                <Pressable
                  style={styles.editBtn}
                  onPress={() => openEditModal(item)}
                >
                  <Ionicons name="pencil-outline" size={16} color="#22C55E" />
                  <Text style={styles.editBtnText}>Редактировать</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* Edit / Add Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? "Редактирование зала" : "Добавление зала"}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Hall Title */}
              <Text style={styles.inputLabel}>Название зала</Text>
              <TextInput
                style={styles.input}
                placeholder="Например: Футбольный зал Arena 1"
                placeholderTextColor="#6B7C72"
                value={title}
                onChangeText={setTitle}
              />

              {/* Sport Type */}
              <Text style={styles.inputLabel}>Вид спорта</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.optionsScroll}
              >
                {SPORT_OPTIONS.map((sport) => {
                  const sel = sportType === sport;
                  return (
                    <Pressable
                      key={sport}
                      style={[styles.sportOption, sel && styles.sportOptionActive]}
                      onPress={() => {
                        hapticSelection();
                        setSportType(sport);
                      }}
                    >
                      <Text
                        style={[
                          styles.sportOptionText,
                          sel && styles.sportOptionTextActive,
                        ]}
                      >
                        {sport}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Surface Type */}
              <Text style={styles.inputLabel}>Тип покрытия</Text>
              <TextInput
                style={styles.input}
                placeholder="Например: Искусственный газон 60 мм / Паркет клён"
                placeholderTextColor="#6B7C72"
                value={surfaceType}
                onChangeText={setSurfaceType}
              />

              {/* Price & Capacity in Row */}
              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Цена за 1 час (₸)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="15000"
                    placeholderTextColor="#6B7C72"
                    value={pricePerHour}
                    onChangeText={setPricePerHour}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Вместимость</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="5x5 (14 чел)"
                    placeholderTextColor="#6B7C72"
                    value={capacity}
                    onChangeText={setCapacity}
                  />
                </View>
              </View>

              {/* Equipment Selection */}
              <Text style={styles.inputLabel}>Оснащение и инвентарь</Text>
              <View style={styles.presetEquipWrap}>
                {PRESET_EQUIPMENT.map((item) => {
                  const active = equipment.includes(item);
                  return (
                    <Pressable
                      key={item}
                      style={[
                        styles.equipToggle,
                        active && styles.equipToggleActive,
                      ]}
                      onPress={() => toggleEquipmentItem(item)}
                    >
                      <Ionicons
                        name={active ? "checkmark-circle" : "add-circle-outline"}
                        size={14}
                        color={active ? "#22C55E" : "#6B7C72"}
                      />
                      <Text
                        style={[
                          styles.equipToggleText,
                          active && styles.equipToggleTextActive,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom equipment item */}
              <View style={styles.customEquipRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Добавить своё оснащение..."
                  placeholderTextColor="#6B7C72"
                  value={customEquip}
                  onChangeText={setCustomEquip}
                />
                <Pressable
                  style={styles.addEquipBtn}
                  onPress={addCustomEquipment}
                >
                  <Text style={styles.addEquipBtnText}>+ Добавить</Text>
                </Pressable>
              </View>

              {/* Description */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Описание</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                placeholder="Краткое описание преимуществ зала..."
                placeholderTextColor="#6B7C72"
                value={description}
                onChangeText={setDescription}
              />

              {/* Save Button */}
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>
                  {isEditing ? "Сохранить изменения" : "Создать зал"}
                </Text>
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
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  list: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: "#131916",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#1A221E",
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sportTag: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sportTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#22C55E",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  statusMaint: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: "#6B7C72",
  },
  metaValue: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
    flex: 1,
  },
  equipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  equipChip: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  equipText: {
    fontSize: 11,
    color: "#8E9B94",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  priceLabel: {
    fontSize: 10,
    color: "#6B7C72",
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  priceSub: {
    fontSize: 11,
    fontWeight: "400",
    color: "#6B7C72",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22C55E",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
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
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  inputRow: {
    flexDirection: "row",
  },
  optionsScroll: {
    gap: 8,
    marginBottom: 14,
  },
  sportOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#0B0F0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sportOptionActive: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderColor: "#22C55E",
  },
  sportOptionText: {
    fontSize: 13,
    color: "#8E9B94",
    fontWeight: "600",
  },
  sportOptionTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  presetEquipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  equipToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#0B0F0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  equipToggleActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.5)",
  },
  equipToggleText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  equipToggleTextActive: {
    color: "#22C55E",
    fontWeight: "600",
  },
  customEquipRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 14,
  },
  addEquipBtn: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  addEquipBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#22C55E",
  },
  saveBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B0F0D",
  },
});
