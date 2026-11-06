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

export default function BusinessPromotionsScreen() {
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
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </Pressable>
        <Text style={styles.headerTitle}>Маркетинг и Акции</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoBanner}>
          <Ionicons name="trending-up" size={24} color="#10b981" />
          <View style={styles.infoBannerText}>
            <Text style={styles.infoBannerTitle}>Динамическое ценообразование</Text>
            <Text style={styles.infoBannerSubtitle}>
              Включение скидок в непиковые дневные часы повышает среднюю загрузку залов на 35-40% и привлекает корпоративные команды.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>АКТИВНЫЕ МЕХАНИКИ СКИТОК</Text>

        {promos.map((p) => (
          <View key={p.id} style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: p.bannerGradient[0] },
                ]}
              >
                <Ionicons name={p.icon as any} size={22} color="#fff" />
              </View>
              <View style={styles.promoMeta}>
                <View style={styles.row}>
                  <Text style={styles.promoTitle}>{p.title}</Text>
                </View>
                <Text style={styles.promoTagline}>{p.tagline}</Text>
              </View>
              <Switch
                value={p.isEnabled}
                onValueChange={() => handleToggle(p.id)}
                trackColor={{ false: "#334155", true: "#059669" }}
                thumbColor={p.isEnabled ? "#10b981" : "#94a3b8"}
              />
            </View>

            <Text style={styles.promoDesc}>{p.description}</Text>

            <View style={styles.conditionBox}>
              <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
              <Text style={styles.conditionText}>{p.conditions}</Text>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>{p.badge}</Text>
              </View>
              {p.promoCode && (
                <View style={styles.codeWrap}>
                  <Text style={styles.codeText}>Промокод: {p.promoCode}</Text>
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
              "Кастомная промо-акция",
              "Для создания индивидуального сезонного турнира или специального корпоративного тарифа свяжитесь с поддержкой AlanGo Business."
            );
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color="#10b981" />
          <Text style={styles.addCustomText}>Создать индивидуальную акцию</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#17231c",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
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
    color: "#f8fafc",
    marginBottom: 4,
  },
  infoBannerSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  promoCard: {
    backgroundColor: "#151d18",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#223127",
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
    color: "#f8fafc",
  },
  promoTagline: {
    fontSize: 12,
    color: "#10b981",
    marginTop: 2,
  },
  promoDesc: {
    fontSize: 13,
    color: "#cbd5e1",
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
    color: "#94a3b8",
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
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },
  codeWrap: {
    backgroundColor: "#17231c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2d4234",
  },
  codeText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "600",
  },
  addCustomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17231c",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#059669",
    marginTop: 8,
  },
  addCustomText: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "700",
  },
});
