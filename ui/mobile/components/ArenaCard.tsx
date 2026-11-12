import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ArenaWithHalls, Hall } from "@/lib/sportRentData";
import { plural } from "@/lib/plural";
import { hapticSelection } from "@/lib/haptics";
import { colors, radii, spacing, typography } from "@/constants/theme";

const VENUE_LABEL: Record<string, string> = {
  complex: "Спорткомплекс",
  single: "Отдельный зал",
  outdoor: "Открытая площадка",
};

type Props = {
  arena: ArenaWithHalls;
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
export function ArenaCard({ arena, onPress, onHallPress }: Props) {
  const minPrice = arenaMinPrice(arena);
  const hallsCount = arena.halls.length;
  const cover = arena.imageUrl || arena.halls.find((h) => h.imageUrl)?.imageUrl || "";
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
            <Ionicons name="business-outline" size={44} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.coverShade} />
        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}>
            <Ionicons name="business" size={12} color={colors.primary} />
            <Text style={styles.typeBadgeText}>
              {VENUE_LABEL[arena.venueType ?? "complex"] ?? arena.category ?? "Спорткомплекс"}
            </Text>
          </View>
          {arena.rating > 0 ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color={colors.primary} />
              <Text style={styles.ratingText}>{arena.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.coverBottom}>
          <Text style={styles.title} numberOfLines={2}>
            {arena.title}
          </Text>
          {arena.address || arena.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location" size={13} color={colors.primary} />
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
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.hoursText}>{arena.workingHours}</Text>
          </View>
        ) : null}

        {sports.length ? (
          <View style={styles.sportsRow}>
            {sports.map((s) => (
              <View key={s} style={styles.sportChip}>
                <Text style={styles.sportText}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>
          {hallsCount > 0
            ? `Внутри ${hallsCount} ${plural(hallsCount, ["зал", "зала", "залов"])}`
            : "Залы ещё не добавлены"}
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
                    <Ionicons name="layers-outline" size={22} color={colors.textSecondary} />
                  </View>
                )}
                <Text style={styles.hallTitle} numberOfLines={1}>
                  {h.title}
                </Text>
                <Text style={styles.hallMeta} numberOfLines={1}>
                  {h.sportType}
                  {h.pricePerHour > 0 ? ` · ${h.pricePerHour.toLocaleString("ru-RU")} ₸` : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.footer}>
          <View>
            {minPrice !== null ? (
              <>
                <Text style={styles.priceLabel}>Аренда</Text>
                <Text style={styles.price}>
                  от {minPrice.toLocaleString("ru-RU")} ₸<Text style={styles.priceSub}> / час</Text>
                </Text>
              </>
            ) : (
              <Text style={styles.priceLabel}>Цены уточняются</Text>
            )}
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Смотреть комплекс</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.background} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.92,
  },
  cover: {
    height: 200,
    justifyContent: "space-between",
    backgroundColor: colors.surfaceElevated,
  },
  coverEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.glassBackground,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  typeBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.smallChip,
    backgroundColor: colors.glassBackground,
  },
  ratingText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  coverBottom: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  hoursText: {
    ...typography.body,
    color: colors.textSecondary,
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
    backgroundColor: colors.surfaceElevated,
  },
  sportText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.primary,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
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
    color: colors.textPrimary,
  },
  hallMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  price: {
    ...typography.cardTitle,
    fontWeight: "800",
    color: colors.primary,
  },
  priceSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
  },
  ctaText: {
    ...typography.button,
    color: colors.background,
  },
});
