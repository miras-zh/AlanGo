import { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSessionUser, subscribeAuth, updateSessionUser } from "@/lib/auth";
import { deleteAccountApi, logoutCurrentSession } from "@/lib/registration";
import {
  cancelSubscriptionRequest,
  changeMySubscriptionPlan,
  requestSubscriptionPlan,
  fetchMySubscription,
  SubscriptionInfo,
  updateMyProfile,
  uploadAvatar,
} from "@/lib/user";
import { pickImageAsJpeg, type PickedPhoto } from "@/lib/pickImage";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { BusinessAccountCard } from "@/components/BusinessAccountCard";
import { colors } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(getSessionUser());
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
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
      Alert.alert("Ошибка", getErrorMessage(err, "Не удалось открыть галерею"));
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
      Alert.alert("Не удалось загрузить фото", getErrorMessage(err));
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
      if (u) {
        fetchMySubscription().then(setSub).catch(() => {});
      } else {
        setSub(null);
      }
    });
  }, []);

  useEffect(() => {
    if (getSessionUser()) {
      fetchMySubscription()
        .then((s) => setSub(s))
        .catch(() => {});
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({ name: name.trim(), phone: phone.trim(), city: city.trim() });
      hapticSuccess();
      Alert.alert("Успешно", "Данные профиля обновлены!");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = async (newPlan: string) => {
    if (newPlan === (sub?.plan || "pro")) {
      Alert.alert("Текущий тариф", "Этот тариф уже активирован в вашем аккаунте.");
      return;
    }

    if (
      sub?.pending_request &&
      sub.pending_request.status === "pending" &&
      sub.pending_request.requested_plan === newPlan
    ) {
      Alert.alert(
        "Заявка на рассмотрении ⏳",
        `Ваша заявка на тариф ${newPlan.toUpperCase()} уже отправлена и находится на рассмотрении у администратора.`
      );
      return;
    }

    hapticSelection();
    try {
      const res = await requestSubscriptionPlan(newPlan);
      const fresh = await fetchMySubscription();
      setSub(fresh);
      hapticSuccess();
      Alert.alert(
        "Заявка отправлена 🎉",
        res.message || `Ваша заявка на тариф ${newPlan.toUpperCase()} успешно отправлена. Ожидайте подтверждения от администратора.`
      );
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    }
  };

  const handleCancelPending = () => {
    hapticImpact();
    Alert.alert(
      "Отмена заявки",
      "Вы действительно хотите отменить отправленную заявку на смену тарифа?",
      [
        { text: "Нет", style: "cancel" },
        {
          text: "Отменить заявку",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelSubscriptionRequest();
              const fresh = await fetchMySubscription();
              setSub(fresh);
              hapticSuccess();
              Alert.alert("Заявка отменена", "Заявка на смену тарифа успешно отменена.");
            } catch (e) {
              Alert.alert("Ошибка", getErrorMessage(e));
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    hapticImpact();
    Alert.alert(
      "Выход из аккаунта",
      "Вы действительно хотите выйти из своего аккаунта?",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Выйти",
          style: "destructive",
          onPress: async () => {
            await logoutCurrentSession();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    hapticImpact();
    Alert.alert(
      "Удаление аккаунта",
      "Вы действительно хотите удалить свой аккаунт? Все ваши бронирования, история и персональные данные будут безвозвратно стёрты в соответствии с требованиями Apple.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить навсегда",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccountApi();
              hapticSuccess();
              Alert.alert(
                "Аккаунт удален",
                "Ваш аккаунт и данные были успешно удалены."
              );
              router.replace("/login");
            } catch (e) {
              Alert.alert("Ошибка", getErrorMessage(e));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]} edges={["top"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Мой профиль</Text>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => {
            hapticSelection();
            router.push("/settings");
          }}
        >
          <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!user ? (
          /* Unauthenticated Guest State */
          <>
            <View style={styles.guestCard}>
              <View style={styles.guestIconWrap}>
                <Ionicons name="person-circle-outline" size={54} color="#22C55E" />
              </View>
              <Text style={styles.guestTitle}>Войдите в аккаунт</Text>
              <Text style={styles.guestSubtitle}>
                Авторизуйтесь, чтобы бронировать площадки, сохранять избранное и управлять абонементами.
              </Text>
              <Pressable
                style={styles.guestLoginBtn}
                onPress={() => {
                  hapticSelection();
                  router.push("/login");
                }}
              >
                <Ionicons name="log-in-outline" size={20} color="#0B0F0D" />
                <Text style={styles.guestLoginBtnText}>Войти / Зарегистрироваться</Text>
              </Pressable>
            </View>

            {/* Sports Subscriptions Card */}
            <Pressable
              style={[styles.card, { borderColor: "#059669", backgroundColor: "#111814" }]}
              onPress={() => {
                hapticSelection();
                router.push("/subscriptions");
              }}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <Ionicons name="ticket" size={20} color="#10b981" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardTitle}>Спортивные абонементы</Text>
                  <Text style={styles.cardSubtitle}>
                    Пакеты игр (8-12 тренировок), экономия до 25% и QR-пропуск
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#10b981" />
              </View>
            </Pressable>
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
                      <ActivityIndicator color={colors.textPrimary} />
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  hitSlop={8}
                  style={styles.avatarEditBadge}
                >
                  <Ionicons name="pencil" size={12} color={colors.background} />
                </Pressable>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{name || user.email?.split("@")[0] || "Пользователь"}</Text>
                  {sub?.plan && sub.plan !== "standard" && (
                    <View style={styles.proBadge}>
                      <Ionicons name="shield-checkmark" size={12} color="#22C55E" />
                      <Text style={styles.proBadgeText}>{sub.plan.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userEmail}>{user.email}</Text>
                {city ? <Text style={styles.userLocation}>📍 {city}</Text> : null}
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>14</Text>
                <Text style={styles.statLabel}>Игр сыграно</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>28 ч</Text>
                <Text style={styles.statLabel}>На корте</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>★ 4.9</Text>
                <Text style={styles.statLabel}>Рейтинг</Text>
              </View>
            </View>

            {/* Subscription Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="flash" size={20} color="#22C55E" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardTitle}>SportRent Club</Text>
                  <Text style={styles.cardSubtitle}>
                    Скидка 15% на дневные слоты и приоритетное бронирование
                  </Text>
                </View>
              </View>

              {/* Pending Tariff Application Banner */}
              {sub?.pending_request && sub.pending_request.status === "pending" && (
                <View style={styles.pendingRequestBanner}>
                  <View style={styles.pendingDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingRequestTitle}>
                      Заявка на {sub.pending_request.requested_plan.toUpperCase()}
                    </Text>
                    <Text style={styles.pendingRequestSub}>
                      Ожидает подтверждения от администратора
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleCancelPending}
                    style={styles.cancelRequestBtn}
                    hitSlop={8}
                  >
                    <Text style={styles.cancelRequestBtnText}>Отозвать</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.planSelector}>
                {[
                  { id: "standard", name: "Базовый", price: "0 ₸" },
                  { id: "pro", name: "PRO Клуб", price: "4 990 ₸ / мес" },
                  { id: "vip", name: "VIP Безлимит", price: "12 990 ₸ / мес" },
                ].map((p) => {
                  const active = (sub?.plan || "standard") === p.id;
                  const isPending =
                    sub?.pending_request?.status === "pending" &&
                    sub.pending_request.requested_plan === p.id;

                  return (
                    <Pressable
                      key={p.id}
                      style={[
                        styles.planChip,
                        active && styles.planChipActive,
                        isPending && styles.planChipPending,
                      ]}
                      onPress={() => handlePlanChange(p.id)}
                    >
                      <View style={styles.planNameWrap}>
                        <Text
                          style={[
                            styles.planName,
                            active && styles.planNameActive,
                            isPending && styles.planNamePending,
                          ]}
                        >
                          {p.name}
                        </Text>
                        {isPending && (
                          <View style={styles.pendingBadgeMini}>
                            <Ionicons name="time-outline" size={11} color="#F59E0B" />
                            <Text style={styles.pendingBadgeMiniText}>На рассмотрении</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.planPrice,
                          active && styles.planPriceActive,
                          isPending && styles.planPricePending,
                        ]}
                      >
                        {p.price}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Sports Subscriptions Card */}
            <Pressable
              style={[styles.card, { borderColor: "#059669", backgroundColor: "#111814" }]}
              onPress={() => {
                hapticSelection();
                router.push("/subscriptions");
              }}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <Ionicons name="ticket" size={20} color="#10b981" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardTitle}>Спортивные абонементы</Text>
                  <Text style={styles.cardSubtitle}>
                    Пакеты игр (8-12 тренировок), экономия до 25% и QR-пропуск
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#10b981" />
              </View>
            </Pressable>

            {/* Business account: create / open / disable / enable */}
            <BusinessAccountCard />

            {/* Edit Profile Form */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Персональные данные</Text>

              <Text style={styles.label}>ФИО</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="Ваше имя"
                placeholderTextColor="#6B7C72"
              />

              <Text style={styles.label}>Телефон</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                placeholder="+7 (___) ___-__-__"
                placeholderTextColor="#6B7C72"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Город</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                style={styles.input}
                placeholder="Город"
                placeholderTextColor="#6B7C72"
              />

              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? "Сохраняем..." : "Сохранить изменения"}</Text>
              </Pressable>
            </View>

            {/* Account Safety Actions (Apple Guideline 5.1.1) */}
            <View style={styles.accountActionsCard}>
              <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
              </Pressable>

              <Pressable style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
                <Ionicons name="trash-outline" size={17} color="#EF4444" />
                <Text style={styles.deleteAccountBtnText}>Удалить аккаунт</Text>
              </Pressable>
            </View>
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

const styles = StyleSheet.create({
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
    color: "#FFFFFF",
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#161D19",
    borderWidth: 1,
    borderColor: "#232F28",
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
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
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
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  guestSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#8E9B94",
    textAlign: "center",
    marginBottom: 20,
  },
  guestLoginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: "100%",
  },
  guestLoginBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B0F0D",
  },

  // User Card
  userCard: {
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
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
    borderColor: colors.primary,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary,
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
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
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
    color: "#FFFFFF",
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
    color: "#22C55E",
  },
  userEmail: {
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 3,
  },
  userLocation: {
    fontSize: 12,
    color: "#6B7C72",
    marginTop: 3,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#141A17",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2823",
    paddingVertical: 14,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#8E9B94",
  },

  // Generic Card
  card: {
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
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
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#8E9B94",
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
    color: "#D1D5DB",
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
    borderColor: "#22C55E",
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
    color: "#8E9B94",
  },
  planNameActive: {
    color: "#FFFFFF",
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
    color: "#6B7C72",
  },
  planPriceActive: {
    color: "#22C55E",
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
    color: "#FFFFFF",
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#19221C",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#253329",
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  saveBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  accountActionsCard: {
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
    padding: 16,
    gap: 12,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 13,
    borderRadius: 14,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
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
    color: "#EF4444",
  },
});
