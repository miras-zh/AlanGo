import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser, subscribeAuth, updateSessionUser } from "@/lib/auth";
import { EMPTY_STATS, fetchMyStats, uploadAvatar, type MyStats } from "@/lib/user";
import { pickErrorTitle, pickImageAsJpeg, type PickedPhoto } from "@/lib/pickImage";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { BusinessAccountCard } from "@/components/BusinessAccountCard";
import { ProfilePreferences } from "@/components/ProfilePreferences";

import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";
import { useT } from "@/lib/i18n";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export default function ProfileScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser());
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [stats, setStats] = useState<MyStats>(EMPTY_STATS);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const avatarUrl = user?.avatar_url || user?.photo || "";
  const avatarLetter = (name || user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  // Pick from the gallery, then hand the JPEG to the circular cropper.
  const handlePickAvatar = async () => {
    hapticSelection();
    try {
      const picked = await pickImageAsJpeg("avatar");
      if (picked) setCropSource(picked.uri);
    } catch (err) {
      Alert.alert(pickErrorTitle(err), getErrorMessage(err, t("profile.galleryError")));
    }
  };

  const handleCroppedUpload = async (file: PickedPhoto) => {
    setCropSource(null);
    setUploadingAvatar(true);
    try {
      const me = await uploadAvatar(file);
      const photo = me?.photo || "";
      await updateSessionUser({ photo, avatar_url: photo });
      hapticSuccess();
    } catch (err) {
      Alert.alert(t("profile.avatarUploadError"), getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    return subscribeAuth(() => {
      const u = getSessionUser();
      setUser(u);
      setName(u?.name || u?.full_name || "");
      setPhone(u?.phone || "");
      setCity(u?.city || "");
      if (!u) setStats(EMPTY_STATS);
    });
  }, []);

  // Real statistics from the user's bookings; refreshed whenever the tab is
  // opened. A new account shows 0 games, 0 h and the starting rating 5.0.
  useFocusEffect(
    useCallback(() => {
      if (!getSessionUser()) return;
      fetchMyStats()
        .then(setStats)
        .catch(() => {});
    }, [user?.id]),
  );

  const hoursPlayed = Math.round((stats.minutes_played / 60) * 10) / 10;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={["top"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>{t("profile.title")}</Text>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => {
            hapticSelection();
            router.push("/settings");
          }}
        >
          <Ionicons name="settings-outline" size={22} color={c.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!user ? (
          /* Unauthenticated Guest State */
          <>
            <View style={styles.guestCard}>
              <View style={styles.guestIconWrap}>
                <Ionicons name="person-circle-outline" size={54} color={c.primary} />
              </View>
              <Text style={styles.guestTitle}>{t("profile.guestTitle")}</Text>
              <Text style={styles.guestSubtitle}>
                {t("profile.guestText")}
              </Text>
              <Pressable
                style={styles.guestLoginBtn}
                onPress={() => {
                  hapticSelection();
                  router.push("/login");
                }}
              >
                <Ionicons name="log-in-outline" size={20} color={c.background} />
                <Text style={styles.guestLoginBtnText}>{t("profile.guestButton")}</Text>
              </Pressable>
            </View>

            <ProfilePreferences signedIn={false} />
          </>
        ) : (
          /* Authenticated User State */
          <>
            {/* User Card */}
            <View style={styles.userCard}>
              <View style={styles.avatarWrap}>
                <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                    </View>
                  )}
                  {uploadingAvatar ? (
                    <View style={[styles.avatar, styles.avatarOverlay]}>
                      <ActivityIndicator color={c.textPrimary} />
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  hitSlop={8}
                  style={styles.avatarEditBadge}
                >
                  <Ionicons name="pencil" size={12} color={c.background} />
                </Pressable>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{name || user.email?.split("@")[0] || t("profile.userFallback")}</Text>
                </View>
                <Text style={styles.userEmail}>{user.email}</Text>
                {city ? <Text style={styles.userLocation}>📍 {city}</Text> : null}
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{stats.games_played}</Text>
                <Text style={styles.statLabel}>{t("profile.gamesPlayed")}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{t("profile.hoursShort", { n: hoursPlayed })}</Text>
                <Text style={styles.statLabel}>{t("profile.onCourt")}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>★ {stats.rating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>{t("profile.rating")}</Text>
              </View>
            </View>

            {/* Business account: create / open / disable / enable */}
            <BusinessAccountCard />

            {/* Theme, language, invite, account settings (personal data) */}
            <ProfilePreferences signedIn />
          </>
        )}
      </ScrollView>
      {cropSource ? (
        <AvatarCropModal
          source={cropSource}
          onCancel={() => setCropSource(null)}
          onSave={handleCroppedUpload}
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  topBarTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: c.textPrimary,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 16,
  },

  // Guest Card
  guestCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 24,
    alignItems: "center",
  },
  guestIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  guestSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: c.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  guestLoginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: "100%",
  },
  guestLoginBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: c.background,
  },

  // User Card
  userCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarWrap: {
    width: 68,
    height: 68,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: c.primary,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: "800",
    color: c.primary,
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.surface,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: c.primary,
  },
  userEmail: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 3,
  },
  userLocation: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 3,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: c.textSecondary,
  },

  // Generic Card
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#182B1F",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  pendingRequestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  pendingRequestTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
  },
  pendingRequestSub: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 1,
  },
  planSelector: {
    gap: 8,
  },
  planChip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#19221C",
    borderWidth: 1,
    borderColor: "#253329",
  },
  planChipActive: {
    backgroundColor: "#132E1D",
    borderColor: c.primary,
  },
  planChipPending: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "#F59E0B",
  },
  planNameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planName: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
  },
  planNameActive: {
    color: c.textPrimary,
    fontWeight: "700",
  },
  planNamePending: {
    color: "#FBBF24",
    fontWeight: "700",
  },
  pendingBadgeMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingBadgeMiniText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#F59E0B",
  },
  planPrice: {
    fontSize: 13,
    color: c.textMuted,
  },
  planPriceActive: {
    color: c.primary,
    fontWeight: "700",
  },
  planPricePending: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  cancelRequestBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  cancelRequestBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F59E0B",
  },

  // Form
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: c.textSecondary,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#19221C",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#253329",
    color: c.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  saveBtn: {
    backgroundColor: c.primary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: c.background,
  },
  accountActionsCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    gap: 12,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.subtle,
    paddingVertical: 13,
    borderRadius: 14,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingVertical: 13,
    borderRadius: 14,
  },
  deleteAccountBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: c.error,
  },
});
