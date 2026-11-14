import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ArenaWithHalls, Hall } from "@/lib/sportRentData";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useT, type MessageKey } from "@/lib/i18n";
import { categoryLabel, sportLabel, workingHoursLabel } from "@/lib/dataLabels";

const VENUE_LABEL: Record<string, MessageKey> = {
  complex: "venue.complex",
  single: "venue.single",
  outdoor: "venue.outdoor",
};

type Props = {
  arena: ArenaWithHalls;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress: () => void;
  onHallPress: (hall: Hall) => void;
};

// Lowest real hourly price among the arena's halls (null if none is priced).
export function arenaMinPrice(arena: ArenaWithHalls): number | null {
  const prices = arena.halls.map((h) => h.pricePerHour).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

// Large sports-complex card: cover, type badge, rating, address, hours and a
// strip of the halls inside — a complex is a set of halls, not one venue.
export function ArenaCard({ arena, isFavorite = false, onToggleFavorite, onPress, onHallPress }: Props) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const minPrice = arenaMinPrice(arena);
  const hallsCount = arena.halls.length;
  // Only the arena's own cover (set in the business profile). Halls' photos
  // stay in the "inside" strip below — no borrowing the first hall's photo.
  const cover = arena.imageUrl || "";
  const sports = arena.availableSports.slice(0, 4);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
    >
      <View style={styles.cover}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverEmpty]}>
            <Ionicons name="business-outline" size={44} color={c.textSecondary} />
          </View>
        )}
        <View style={styles.coverShade} />
        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}>
            <Ionicons name="business" size={12} color={c.primary} />
            <Text style={styles.typeBadgeText}>
              {VENUE_LABEL[arena.venueType ?? "complex"] ? t(VENUE_LABEL[arena.venueType ?? "complex"]) : categoryLabel(arena.category ?? "Спорткомплекс", t)}
            </Text>
          </View>
          <View style={styles.badgeRight}>
            {arena.rating > 0 ? (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color={c.primary} />
                <Text style={styles.ratingText}>{arena.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            {onToggleFavorite ? (
              <Pressable
                style={({ pressed }) => [styles.favoriteBtn, pressed && { transform: [{ scale: 0.9 }] }]}
                onPress={(e) => {
                  e.stopPropagation();
                  hapticImpact();
                  onToggleFavorite();
                }}
                hitSlop={6}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={15}
                  color={isFavorite ? c.accent : c.textPrimary}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.coverBottom}>
          <View style={styles.titleRow}>
            {arena.logoUrl ? (
              <Image source={{ uri: arena.logoUrl }} style={styles.logo} />
            ) : null}
            <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>
              {arena.title}
            </Text>
          </View>
          {arena.address || arena.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location" size={13} color={c.primary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {[arena.city, arena.address].filter(Boolean).join(", ")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {arena.workingHours ? (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={c.textSecondary} />
            <Text style={styles.hoursText}>{workingHoursLabel(arena.workingHours, t)}</Text>
          </View>
        ) : null}

        {sports.length ? (
          <View style={styles.sportsRow}>
            {sports.map((s) => (
              <View key={s} style={styles.sportChip}>
                <Text style={styles.sportText}>{sportLabel(s, t)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>
          {hallsCount > 0
            ? t("arenaCard.hallsInside", { count: hallsCount })
            : t("arenaCard.noHalls")}
        </Text>
        {hallsCount > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hallsRow}>
            {arena.halls.map((h) => (
              <Pressable
                key={h.id}
                style={styles.hallTile}
                onPress={() => {
                  hapticSelection();
                  onHallPress(h);
                }}
              >
                {h.imageUrl ? (
                  <Image source={{ uri: h.imageUrl }} style={styles.hallImage} />
                ) : (
                  <View style={[styles.hallImage, styles.coverEmpty]}>
                    <Ionicons name="layers-outline" size={22} color={c.textSecondary} />
                  </View>
                )}
                <Text style={styles.hallTitle} numberOfLines={1}>
                  {h.title}
                </Text>
                <Text style={styles.hallMeta} numberOfLines={1}>
                  {sportLabel(h.sportType, t)}
                  {h.pricePerHour > 0 ? ` · ${formatNumber(h.pricePerHour)} ₸` : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.footer}>
          <View>
            {minPrice !== null ? (
              <>
                <Text style={styles.priceLabel}>{t("arenaCard.rent")}</Text>
                <Text style={styles.price}>
                  {t("common.priceFrom", { price: formatNumber(minPrice) })}<Text style={styles.priceSub}> {t("common.perHour")}</Text>
                </Text>
              </>
            ) : (
              <Text style={styles.priceLabel}>{t("arenaCard.pricesTbd")}</Text>
            )}
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{t("arenaCard.cta")}</Text>
            <Ionicons name="arrow-forward" size={16} color={c.background} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.92,
  },
  cover: {
    height: 200,
    justifyContent: "space-between",
    backgroundColor: c.surfaceElevated,
  },
  coverEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
  },
  coverShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.smallChip,
    backgroundColor: c.glassBackground,
    borderWidth: 1,
    borderColor: c.glassBorder,
  },
  typeBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    color: c.primary,
  },
  badgeRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  favoriteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.glassBackground,
    borderWidth: 1,
    borderColor: c.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.smallChip,
    backgroundColor: c.glassBackground,
  },
  ratingText: {
    ...typography.caption,
    fontWeight: "700",
    color: c.textPrimary,
  },
  coverBottom: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: c.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    ...typography.body,
    color: c.textPrimary,
    flex: 1,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  hoursText: {
    ...typography.body,
    color: c.textSecondary,
  },
  sportsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sportChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.smallChip,
    backgroundColor: c.surfaceElevated,
  },
  sportText: {
    ...typography.caption,
    fontWeight: "600",
    color: c.primary,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: c.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hallsRow: {
    gap: spacing.sm,
  },
  hallTile: {
    width: 128,
    gap: spacing.xs,
  },
  hallImage: {
    width: 128,
    height: 84,
    borderRadius: radii.smallChip,
  },
  hallTitle: {
    ...typography.body,
    fontWeight: "600",
    color: c.textPrimary,
  },
  hallMeta: {
    ...typography.caption,
    color: c.textSecondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  priceLabel: {
    ...typography.caption,
    color: c.textSecondary,
  },
  price: {
    ...typography.cardTitle,
    fontWeight: "800",
    color: c.primary,
  },
  priceSub: {
    ...typography.caption,
    color: c.textSecondary,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: c.primary,
  },
  ctaText: {
    ...typography.button,
    color: c.background,
  },
});
