import { useState, useMemo, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

export type SportFilterState = {
  sports: string[];
  surfaces: string[];
  amenities: string[];
  priceRange: string; // 'all' | 'under10' | '10to20' | 'above20'
};

export const DEFAULT_FILTERS: SportFilterState = {
  sports: [],
  surfaces: [],
  amenities: [],
  priceRange: "all",
};

export const SPORTS_LIST = [
  { id: "Футбол", label: "Футбол", icon: "football-outline" as const },
  { id: "Теннис", label: "Теннис", icon: "tennisball-outline" as const },
  { id: "Баскетбол", label: "Баскетбол", icon: "basketball-outline" as const },
  { id: "Волейбол", label: "Волейбол", icon: "baseball-outline" as const },
  { id: "Падел", label: "Падел", icon: "fitness-outline" as const },
  { id: "Настольный теннис", label: "Наст. теннис", icon: "disc-outline" as const },
];

export const SURFACES_LIST = [
  "Искусственный газон",
  "Натуральный газон",
  "Спортивный паркет",
  "Терафлекс",
  "Хард",
  "Резина",
];

export const AMENITIES_LIST = [
  { id: "shower", label: "Душевые кабины", icon: "water-outline" as const },
  { id: "locker", label: "Раздевалки со шкафчиками", icon: "file-tray-stacked-outline" as const },
  { id: "parking", label: "Собственная парковка", icon: "car-outline" as const },
  { id: "lighting", label: "Освещение для вечерней игры", icon: "flashlight-outline" as const },
  { id: "tribune", label: "Трибуны для зрителей", icon: "people-outline" as const },
  { id: "sauna", label: "Сауна после матча", icon: "flame-outline" as const },
  { id: "inventory", label: "Аренда мячей и манишек", icon: "shirt-outline" as const },
];

export const PRICE_RANGES = [
  { id: "all", label: "Любая цена" },
  { id: "under10", label: "До 10 000 ₸" },
  { id: "10to20", label: "10 000 — 20 000 ₸" },
  { id: "above20", label: "От 20 000 ₸" },
];

interface SportSearchFiltersModalProps {
  visible: boolean;
  filters: SportFilterState;
  matchedCount: number;
  onClose: () => void;
  onApply: (newFilters: SportFilterState) => void;
}

export function SportSearchFiltersModal({
  visible,
  filters,
  matchedCount,
  onClose,
  onApply,
}: SportSearchFiltersModalProps) {
  const [draft, setDraft] = useState<SportFilterState>(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters, visible]);

  const toggleSport = (sport: string) => {
    hapticSelection();
    setDraft((prev) => {
      const exists = prev.sports.includes(sport);
      return {
        ...prev,
        sports: exists ? prev.sports.filter((s) => s !== sport) : [...prev.sports, sport],
      };
    });
  };

  const toggleSurface = (surf: string) => {
    hapticSelection();
    setDraft((prev) => {
      const exists = prev.surfaces.includes(surf);
      return {
        ...prev,
        surfaces: exists ? prev.surfaces.filter((s) => s !== surf) : [...prev.surfaces, surf],
      };
    });
  };

  const toggleAmenity = (amenityId: string) => {
    hapticSelection();
    setDraft((prev) => {
      const exists = prev.amenities.includes(amenityId);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenityId)
          : [...prev.amenities, amenityId],
      };
    });
  };

  const setPrice = (rangeId: string) => {
    hapticSelection();
    setDraft((prev) => ({ ...prev, priceRange: rangeId }));
  };

  const handleReset = () => {
    hapticSelection();
    setDraft(DEFAULT_FILTERS);
  };

  const handleApply = () => {
    hapticSuccess();
    onApply(draft);
    onClose();
  };

  const activeFiltersCount = useMemo(() => {
    let count = draft.sports.length + draft.surfaces.length + draft.amenities.length;
    if (draft.priceRange !== "all") count += 1;
    return count;
  }, [draft]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Фильтры</Text>
              {activeFiltersCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerActions}>
              {activeFiltersCount > 0 && (
                <Pressable onPress={handleReset} style={styles.resetBtn} hitSlop={8}>
                  <Text style={styles.resetBtnText}>Сбросить</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  hapticSelection();
                  onClose();
                }}
                style={styles.closeBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color="#8E9B94" />
              </Pressable>
            </View>
          </View>

          {/* Scrollable Filters */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Виды спорта */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Вид спорта</Text>
              <View style={styles.chipsWrap}>
                {SPORTS_LIST.map((sport) => {
                  const active = draft.sports.includes(sport.id);
                  return (
                    <Pressable
                      key={sport.id}
                      onPress={() => toggleSport(sport.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Ionicons
                        name={sport.icon}
                        size={16}
                        color={active ? "#22C55E" : "#8E9B94"}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {sport.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Тип покрытия */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Покрытие площадки</Text>
              <View style={styles.chipsWrap}>
                {SURFACES_LIST.map((surf) => {
                  const active = draft.surfaces.includes(surf);
                  return (
                    <Pressable
                      key={surf}
                      onPress={() => toggleSurface(surf)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {surf}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3. Диапазон цен */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Стоимость в час</Text>
              <View style={styles.chipsWrap}>
                {PRICE_RANGES.map((p) => {
                  const active = draft.priceRange === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPrice(p.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 4. Удобства и инфраструктура */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Удобства и инвентарь</Text>
              <View style={styles.amenitiesList}>
                {AMENITIES_LIST.map((amenity) => {
                  const active = draft.amenities.includes(amenity.id);
                  return (
                    <Pressable
                      key={amenity.id}
                      onPress={() => toggleAmenity(amenity.id)}
                      style={[styles.amenityRow, active && styles.amenityRowActive]}
                    >
                      <View style={styles.amenityLeft}>
                        <Ionicons
                          name={amenity.icon}
                          size={20}
                          color={active ? "#22C55E" : "#8E9B94"}
                        />
                        <Text style={[styles.amenityLabel, active && styles.amenityLabelActive]}>
                          {amenity.label}
                        </Text>
                      </View>
                      <Ionicons
                        name={active ? "checkbox" : "square-outline"}
                        size={22}
                        color={active ? "#22C55E" : "#4A5851"}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Apply CTA */}
          <View style={styles.bottomBar}>
            <Pressable onPress={handleApply} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>
                {matchedCount > 0
                  ? `Показать ${matchedCount} ${getDeclension(matchedCount, "площадку", "площадки", "площадок")}`
                  : "Показать площадки"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#0B0F0D" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function getDeclension(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#111714",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2621",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: "#0B0F0D",
    fontSize: 12,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  resetBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A231F",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 22,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "#17211C",
    borderWidth: 1,
    borderColor: "#223129",
  },
  chipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22C55E",
  },
  chipText: {
    color: "#C2CEC7",
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  amenitiesList: {
    gap: 8,
  },
  amenityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#161E1A",
    borderWidth: 1,
    borderColor: "#202C26",
  },
  amenityRowActive: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.06)",
  },
  amenityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  amenityLabel: {
    color: "#D4DDD7",
    fontSize: 14,
    fontWeight: "500",
  },
  amenityLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 12 : 20,
    borderTopWidth: 1,
    borderTopColor: "#1C2621",
    backgroundColor: "#111714",
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22C55E",
    paddingVertical: 15,
    borderRadius: 16,
  },
  applyBtnText: {
    color: "#0B0F0D",
    fontSize: 16,
    fontWeight: "700",
  },
});

