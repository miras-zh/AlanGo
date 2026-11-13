import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/constants/theme";
import { SportEvent } from "@/lib/eventsData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export interface EventCardProps {
  event: SportEvent;
  onPress: () => void;
  onRegister: () => void;
  onToggleFavorite: () => void;
}

export function EventCard({
  event,
  onPress,
  onRegister,
  onToggleFavorite,
}: EventCardProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
    >
      {/* Left: Compact Event Thumbnail with category tag */}
      <View style={styles.thumbnailWrapper}>
        <Image
          source={{ uri: event.imageUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        {/* Category Pill on Image */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText} numberOfLines={1}>
            {event.categoryLabel}
          </Text>
        </View>
      </View>

      {/* Right: Event Info */}
      <View style={styles.infoWrapper}>
        {/* Top: Title + Favorite Heart */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              hapticImpact();
              onToggleFavorite();
            }}
            style={styles.heartBtn}
          >
            <Ionicons
              name={event.isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={event.isFavorite ? c.accent : c.textPrimary}
            />
          </Pressable>
        </View>

        {/* Date & Time */}
        <View style={styles.metaRow}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={c.textSecondary}
            style={styles.metaIcon}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {event.date} · {event.time}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.metaRow}>
          <Ionicons
            name="location-outline"
            size={13}
            color={c.textSecondary}
            style={styles.metaIcon}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {event.location}
          </Text>
        </View>

        {/* Bottom Row: Price + Join Button */}
        <View style={styles.bottomRow}>
          <Text style={styles.priceText} numberOfLines={1}>
            {event.price}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.registerBtn,
              pressed && styles.registerBtnPressed,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              hapticSelection();
              onRegister();
            }}
          >
            <Text style={styles.registerBtnText}>Записаться</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: c.glassBackground,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.subtle,
    padding: 10,
    marginBottom: spacing.card,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  thumbnailWrapper: {
    width: 116,
    height: 112,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: c.surfaceElevated,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  categoryBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    maxWidth: 104,
    backgroundColor: c.glassBackground,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 201, 104, 0.4)",
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: c.primary,
  },
  infoWrapper: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: c.textPrimary,
    marginRight: 6,
  },
  heartBtn: {
    padding: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  metaIcon: {
    marginRight: 5,
  },
  metaText: {
    fontSize: 12,
    color: c.textSecondary,
    flex: 1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  priceText: {
    fontSize: 15,
    fontWeight: "800",
    color: c.textPrimary,
  },
  registerBtn: {
    backgroundColor: c.primary,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
  },
  registerBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  registerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: c.background,
  },
});
