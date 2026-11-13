import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PickedPhoto } from "@/lib/pickImage";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const OUTPUT_SIZE = 640; // px, the exported square avatar's side
const MAX_ZOOM = 3; // multiple of the "cover" fit scale

type Props = {
  // A local file:// URI (freshly picked) or the remote URL of the current avatar.
  source: string;
  onCancel: () => void;
  onSave: (file: PickedPhoto) => void;
  title?: string;
};

// Pan-and-zoom circular cropper (ported from Vison). Drag the photo inside
// the circular viewport, zoom with the slider, then crop exactly what's
// visible via expo-image-manipulator. Output is a square JPEG for uploadAvatar.
export function AvatarCropModal({ source, onCancel, onSave, title = "Фото профиля" }: Props) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const viewport = Math.min(280, Dimensions.get("window").width - spacing.lg * 2 - 40);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image top-left, viewport-relative
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const trackWidthRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setNaturalSize(null);
    setLoadError(false);
    setZoom(1);

    Image.getSize(
      source,
      (w, h) => {
        if (cancelled) return;
        const fit = Math.max(viewport / w, viewport / h);
        setNaturalSize({ w, h });
        setPos({ x: (viewport - w * fit) / 2, y: (viewport - h * fit) / 2 });
      },
      () => {
        if (!cancelled) setLoadError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, viewport]);

  const baseScale = naturalSize ? Math.max(viewport / naturalSize.w, viewport / naturalSize.h) : 1;
  const scale = baseScale * zoom;
  const displayW = naturalSize ? naturalSize.w * scale : 0;
  const displayH = naturalSize ? naturalSize.h * scale : 0;

  function clamp(p: { x: number; y: number }, w: number, h: number) {
    return {
      x: Math.min(0, Math.max(viewport - w, p.x)),
      y: Math.min(0, Math.max(viewport - h, p.y)),
    };
  }

  function onImageGrant(e: { nativeEvent: { pageX: number; pageY: number } }) {
    dragRef.current = {
      startX: e.nativeEvent.pageX,
      startY: e.nativeEvent.pageY,
      posX: pos.x,
      posY: pos.y,
    };
  }

  function onImageMove(e: { nativeEvent: { pageX: number; pageY: number } }) {
    const drag = dragRef.current;
    if (!drag || !naturalSize) return;
    const dx = e.nativeEvent.pageX - drag.startX;
    const dy = e.nativeEvent.pageY - drag.startY;
    setPos(clamp({ x: drag.posX + dx, y: drag.posY + dy }, displayW, displayH));
  }

  function onImageRelease() {
    dragRef.current = null;
  }

  function applyZoom(nextZoom: number) {
    const next = Math.min(MAX_ZOOM, Math.max(1, nextZoom));
    setZoom(next);
    if (!naturalSize) return;
    const nextScale = baseScale * next;
    const w = naturalSize.w * nextScale;
    const h = naturalSize.h * nextScale;
    // Keep the current viewport-centre focal point fixed instead of snapping.
    setPos((p) => {
      const prevW = displayW || w;
      const prevH = displayH || h;
      const ratioX = prevW > 0 ? (viewport / 2 - p.x) / prevW : 0.5;
      const ratioY = prevH > 0 ? (viewport / 2 - p.y) / prevH : 0.5;
      return clamp({ x: viewport / 2 - ratioX * w, y: viewport / 2 - ratioY * h }, w, h);
    });
  }

  function onTrackTouch(e: { nativeEvent: { locationX: number } }) {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / width));
    applyZoom(1 + ratio * (MAX_ZOOM - 1));
  }

  async function handleSave() {
    if (!naturalSize) return;
    setSaving(true);
    try {
      const sx = -pos.x / scale;
      const sy = -pos.y / scale;
      const sSize = viewport / scale;

      const originX = Math.max(0, Math.round(sx));
      const originY = Math.max(0, Math.round(sy));
      const size = Math.max(
        1,
        Math.round(Math.min(sSize, naturalSize.w - originX, naturalSize.h - originY)),
      );

      const result = await manipulateAsync(
        source,
        [{ crop: { originX, originY, width: size, height: size } }, { resize: { width: OUTPUT_SIZE } }],
        { compress: 0.92, format: SaveFormat.JPEG },
      );
      onSave({ uri: result.uri, name: `avatar-${Date.now()}.jpg`, type: "image/jpeg" });
    } catch {
      setLoadError(true);
    } finally {
      setSaving(false);
    }
  }

  const zoomPct = (zoom - 1) / (MAX_ZOOM - 1);
  const saveDisabled = !naturalSize || saving;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>Перетащите фото и настройте масштаб</Text>
          {loadError ? (
            <Text style={styles.loadError}>Не удалось обработать изображение. Выберите другое фото.</Text>
          ) : null}

          <View style={styles.viewportRow}>
            <View
              style={[styles.viewport, { width: viewport, height: viewport, borderRadius: viewport / 2 }]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={onImageGrant}
              onResponderMove={onImageMove}
              onResponderRelease={onImageRelease}
              onResponderTerminate={onImageRelease}
            >
              {naturalSize ? (
                <Image
                  source={{ uri: source }}
                  style={{ position: "absolute", left: pos.x, top: pos.y, width: displayW, height: displayH }}
                />
              ) : null}

              {/* Rule-of-thirds guide grid — purely visual. */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[styles.gridV, { left: "33.33%" }]} />
                <View style={[styles.gridV, { left: "66.66%" }]} />
                <View style={[styles.gridH, { top: "33.33%" }]} />
                <View style={[styles.gridH, { top: "66.66%" }]} />
              </View>
            </View>
          </View>

          {/* Zoom slider */}
          <View style={styles.sliderRow}>
            <Pressable onPress={() => applyZoom(zoom - 0.25)} hitSlop={10}>
              <Text style={styles.sliderEnd}>−</Text>
            </Pressable>
            <View
              style={styles.track}
              onLayout={(e: LayoutChangeEvent) => {
                trackWidthRef.current = e.nativeEvent.layout.width;
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={onTrackTouch}
              onResponderMove={onTrackTouch}
            >
              <View style={styles.trackBg} />
              <View style={[styles.trackFill, { width: `${zoomPct * 100}%` }]} />
              <View style={[styles.thumb, { left: `${zoomPct * 100}%` }]} />
            </View>
            <Pressable onPress={() => applyZoom(zoom + 0.25)} hitSlop={10}>
              <Text style={styles.sliderEnd}>+</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Отмена</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saveDisabled}
              style={({ pressed }) => [styles.saveBtn, (saveDisabled || pressed) && styles.pressed]}
            >
              <Text style={styles.saveText}>{saving ? "Сохранение..." : "Сохранить"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.screenHorizontal,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: c.glassBorder,
    borderRadius: radii.modal,
    padding: spacing.xl,
    backgroundColor: c.surface,
  },
  title: {
    ...typography.sectionTitle,
    color: c.textPrimary,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: c.textSecondary,
  },
  loadError: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: c.error,
  },
  viewportRow: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  viewport: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: c.primary,
    backgroundColor: c.surfaceElevated,
  },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: c.glassBorder,
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.glassBorder,
  },
  sliderRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sliderEnd: {
    fontSize: 20,
    fontWeight: "600",
    width: 16,
    textAlign: "center",
    color: c.textSecondary,
  },
  track: {
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: c.surfaceElevated,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: c.primary,
  },
  thumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    backgroundColor: c.primary,
  },
  actions: {
    marginTop: spacing.xxl,
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.button,
  },
  cancelText: {
    ...typography.button,
    color: c.textPrimary,
  },
  saveBtn: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.button,
    backgroundColor: c.primary,
  },
  saveText: {
    ...typography.button,
    color: c.background,
  },
  pressed: {
    opacity: 0.6,
  },
});
