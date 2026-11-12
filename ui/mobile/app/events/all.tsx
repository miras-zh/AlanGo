import React, { useState, useMemo } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/constants/theme";
import {
  DEFAULT_EVENT_FILTERS,
  EventFilterState,
  INITIAL_EVENTS,
  SportCategoryId,
  SPORT_CATEGORIES,
  SportEvent,
  filterEvents,
} from "@/lib/eventsData";
import { EventCard } from "@/components/EventCard";
import { EventsFilterModal } from "@/components/EventsFilterModal";
import { EventCalendarModal } from "@/components/EventCalendarModal";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

export default function AllEventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<SportEvent[]>(INITIAL_EVENTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<EventFilterState>(DEFAULT_EVENT_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  // Toggle favorite
  const handleToggleFavorite = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, isFavorite: !e.isFavorite } : e
      )
    );
  };

  // Join action
  const handleRegister = (event: SportEvent) => {
    Alert.alert(
      "Запись на событие",
      `Вы успешно подали заявку на участие в «${event.title}». Организатор свяжется с вами для подтверждения.`,
      [{ text: "Отлично" }]
    );
  };

  // Filtered list
  const filteredList = useMemo(() => {
    let list = filterEvents(events, filters);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.categoryLabel.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, filters, searchQuery]);

  const hasAdvancedFilters =
    filters.eventType !== "all" ||
    filters.priceRange !== "all" ||
    filters.onlyWithSpots;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>

        <Text style={styles.screenTitle}>Все события</Text>

        <View style={styles.headerControls}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => {
              hapticSelection();
              setCalendarModalVisible(true);
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            style={[styles.iconBtn, hasAdvancedFilters && styles.iconBtnActive]}
            onPress={() => {
              hapticSelection();
              setFilterModalVisible(true);
            }}
          >
            <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
            {hasAdvancedFilters && <View style={styles.badgeDot} />}
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по турнирам и играм..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Sport Category Filter Chips */}
      <View style={styles.categoriesWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SPORT_CATEGORIES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoriesContent}
          renderItem={({ item }) => {
            const isSelected = filters.sportCategory === item.id;
            return (
              <Pressable
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                ]}
                onPress={() => {
                  hapticSelection();
                  setFilters((prev) => ({
                    ...prev,
                    sportCategory: item.id as SportCategoryId,
                  }));
                }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Events List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => {
              Alert.alert(item.title, `${item.categoryLabel}\n${item.date} · ${item.time}\n${item.location}\nЦена: ${item.price}`);
            }}
            onRegister={() => handleRegister(item)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-clear-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Событий не найдено</Text>
            <Text style={styles.emptySub}>
              Попробуйте изменить категорию или сбросить фильтры
            </Text>
            <Pressable
              style={styles.resetFiltersBtn}
              onPress={() => {
                hapticImpact();
                setFilters(DEFAULT_EVENT_FILTERS);
                setSearchQuery("");
              }}
            >
              <Text style={styles.resetFiltersBtnText}>Сбросить фильтры</Text>
            </Pressable>
          </View>
        }
      />

      {/* Modals */}
      <EventsFilterModal
        visible={filterModalVisible}
        filters={filters}
        matchedCount={filteredList.length}
        onClose={() => setFilterModalVisible(false)}
        onApply={(newFilters) => setFilters(newFilters)}
        onReset={() => setFilters(DEFAULT_EVENT_FILTERS)}
      />

      <EventCalendarModal
        visible={calendarModalVisible}
        selectedDate={filters.dateFilter}
        onClose={() => setCalendarModalVisible(false)}
        onSelectDate={(dateKey) =>
          setFilters((prev) => ({ ...prev, dateFilter: dateKey }))
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
  },
  iconBtnActive: {
    borderColor: colors.primary,
  },
  badgeDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
  searchBarWrap: {
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: radii.button,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  categoriesWrap: {
    marginBottom: 14,
  },
  categoriesContent: {
    paddingHorizontal: spacing.screenHorizontal,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.smallChip,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  categoryChipSelected: {
    backgroundColor: "rgba(0, 201, 104, 0.16)",
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  categoryChipTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  resetFiltersBtn: {
    marginTop: 16,
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resetFiltersBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
});
