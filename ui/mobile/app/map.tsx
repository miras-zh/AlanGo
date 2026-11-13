import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { ArenaWithHalls, getArenasWithHalls } from "@/lib/sportRentData";
import { getSelectedCity } from "@/lib/cities";
import { radii, spacing, typography } from "@/constants/theme";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useLocaleTag, useT, type MessageKey } from "@/lib/i18n";
import { cityLabel } from "@/lib/dataLabels";

const { width, height } = Dimensions.get("window");

const SPORT_FILTERS = [
  { id: "all", name: "map.allHalls" as MessageKey, icon: "grid-outline" },
  { id: "Футбол", name: "sport.football" as MessageKey, icon: "football-outline" },
  { id: "Баскетбол", name: "sport.basketball" as MessageKey, icon: "basketball-outline" },
  { id: "Теннис", name: "sport.tennis" as MessageKey, icon: "tennisball-outline" },
  { id: "Волейбол", name: "sport.volleyball" as MessageKey, icon: "baseball-outline" },
  { id: "Сквош и падл", name: "map.padelSquash" as MessageKey, icon: "fitness-outline" },
];

const CITY_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  Алматы: { lat: 43.2389, lng: 76.8897, zoom: 13 },
  Астана: { lat: 51.1300, lng: 71.4200, zoom: 13 },
  Шымкент: { lat: 42.3417, lng: 69.5901, zoom: 13 },
  Караганда: { lat: 49.8047, lng: 73.1094, zoom: 13 },
  Актобе: { lat: 50.2839, lng: 57.1670, zoom: 13 },
};

const WebViewComponent = WebView as any;

