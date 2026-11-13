import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useT, type MessageKey } from "@/lib/i18n";
import { hapticSelection } from "@/lib/haptics";
import { radii, spacing } from "@/constants/theme";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export const ALL_SPORTS = "all";

type SportCategory = {
  // Sport value as stored on halls/arenas (Russian), or ALL_SPORTS.
  id: string;
  name: MessageKey;
  // 3D sport picture (assets/sports); null for "all" (grid icon).
  image: ImageSourcePropType | null;
  // Grayscale copy shown while another sport is selected.
  gray: ImageSourcePropType | null;
};

export const SPORT_CATEGORIES: SportCategory[] = [
  { id: ALL_SPORTS, name: "sport.all", image: null, gray: null },
  { id: "Футбол", name: "sport.football", image: require("@/assets/sports/football.jpg"), gray: require("@/assets/sports/football_gray.jpg") },
  { id: "Теннис", name: "sport.tennis", image: require("@/assets/sports/tennis.jpg"), gray: require("@/assets/sports/tennis_gray.jpg") },
  { id: "Баскетбол", name: "sport.basketball", image: require("@/assets/sports/basketball.jpg"), gray: require("@/assets/sports/basketball_gray.jpg") },
  { id: "Сквош и падл", name: "sport.padel", image: require("@/assets/sports/padel.jpg"), gray: require("@/assets/sports/padel_gray.jpg") },
  { id: "Волейбол", name: "sport.volleyball", image: require("@/assets/sports/volleyball.jpg"), gray: require("@/assets/sports/volleyball_gray.jpg") },
  { id: "Хоккей", name: "sport.hockey", image: require("@/assets/sports/hockey.jpg"), gray: require("@/assets/sports/hockey_gray.jpg") },
];

/** 3D picture for a stored sport value (e.g. a hall's sportType), if we have one. */
export function sportImage(sport?: string | null): ImageSourcePropType | null {
  if (!sport) return null;
  const s = sport.toLowerCase();
  if (s.includes("падл") || s.includes("падел") || s.includes("сквош")) {
    return SPORT_CATEGORIES.find((x) => x.id === "Сквош и падл")?.image ?? null;
  }
  if (s.includes("мини-футбол")) return SPORT_CATEGORIES.find((x) => x.id === "Футбол")?.image ?? null;
  return SPORT_CATEGORIES.find((x) => x.id.toLowerCase() === s)?.image ?? null;
}

/** True if a stored sport value belongs to the category id (padel tile covers squash too). */
export function sportMatches(categoryId: string, sport?: string | null): boolean {
  if (categoryId === ALL_SPORTS) return true;
  if (!sport) return false;
  const s = sport.toLowerCase();
  if (categoryId === "Сквош и падл") return s.includes("сквош") || s.includes("падл") || s.includes("падел");
  return s === categoryId.toLowerCase();
}

// Color picture over its grayscale copy; the color layer fades in/out.
function SportTileImage({
  color,
  gray,
  colored,
  style,
}: {
  color: ImageSourcePropType;
  gray: ImageSourcePropType;
  colored: boolean;
  style: StyleProp<ImageStyle>;
}) {
  const opacity = useRef(new Animated.Value(colored ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: colored ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [colored, opacity]);
  return (
    <>
      <Image source={gray} style={style} resizeMode="cover" />
      <Animated.Image source={color} style={[style, { opacity }]} resizeMode="cover" />
    </>
  );
}

type Props = {
  selected: string;
  onSelect: (id: string) => void;
  // "large": home (picture with the label inside the tile);
  // "compact": halls catalog (small square, label under it).
  variant?: "large" | "compact";
  style?: StyleProp<ViewStyle>;
  // Rendered before the tiles, scrolling with them (e.g. a city picker).
  leading?: React.ReactNode;
};

/**
 * Horizontal sport filter. "All" keeps every tile in color; a picked sport
 * stays in color and the rest fade to grayscale.
 */
export function SportCategoryTiles({ selected, onSelect, variant = "large", style, leading }: Props) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const t = useT();
  const compact = variant === "compact";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, style]}
      contentContainerStyle={styles.row}
    >
      {leading}
      {SPORT_CATEGORIES.map((cat) => {
        const isSelected = selected === cat.id;
        const colored = selected === ALL_SPORTS || isSelected;
        const label = (
          <Text
            style={[
              compact ? styles.compactLabel : styles.label,
              !colored && styles.labelDimmed,
              isSelected && styles.labelSelected,
            ]}
            numberOfLines={1}
          >
            {t(cat.name)}
          </Text>
        );
        return (
          <Pressable
            key={cat.id}
            onPress={() => {
              hapticSelection();
              onSelect(isSelected ? ALL_SPORTS : cat.id);
            }}
            style={compact ? styles.compactItem : styles.item}
            accessibilityRole="button"
            accessibilityLabel={t(cat.name)}
            accessibilityState={{ selected: isSelected }}
          >
            <View
              style={[
                compact ? styles.compactTile : styles.tile,
                isSelected && styles.tileSelected,
              ]}
            >
              {cat.image ? (
                <SportTileImage
                  color={cat.image}
                  gray={cat.gray ?? cat.image}
                  colored={colored}
                  style={compact ? styles.compactImage : styles.image}
                />
              ) : (
                <View style={compact ? styles.compactAllIcon : styles.allIcon}>
                  <Ionicons
                    name="grid-outline"
                    size={compact ? 24 : 30}
                    color={colored ? c.primary : c.textMuted}
                  />
                </View>
              )}
              {compact ? null : label}
            </View>
            {compact ? label : (
              <View style={[styles.indicator, isSelected && styles.indicatorActive]} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const LARGE_IMAGE = 68;
const COMPACT_TILE = 56;

function createStyles(c: Palette) {
  return StyleSheet.create({
    scroll: {
      marginHorizontal: -spacing.screenHorizontal,
      flexGrow: 0,
      flexShrink: 0,
    },
    row: {
      paddingHorizontal: spacing.screenHorizontal,
      gap: spacing.sm,
    },
    // --- large (home) ---
    item: {
      alignItems: "center",
    },
    tile: {
      width: 76,
      height: 92,
      borderRadius: radii.card,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    image: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: LARGE_IMAGE,
    },
    allIcon: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: LARGE_IMAGE,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      color: c.textPrimary,
      textAlign: "center",
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.xs,
    },
    indicator: {
      width: 20,
      height: 4,
      borderRadius: 2,
      marginTop: spacing.sm,
      backgroundColor: "transparent",
    },
    indicatorActive: {
      backgroundColor: c.primary,
    },
    // --- compact (halls catalog) ---
    compactItem: {
      alignItems: "center",
      width: COMPACT_TILE + spacing.md,
    },
    compactTile: {
      width: COMPACT_TILE,
      height: COMPACT_TILE,
      borderRadius: radii.button,
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      overflow: "hidden",
    },
    compactImage: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    },
    compactAllIcon: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    compactLabel: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600",
      color: c.textPrimary,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    // --- shared states ---
    tileSelected: {
      borderWidth: 2,
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
      shadowColor: c.primary,
      shadowOpacity: 0.5,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    labelDimmed: {
      color: c.textMuted,
    },
    labelSelected: {
      color: c.primary,
    },
  });
}
