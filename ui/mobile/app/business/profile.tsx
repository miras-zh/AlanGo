import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { AppearanceSettings } from "@/components/ProfilePreferences";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { radii, spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errorMessage";
import { pickErrorTitle, pickImageAsJpeg, type PickedPhoto } from "@/lib/pickImage";
import { clearSession, getSessionUser } from "@/lib/auth";
import {
  Arena,
  cacheArenaLogo,
  deleteArenaLogo,
  getStoredArenas,
  saveUpdatedArena,
  uploadArenaLogo,
  uploadArenaCover,
  deleteArenaCover,
  cacheArenaCover,
} from "@/lib/sportRentData";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT, type MessageKey } from "@/lib/i18n";
import { cityLabel, workingHoursLabel } from "@/lib/dataLabels";

type HoursMode = "daily" | "weekdays" | "mon_sat" | "24_7";

// `suffix` is the stored (Russian) form — see workingHoursLabel() for display.
const HOURS_MODES: { id: HoursMode; label: MessageKey | null; suffix: string }[] = [
  { id: "daily", label: "hours.modeDaily", suffix: "ежедневно" },
  { id: "weekdays", label: "hours.modeWeekdays", suffix: "пн–пт" },
  { id: "mon_sat", label: "hours.modeMonSat", suffix: "пн–сб" },
  { id: "24_7", label: null, suffix: "круглосуточно" },
];

function formatMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildWorkingHours(openMins: number, closeMins: number, mode: HoursMode): string {
  if (mode === "24_7") return "Круглосуточно (24/7)";
  const suffix = HOURS_MODES.find((m) => m.id === mode)?.suffix || "ежедневно";
  return `${formatMinutes(openMins)} - ${formatMinutes(closeMins)} (${suffix})`;
}

function parseWorkingHours(raw?: string): { openMins: number; closeMins: number; mode: HoursMode } {
  const text = (raw || "").toLowerCase();
  let mode: HoursMode = "daily";
  if (text.includes("24/7") || text.includes("круглосуточ")) mode = "24_7";
  else if (text.includes("пн–пт") || text.includes("пн-пт") || text.includes("будн")) mode = "weekdays";
  else if (text.includes("пн–сб") || text.includes("пн-сб")) mode = "mon_sat";

  const match = text.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const openMins = Math.min(23 * 60 + 30, Math.max(0, Number(match[1]) * 60 + Number(match[2])));
    const closeMins = Math.min(24 * 60, Math.max(30, Number(match[3]) * 60 + Number(match[4])));
    return { openMins, closeMins, mode };
  }
  return { openMins: 8 * 60, closeMins: 23 * 60, mode };
}

