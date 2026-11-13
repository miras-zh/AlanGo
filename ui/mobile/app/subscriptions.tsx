import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SUBSCRIPTION_PACKAGES,
  SubscriptionPackage,
  UserSubscription,
  getUserSubscriptions,
  buySubscription,
} from "@/lib/subscriptionsData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import * as Haptics from "expo-haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export default function SubscriptionsScreen() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"catalog" | "my">("catalog");
  const [userSubs, setUserSubs] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [activeQrSub, setActiveQrSub] = useState<UserSubscription | null>(null);

  const loadSubs = useCallback(async () => {
    const list = await getUserSubscriptions();
    setUserSubs(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const handleSelectToBuy = (pkg: SubscriptionPackage) => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPackage(pkg);
    setBuyModalVisible(true);
  };

  const handleConfirmBuy = async (method: "kaspi" | "card") => {
    if (!selectedPackage) return;
    setProcessing(true);
    hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);
    // Simulate payment processing
    setTimeout(async () => {
      const newSub = await buySubscription(selectedPackage);
      setProcessing(false);
      setBuyModalVisible(false);
      await loadSubs();
      setActiveTab("my");
      Alert.alert(
        "Абонемент оформлен! 🎉",
        `Вы успешно приобрели «${selectedPackage.title}» на ${selectedPackage.totalVisits} посещений. Он готов к использованию.`
      );
    }, 1200);
  };

  const handleShowQr = (sub: UserSubscription) => {
    hapticSelection();
    setActiveQrSub(sub);
    setQrModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Абонементы и Пакеты</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segment Switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, activeTab === "catalog" && styles.tabBtnActive]}
          onPress={() => {
            hapticSelection();
            setActiveTab("catalog");
          }}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "catalog" && styles.tabBtnTextActive,
            ]}
          >
            Витрина пакетов
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "my" && styles.tabBtnActive]}
          onPress={() => {
            hapticSelection();
            setActiveTab("my");
          }}
        >
          <View style={styles.row}>
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "my" && styles.tabBtnTextActive,
              ]}
            >
              Мои абонементы
            </Text>
            {userSubs.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{userSubs.length}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "catalog" ? (
          /* Catalog Tab */
          <View>
            {/* Promo Banner */}
            <View style={styles.heroPromo}>
              <View style={styles.heroPromoIcon}>
                <Ionicons name="sparkles" size={24} color={c.primary} />
              </View>
              <View style={styles.heroPromoText}>
                <Text style={styles.heroPromoTitle}>Экономия до 25% на играх</Text>
                <Text style={styles.heroPromoSubtitle}>
                  Покупайте пакеты тренировок заранее и бронируйте залы без очередей и переплат
                </Text>
              </View>
            </View>

            {/* List of Packages */}
            {SUBSCRIPTION_PACKAGES.map((pkg) => (
              <View key={pkg.id} style={styles.packageCard}>
                {pkg.popular && (
                  <View style={styles.popularBadge}>
                    <Ionicons name="flame" size={12} color={c.onPrimary} />
                    <Text style={styles.popularBadgeText}>ХИТ СЕЗОНА</Text>
                  </View>
                )}

                <View style={styles.packageHeader}>
                  <View style={[styles.packageIconWrap, { backgroundColor: pkg.gradient[0] }]}>
                    <Ionicons name={pkg.icon as any} size={24} color={c.textPrimary} />
                  </View>
                  <View style={styles.packageHeaderMeta}>
                    <Text style={styles.packageTitle}>{pkg.title}</Text>
                    <Text style={styles.packageSport}>{pkg.sportName} • {pkg.durationDays} дней</Text>
                  </View>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>{pkg.discountBadge}</Text>
                  </View>
                </View>

                {/* Features List */}
                <View style={styles.featuresList}>
                  {pkg.features.map((feat, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color={c.primary} />
                      <Text style={styles.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>

                {/* Price and CTA */}
                <View style={styles.packageFooter}>
                  <View>
                    <Text style={styles.regularPriceText}>
                      {pkg.regularPrice.toLocaleString("ru-RU")} ₸
                    </Text>
                    <Text style={styles.priceText}>
                      {pkg.price.toLocaleString("ru-RU")} <Text style={styles.priceCurrency}>₸</Text>
                    </Text>
                  </View>

                  <Pressable
                    style={styles.buyBtn}
                    onPress={() => handleSelectToBuy(pkg)}
                  >
                    <Text style={styles.buyBtnText}>Оформить</Text>
                    <Ionicons name="arrow-forward" size={16} color={c.onPrimary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          /* My Subscriptions Tab */
          <View>
            {loading ? (
              <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
            ) : userSubs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="ticket-outline" size={56} color="#475569" />
                <Text style={styles.emptyTitle}>У вас пока нет абонементов</Text>
                <Text style={styles.emptySubtitle}>
                  Выберите подходящий пакет тренировок в каталоге и экономьте на каждой игре
                </Text>
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => setActiveTab("catalog")}
                >
                  <Text style={styles.emptyBtnText}>Перейти к пакетам</Text>
                </Pressable>
              </View>
            ) : (
              userSubs.map((sub) => {
                const percentLeft = Math.round(
                  (sub.remainingVisits / sub.totalVisits) * 100
                );
                return (
                  <View key={sub.id} style={styles.mySubCard}>
                    <View style={styles.mySubHeader}>
                      <View>
                        <Text style={styles.mySubTitle}>{sub.title}</Text>
                        <Text style={styles.mySubSport}>{sub.sportName}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          sub.status === "active"
                            ? styles.statusActive
                            : styles.statusDepleted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            sub.status === "active"
                              ? styles.statusTextActive
                              : styles.statusTextDepleted,
                          ]}
                        >
                          {sub.status === "active" ? "Активен" : "Использован"}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressLabelLeft}>
                          Осталось посещений:
                        </Text>
                        <Text style={styles.progressLabelRight}>
                          <Text style={styles.progressBold}>
                            {sub.remainingVisits}
                          </Text>{" "}
                          из {sub.totalVisits}
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${percentLeft}%` },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.mySubFooter}>
                      <View>
                        <Text style={styles.metaLabel}>Действует до</Text>
                        <Text style={styles.metaValue}>{sub.expiresAt}</Text>
                      </View>

                      <Pressable
                        style={styles.qrBtn}
                        onPress={() => handleShowQr(sub)}
                      >
                        <Ionicons name="qr-code" size={18} color={c.primary} />
                        <Text style={styles.qrBtnText}>Показать QR</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Buy Package Modal */}
      <Modal
        visible={buyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBuyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Оформление абонемента</Text>
              <Pressable
                onPress={() => setBuyModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={c.textSecondary} />
              </Pressable>
            </View>

            {selectedPackage && (
              <View>
                <View style={styles.modalPkgSummary}>
                  <Text style={styles.modalPkgTitle}>{selectedPackage.title}</Text>
                  <Text style={styles.modalPkgDetails}>
                    {selectedPackage.totalVisits} игр • {selectedPackage.durationDays} дней срока
                  </Text>
                  <Text style={styles.modalPkgPrice}>
                    {selectedPackage.price.toLocaleString("ru-RU")} ₸
                  </Text>
                </View>

                <Text style={styles.paymentMethodTitle}>Способ оплаты:</Text>

                {processing ? (
                  <View style={styles.processingWrap}>
                    <ActivityIndicator size="large" color={c.primary} />
                    <Text style={styles.processingText}>
                      Оформление подписки и генерация пропуска...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.paymentMethods}>
                    <Pressable
                      style={styles.kaspiPayBtn}
                      onPress={() => handleConfirmBuy("kaspi")}
                    >
                      <View style={styles.kaspiBadge}>
                        <Text style={styles.kaspiBadgeText}>Kaspi</Text>
                      </View>
                      <Text style={styles.kaspiPayText}>Оплатить через Kaspi QR</Text>
                    </Pressable>

                    <Pressable
                      style={styles.cardPayBtn}
                      onPress={() => handleConfirmBuy("card")}
                    >
                      <Ionicons name="card-outline" size={22} color={c.textPrimary} />
                      <Text style={styles.cardPayText}>Банковской картой</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* QR Code Pass Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContainer}>
            <Pressable
              onPress={() => setQrModalVisible(false)}
              style={styles.qrCloseBtn}
            >
              <Ionicons name="close" size={24} color={c.textSecondary} />
            </Pressable>

            {activeQrSub && (
              <View style={styles.qrCenter}>
                <Ionicons name="shield-checkmark" size={32} color={c.primary} />
                <Text style={styles.qrTitle}>Электронный абонемент</Text>
                <Text style={styles.qrSubName}>{activeQrSub.title}</Text>

                <View style={styles.qrMockCard}>
                  <Ionicons name="qr-code-outline" size={180} color={c.onPrimary} />
                  <Text style={styles.qrTokenText}>{activeQrSub.qrCodeToken}</Text>
                </View>

                <Text style={styles.qrInstructions}>
                  Покажите этот QR-код на ресепшене или турникете спорткомплекса при входе
                </Text>

                <View style={styles.qrFooterMeta}>
                  <Text style={styles.qrMetaText}>
                    Осталось игр: {activeQrSub.remainingVisits} из {activeQrSub.totalVisits}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0d1310",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e2922",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: c.textPrimary,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: c.primary,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
  },
  tabBtnTextActive: {
    color: c.onPrimary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeCount: {
    backgroundColor: c.onPrimary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeCountText: {
    color: c.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroPromo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#162e24",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.primary,
    gap: 14,
  },
  heroPromoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#064e3b",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPromoText: {
    flex: 1,
  },
  heroPromoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 2,
  },
  heroPromoSubtitle: {
    fontSize: 12,
    color: "#a7f3d0",
    lineHeight: 16,
  },
  packageCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: 18,
    backgroundColor: c.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  popularBadgeText: {
    color: c.onPrimary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  packageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  packageIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  packageHeaderMeta: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: c.textPrimary,
  },
  packageSport: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 2,
  },
  discountBadge: {
    backgroundColor: "#1e3a2b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountBadgeText: {
    color: c.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  featuresList: {
    gap: 8,
    marginBottom: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.surfaceElevated,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: c.textSecondary,
  },
  packageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  regularPriceText: {
    fontSize: 12,
    color: c.textMuted,
    textDecorationLine: "line-through",
  },
  priceText: {
    fontSize: 22,
    fontWeight: "800",
    color: c.textPrimary,
  },
  priceCurrency: {
    fontSize: 16,
    color: c.primary,
  },
  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: c.onPrimary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: c.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  emptyBtnText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  mySubCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
  },
  mySubHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  mySubTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
  },
  mySubSport: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: "#064e3b",
  },
  statusDepleted: {
    backgroundColor: "#334155",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusTextActive: {
    color: c.primaryGlow,
  },
  statusTextDepleted: {
    color: c.textSecondary,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabelLeft: {
    fontSize: 13,
    color: c.textSecondary,
  },
  progressLabelRight: {
    fontSize: 13,
    color: c.textSecondary,
  },
  progressBold: {
    color: c.primary,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: c.surfaceElevated,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: c.primary,
    borderRadius: 4,
  },
  mySubFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: c.surfaceElevated,
    paddingTop: 12,
  },
  metaLabel: {
    fontSize: 11,
    color: c.textMuted,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
    marginTop: 2,
  },
  qrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#172b20",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.primary,
  },
  qrBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: c.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: c.surfaceElevated,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: c.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  modalPkgSummary: {
    backgroundColor: "#1a251f",
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  modalPkgTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
  },
  modalPkgDetails: {
    fontSize: 13,
    color: c.textSecondary,
    marginVertical: 4,
  },
  modalPkgPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: c.primary,
    marginTop: 4,
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
    marginBottom: 12,
  },
  paymentMethods: {
    gap: 12,
  },
  kaspiPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f14635",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  kaspiBadge: {
    backgroundColor: c.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kaspiBadgeText: {
    color: "#f14635",
    fontSize: 11,
    fontWeight: "900",
  },
  kaspiPayText: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  cardPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2e24",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#2d4234",
  },
  cardPayText: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  processingWrap: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 12,
  },
  processingText: {
    color: c.textSecondary,
    fontSize: 14,
  },
  qrModalContainer: {
    backgroundColor: c.surface,
    marginHorizontal: 20,
    marginTop: "auto",
    marginBottom: "auto",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
    position: "relative",
  },
  qrCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  qrCenter: {
    alignItems: "center",
    paddingTop: 10,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.textPrimary,
    marginTop: 8,
  },
  qrSubName: {
    fontSize: 14,
    color: c.textSecondary,
    marginBottom: 20,
  },
  qrMockCard: {
    backgroundColor: c.textPrimary,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  qrTokenText: {
    color: c.onPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
  },
  qrInstructions: {
    fontSize: 12,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  qrFooterMeta: {
    backgroundColor: "#1a251f",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  qrMetaText: {
    fontSize: 13,
    fontWeight: "700",
    color: c.primary,
  },
});
