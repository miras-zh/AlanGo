import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { resolveMyArenaId } from "@/lib/business";
import { getStoredArenas, saveArenaLocation } from "@/lib/sportRentData";
import { getCurrentLocation, type LatLng } from "@/lib/location";
import { getErrorMessage } from "@/lib/errorMessage";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

// City centres used when the arena has no location and GPS is unavailable.
const CITY_CENTER: Record<string, LatLng> = {
  "Астана": { lat: 51.128, lng: 71.43 },
  "Алматы": { lat: 43.2389, lng: 76.8897 },
  "Шымкент": { lat: 42.3417, lng: 69.5901 },
  "Караганда": { lat: 49.8047, lng: 73.1094 },
  "Актобе": { lat: 50.2839, lng: 57.167 },
};

/**
 * Business: pick the sports complex location on a map (tap or drag the pin,
 * or use the current position) and save it to the arena.
 */
export default function ArenaLocationScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const webRef = useRef<any>(null);

  const [arenaId, setArenaId] = useState<number | null>(null);
  const [initial, setInitial] = useState<LatLng | null>(null);
  const [hadLocation, setHadLocation] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await resolveMyArenaId();
      setArenaId(id);
      const arena = id ? (await getStoredArenas()).find((a) => a.id === id) : undefined;
      if (arena?.latitude != null && arena?.longitude != null) {
        const p = { lat: arena.latitude, lng: arena.longitude };
        setHadLocation(true);
        setInitial(p);
        setPoint(p);
        return;
      }
      // No saved location yet: start at the owner's position, else the city centre.
      const res = await getCurrentLocation();
      const start = res.status === "granted" ? res.coords : CITY_CENTER[arena?.city ?? ""] ?? CITY_CENTER["Астана"];
      setInitial(start);
      setPoint(res.status === "granted" ? res.coords : null);
    })();
  }, []);

  const html = useMemo(() => {
    if (!initial) return "";
    return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${c.background};}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
  var start = ${JSON.stringify(initial)};
  var hasPoint = ${JSON.stringify(!!point)};
  var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([start.lat, start.lng], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var pin = null;
  function post(ll) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ lat: ll.lat, lng: ll.lng }));
  }
  window.setPin = function(lat, lng, move) {
    if (!pin) {
      pin = L.marker([lat, lng], { draggable: true }).addTo(map);
      pin.on('dragend', function() { post(pin.getLatLng()); });
    } else {
      pin.setLatLng([lat, lng]);
    }
    if (move) map.setView([lat, lng], 17);
  };
  if (hasPoint) window.setPin(start.lat, start.lng, false);
  map.on('click', function(e) { window.setPin(e.latlng.lat, e.latlng.lng, false); post(e.latlng); });
</script></body></html>`;
    // Built once from the starting point; later moves go through injectJavaScript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, c.background]);

  const useMyPosition = async () => {
    hapticSelection();
    setLocating(true);
    const res = await getCurrentLocation();
    setLocating(false);
    if (res.status !== "granted") {
      Alert.alert(t("bizLocation.noGpsTitle"), t("bizLocation.noGpsText"));
      return;
    }
    setPoint(res.coords);
    webRef.current?.injectJavaScript(`window.setPin(${res.coords.lat}, ${res.coords.lng}, true); true;`);
  };

  const save = async () => {
    if (!arenaId || !point) return;
    hapticImpact();
    setSaving(true);
    try {
      await saveArenaLocation(arenaId, point.lat, point.lng);
      hapticSuccess();
      Alert.alert(t("account.savedTitle"), t("bizLocation.saved"), [{ text: t("common.ok"), onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert(t("common.error"), getErrorMessage(err, t("bizProfile.saveError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("bizLocation.title")}</Text>
          <Text style={styles.subtitle}>{hadLocation ? t("bizLocation.hintEdit") : t("bizLocation.hintNew")}</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        {html ? (
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{ html }}
            style={styles.map}
            onMessage={(e) => {
              try {
                const p = JSON.parse(e.nativeEvent.data);
                if (typeof p.lat === "number" && typeof p.lng === "number") setPoint({ lat: p.lat, lng: p.lng });
              } catch {}
            }}
            javaScriptEnabled
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={c.primary} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.coords} numberOfLines={1}>
          {point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : t("bizLocation.tapMap")}
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={useMyPosition} disabled={locating} accessibilityRole="button">
            {locating ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : (
              <Ionicons name="navigate" size={18} color={c.primary} />
            )}
            <Text style={styles.secondaryText}>{t("map.myLocation")}</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, (!point || !arenaId) && styles.primaryBtnDisabled]}
            onPress={save}
            disabled={!point || !arenaId || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !point || !arenaId, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : (
              <Text style={styles.primaryText}>{t("common.save")}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.screenHorizontal,
      paddingVertical: spacing.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    mapWrap: {
      flex: 1,
    },
    map: {
      flex: 1,
      backgroundColor: c.background,
    },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    footer: {
      paddingHorizontal: spacing.screenHorizontal,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
      backgroundColor: c.surface,
    },
    coords: {
      fontSize: 13,
      color: c.textSecondary,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    secondaryBtn: {
      flex: 1,
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radii.button,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassBackground,
    },
    secondaryText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textPrimary,
    },
    primaryBtn: {
      flex: 1,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.button,
      backgroundColor: c.primary,
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.onPrimary,
    },
  });
}
