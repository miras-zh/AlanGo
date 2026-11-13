import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, typography } from "@/constants/theme";
import { resolveMyArenaId } from "@/lib/business";
import { getSessionUser } from "@/lib/auth";
import {
  deleteHallPhoto,
  getStoredHalls,
  Hall,
  saveNewHall,
  saveUpdatedHall,
  SportType,
  uploadHallPhoto,
} from "@/lib/sportRentData";
import { SelectField } from "@/components/SelectField";
import {
  CAPACITY_OPTIONS,
  MAX_HALL_PHOTOS,
  SIZE_OPTIONS,
  SURFACE_TYPES,
  capacityLabel,
  sizeLabel,
} from "@/lib/hallOptions";
import { pickErrorTitle, pickImageAsJpeg, type PickedPhoto } from "@/lib/pickImage";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

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
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [arenaId, setArenaId] = useState<number | null>(null);
  const [hallsLoaded, setHallsLoaded] = useState(false);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(getSessionUser());

  // Edit / Create Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [sportType, setSportType] = useState<SportType>("Футбол");
  const [surfaceType, setSurfaceType] = useState<string | null>(null);
  const [pricePerHour, setPricePerHour] = useState("");
  const [maxPeople, setMaxPeople] = useState<number | null>(null);
  const [lengthM, setLengthM] = useState<number | null>(null);
  const [widthM, setWidthM] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [customEquip, setCustomEquip] = useState("");
  const [description, setDescription] = useState("");
  // Gallery: uploaded photos (url) + photos picked for a hall not created yet.
  const [photos, setPhotos] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PickedPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadHalls = useCallback(async () => {
    const user = getSessionUser();
    setCurrentUser(user);
    const id = await resolveMyArenaId();
    setArenaId(id);
    const all = id ? await getStoredHalls() : [];
    setHalls(id ? all.filter((h) => h.arenaId === id) : []);
    setHallsLoaded(true);
    setRefreshing(false);
  }, []);

  // Reload on focus: returning from the schedule tab updates the badge.
  useFocusEffect(
    useCallback(() => {
      loadHalls();
    }, [loadHalls]),
  );

  const openCreateModal = () => {
    hapticSelection();
    setIsEditing(false);
    setEditingId(null);
    setTitle("");
    setSportType("Футбол");
    setSurfaceType(null);
    setPricePerHour("");
    setMaxPeople(null);
    setLengthM(null);
    setWidthM(null);
    setEquipment([]);
    setDescription("");
    setPhotos([]);
    setPendingPhotos([]);
    setModalVisible(true);
  };

  const openEditModal = (hall: Hall) => {
    hapticSelection();
    setIsEditing(true);
    setEditingId(hall.id);
    setTitle(hall.title);
    setSportType(hall.sportType);
    setSurfaceType(hall.surfaceType || null);
    setPricePerHour(hall.pricePerHour ? String(hall.pricePerHour) : "");
    setMaxPeople(hall.maxPeople || null);
    setLengthM(hall.lengthM || null);
    setWidthM(hall.widthM || null);
    setEquipment([...hall.equipment]);
    setDescription(hall.description);
    setPhotos(hall.photos ?? []);
    setPendingPhotos([]);
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

  const photoCount = photos.length + pendingPhotos.length;

  const handleAddPhoto = async () => {
    if (photoCount >= MAX_HALL_PHOTOS) {
      Alert.alert("Максимум 5 фото", "Удалите одно из фото, чтобы добавить новое.");
      return;
    }
    hapticSelection();
    let picked: PickedPhoto | null = null;
    try {
      picked = await pickImageAsJpeg("hall");
    } catch (err) {
      Alert.alert(pickErrorTitle(err), getErrorMessage(err, "Не удалось открыть галерею"));
      return;
    }
    if (!picked) return;
    // Existing hall: upload right away. New hall: keep until it is created.
    if (isEditing && editingId) {
      setPhotoBusy(true);
      try {
        const res = await uploadHallPhoto(editingId, picked);
        setPhotos(res.photos);
      } catch (err) {
        Alert.alert("Не удалось загрузить фото", getErrorMessage(err));
      } finally {
        setPhotoBusy(false);
      }
    } else {
      setPendingPhotos((prev) => [...prev, picked as PickedPhoto]);
    }
  };

  const handleRemovePhoto = (photo: string | PickedPhoto) => {
    hapticImpact();
    if (typeof photo !== "string") {
      setPendingPhotos((prev) => prev.filter((p) => p !== photo));
      return;
    }
    if (!editingId) return;
    Alert.alert("Удалить фото?", "Фото будет удалено из галереи зала.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          setPhotoBusy(true);
          try {
            const res = await deleteHallPhoto(editingId, photo);
            setPhotos(res.photos);
          } catch (err) {
            Alert.alert("Не удалось удалить фото", getErrorMessage(err));
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Ошибка", "Укажите название зала");
      return;
    }
    if (!surfaceType) {
      Alert.alert("Ошибка", "Выберите тип покрытия зала");
      return;
    }
    const numPrice = parseInt(pricePerHour.replace(/\D/g, ""), 10) || 0;
    if (numPrice <= 0) {
      Alert.alert("Ошибка", "Укажите цену за 1 час");
      return;
    }
    if (!arenaId) {
      Alert.alert("Ошибка", "Не удалось определить вашу площадку. Обновите экран.");
      return;
    }

    const fields = {
      title: title.trim(),
      sportType,
      surfaceType,
      pricePerHour: numPrice,
      maxPeople: maxPeople ?? 0,
      capacity: capacityLabel(maxPeople ?? 0),
      lengthM: lengthM ?? 0,
      widthM: widthM ?? 0,
      equipment,
      description: description.trim(),
    };

    setSaving(true);
    try {
      if (isEditing && editingId) {
        const existing = halls.find((h) => h.id === editingId);
        if (existing) {
          await saveUpdatedHall({ ...existing, ...fields });
          hapticSuccess();
        }
      } else {
        const created = await saveNewHall(arenaId, fields);
        // Upload photos picked before the hall existed.
        let failed = 0;
        for (const photo of pendingPhotos) {
          try {
            await uploadHallPhoto(created.id, photo);
          } catch {
            failed += 1;
          }
        }
        hapticSuccess();
        if (failed > 0) {
          Alert.alert(
            "Зал создан",
            `Не удалось загрузить фото: ${failed}. Добавьте их снова в редактировании зала.`,
          );
        }
      }
      setModalVisible(false);
      loadHalls();
    } catch (e) {
      Alert.alert("Не удалось сохранить зал", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleHallStatus = async (hall: Hall) => {
    hapticImpact();
    const nextStatus = hall.status === "active" ? "maintenance" : "active";
    try {
      await saveUpdatedHall({ ...hall, status: nextStatus });
      loadHalls();
    } catch (e) {
      Alert.alert("Ошибка", getErrorMessage(e));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Залы комплекса
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {halls.length > 0 ? `Площадок: ${halls.length} · покрытие, оснащение, цены` : "Площадки, покрытие, оснащение, цены"}
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openCreateModal}>
          <Ionicons name="add" size={20} color={c.background} />
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
            tintColor={c.primary}
          />
        }
        ListEmptyComponent={
          hallsLoaded ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="layers-outline" size={48} color={c.border} />
              <Text style={styles.emptyTitle}>У вас пока нет залов</Text>
              <Text style={styles.emptySub}>
                Добавьте первый зал или площадку: вид спорта, покрытие и цену за час.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={openCreateModal}>
                <Ionicons name="add" size={18} color={c.background} />
                <Text style={styles.emptyBtnText}>Добавить зал</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
            ) : (
              <Pressable style={[styles.cardImage, styles.cardImageEmpty]} onPress={() => openEditModal(item)}>
                <Ionicons name="images-outline" size={32} color={c.textSecondary} />
                <Text style={styles.cardImageEmptyText}>Добавьте фото зала</Text>
              </Pressable>
            )}
            {(item.photos?.length ?? 0) > 1 ? (
              <View style={styles.photoCountBadge}>
                <Ionicons name="images" size={12} color={c.textPrimary} />
                <Text style={styles.photoCountText}>{item.photos?.length}</Text>
              </View>
            ) : null}

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
                          item.status === "active" ? c.primary : "#EAB308",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color:
                          item.status === "active" ? c.primary : "#EAB308",
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
                <Ionicons name="layers-outline" size={14} color={c.primary} />
                <Text style={styles.metaLabel}>Покрытие:</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {item.surfaceType}
                </Text>
              </View>

              {/* Capacity */}
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={14} color="#60A5FA" />
                <Text style={styles.metaLabel}>Вместимость:</Text>
                <Text style={styles.metaValue}>
                  {capacityLabel(item.maxPeople ?? 0) || item.capacity || "не указана"}
                </Text>
              </View>

              {sizeLabel(item.lengthM ?? 0, item.widthM ?? 0) ? (
                <View style={styles.metaRow}>
                  <Ionicons name="resize-outline" size={14} color="#EAB308" />
                  <Text style={styles.metaLabel}>Размер:</Text>
                  <Text style={styles.metaValue}>{sizeLabel(item.lengthM ?? 0, item.widthM ?? 0)}</Text>
                </View>
              ) : null}

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

                <View style={styles.cardActions}>
                  {/* Per-hall schedule: labelled until configured, then icon only */}
                  <Pressable
                    style={[styles.editBtn, !item.scheduleConfigured && styles.scheduleBtnCta]}
                    hitSlop={6}
                    accessibilityLabel="Настроить график зала"
                    onPress={() => {
                      hapticSelection();
                      router.push({ pathname: "/business/schedule", params: { hallId: String(item.id) } });
                    }}
                  >
                    <Ionicons name="calendar-outline" size={16} color={c.primary} />
                    {!item.scheduleConfigured ? (
                      <Text style={styles.editBtnText}>Настроить график</Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    style={styles.editBtn}
                    accessibilityLabel="Редактировать зал"
                    onPress={() => openEditModal(item)}
                  >
                    <Ionicons name="pencil-outline" size={16} color={c.primary} />
                    {item.scheduleConfigured ? (
                      <Text style={styles.editBtnText}>Редактировать</Text>
                    ) : null}
                  </Pressable>
                </View>
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
                <Ionicons name="close" size={24} color={c.textPrimary} />
              </Pressable>
            </View>

            {/* "handled": with the keyboard open, a tap on a list / chip must
                select it right away instead of only closing the keyboard. */}
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Hall Title */}
              <Text style={styles.inputLabel}>Название зала</Text>
              <TextInput
                style={styles.input}
                placeholder="Например: Футбольный зал Arena 1"
                placeholderTextColor={c.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              {/* Sport Type */}
              <Text style={styles.inputLabel}>Вид спорта</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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

              {/* Gallery */}
              <Text style={styles.inputLabel}>
                Фото зала ({photoCount}/{MAX_HALL_PHOTOS})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.galleryRow}
              >
                {photos.map((url, i) => (
                  <View key={url} style={styles.galleryItem}>
                    <Image source={{ uri: url }} style={styles.galleryImage} />
                    {i === 0 ? (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>Обложка</Text>
                      </View>
                    ) : null}
                    <Pressable style={styles.galleryRemove} hitSlop={6} onPress={() => handleRemovePhoto(url)}>
                      <Ionicons name="close" size={14} color={c.textPrimary} />
                    </Pressable>
                  </View>
                ))}
                {pendingPhotos.map((p, i) => (
                  <View key={p.uri} style={styles.galleryItem}>
                    <Image source={{ uri: p.uri }} style={styles.galleryImage} />
                    {photos.length === 0 && i === 0 ? (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>Обложка</Text>
                      </View>
                    ) : null}
                    <Pressable style={styles.galleryRemove} hitSlop={6} onPress={() => handleRemovePhoto(p)}>
                      <Ionicons name="close" size={14} color={c.textPrimary} />
                    </Pressable>
                  </View>
                ))}
                {photoCount < MAX_HALL_PHOTOS ? (
                  <Pressable style={styles.galleryAdd} onPress={handleAddPhoto} disabled={photoBusy}>
                    {photoBusy ? (
                      <ActivityIndicator color={c.primary} />
                    ) : (
                      <>
                        <Ionicons name="add" size={26} color={c.primary} />
                        <Text style={styles.galleryAddText}>Фото</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </ScrollView>

              {/* Surface Type */}
              <View style={styles.fieldGap}>
                <SelectField
                  label="Тип покрытия"
                  placeholder="Выберите покрытие"
                  value={surfaceType}
                  options={SURFACE_TYPES.map((t) => ({ value: t, label: t }))}
                  onChange={setSurfaceType}
                />
              </View>

              {/* Price & Capacity in Row */}
              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.inputLabel, { marginBottom: spacing.sm }]}>Цена за 1 час (₸)</Text>
                  <TextInput
                    style={[styles.input, styles.inputTall]}
                    keyboardType="numeric"
                    placeholder="Например, 15000"
                    placeholderTextColor={c.textMuted}
                    value={pricePerHour}
                    onChangeText={setPricePerHour}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <SelectField
                    label="Вместимость"
                    placeholder="Человек"
                    sheetTitle="Сколько человек вмещает зал"
                    value={maxPeople}
                    options={CAPACITY_OPTIONS.map((n) => ({ value: n, label: capacityLabel(n) }))}
                    onChange={setMaxPeople}
                  />
                </View>
              </View>

              {/* Hall size */}
              <View style={[styles.inputRow, styles.fieldGap]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <SelectField
                    label="Длина, м"
                    placeholder="Длина"
                    sheetTitle="Длина зала"
                    value={lengthM}
                    options={SIZE_OPTIONS.map((n) => ({ value: n, label: `${n} м` }))}
                    onChange={setLengthM}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <SelectField
                    label="Ширина, м"
                    placeholder="Ширина"
                    sheetTitle="Ширина зала"
                    value={widthM}
                    options={SIZE_OPTIONS.map((n) => ({ value: n, label: `${n} м` }))}
                    onChange={setWidthM}
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
                        color={active ? c.primary : c.textMuted}
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
                  placeholderTextColor={c.textMuted}
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
                placeholderTextColor={c.textMuted}
                value={description}
                onChangeText={setDescription}
              />

              {/* Save Button */}
              <Pressable
                style={[styles.saveBtn, (saving || photoBusy) && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving || photoBusy}
              >
                {saving ? (
                  <ActivityIndicator color={c.background} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {isEditing ? "Сохранить изменения" : "Создать зал"}
                  </Text>
                )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
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
  addBtn: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.background,
  },
  list: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  fieldGap: {
    marginBottom: spacing.md,
  },
  cardImageEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: c.surfaceElevated,
  },
  cardImageEmptyText: {
    ...typography.caption,
    color: c.textSecondary,
  },
  photoCountBadge: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.smallChip,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  photoCountText: {
    ...typography.caption,
    fontWeight: "600",
    color: c.textPrimary,
  },
  galleryRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  galleryItem: {
    width: 88,
    height: 88,
    borderRadius: radii.smallChip,
    overflow: "hidden",
    backgroundColor: c.surfaceElevated,
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  galleryRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  coverBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: c.primary,
  },
  coverBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: c.background,
  },
  galleryAdd: {
    width: 88,
    height: 88,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  galleryAddText: {
    ...typography.caption,
    color: c.primary,
    fontWeight: "600",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: c.textPrimary,
    marginTop: spacing.sm,
  },
  emptySub: {
    ...typography.body,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.button,
    backgroundColor: c.primary,
  },
  emptyBtnText: {
    ...typography.button,
    color: c.background,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.hairline,
  },
  cardImage: {
    width: "100%",
    height: 160,
    backgroundColor: c.surface,
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
    color: c.primary,
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
    color: c.textPrimary,
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
    color: c.textMuted,
  },
  metaValue: {
    fontSize: 12,
    color: c.textPrimary,
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
    backgroundColor: c.hairline,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  equipText: {
    fontSize: 11,
    color: c.textSecondary,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
  },
  priceLabel: {
    fontSize: 10,
    color: c.textMuted,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "800",
    color: c.textPrimary,
  },
  priceSub: {
    fontSize: 11,
    fontWeight: "400",
    color: c.textMuted,
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
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  scheduleBtnCta: {
    borderColor: c.primary,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.primary,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
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
  inputTall: {
    height: 50,
    paddingVertical: 0,
    borderRadius: radii.button,
    fontSize: 15,
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
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  sportOptionActive: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderColor: c.primary,
  },
  sportOptionText: {
    fontSize: 13,
    color: c.textSecondary,
    fontWeight: "600",
  },
  sportOptionTextActive: {
    color: c.primary,
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
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  equipToggleActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.5)",
  },
  equipToggleText: {
    fontSize: 12,
    color: c.textSecondary,
  },
  equipToggleTextActive: {
    color: c.primary,
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
    color: c.primary,
  },
  saveBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: c.background,
  },
});