export default function MapScreen() {
  const c = usePalette();
  const t = useT();
  const localeTag = useLocaleTag();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const webViewRef = useRef<any>(null);

  const [arenas, setArenas] = useState<ArenaWithHalls[]>([]);
  const [selectedSport, setSelectedSport] = useState("all");
  const [currentCity, setCurrentCity] = useState("Алматы");
  const [selectedArena, setSelectedArena] = useState<ArenaWithHalls | null>(null);
  const [loading, setLoading] = useState(true);

  // Load city and venues
  useEffect(() => {
    getSelectedCity().then((city) => {
      if (city) setCurrentCity(city);
    });

    getArenasWithHalls().then((data) => {
      setArenas(data);
      setLoading(false);
    });
  }, []);

  // Filter venues by city and selected sport
  const filteredArenas = useMemo(() => {
    return arenas.filter((arena) => {
      const matchCity = !currentCity || arena.city.toLowerCase() === currentCity.toLowerCase();
      const matchSport =
        selectedSport === "all" ||
        arena.availableSports?.includes(selectedSport as any) ||
        arena.sports?.includes(selectedSport as any);
      return matchCity && matchSport;
    });
  }, [arenas, currentCity, selectedSport]);

  const cityCoords = CITY_COORDINATES[currentCity] || CITY_COORDINATES["Алматы"];

  // Handle messages from WebView Leaflet map
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "SELECT_ARENA") {
        const found = arenas.find((a) => a.id === data.id);
        if (found) {
          hapticSelection();
          setSelectedArena(found);
        }
      } else if (data.type === "DESELECT") {
        setSelectedArena(null);
      }
    } catch {
      // ignore
    }
  };

  // Generate Leaflet HTML
  const leafletHtml = useMemo(() => {
    const venuesJson = JSON.stringify(
      filteredArenas.map((a) => ({
        id: a.id,
        title: a.title,
        price: a.minPrice || a.minPricePerHour || 8000,
        address: a.address,
        sports: a.availableSports || a.sports || [],
        lat: a.latitude || cityCoords.lat,
        lng: a.longitude || cityCoords.lng,
      }))
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #e5e3df; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    
    /* Cluster circle styling (matches screenshot: solid blue with white bold font and white border) */
    .custom-cluster-icon {
      background: #1976D2;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      transition: transform 0.15s ease;
    }
    .custom-cluster-icon:active {
      transform: scale(0.92);
    }

    /* Price Badge (speech bubble pill: от 8 000 ₸) */
    .custom-price-badge {
      background: #FFFFFF;
      border: 1.5px solid #10B981;
      border-radius: 12px;
      padding: 4px 8px;
      color: #0B0F0D;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 3px 8px rgba(0,0,0,0.18);
      position: relative;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .custom-price-badge span {
      color: #10B981;
    }
    .custom-price-badge::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #10B981;
    }

    /* Pin marker icon (dark circle with sport icon) */
    .custom-pin-marker {
      background: #37474F;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 8px rgba(0,0,0,0.25);
      cursor: pointer;
    }
    .custom-pin-marker svg {
      width: 16px;
      height: 16px;
      fill: #FFFFFF;
    }

    /* Floating Controls: Locate Me button (top-right) */
    .locate-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 1000;
      background: #FFFFFF;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
      cursor: pointer;
      border: none;
    }
    .locate-btn:active {
      background: #f0f0f0;
      transform: scale(0.95);
    }
    .locate-btn svg {
      width: 22px;
      height: 22px;
      fill: #1976D2;
    }

    /* Zoom Controls (top-left) */
    .leaflet-top.leaflet-left {
      top: 16px;
      left: 16px;
    }
    .leaflet-bar {
      border: none;
      box-shadow: 0 3px 10px rgba(0,0,0,0.22);
      border-radius: 12px;
      overflow: hidden;
    }
    .leaflet-bar a {
      background: #FFFFFF;
      color: #333333;
      width: 40px;
      height: 40px;
      line-height: 40px;
      font-size: 20px;
      font-weight: 700;
      border-bottom: 1px solid #ECEFF1;
    }
    .leaflet-bar a:last-child {
      border-bottom: none;
    }
    .leaflet-control-attribution {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button class="locate-btn" id="locateBtn" title="${t("map.myLocation")}">
    <svg viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
  </button>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script>
    var centerLat = ${cityCoords.lat};
    var centerLng = ${cityCoords.lng};
    var zoomLevel = ${cityCoords.zoom};
    var venues = ${venuesJson};

    // Initialize Map with free OpenStreetMap tiles (no API key required)
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([centerLat, centerLng], zoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Custom Marker Cluster Group
    var markers = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
      iconCreateFunction: function(cluster) {
        var count = cluster.getChildCount();
        var size = count < 10 ? 38 : count < 50 ? 44 : 50;
        return L.divIcon({
          html: '<div>' + count + '</div>',
          className: 'custom-cluster-icon',
          iconSize: [size, size]
        });
      }
    });

    // Add Venue Markers
    venues.forEach(function(v, index) {
      if (!v.lat || !v.lng) return;

      var formattedPrice = Number(v.price).toLocaleString('${localeTag}');
      var priceHtml = '<div class="custom-price-badge">' + ${JSON.stringify(t("map.priceFrom"))}.replace('{price}', '<span>' + formattedPrice + ' ₸</span>') + '</div>';

      var priceIcon = L.divIcon({
        className: 'price-wrapper',
        html: priceHtml,
        iconSize: [110, 32],
        iconAnchor: [55, 32]
      });

      var marker = L.marker([v.lat, v.lng], { icon: priceIcon });

      marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SELECT_ARENA',
            id: v.id
          }));
        }
      });

      markers.addLayer(marker);
    });

    map.addLayer(markers);

    // Click on empty map deselects venue
    map.on('click', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DESELECT' }));
      }
    });

    // Locate Me Handler
    var userMarker = null;
    document.getElementById('locateBtn').addEventListener('click', function() {
      map.locate({ setView: true, maxZoom: 15 });
    });

    map.on('locationfound', function(e) {
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker(e.latlng, {
        radius: 8,
        fillColor: '#1976D2',
        color: c.textPrimary,
        weight: 3,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map);
    });
  </script>
</body>
</html>
    `;
  }, [filteredArenas, cityCoords, t, localeTag]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* --- TOP BAR (Liquid Glass) --- */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
        </Pressable>

        <View style={styles.titleWrap}>
          <Text style={styles.titleText}>{t("map.title")}</Text>
          <View style={styles.cityPill}>
            <Ionicons name="location-sharp" size={12} color={c.primary} />
            <Text style={styles.cityName}>{cityLabel(currentCity, t)}</Text>
            <Text style={styles.venueCount}>{t("map.venueCount", { count: filteredArenas.length })}</Text>
          </View>
        </View>

        <Pressable
          style={styles.listToggleBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
        >
          <Ionicons name="list" size={18} color={c.primary} />
          <Text style={styles.listToggleText}>{t("map.list")}</Text>
        </Pressable>
      </View>

      {/* --- SPORT FILTER CHIPS --- */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {SPORT_FILTERS.map((s) => {
            const active = selectedSport === s.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  hapticSelection();
                  setSelectedSport(s.id);
                  setSelectedArena(null);
                }}
              >
                <Ionicons
                  name={s.icon as any}
                  size={15}
                  color={active ? c.background : c.textSecondary}
                />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {t(s.name)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* --- MAP WEBVIEW --- */}
      <View style={styles.mapContainer}>
        <WebViewComponent
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: leafletHtml }}
          style={styles.webView}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
        />
      </View>

      {/* --- FLOATING VENUE PREVIEW SHEET --- */}
      {selectedArena && (
        <View style={styles.previewCard}>
          <Pressable
            style={styles.closeCardBtn}
            onPress={() => {
              hapticImpact();
              setSelectedArena(null);
            }}
            hitSlop={10}
          >
            <Ionicons name="close" size={18} color={c.textSecondary} />
          </Pressable>

          <View style={styles.previewContent}>
            <Image
              source={{ uri: selectedArena.imageUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <View style={styles.previewDetails}>
              <View style={styles.previewHeaderRow}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {selectedArena.title}
                </Text>
              </View>

              <Text style={styles.previewAddress} numberOfLines={1}>
                <Ionicons name="location-outline" size={13} color={c.textMuted} /> {selectedArena.address}
              </Text>

              <View style={styles.previewMetaRow}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={13} color="#FBBF24" />
                  <Text style={styles.ratingText}>{selectedArena.rating.toFixed(1)}</Text>
                  <Text style={styles.reviewsCount}>({selectedArena.reviewsCount})</Text>
                </View>

                <Text style={styles.previewPrice}>
                  {t("common.priceFrom", { price: formatNumber(selectedArena.minPrice) })}
                  <Text style={styles.previewPriceUnit}> {t("map.perHourShort")}</Text>
                </Text>
              </View>

              <Pressable
                style={styles.bookBtn}
                onPress={() => {
                  hapticSelection();
                  router.push(`/arena/${selectedArena.id}`);
                }}
              >
                <Text style={styles.bookBtnText}>{t("map.viewHalls")}</Text>
                <Ionicons name="arrow-forward" size={15} color={c.background} />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: c.background,
    borderBottomWidth: 1,
    borderBottomColor: "#18201B",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    alignItems: "center",
  },
  titleText: {
    fontSize: 17,
    fontWeight: "700",
    color: c.textPrimary,
  },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  cityName: {
    fontSize: 12,
    fontWeight: "600",
    color: c.primary,
  },
  venueCount: {
    fontSize: 12,
    color: c.textMuted,
  },
  listToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  listToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.primary,
  },
  filterBar: {
    backgroundColor: c.background,
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: "#202B24",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  filterChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
  },
  filterChipTextActive: {
    color: c.background,
    fontWeight: "700",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  webView: {
    flex: 1,
    backgroundColor: "#e5e3df",
  },
  previewCard: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#223128",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  closeCardBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  previewContent: {
    flexDirection: "row",
    gap: 12,
  },
  previewImage: {
    width: 100,
    height: 105,
    borderRadius: 14,
    backgroundColor: c.surfaceElevated,
  },
  previewDetails: {
    flex: 1,
    justifyContent: "space-between",
  },
  previewHeaderRow: {
    paddingRight: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.textPrimary,
  },
  previewAddress: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
  previewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: c.textPrimary,
  },
  reviewsCount: {
    fontSize: 11,
    color: c.textMuted,
  },
  previewPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: c.primary,
  },
  previewPriceUnit: {
    fontSize: 11,
    fontWeight: "500",
    color: c.textSecondary,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: c.primary,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 2,
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: c.background,
  },
});