export default function BusinessProfileScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
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

  // Complex Working Hours Modal State (independent from hall schedules)
  const [hoursModalVisible, setHoursModalVisible] = useState(false);
  const [openMins, setOpenMins] = useState(8 * 60);
  const [closeMins, setCloseMins] = useState(23 * 60);
  const [hoursMode, setHoursMode] = useState<HoursMode>("daily");
  const [hoursText, setHoursText] = useState("08:00 - 23:00 (ежедневно)");
  const [savingHours, setSavingHours] = useState(false);

  // Business avatar (arena logo)
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

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
      Alert.alert(pickErrorTitle(err), getErrorMessage(err, t("profile.galleryError")));
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
      Alert.alert(t("bizProfile.logoDeleteError"), getErrorMessage(err));
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
          options: [t("bizProfile.chooseNewPhoto"), t("bizProfile.deleteLogo"), t("common.cancel")],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (i) => {
          if (i === 0) pickLogo();
          if (i === 1) removeLogo();
        },
      );
    } else {
      Alert.alert(t("bizProfile.logo"), undefined, [
        { text: t("bizProfile.chooseNewPhoto"), onPress: pickLogo },
        { text: t("bizProfile.deleteLogo"), style: "destructive", onPress: removeLogo },
        { text: t("common.cancel"), style: "cancel" },
      ]);
    }
  };

  // Cover (banner) — the wide photo above the logo, shown on the arena card.
  const coverUrl = arena?.imageUrl || "";

  const applyCover = async (url: string) => {
    if (!arena) return;
    setArena({ ...arena, imageUrl: url });
    await cacheArenaCover(arena.id, url);
  };

  const pickCover = async () => {
    if (!arena) return;
    let picked: PickedPhoto | null = null;
    try {
      picked = await pickImageAsJpeg("arena-cover");
    } catch (err) {
      Alert.alert(pickErrorTitle(err), getErrorMessage(err, t("profile.galleryError")));
      return;
    }
    if (!picked) return;
    setUploadingCover(true);
    try {
      const url = await uploadArenaCover(arena.id, picked);
      await applyCover(url);
      hapticSuccess();
    } catch (err) {
      Alert.alert(t("bizProfile.coverUploadError"), getErrorMessage(err));
    } finally {
      setUploadingCover(false);
    }
  };

  const removeCover = async () => {
    if (!arena) return;
    setUploadingCover(true);
    try {
      await deleteArenaCover(arena.id);
      await applyCover("");
      hapticSuccess();
    } catch (err) {
      Alert.alert(t("bizProfile.coverDeleteError"), getErrorMessage(err));
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverPress = () => {
    if (!arena || uploadingCover) return;
    hapticSelection();
    if (!coverUrl) {
      pickCover();
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t("bizProfile.replaceCover"), t("bizProfile.deleteCover"), t("common.cancel")],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (i) => {
          if (i === 0) pickCover();
          if (i === 1) removeCover();
        },
      );
    } else {
      Alert.alert(t("bizProfile.cover"), undefined, [
        { text: t("bizProfile.replaceCover"), onPress: pickCover },
        { text: t("bizProfile.deleteCover"), style: "destructive", onPress: removeCover },
        { text: t("common.cancel"), style: "cancel" },
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
      Alert.alert(t("bizProfile.logoUploadError"), getErrorMessage(err));
    } finally {
      setUploadingLogo(false);
    }
  };

  const openEditModal = () => {
    hapticSelection();
    if (!arena) return;
    setTitle(arena.title || "");
    setAddress(arena.address || "");
    setPhone(arena.phone || "");
    setCity(arena.city || "Астана");
    setDescription(arena.description || "");
    setModalVisible(true);
  };

  const handleSaveArena = async () => {
    if (!arena) return;
    if (!title.trim()) {
      Alert.alert(t("common.error"), t("bizProfile.nameRequired"));
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
        description: description.trim(),
      };
      await saveUpdatedArena(updated);
      setArena(updated);
      hapticSuccess();
      setModalVisible(false);
      Alert.alert(t("common.success"), t("bizProfile.updated"));
    } catch (err) {
      Alert.alert(t("common.error"), getErrorMessage(err, t("bizProfile.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const openHoursModal = () => {
    hapticSelection();
    if (!arena) return;
    const parsed = parseWorkingHours(arena.workingHours);
    setOpenMins(parsed.openMins);
    setCloseMins(parsed.closeMins);
    setHoursMode(parsed.mode);
    setHoursText(arena.workingHours?.trim() || buildWorkingHours(parsed.openMins, parsed.closeMins, parsed.mode));
    setHoursModalVisible(true);
  };

  const shiftOpenMins = (delta: number) => {
    hapticSelection();
    const next = Math.max(0, Math.min(closeMins - 30, openMins + delta));
    const nextMode = hoursMode === "24_7" ? "daily" : hoursMode;
    setOpenMins(next);
    setHoursMode(nextMode);
    setHoursText(buildWorkingHours(next, closeMins, nextMode));
  };

  const shiftCloseMins = (delta: number) => {
    hapticSelection();
    const next = Math.min(24 * 60, Math.max(openMins + 30, closeMins + delta));
    const nextMode = hoursMode === "24_7" ? "daily" : hoursMode;
    setCloseMins(next);
    setHoursMode(nextMode);
    setHoursText(buildWorkingHours(openMins, next, nextMode));
  };

  const selectHoursMode = (mode: HoursMode) => {
    hapticSelection();
    setHoursMode(mode);
    setHoursText(buildWorkingHours(openMins, closeMins, mode));
  };

  const handleSaveHours = async () => {
    if (!arena) return;
    const nextHours = hoursText.trim();
    if (!nextHours) {
      Alert.alert(t("common.error"), t("bizProfile.hoursRequired"));
      return;
    }
    setSavingHours(true);
    try {
      const updated: Arena = { ...arena, workingHours: nextHours };
      await saveUpdatedArena(updated);
      setArena(updated);
      hapticSuccess();
      setHoursModalVisible(false);
      Alert.alert(t("common.success"), t("bizProfile.hoursUpdated"));
    } catch (err) {
      Alert.alert(t("common.error"), getErrorMessage(err, t("sched.saveError")));
    } finally {
      setSavingHours(false);
    }
  };

  const handleLogout = async () => {
    hapticImpact();
    Alert.alert(t("bizProfile.logoutTitle"), t("bizProfile.logoutText"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.logout"),
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
        <Text style={styles.headerTitle}>{t("bizProfile.title")}</Text>
        <Pressable
          style={styles.editBtn}
          onPress={openEditModal}
        >
          <Ionicons name="create-outline" size={18} color={c.primary} />
          <Text style={styles.editBtnText}>{t("bizProfile.edit")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Arena Big Card */}
        <View style={styles.arenaCard}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.arenaCover} />
          ) : null}
          <View style={[styles.arenaOverlay, !coverUrl && styles.arenaOverlayPlain]}>
            {!coverUrl ? (
              <Text style={styles.coverHint}>{t("bizProfile.coverHint")}</Text>
            ) : null}
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{t("bizProfile.verified")}</Text>
            </View>
            <View style={styles.arenaIdentity}>
              <Pressable
                onPress={handleLogoPress}
                disabled={!arena || uploadingLogo}
                accessibilityRole="button"
                accessibilityLabel={t("bizProfile.changeLogo")}
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
                    <ActivityIndicator color={c.textPrimary} />
                  </View>
                ) : null}
                <View style={styles.logoEditBadge}>
                  <Ionicons name="camera" size={12} color={c.background} />
                </View>
              </Pressable>
              <View style={styles.arenaIdentityText}>
                <Text style={styles.arenaName} numberOfLines={1}>
                  {arena?.title}
                </Text>
                <Text style={styles.arenaAddress} numberOfLines={1}>
                  {[arena?.city ? cityLabel(arena.city, t) : "", arena?.address].filter(Boolean).join(", ")}
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            style={styles.coverBtn}
            onPress={handleCoverPress}
            disabled={!arena || uploadingCover}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("bizProfile.changeCover")}
          >
            {uploadingCover ? (
              <ActivityIndicator size="small" color={c.textPrimary} />
            ) : (
              <Ionicons name="camera" size={15} color={c.textPrimary} />
            )}
            <Text style={styles.coverBtnText}>{t("bizProfile.coverButton")}</Text>
          </Pressable>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoTile}>
            <Ionicons name="call-outline" size={18} color={c.primary} />
            <Text style={styles.infoTileLabel}>{t("bizProfile.adminPhone")}</Text>
            <Text style={styles.infoTileValue}>{arena?.phone || "+7 (701) 111-22-33"}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.infoTile, styles.infoTileRow, pressed && { opacity: 0.85 }]}
            onPress={openHoursModal}
            accessibilityLabel={t("bizProfile.changeHours")}
          >
            <View style={{ flex: 1 }}>
              <Ionicons name="time-outline" size={18} color={c.primary} />
              <Text style={styles.infoTileLabel}>{t("bizProfile.hours")}</Text>
              <Text style={styles.infoTileValue}>
                {workingHoursLabel(arena?.workingHours || "08:00 - 23:00 (ежедневно)", t)}
              </Text>
            </View>
            <View style={styles.tileEditBtn}>
              <Ionicons name="create-outline" size={18} color={c.primary} />
            </View>
          </Pressable>

          <View style={styles.infoTile}>
            <Ionicons name="mail-outline" size={18} color="#EAB308" />
            <Text style={styles.infoTileLabel}>{t("bizProfile.ownerLogin")}</Text>
            <Text style={styles.infoTileValue}>{user?.email || "dev.arena1"}</Text>
          </View>

          <View style={styles.infoTile}>
            <Ionicons name="star" size={18} color={c.primary} />
            <Text style={styles.infoTileLabel}>{t("bizProfile.rating")}</Text>
            <Text style={styles.infoTileValue}>
              {t("bizProfile.ratingValue", { rating: arena?.rating ?? 0, count: arena?.reviewsCount ?? 0 })}
            </Text>
          </View>
        </View>

        {/* Features list */}
        <Text style={styles.sectionTitle}>{t("bizProfile.amenities")}</Text>
        <View style={styles.featuresWrap}>
          {arena?.features.map((feat, i) => (
            <View key={i} style={styles.featurePill}>
              <Ionicons name="checkmark-sharp" size={14} color={c.primary} />
              <Text style={styles.featureText}>{feat}</Text>
            </View>
          ))}
        </View>

        {/* Theme + language, so owners don't have to switch to client mode */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t("bizProfile.appSettings")}</Text>
        <AppearanceSettings />

        {/* Business account management (real accounts) */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t("bizProfile.account")}</Text>
        <BusinessAccountCard />
        <Pressable
          style={[styles.switchBtn, styles.switchBtnClient]}
          onPress={() => {
            hapticSelection();
            router.replace("/(tabs)");
          }}
        >
          <Ionicons name="person-outline" size={18} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchBtnTitle, { color: c.primary }]}>{t("bizProfile.asClient")}</Text>
            <Text style={styles.switchBtnSub}>{t("bizProfile.asClientText")}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={c.primary} />
        </Pressable>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={c.error} />
          <Text style={styles.logoutBtnText}>{t("account.logoutFull")}</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("bizProfile.params")}</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>{t("bizProfile.complexName")}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Astana Arena Sport"
                placeholderTextColor={c.textMuted}
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>{t("account.city")}</Text>
                  <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                    placeholder={t("bizProfile.cityPlaceholder")}
                    placeholderTextColor={c.textMuted}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>{t("account.phone")}</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+7 (701) 111-22-33"
                    placeholderTextColor={c.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>{t("bizProfile.address")}</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder={t("bizProfile.addressPlaceholder")}
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("bizHalls.description")}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
                placeholder={t("bizProfile.descriptionPlaceholder")}
                placeholderTextColor={c.textMuted}
              />

              <Pressable
                style={[styles.saveModalBtn, saving && { opacity: 0.5 }]}
                onPress={handleSaveArena}
                disabled={saving}
              >
                <Text style={styles.saveModalBtnText}>
                  {saving ? t("common.saving") : t("account.saveChanges")}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Complex Working Hours Modal */}
      <Modal visible={hoursModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("bizProfile.hoursTitle")}</Text>
              <Pressable onPress={() => setHoursModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.hoursHint}>
                {t("bizProfile.hoursHint")}
              </Text>

              <Text style={styles.inputLabel}>{t("bizProfile.mode")}</Text>
              <View style={styles.modeChipsRow}>
                {HOURS_MODES.map((m) => {
                  const active = hoursMode === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.modeChip, active && styles.modeChipActive]}
                      onPress={() => selectHoursMode(m.id)}
                    >
                      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                        {m.label ? t(m.label) : "24/7"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {hoursMode !== "24_7" ? (
                <View style={styles.timeSteppersRow}>
                  <View style={styles.timeStepperCard}>
                    <Text style={styles.timeStepperLabel}>{t("sched.opening")}</Text>
                    <View style={styles.timeStepperControls}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => shiftOpenMins(-30)}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={18} color={c.textPrimary} />
                      </Pressable>
                      <Text style={styles.timeStepperValue}>{formatMinutes(openMins)}</Text>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => shiftOpenMins(30)}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={18} color={c.textPrimary} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.timeStepperCard}>
                    <Text style={styles.timeStepperLabel}>{t("sched.closing")}</Text>
                    <View style={styles.timeStepperControls}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => shiftCloseMins(-30)}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={18} color={c.textPrimary} />
                      </Pressable>
                      <Text style={styles.timeStepperValue}>{formatMinutes(closeMins)}</Text>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => shiftCloseMins(30)}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={18} color={c.textPrimary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>{t("bizProfile.hoursText")}</Text>
              <TextInput
                style={styles.input}
                value={hoursText}
                onChangeText={setHoursText}
                placeholder="08:00 - 23:00 (ежедневно)"
                placeholderTextColor={c.textMuted}
                maxLength={100}
              />

              <Pressable
                style={[styles.saveModalBtn, savingHours && { opacity: 0.5 }]}
                onPress={handleSaveHours}
                disabled={savingHours}
              >
                <Text style={styles.saveModalBtnText}>
                  {savingHours ? t("common.saving") : t("bizProfile.saveHours")}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {cropSource ? (
        <AvatarCropModal
          title={t("bizProfile.logo")}
          source={cropSource}
          onCancel={() => setCropSource(null)}
          onSave={handleCroppedLogo}
        />
      ) : null}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.textPrimary,
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
    color: c.primary,
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
    backgroundColor: c.surface,
  },
  arenaCover: {
    width: "100%",
    height: "100%",
  },
  arenaOverlay: {
    ...StyleSheet.absoluteFill,
    // Light shade so the cover stays visible while the name stays readable.
    backgroundColor: "rgba(11, 15, 13, 0.35)",
    padding: 16,
    justifyContent: "flex-end",
  },
  arenaOverlayPlain: {
    backgroundColor: c.surface,
  },
  coverHint: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: 120,
    fontSize: 12,
    color: c.textSecondary,
  },
  coverBtn: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: c.glassBorder,
    backgroundColor: c.glassBackground,
  },
  coverBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textPrimary,
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
    borderColor: c.glassBorder,
  },
  logoFallback: {
    backgroundColor: c.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 28,
    fontWeight: "800",
    color: c.primary,
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
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.background,
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
    backgroundColor: c.primary,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: c.primary,
  },
  arenaName: {
    fontSize: 22,
    fontWeight: "800",
    color: c.textPrimary,
  },
  arenaAddress: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 2,
  },
  infoGrid: {
    gap: 10,
    marginBottom: 20,
  },
  infoTile: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  infoTileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  tileEditBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.smallChip,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  hoursHint: {
    fontSize: 13,
    lineHeight: 18,
    color: c.textSecondary,
    marginBottom: spacing.md,
  },
  modeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.smallChip,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  modeChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderColor: c.primary,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
  },
  modeChipTextActive: {
    color: c.primary,
  },
  timeSteppersRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  timeStepperCard: {
    flex: 1,
    backgroundColor: c.background,
    borderRadius: radii.smallChip,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.subtle,
    alignItems: "center",
  },
  timeStepperLabel: {
    fontSize: 12,
    color: c.textMuted,
    marginBottom: spacing.sm,
  },
  timeStepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  timeStepperValue: {
    fontSize: 16,
    fontWeight: "800",
    color: c.textPrimary,
    minWidth: 48,
    textAlign: "center",
  },
  infoTileLabel: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 4,
  },
  infoTileValue: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
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
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  featureText: {
    fontSize: 12,
    color: c.textSecondary,
  },
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: c.subtle,
  },
  switchBtnClient: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  switchBtnTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.textPrimary,
  },
  switchBtnSub: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: spacing.card,
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
    maxHeight: "85%",
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
  inputRow: {
    flexDirection: "row",
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  saveModalBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  saveModalBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: c.background,
  },
});
