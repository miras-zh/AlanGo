import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, typography } from "@/constants/theme";
import { useT } from "@/lib/i18n";
import { pickHallLayout } from "@/lib/hallLayouts";
import { surfaceLabel } from "@/lib/dataLabels";
import { sizeLabel } from "@/lib/hallOptions";
import type { Hall } from "@/lib/sportRentData";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type Props = {
  hall: Pick<Hall, "sportType" | "surfaceType" | "title" | "lengthM" | "widthM">;
};

export function HallLayoutCard({ hall }: Props) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);

  const layout = useMemo(
    () => pickHallLayout(hall),
    [hall.sportType, hall.surfaceType, hall.title],
  );

  const html = useMemo(() => {
    if (!layout) return "";
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
</head>
<body>${layout.svg}</body>
</html>`;
  }, [layout]);

  if (!layout) return null;

  const subtitle = hall.surfaceType ? surfaceLabel(hall.surfaceType, t) : t("hall.layoutSub");
  const dimensions = sizeLabel(hall.lengthM ?? 0, hall.widthM ?? 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="map-outline" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("hall.layoutTitle")}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View
        style={[styles.svgWrap, { aspectRatio: layout.aspectRatio }]}
        pointerEvents="none"
      >
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled={false}
        />
        {dimensions ? (
          <View style={styles.sizeOverlay}>
            <View style={styles.sizePill}>
              <Ionicons name="resize-outline" size={12} color={c.primary} />
              <Text style={styles.sizeText}>{dimensions}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: spacing.lg,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
      marginBottom: spacing.md,
    },
    iconBox: {
      width: 34,
      height: 34,
      borderRadius: radii.smallChip,
      backgroundColor: "rgba(34, 197, 94, 0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...typography.cardTitle,
      color: c.textPrimary,
    },
    subtitle: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 1,
    },
    svgWrap: {
      width: "100%",
      borderRadius: radii.smallChip,
      overflow: "hidden",
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.hairline,
      position: "relative",
    },
    webview: {
      flex: 1,
      backgroundColor: "transparent",
    },
    sizeOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: spacing.sm,
      alignItems: "center",
    },
    sizePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: radii.smallChip,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    sizeText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textPrimary,
    },
  });
