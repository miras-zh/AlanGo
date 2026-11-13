import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export interface VenueCardProps {
  id: number | string;
  title: string;
  imageUrl?: string;
  address: string;
  distance?: string;
  rating: number;
  reviewsCount?: number;
  pricePerHour: number;
  sportType?: string;
  specs?: string;
  availableTimeText?: string;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

function getSportIcon(sport?: string): keyof typeof Ionicons.glyphMap {
  if (!sport) return "fitness-outline";
  const s = sport.toLowerCase();
  if (s.includes("футбол")) return "football-outline";
  if (s.includes("теннис")) return "tennisball-outline";
  if (s.includes("баскетбол")) return "basketball-outline";
  if (s.includes("волейбол")) return "fitness-outline";
  if (s.includes("падл") || s.includes("сквош")) return "disc-outline";
  return "fitness-outline";
}

export function VenueCard({
  title,
  imageUrl,
  address,
  distance,
  rating,
  reviewsCount,
  pricePerHour,
  sportType,
  specs,
  availableTimeText,
  isFavorite = false,
  onPress,
  onToggleFavorite,
}: VenueCardProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const formattedPrice = (pricePerHour || 0).toLocaleString("ru-RU");

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
      {/* 1. Left: Compact Thumbnail Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name={getSportIcon(sportType)}
              size={26}
              color={c.textSecondary}
            />
          </View>
        )}

        {/* Favorite Button (top right of thumbnail) */}
        {onToggleFavorite && (
          <Pressable
            style={({ pressed }) => [
              styles.favoriteBtn,
              pressed && { transform: [{ scale: 0.9 }] },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              hapticImpact();
              onToggleFavorite();
            }}
            hitSlop={6}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={13}
              color={isFavorite ? c.accent : c.textPrimary}
            />
          </Pressable>
        )}
      </View>

      {/* 2. Right: Information Content */}
      <View style={styles.content}>
        {/* Title (Up to 2 lines) */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Rating & Reviews */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={13} color={c.primary} />
          <Text style={styles.ratingValue}>{rating ? rating.toFixed(1) : "5.0"}</Text>
          {reviewsCount !== undefined && (
            <Text style={styles.reviewsCount}>({reviewsCount})</Text>
          )}
        </View>

        {/* Address and Distance */}
        {address ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="location-outline"
              size={12}
              color={c.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {address}
              {distance ? ` · ${distance}` : ""}
            </Text>
          </View>
        ) : distance ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="location-outline"
              size={12}
              color={c.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {distance}
            </Text>
          </View>
        ) : null}

        {/* Characteristics (if available) */}
        {specs ? (
          <View style={styles.metaRow}>
            <Ionicons
              name={getSportIcon(sportType)}
              size={12}
              color={c.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {specs}
            </Text>
          </View>
        ) : null}

        {/* Nearest Free Time (if available) */}
        {availableTimeText ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={c.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {availableTimeText}
            </Text>
          </View>
        ) : null}

        {/* Price & Action Button */}
        <View style={styles.bottomRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.pricePrefix}>от </Text>
            <Text style={styles.priceAmount}>{formattedPrice} ₸</Text>
            <Text style={styles.priceSuffix}> / час</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              hapticSelection();
              onPress();
            }}
          >
            <Ionicons name="arrow-forward" size={18} color={c.background} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    marginBottom: spacing.card,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardPressed: {
    opacity: 0.96,
    borderColor: c.primary,
  },
  imageContainer: {
    width: 108,
    height: 108,
    borderRadius: 14,
    backgroundColor: c.surfaceElevated,
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
  },
  favoriteBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.glassBackground,
    borderWidth: 1,
    borderColor: c.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "space-between",
  },
  title: {
    ...typography.cardTitle,
    color: c.textPrimary,
    lineHeight: 20,
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textPrimary,
  },
  reviewsCount: {
    fontSize: 12,
    fontWeight: "400",
    color: c.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  metaIcon: {
    marginRight: 5,
    flexShrink: 0,
  },
  metaText: {
    ...typography.caption,
    color: c.textSecondary,
    flex: 1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 4,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    flex: 1,
    marginRight: 8,
  },
  pricePrefix: {
    ...typography.caption,
    color: c.textSecondary,
  },
  priceAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: c.textPrimary,
  },
  priceSuffix: {
    ...typography.caption,
    color: c.textSecondary,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
