import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

export interface VenueCardProps {
  id: number | string;
  title: string;
  imageUrl: string;
  address: string;
  distance?: string;
  rating: number;
  reviewsCount?: number;
  pricePerHour: number;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
  badgeText?: string;
}

export function VenueCard({
  title,
  imageUrl,
  address,
  distance = "2,4 км",
  rating,
  reviewsCount = 124,
  pricePerHour,
  isFavorite = false,
  onPress,
  onToggleFavorite,
  badgeText,
}: VenueCardProps) {
  const formattedPrice = pricePerHour.toLocaleString("ru-RU");

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
      {/* Cover Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Favorite Button (Top Right) */}
        <Pressable
          style={({ pressed }) => [
            styles.favoriteBtn,
            pressed && { transform: [{ scale: 0.9 }] },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            hapticImpact();
            onToggleFavorite?.();
          }}
          hitSlop={8}
        >
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={18}
            color={isFavorite ? colors.accent : "#FFFFFF"}
          />
        </Pressable>

        {/* Rating Badge (Bottom Left) */}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={13} color={colors.primary} />
          <Text style={styles.ratingText}>
            {rating.toFixed(1)}{" "}
            <Text style={styles.reviewsCountText}>({reviewsCount})</Text>
          </Text>
        </View>

        {/* Optional Promo/Special Badge */}
        {badgeText && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>{badgeText}</Text>
          </View>
        )}
      </View>

      {/* Content Container */}
      <View style={styles.content}>
        {/* Venue Title */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Address and Distance Row */}
        <View style={styles.metaRow}>
          <View style={styles.addressWrap}>
            <Ionicons
              name="location-outline"
              size={13}
              color={colors.textSecondary}
              style={{ marginRight: 3 }}
            />
            <Text style={styles.addressText} numberOfLines={1}>
              {address}
            </Text>
          </View>

          {distance ? (
            <View style={styles.distanceWrap}>
              <Ionicons
                name="navigate-outline"
                size={11}
                color={colors.textSecondary}
                style={{ marginRight: 2 }}
              />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom Price and Action Row */}
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
            <Ionicons name="arrow-forward" size={18} color="#080D0B" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.card,
  },
  cardPressed: {
    opacity: 0.96,
    borderColor: "rgba(0, 201, 104, 0.35)",
  },
  imageContainer: {
    width: "100%",
    height: 155,
    backgroundColor: "#16201B",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  favoriteBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(18, 26, 22, 0.72)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(18, 26, 22, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  reviewsCountText: {
    fontWeight: "400",
    color: colors.textSecondary,
    fontSize: 11,
  },
  promoBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promoBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#080D0B",
  },
  content: {
    padding: 14,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  addressWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  distanceWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
    paddingTop: 10,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  pricePrefix: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  priceSuffix: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

