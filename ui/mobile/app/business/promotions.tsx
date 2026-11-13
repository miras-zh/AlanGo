import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Promotion,
  getPromotions,
  togglePromotion,
} from "@/lib/promotionsData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import * as Haptics from "expo-haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT, type MessageKey, type TFunction } from "@/lib/i18n";

// Built-in demo promotions are stored on the device in Russian; show them in
// the selected language by id. Custom promotions are shown as stored.
const PROMO_KEYS: Record<string, string> = {
  "promo-happy-hours": "promo.happy",
  "promo-hot-slot": "promo.hot",
  "promo-welcome": "promo.welcome",
};

type PromoField = "title" | "tagline" | "badge" | "description" | "conditions";

function promoText(p: Promotion, field: PromoField, t: TFunction): string {
  const base = PROMO_KEYS[p.id];
  return base ? t(`${base}.${field}` as MessageKey) : p[field];
}

export default function BusinessPromotionsScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPromos = useCallback(async () => {
    const list = await getPromotions();
    setPromos(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  const handleToggle = async (id: string) => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
    const updated = await togglePromotion(id);
    setPromos(updated);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("promo.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoBanner}>
          <Ionicons name="trending-up" size={24} color={c.primary} />
          <View style={styles.infoBannerText}>
            <Text style={styles.infoBannerTitle}>{t("promo.dynamic")}</Text>
            <Text style={styles.infoBannerSubtitle}>
              {t("promo.dynamicText")}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("promo.activeMechanics")}</Text>

        {promos.map((p) => (
          <View key={p.id} style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: p.bannerGradient[0] },
                ]}
              >
                <Ionicons name={p.icon as any} size={22} color={c.textPrimary} />
              </View>
              <View style={styles.promoMeta}>
                <View style={styles.row}>
                  <Text style={styles.promoTitle}>{promoText(p, "title", t)}</Text>
                </View>
                <Text style={styles.promoTagline}>{promoText(p, "tagline", t)}</Text>
              </View>
              <Switch
                value={p.isEnabled}
                onValueChange={() => handleToggle(p.id)}
                trackColor={{ false: "#334155", true: c.primary }}
                thumbColor={p.isEnabled ? c.primary : c.textSecondary}
              />
            </View>

            <Text style={styles.promoDesc}>{promoText(p, "description", t)}</Text>

            <View style={styles.conditionBox}>
              <Ionicons name="information-circle-outline" size={16} color={c.textSecondary} />
              <Text style={styles.conditionText}>{promoText(p, "conditions", t)}</Text>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>{promoText(p, "badge", t)}</Text>
              </View>
              {p.promoCode && (
                <View style={styles.codeWrap}>
                  <Text style={styles.codeText}>{t("promo.code", { code: p.promoCode })}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        <Pressable
          style={styles.addCustomBtn}
          onPress={() => {
            hapticSelection();
            Alert.alert(
              t("promo.customTitle"),
              t("promo.customText")
            );
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={c.primary} />
          <Text style={styles.addCustomText}>{t("promo.createCustom")}</Text>
        </Pressable>
      </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#13231a",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e3d2a",
    gap: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 4,
  },
  infoBannerSubtitle: {
    fontSize: 12,
    color: c.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textMuted,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  promoCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
  },
  promoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  promoMeta: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
  },
  promoTagline: {
    fontSize: 12,
    color: c.primary,
    marginTop: 2,
  },
  promoDesc: {
    fontSize: 13,
    color: c.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  conditionBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1b2520",
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  conditionText: {
    flex: 1,
    fontSize: 12,
    color: c.textSecondary,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeWrap: {
    backgroundColor: "#1e3a2b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: c.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  codeWrap: {
    backgroundColor: c.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2d4234",
  },
  codeText: {
    color: c.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  addCustomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.primary,
    marginTop: 8,
  },
  addCustomText: {
    color: c.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
