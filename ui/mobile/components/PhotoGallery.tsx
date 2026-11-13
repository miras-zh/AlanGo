import { useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticSelection } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type Props = {
  photos: string[];
  height: number;
  // Rendered over the gallery (back / share buttons etc.).
  overlay?: React.ReactNode;
};

const SCREEN_WIDTH = Dimensions.get("window").width;

// Swipeable hall photo gallery with a page counter; tap opens full screen.
export function PhotoGallery({ photos, height, overlay }: Props) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== index) setIndex(next);
  };

  if (photos.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Ionicons name="images-outline" size={40} color={c.textSecondary} />
        <Text style={styles.emptyText}>Фото зала пока не добавлены</Text>
        {overlay}
      </View>
    );
  }

  return (
    <View style={{ height }}>
      <FlatList
        data={photos}
        keyExtractor={(url, i) => `${i}-${url}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => {
              hapticSelection();
              setViewerIndex(i);
            }}
          >
            <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height }} />
          </Pressable>
        )}
      />

      {photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={styles.counter} pointerEvents="none">
        <Ionicons name="camera-outline" size={13} color={c.textPrimary} />
        <Text style={styles.counterText}>
          {index + 1}/{photos.length}
        </Text>
      </View>

      {overlay}

      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewer}>
          <FlatList
            data={photos}
            keyExtractor={(url, i) => `full-${i}-${url}`}
            horizontal
            pagingEnabled
            initialScrollIndex={viewerIndex ?? 0}
            getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.viewerPage}>
                <Image source={{ uri: item }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            )}
          />
          <Pressable
            style={[styles.viewerClose, { top: insets.top + spacing.sm }]}
            hitSlop={10}
            onPress={() => setViewerIndex(null)}
          >
            <Ionicons name="close" size={24} color={c.textPrimary} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: c.surfaceElevated,
  },
  emptyText: {
    ...typography.body,
    color: c.textSecondary,
  },
  dots: {
    position: "absolute",
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    width: 18,
    backgroundColor: c.textPrimary,
  },
  counter: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.smallChip,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  counterText: {
    ...typography.caption,
    fontWeight: "600",
    color: c.textPrimary,
  },
  viewer: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewerPage: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: "80%",
  },
  viewerClose: {
    position: "absolute",
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
});
