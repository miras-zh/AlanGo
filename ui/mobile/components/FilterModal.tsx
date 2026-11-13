import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export interface FilterState {
  sport: string;
  facilityType: "all" | "arena" | "hall";
  maxPrice: number;
  amenities: string[];
}

export interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onReset: () => void;
  totalResultsCount: number;
}

const SPORTS_GRID = [
  { key: "Футбол", label: "Футбол", icon: "football-outline" },
  { key: "Теннис", label: "Теннис", icon: "tennisball-outline" },
  { key: "Баскетбол", label: "Баскетбол", icon: "basketball-outline" },
  { key: "Волейбол", label: "Волейбол", icon: "fitness-outline" },
  { key: "Сквош", label: "Сквош", icon: "disc-outline" },
  { key: "Падл", label: "Падл", icon: "baseball-outline" },
];

const AMENITIES_LIST = [
  { key: "Парковка", label: "Парковка", icon: "car-outline" },
  { key: "Раздевалка", label: "Раздевалка", icon: "shirt-outline" },
  { key: "Душ", label: "Душ", icon: "water-outline" },
  { key: "Wi-Fi", label: "Wi-Fi", icon: "wifi-outline" },
];

const PRICE_PRESETS = [
  { label: "до 15 000 ₸", max: 15000 },
  { label: "до 25 000 ₸", max: 25000 },
  { label: "до 50 000 ₸", max: 50000 },
];

export function FilterModal({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
  totalResultsCount,
}: FilterModalProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  // Sync whenever modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  const toggleSport = (sportName: string) => {
    hapticSelection();
    setLocalFilters((prev) => ({
      ...prev,
      sport: prev.sport === sportName ? "Все" : sportName,
    }));
  };

  const setFacilityType = (type: "all" | "arena" | "hall") => {
    hapticSelection();
    setLocalFilters((prev) => ({
      ...prev,
      facilityType: prev.facilityType === type ? "all" : type,
    }));
  };

  const toggleAmenity = (amenity: string) => {
    hapticSelection();
    setLocalFilters((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  const handleReset = () => {
    hapticImpact();
    const resetValues: FilterState = {
      sport: "Все",
      facilityType: "all",
      maxPrice: 50000,
      amenities: [],
    };
    setLocalFilters(resetValues);
    onReset();
  };

  const handleApply = () => {
    hapticImpact();
    onApply(localFilters);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Фильтры</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={10}
            >
              <Ionicons name="close" size={22} color={c.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Section 1: Sport Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Вид спорта</Text>
              <View style={styles.sportsGrid}>
                {SPORTS_GRID.map((s) => {
                  const isSelected = localFilters.sport === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      style={[
                        styles.sportCard,
                        isSelected && styles.sportCardSelected,
                      ]}
                      onPress={() => toggleSport(s.key)}
                    >
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark" size={12} color={c.background} />
                        </View>
                      )}
                      <Ionicons
                        name={s.icon as any}
                        size={22}
                        color={isSelected ? c.primary : c.textSecondary}
                      />
                      <Text
                        style={[
                          styles.sportText,
                          isSelected && styles.sportTextSelected,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Section 2: Facility Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Тип объекта</Text>
              <View style={styles.segmentedRow}>
                <Pressable
                  style={[
                    styles.segmentBtn,
                    localFilters.facilityType === "arena" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setFacilityType("arena")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      localFilters.facilityType === "arena" &&
                        styles.segmentTextActive,
                    ]}
                  >
                    Спорткомплекс
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segmentBtn,
                    localFilters.facilityType === "hall" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setFacilityType("hall")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      localFilters.facilityType === "hall" &&
                        styles.segmentTextActive,
                    ]}
                  >
                    Отдельный зал
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Section 3: Price Per Hour */}
            <View style={styles.section}>
              <View style={styles.priceHeaderRow}>
                <Text style={styles.sectionTitle}>Цена за час</Text>
                <Text style={styles.priceRangeLabel}>
                  до {localFilters.maxPrice.toLocaleString("ru-RU")} ₸
                </Text>
              </View>

              {/* Price Preset Chips */}
              <View style={styles.presetsRow}>
                {PRICE_PRESETS.map((p) => {
                  const isSelected = localFilters.maxPrice === p.max;
                  return (
                    <Pressable
                      key={p.label}
                      style={[
                        styles.presetChip,
                        isSelected && styles.presetChipActive,
                      ]}
                      onPress={() => {
                        hapticSelection();
                        setLocalFilters((prev) => ({ ...prev, maxPrice: p.max }));
                      }}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          isSelected && styles.presetTextActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Section 4: Amenities */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Удобства</Text>
              <View style={styles.amenitiesGrid}>
                {AMENITIES_LIST.map((a) => {
                  const isSelected = localFilters.amenities.includes(a.key);
                  return (
                    <Pressable
                      key={a.key}
                      style={[
                        styles.amenityCard,
                        isSelected && styles.amenityCardSelected,
                      ]}
                      onPress={() => toggleAmenity(a.key)}
                    >
                      <Ionicons
                        name={a.icon as any}
                        size={22}
                        color={isSelected ? c.primary : c.textSecondary}
                      />
                      <Text
                        style={[
                          styles.amenityText,
                          isSelected && styles.amenityTextSelected,
                        ]}
                      >
                        {a.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Sticky Actions Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Сбросить</Text>
            </Pressable>

            <Pressable style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>
                Показать ({totalResultsCount})
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: c.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  headerTitle: {
    ...typography.sectionTitle,
    color: c.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    maxHeight: 460,
  },
  scrollContent: {
    padding: spacing.screenHorizontal,
    gap: spacing.section,
  },
  section: {},
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: c.textPrimary,
    marginBottom: 12,
  },
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sportCard: {
    width: "31%",
    aspectRatio: 1.15,
    backgroundColor: c.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative",
  },
  sportCardSelected: {
    borderColor: c.primary,
    backgroundColor: "rgba(0, 201, 104, 0.12)",
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sportText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  sportTextSelected: {
    color: c.primary,
    fontWeight: "700",
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    borderColor: c.primary,
    backgroundColor: "rgba(0, 201, 104, 0.15)",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
  },
  segmentTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  priceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceRangeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: c.primary,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.smallChip,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  presetChipActive: {
    borderColor: c.primary,
    backgroundColor: "rgba(0, 201, 104, 0.15)",
  },
  presetText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  presetTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  amenitiesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amenityCard: {
    width: "23%",
    aspectRatio: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  amenityCardSelected: {
    borderColor: c.primary,
    backgroundColor: "rgba(0, 201, 104, 0.12)",
  },
  amenityText: {
    fontSize: 11,
    color: c.textSecondary,
    fontWeight: "500",
  },
  amenityTextSelected: {
    color: c.primary,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.screenHorizontal,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
    paddingBottom: 28,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: c.background,
  },
});

