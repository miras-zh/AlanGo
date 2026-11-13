import React from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { monthShort, weekdayShort } from "@/lib/dataLabels";
import {
  EVENT_SPORT_LABEL,
  eventPrice,
  eventTimeRange,
  type EventSport,
  type SportEvent,
} from "@/lib/eventsData";
import { sportImage } from "@/components/SportCategoryTiles";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

// Event sport ids → stored sport names used by the 3D sport pictures.
const SPORT_PICTURE: Partial<Record<EventSport, string>> = {
  football: "Футбол",
  tennis: "Теннис",
  basketball: "Баскетбол",
  padel: "Сквош и падл",
  volleyball: "Волейбол",
  hockey: "Хоккей",
};

interface EventCardProps {
  event: SportEvent;
  isFavorite: boolean;
  isRegistered: boolean;
  registering?: boolean;
  onPress: () => void;
  onRegister: () => void;
  onToggleFavorite: () => void;
}

// Steps of the image → card fade (no gradient dependency in the project).
const FADE_STEPS = [0.06, 0.14, 0.24, 0.36, 0.5, 0.64, 0.78, 0.9];

export function EventCard({
  event,
  isFavorite,
  isRegistered,
  registering = false,
  onPress,
  onRegister,
  onToggleFavorite,
}: EventCardProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const price = eventPrice(event, t);
  const soldOut = event.spotsLeft !== undefined && event.spotsLeft <= 0 && !isRegistered;
  const sportPic = sportImage(SPORT_PICTURE[event.sport]);
  const extra =
    event.participants !== undefined
      ? t("events.participants", { count: event.participants })
      : event.format
        ? t("events.teams", { format: event.format })
        : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      {/* Left: image with date badge */}
      <View style={styles.imageWrap}>
        <Image source={{ uri: event.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={styles.fade} pointerEvents="none">
          {FADE_STEPS.map((o) => (
            <View key={o} style={[styles.fadeStep, { opacity: o }]} />
          ))}
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateDay}>{event.startsAt.getDate()}</Text>
          <Text style={styles.dateMonth}>{monthShort(event.startsAt.getMonth(), t)}</Text>
          <Text style={styles.dateWeekday}>{weekdayShort(event.startsAt.getDay(), t)}</Text>
        </View>
      </View>

      {/* Right: info */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.sportBadge}>
            {sportPic ? <Image source={sportPic} style={styles.sportIcon} /> : null}
            <Text style={styles.sportText} numberOfLines={1}>
              {t(EVENT_SPORT_LABEL[event.sport])}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              hapticImpact();
              onToggleFavorite();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? t("events.unfavorite") : t("events.favorite")}
            accessibilityState={{ selected: isFavorite }}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? c.accent : c.textPrimary}
            />
          </Pressable>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={c.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {event.venue}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={c.textSecondary} />
          <Text style={styles.metaTextFixed}>{eventTimeRange(event)}</Text>
          {extra ? (
            <>
              <Ionicons name="people-outline" size={13} color={c.textSecondary} style={styles.metaGap} />
              <Text style={styles.metaText} numberOfLines={1}>
                {extra}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {price.amount}
            </Text>
            {price.unit ? <Text style={styles.priceUnit} numberOfLines={1}>{price.unit}</Text> : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.registerBtn,
              isRegistered && styles.registerBtnDone,
              soldOut && styles.registerBtnDisabled,
              pressed && !soldOut && { opacity: 0.85 },
            ]}
            disabled={soldOut || registering}
            onPress={(e) => {
              e.stopPropagation();
              onRegister();
            }}
            accessibilityRole="button"
            accessibilityState={{ disabled: soldOut, busy: registering }}
          >
            {registering ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : isRegistered ? (
              <>
                <Ionicons name="checkmark" size={15} color={c.primary} />
                <Text style={[styles.registerText, styles.registerTextDone]}>{t("events.registered")}</Text>
              </>
            ) : soldOut ? (
              <Text style={[styles.registerText, styles.registerTextDisabled]}>{t("events.soldOut")}</Text>
            ) : (
              <>
                <Text style={styles.registerText}>{t("events.register")}</Text>
                <Ionicons name="arrow-forward" size={15} color={c.onPrimary} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const CARD_HEIGHT = 172;

function createStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      minHeight: CARD_HEIGHT,
      marginBottom: spacing.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassBackground,
      overflow: "hidden",
    },
    cardPressed: {
      borderColor: c.primary,
    },
    imageWrap: {
      width: "40%",
      backgroundColor: c.surfaceElevated,
    },
    fade: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      width: 40,
      flexDirection: "row",
    },
    fadeStep: {
      flex: 1,
      backgroundColor: c.surface,
    },
    dateBadge: {
      position: "absolute",
      top: spacing.sm,
      left: spacing.sm,
      minWidth: 44,
      alignItems: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.smallChip,
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    dateDay: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
      color: c.textPrimary,
    },
    dateMonth: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      color: c.textPrimary,
    },
    dateWeekday: {
      fontSize: 11,
      lineHeight: 14,
      color: c.textSecondary,
    },
    content: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    sportBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      flexShrink: 1,
      marginRight: spacing.sm,
      paddingVertical: 2,
      paddingLeft: spacing.xs,
      paddingRight: spacing.sm,
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    sportIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    sportText: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textPrimary,
      flexShrink: 1,
    },
    title: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: spacing.xs,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: 2,
    },
    metaText: {
      flexShrink: 1,
      fontSize: 12,
      color: c.textSecondary,
    },
    metaTextFixed: {
      fontSize: 12,
      color: c.textSecondary,
    },
    metaGap: {
      marginLeft: spacing.sm,
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: "auto",
      paddingTop: spacing.sm,
    },
    priceWrap: {
      flexShrink: 1,
      marginRight: spacing.sm,
    },
    price: {
      fontSize: 17,
      fontWeight: "800",
      color: c.textPrimary,
    },
    priceUnit: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
    },
    registerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: 18,
      backgroundColor: c.primary,
    },
    registerBtnDone: {
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.primary,
    },
    registerBtnDisabled: {
      backgroundColor: c.subtle,
    },
    registerText: {
      fontSize: 13,
      fontWeight: "800",
      color: c.onPrimary,
    },
    registerTextDone: {
      color: c.primary,
    },
    registerTextDisabled: {
      color: c.textMuted,
    },
  });
}
