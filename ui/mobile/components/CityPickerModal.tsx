import { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KZ_CITIES, TOP_CITIES, setSelectedCity } from "@/lib/cities";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

interface CityPickerModalProps {
  visible: boolean;
  selectedCity: string;
  onClose: () => void;
  onSelect: (city: string) => void;
}

export function CityPickerModal({
  visible,
  selectedCity,
  onClose,
  onSelect,
}: CityPickerModalProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState("");

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KZ_CITIES;
    return KZ_CITIES.filter((city) => city.toLowerCase().includes(q));
  }, [query]);

  const handleSelect = async (city: string) => {
    hapticSuccess();
    await setSelectedCity(city);
    onSelect(city);
    onClose();
    setQuery("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="location" size={22} color={c.primary} />
              <Text style={styles.title}>Города Казахстана</Text>
            </View>
            <Pressable
              onPress={() => {
                hapticSelection();
                onClose();
              }}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>

          {/* Quick Select Top Cities */}
          <View style={styles.topCitiesContainer}>
            <Text style={styles.sectionLabel}>Популярные города</Text>
            <View style={styles.topCitiesRow}>
              {TOP_CITIES.map((city) => {
                const isSelected = selectedCity === city;
                return (
                  <Pressable
                    key={city}
                    onPress={() => handleSelect(city)}
                    style={[
                      styles.topCityChip,
                      isSelected && styles.topCityChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.topCityText,
                        isSelected && styles.topCityTextActive,
                      ]}
                    >
                      {city}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={c.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск города..."
              placeholderTextColor={c.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS === "android" && (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={c.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* City List */}
          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = selectedCity === item;
              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.cityRow,
                    isSelected && styles.cityRowActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.cityName,
                      isSelected && styles.cityNameActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={32} color="#38433D" />
                <Text style={styles.emptyText}>Город не найден</Text>
              </View>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: "60%",
    paddingBottom: Platform.OS === "ios" ? 16 : 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceElevated,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  topCitiesContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionLabel: {
    color: c.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  topCitiesRow: {
    flexDirection: "row",
    gap: 10,
  },
  topCityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: "#23332B",
  },
  topCityChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: c.primary,
  },
  topCityText: {
    color: "#E2E8E4",
    fontSize: 13,
    fontWeight: "600",
  },
  topCityTextActive: {
    color: c.primary,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    color: c.textPrimary,
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceElevated,
  },
  cityRowActive: {
    borderBottomColor: "rgba(34, 197, 94, 0.2)",
  },
  cityName: {
    color: c.textSecondary,
    fontSize: 16,
    fontWeight: "500",
  },
  cityNameActive: {
    color: c.primary,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    gap: 8,
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 14,
  },
});

