import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { resolveMyArenaId } from "@/lib/business";
import { Ionicons } from "@expo/vector-icons";
import { BusinessAccountCard } from "@/components/BusinessAccountCard";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { colors, radii, spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errorMessage";
import { pickImageAsJpeg, type PickedPhoto } from "@/lib/pickImage";
import { clearSession, getSessionUser } from "@/lib/auth";
import {
  Arena,
  cacheArenaLogo,
  deleteArenaLogo,
  getStoredArenas,
  saveUpdatedArena,
  uploadArenaLogo,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

export default function BusinessProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser());
  const [arena, setArena] = useState<Arena | null>(null);

  // Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Астана");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Business avatar (arena logo)
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadData = useCallback(async () => {
    const currentUser = getSessionUser();
    setUser(currentUser);
    const arenaId = await resolveMyArenaId();
    if (!arenaId) {
      setArena(null);
      return;
    }
    const all = await getStoredArenas();
    setArena(all.find((a) => a.id === arenaId) ?? null);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logoUrl = arena?.logoUrl || "";
  const logoLetter = (arena?.title || "?").trim().charAt(0).toUpperCase() || "?";

  const applyLogo = async (url: string) => {
    if (!arena) return;
    setArena({ ...arena, logoUrl: url });
    await cacheArenaLogo(arena.id, url);
  };

  const pickLogo = async () => {
    try {
      const picked = await pickImageAsJpeg("arena-logo");
      if (picked) setCropSource(picked.uri);
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err, "Не удалось открыть галерею"));
    }
  };

  const removeLogo = async () => {
    if (!arena) return;
    setUploadingLogo(true);
    try {
      await deleteArenaLogo(arena.id);
      await applyLogo("");
      hapticSuccess();
    } catch (err) {
      Alert.alert("Не удалось удалить логотип", getErrorMessage(err));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoPress = () => {
    if (!arena || uploadingLogo) return;
    hapticSelection();
    if (!logoUrl) {
      pickLogo();
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Выбрать новое фото", "Удалить логотип", "Отмена"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (i) => {
          if (i === 0) pickLogo();
          if (i === 1) removeLogo();
        },
      );
    } else {
      Alert.alert("Логотип арены", undefined, [
        { text: "Выбрать новое фото", onPress: pickLogo },
        { text: "Удалить логотип", style: "destructive", onPress: removeLogo },
        { text: "Отмена", style: "cancel" },
      ]);
    }
  };

  const handleCroppedLogo = async (file: PickedPhoto) => {
    setCropSource(null);
    if (!arena) return;
    setUploadingLogo(true);
    try {
      const url = await uploadArenaLogo(arena.id, file);
      await applyLogo(url);
      hapticSuccess();
    } catch (err) {
      Alert.alert("Не удалось загрузить логотип", getErrorMessage(err));
    } finally {
      setUploadingLogo(false);
    }
  };

  const openEditModal = () => {
    hapticSelection();
    if (!arena) return;
    setTitle(arena.title);
    setAddress(arena.address);
    setPhone(arena.phone);
    setCity(arena.city);
    setDescription(arena.description);
    setModalVisible(true);
  };

  const handleSaveArena = async () => {
    if (!arena) return;
    if (!title.trim() || !address.trim()) {
      Alert.alert("Ошибка", "Заполните название и адрес спорткомплекса");
      return;
    }
    setSaving(true);
    try {
      const updated: Arena = {
        ...arena,
        title: title.trim(),
        address: address.trim(),
        phone: phone.trim() || arena.phone,
        city: city.trim() || arena.city,
        description: description.trim() || arena.description,
      };
      await saveUpdatedArena(updated);
      setArena(updated);
      hapticSuccess();
      setModalVisible(false);
      Alert.alert("Успешно", "Данные спорткомплекса обновлены!");
    } catch {
      Alert.alert("Ошибка", "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    hapticImpact();
    Alert.alert("Выход", "Выйти из бизнес-аккаунта?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Профиль бизнеса</Text>
        <Pressable
          style={styles.editBtn}
          onPress={openEditModal}
        >
          <Ionicons name="create-outline" size={18} color="#22C55E" />
          <Text style={styles.editBtnText}>Изменить</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Arena Big Card */}
        <View style={styles.arenaCard}>
          {arena?.imageUrl ? (
            <Image source={{ uri: arena.imageUrl }} style={styles.arenaCover} />
          ) : null}
          <View style={[styles.arenaOverlay, !arena?.imageUrl && styles.arenaOverlayPlain]}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Арена верифицирована</Text>
            </View>
            <View style={styles.arenaIdentity}>
              <Pressable
                onPress={handleLogoPress}
                disabled={!arena || uploadingLogo}
                accessibilityRole="button"
                accessibilityLabel="Изменить логотип арены"
              >
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logo} />
                ) : (
                  <View style={[styles.logo, styles.logoFallback]}>
                    <Text style={styles.logoLetter}>{logoLetter}</Text>
                  </View>
                )}
                {uploadingLogo ? (
                  <View style={[styles.logo, styles.logoOverlay]}>
                    <ActivityIndicator color={colors.textPrimary} />
                  </View>
                ) : null}
                <View style={styles.logoEditBadge}>
                  <Ionicons name="camera" size={12} color={colors.background} />
                </View>
              </Pressable>
              <View style={styles.arenaIdentityText}>
                <Text style={styles.arenaName} numberOfLines={1}>
                  {arena?.title}
                </Text>
                <Text style={styles.arenaAddress} numberOfLines={1}>
                  {[arena?.city, arena?.address].filter(Boolean).join(", ")}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoTile}>
            <Ionicons name="call-outline" size={18} color="#22C55E" />
            <Text style={styles.infoTileLabel}>Телефон администратора</Text>
            <Text style={styles.infoTileValue}>{arena?.phone || "+7 (701) 111-22-33"}</Text>
          </View>

          <View style={styles.infoTile}>
            <Ionicons name="time-outline" size={18} color="#60A5FA" />
            <Text style={styles.infoTileLabel}>Часы работы</Text>
            <Text style={styles.infoTileValue}>{arena?.workingHours || "08:00 - 24:00"}</Text>
          </View>

          <View style={styles.infoTile}>
            <Ionicons name="mail-outline" size={18} color="#EAB308" />
            <Text style={styles.infoTileLabel}>Логин владельца</Text>
            <Text style={styles.infoTileValue}>{user?.email || "dev.arena1"}</Text>
          </View>

          <View style={styles.infoTile}>
            <Ionicons name="star" size={18} color="#22C55E" />
            <Text style={styles.infoTileLabel}>Рейтинг арены</Text>
            <Text style={styles.infoTileValue}>
              ★ {arena?.rating} ({arena?.reviewsCount} отзывов)
            </Text>
          </View>
        </View>

        {/* Features list */}
        <Text style={styles.sectionTitle}>Удобства комплекса</Text>
        <View style={styles.featuresWrap}>
          {arena?.features.map((feat, i) => (
            <View key={i} style={styles.featurePill}>
              <Ionicons name="checkmark-sharp" size={14} color="#22C55E" />
              <Text style={styles.featureText}>{feat}</Text>
            </View>
          ))}
        </View>

        {/* Business account management (real accounts) */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Аккаунт</Text>
        <BusinessAccountCard />
        <Pressable
          style={[styles.switchBtn, styles.switchBtnClient]}
          onPress={() => {
            hapticSelection();
            router.replace("/(tabs)");
          }}
        >
          <Ionicons name="person-outline" size={18} color="#22C55E" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchBtnTitle, { color: "#22C55E" }]}>Открыть приложение как клиент</Text>
            <Text style={styles.switchBtnSub}>Бронировать залы и смотреть события</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#22C55E" />
        </Pressable>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Параметры спорткомплекса</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>Название комплекса</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Astana Arena Sport"
                placeholderTextColor="#6B7C72"
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Город</Text>
                  <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                    placeholder="Астана"
                    placeholderTextColor="#6B7C72"
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Телефон</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+7 (701) 111-22-33"
                    placeholderTextColor="#6B7C72"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Адрес комплекса</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="ул. Нур-Султан 12"
                placeholderTextColor="#6B7C72"
              />

              <Text style={styles.inputLabel}>Описание</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
                placeholder="Описание спорткомплекса..."
                placeholderTextColor="#6B7C72"
              />

              <Pressable
                style={[styles.saveModalBtn, saving && { opacity: 0.5 }]}
                onPress={handleSaveArena}
                disabled={saving}
              >
                <Text style={styles.saveModalBtnText}>
                  {saving ? "Сохранение..." : "Сохранить изменения"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {cropSource ? (
        <AvatarCropModal
          source={cropSource}
          onCancel={() => setCropSource(null)}
          onSave={handleCroppedLogo}
        />
      ) : null}
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
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#22C55E",
  },
  scroll: {
    padding: 16,
  },
  arenaCard: {
    height: 180,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
    backgroundColor: "#161D19",
  },
  arenaCover: {
    width: "100%",
    height: "100%",
  },
  arenaOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11, 15, 13, 0.65)",
    padding: 16,
    justifyContent: "flex-end",
  },
  arenaOverlayPlain: {
    backgroundColor: colors.surface,
  },
  arenaIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  arenaIdentityText: {
    flex: 1,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.glassBorder,
  },
  logoFallback: {
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary,
  },
  logoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: radii.smallChip,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#22C55E",
  },
  arenaName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  arenaAddress: {
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 2,
  },
  infoGrid: {
    gap: 10,
    marginBottom: 20,
  },
  infoTile: {
    backgroundColor: "#131916",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  infoTileLabel: {
    fontSize: 11,
    color: "#6B7C72",
    marginTop: 4,
  },
  infoTileValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  featuresWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#131916",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  featureText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0B0F0D",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  switchBtnClient: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  switchBtnTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  switchBtnSub: {
    fontSize: 11,
    color: "#6B7C72",
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
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
    maxHeight: "85%",
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
  inputRow: {
    flexDirection: "row",
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  saveModalBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  saveModalBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B0F0D",
  },
});
