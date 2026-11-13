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
import { formatNumber, useT } from "@/lib/i18n";
import { sportLabel } from "@/lib/dataLabels";
import { sportImage } from "@/components/SportCategoryTiles";

export interface VenueCardProps {
  id: number | string;
  title: string;
  arenaTitle?: string;
  imageUrl?: string;
  address: string;
  distance?: string;
  // Shown only when the backend has a rating (no invented values).
  rating?: number;
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
  if (s.includes("хоккей")) return "snow-outline";
  return "fitness-outline";
}

export function VenueCard({
  title,
  arenaTitle,
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
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const formattedPrice = formatNumber((pricePerHour || 0));
  const sportPic = sportImage(sportType);

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

        {/* Sport badge (bottom-left of thumbnail) */}
        {sportType ? (
          <View style={styles.sportBadge}>
            {sportPic ? <Image source={sportPic} style={styles.sportBadgeIcon} /> : null}
            <Text style={styles.sportBadgeText} numberOfLines={1}>
              {sportLabel(sportType, t)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 2. Right: Information Content */}
      <View style={styles.content}>
        {/* Title + Business/Complex Badge in top-right */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>
            {title}
          </Text>
          {arenaTitle ? (
            <View style={styles.arenaBadge}>
              <Ionicons name="business-outline" size={10} color={c.primary} />
              <Text style={styles.arenaBadgeText} numberOfLines={1} ellipsizeMode="tail">
                {arenaTitle}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Rating & Reviews */}
        {rating && rating > 0 ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color={c.primary} />
            <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
            {reviewsCount ? <Text style={styles.reviewsCount}>({reviewsCount})</Text> : null}
          </View>
        ) : null}

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
              name="layers-outline"
              size={12}
              color={c.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} numberOfLines={2}>
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
            <Text style={styles.priceAmount}>{formattedPrice} ₸</Text>
            <Text style={styles.priceSuffix}> {t("common.perHour")}</Text>
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
            <Ionicons name="arrow-forward" size={18} color={c.onPrimary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    backgroundColor: c.glassBackground,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.glassBorder,
    padding: spacing.sm,
    marginBottom: spacing.card,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardPressed: {
    opacity: 0.96,
    borderColor: c.primary,
  },
  imageContainer: {
    width: 120,
    height: 128,
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
  sportBadge: {
    position: "absolute",
    left: spacing.xs + 2,
    bottom: spacing.xs + 2,
    maxWidth: "88%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.smallChip,
    backgroundColor: c.overlay,
  },
  sportBadgeIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: c.onImage,
    flexShrink: 1,
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
    marginLeft: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 2,
  },
  title: {
    ...typography.cardTitle,
    fontSize: 15,
    color: c.textPrimary,
    lineHeight: 20,
  },
  arenaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "40%",
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.smallChip,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 1,
  },
  arenaBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: c.textSecondary,
    flexShrink: 1,
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
    fontSize: 18,
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
