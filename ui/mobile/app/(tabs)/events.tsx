import React, { useState, useMemo } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/constants/theme";
import {
  DEFAULT_EVENT_FILTERS,
  EventFilterState,
  INITIAL_EVENTS,
  SportCategoryId,
  SPORT_CATEGORIES,
  SportEvent,
  filterEvents,
  eventCategory,
  eventDate,
  eventDetails,
} from "@/lib/eventsData";
import { EventCard } from "@/components/EventCard";
import { EventsFilterModal } from "@/components/EventsFilterModal";
import { EventCalendarModal } from "@/components/EventCalendarModal";
import { GlassSurface } from "@/components/GlassSurface";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { useT } from "@/lib/i18n";

function AllDotsIcon({ color }: { color: string }) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.allDotsWrap}>
      <View style={[styles.dotCircle, { borderColor: color }]} />
      <View style={[styles.dotCircle, { borderColor: color }]} />
      <View style={[styles.dotCircle, { borderColor: color }]} />
      <View style={[styles.dotCircle, { borderColor: color }]} />
    </View>
  );
}

function getCategoryIcon(id: SportCategoryId, color: string) {
  switch (id) {
    case "all":
      return <AllDotsIcon color={color} />;
    case "football":
      return <Ionicons name="football-outline" size={20} color={color} />;
    case "tennis":
      return <Ionicons name="tennisball-outline" size={20} color={color} />;
    case "basketball":
      return <Ionicons name="basketball-outline" size={20} color={color} />;
    case "padel":
      return <Ionicons name="disc-outline" size={20} color={color} />;
    case "other":
    default:
      return <Ionicons name="ellipsis-horizontal" size={20} color={color} />;
  }
}

export default function EventsScreen() {
  const t = useT();
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [events, setEvents] = useState<SportEvent[]>(INITIAL_EVENTS);
  const [filters, setFilters] = useState<EventFilterState>(DEFAULT_EVENT_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleToggleFavorite = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, isFavorite: !e.isFavorite } : e
      )
    );
  };

  const handleRegister = (event: SportEvent) => {
    Alert.alert(
      t("events.registerTitle"),
      t("events.registeredText", { title: event.title, date: eventDate(event, t), time: event.time, location: event.location }),
      [{ text: t("home.great") }]
    );
  };

  // Filtered upcoming events list
  const filteredEvents = useMemo(() => {
    return filterEvents(events, filters);
  }, [events, filters]);

  const hasAdvancedFilters =
    filters.eventType !== "all" ||
    filters.priceRange !== "all" ||
    filters.onlyWithSpots;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 1. Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>{t("events.title")}</Text>
          <Text style={styles.subtitle}>
            {t("events.subtitle")}
          </Text>
        </View>

        {/* Floating Glass Buttons (Calendar & Filters) */}
        <View style={styles.headerActions}>
          <Pressable
            style={styles.glassCircleBtn}
            onPress={() => {
              hapticSelection();
              setCalendarModalVisible(true);
            }}
          >
            <GlassSurface
              borderRadius={22}
              style={styles.glassBtnInner}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={c.textPrimary}
              />
            </GlassSurface>
          </Pressable>

          <Pressable
            style={styles.glassCircleBtn}
            onPress={() => {
              hapticSelection();
              setFilterModalVisible(true);
            }}
          >
            <GlassSurface
              borderRadius={22}
              style={[
                styles.glassBtnInner,
                hasAdvancedFilters && styles.glassBtnInnerActive,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={c.textPrimary}
              />
              {/* Notification Red Indicator Badge */}
              <View style={styles.redDot} />
            </GlassSurface>
          </Pressable>
        </View>
      </View>

      {/* 2. Sport Category Squircle Buttons */}
      <View style={styles.categoriesSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {SPORT_CATEGORIES.map((cat) => {
            const isSelected = filters.sportCategory === cat.id;
            const iconColor = isSelected ? c.primary : c.textSecondary;

            return (
              <Pressable
                key={cat.id}
                style={styles.categoryItemPressable}
                onPress={() => {
                  hapticSelection();
                  setFilters((prev) => ({
                    ...prev,
                    sportCategory: cat.id,
                  }));
                }}
              >
                <GlassSurface
                  borderRadius={18}
                  variant={isSelected ? "selected" : "default"}
                  glow={isSelected}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                  ]}
                >
                  <View style={styles.categoryIconWrap}>
                    {getCategoryIcon(cat.id, iconColor)}
                  </View>
                  <Text
                    style={[
                      styles.categoryLabel,
                      isSelected && styles.categoryLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {t(cat.label)}
                  </Text>
                </GlassSurface>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Section Title & "Все события >" Navigation */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("events.upcoming")}</Text>
        <Pressable
          style={styles.allEventsLink}
          onPress={() => {
            hapticSelection();
            router.push("/events/all");
          }}
          hitSlop={8}
        >
          <Text style={styles.allEventsText}>{t("events.all")}</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={c.primary}
            style={{ marginLeft: 2 }}
          />
        </Pressable>
      </View>

      {/* 4. Compact Event Cards List */}
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
        contentContainerStyle={styles.eventsListContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => {
              Alert.alert(
                item.title,
                eventDetails(item, t)
              );
            }}
            onRegister={() => handleRegister(item)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name="calendar-clear-outline"
              size={48}
              color={c.textSecondary}
            />
            <Text style={styles.emptyTitle}>{t("events.emptyCategory")}</Text>
            <Text style={styles.emptySubtitle}>
              {t("events.emptyCategoryText")}
            </Text>
            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                hapticImpact();
                setFilters(DEFAULT_EVENT_FILTERS);
              }}
            >
              <Text style={styles.resetBtnText}>{t("events.resetCategory")}</Text>
            </Pressable>
          </View>
        }
      />

      {/* Modals */}
      <EventsFilterModal
        visible={filterModalVisible}
        filters={filters}
        matchedCount={filteredEvents.length}
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

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTitles: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: c.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  glassCircleBtn: {
    width: 44,
    height: 44,
  },
  glassBtnInner: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  glassBtnInnerActive: {
    borderColor: c.primary,
  },
  redDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.accent,
  },
  allDotsWrap: {
    width: 18,
    height: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "space-between",
  },
  dotCircle: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  categoriesSection: {
    marginBottom: 18,
  },
  categoriesContent: {
    paddingHorizontal: spacing.screenHorizontal,
    gap: 9,
  },
  categoryItemPressable: {
    width: 58,
    height: 68,
  },
  categoryCard: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  categoryCardSelected: {
    backgroundColor: "rgba(0, 201, 104, 0.18)",
    borderColor: c.primary,
  },
  categoryIconWrap: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: c.textSecondary,
    textAlign: "center",
  },
  categoryLabelSelected: {
    color: c.primary,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.textPrimary,
  },
  allEventsLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  allEventsText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.primary,
  },
  eventsListContent: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: spacing.bottomScrollPadding, // 110px padding under floating pill
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  resetBtn: {
    marginTop: 16,
    backgroundColor: "rgba(0, 201, 104, 0.15)",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radii.smallChip,
    borderWidth: 1,
    borderColor: c.primary,
  },
  resetBtnText: {
    color: c.primary,
    fontSize: 13,
    fontWeight: "600",
  },
});
