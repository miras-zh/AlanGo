import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Linking,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { getAccessToken } from "@/lib/auth";
import { getMyActiveBooking, type ActiveBooking } from "@/lib/sportRentData";

const { width } = Dimensions.get("window");

export interface LiveMatchData {
  id: string;
  arenaName: string;
  hallName: string;
  sport: string;
  timeSlot: string;
  minutesLeft: number;
  qrCode: string;
  address: string;
  started?: boolean;
}


interface Props {
  match: LiveMatchData;
  onPressQr?: () => void;
  onClose?: () => void;
}

const DISMISSED_KEY = "alango_live_match_dismissed";

function toMatch(b: ActiveBooking): LiveMatchData {
  return {
    id: b.code,
    arenaName: b.arenaTitle || b.hallTitle,
    hallName: b.hallTitle,
    sport: b.sportType,
    timeSlot: `Сегодня, ${b.startTime} — ${b.endTime}`,
    minutesLeft: b.startsInMinutes > 0 ? b.startsInMinutes : b.endsInMinutes,
    started: b.startsInMinutes <= 0,
    qrCode: b.code,
    address: "",
  };
}

// Home banner for the user's real booking today (ongoing or starting within
// 3 h). Hidden when there is none; the × hides it for that booking only.
export function LiveMatchIsland() {
  const [match, setMatch] = useState<LiveMatchData | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      setMatch(null);
      return;
    }
    try {
      const [booking, stored] = await Promise.all([
        getMyActiveBooking(),
        AsyncStorage.getItem(DISMISSED_KEY).catch(() => null),
      ]);
      setDismissed(stored);
      setMatch(booking ? toMatch(booking) : null);
    } catch {
      setMatch(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 60_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  if (!match || dismissed === match.id) return null;

  return (
    <LiveMatchIslandView
      match={match}
      onClose={() => {
        hapticSelection();
        setDismissed(match.id);
        AsyncStorage.setItem(DISMISSED_KEY, match.id).catch(() => {});
      }}
    />
  );
}

function LiveMatchIslandView({ match, onPressQr, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulse((prev) => !prev);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const handleToggleExpand = () => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    setExpanded((prev) => !prev);
  };

  const handleOpenMaps = () => {
    hapticSelection();
    const query = encodeURIComponent(`${match.arenaName} ${match.address}`.trim());
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://2gis.kz/astana/search/${query}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://2gis.kz/astana/search/${query}`);
    });
  };

  const handleShowQr = () => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
    if (onPressQr) {
      onPressQr();
    } else {
      setQrModalVisible(true);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Dynamic Island Capsule */}
      <Pressable
        style={[styles.islandPill, expanded && styles.islandPillExpanded]}
        onPress={handleToggleExpand}
      >
        <View style={styles.pillRow}>
          {/* Left: Animated Pulse Dot & Icon */}
          <View style={styles.islandLeft}>
            <View style={[styles.pulseDot, pulse && styles.pulseDotActive]} />
            <View style={styles.sportIconWrap}>
              <Ionicons name="football" size={16} color="#10b981" />
            </View>
          </View>

          {/* Center: Title & Arena */}
          <View style={styles.islandCenter}>
            <Text style={styles.islandTitle} numberOfLines={1}>
              {match.arenaName}
            </Text>
            <Text style={styles.islandSub} numberOfLines={1}>
              {match.hallName}
            </Text>
          </View>

          {/* Right: Countdown Pill */}
          <View style={styles.islandRight}>
            <View style={styles.countdownBadge}>
              <Ionicons name="timer-outline" size={12} color="#10b981" />
              <Text style={styles.countdownText}>
                {match.started ? `ещё ${match.minutesLeft} мин` : `через ${match.minutesLeft} мин`}
              </Text>
            </View>
            {onClose ? (
              <Pressable
                hitSlop={10}
                accessibilityLabel="Скрыть"
                style={styles.closeBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
              >
                <Ionicons name="close" size={16} color="#94a3b8" />
              </Pressable>
            ) : (
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
            )}
          </View>
        </View>

        {/* Expanded State Content */}
        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            <View style={styles.detailsRow}>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>ВРЕМЯ ИГРЫ</Text>
                <Text style={styles.detailValue}>{match.timeSlot}</Text>
              </View>
              <View style={styles.detailColRight}>
                <Text style={styles.detailLabel}>КОД БРОНИ</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {match.qrCode}
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              <Pressable
                style={styles.actionNavBtn}
                onPress={handleOpenMaps}
              >
                <Ionicons name="navigate-outline" size={16} color="#052e16" />
                <Text style={styles.actionNavText}>Маршрут в 2GIS</Text>
              </Pressable>

              <Pressable
                style={styles.actionQrBtn}
                onPress={handleShowQr}
              >
                <Ionicons name="qr-code-outline" size={16} color="#10b981" />
                <Text style={styles.actionQrText}>QR пропуск</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>

      {/* QR Code Pass Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalCard}>
            <Pressable
              style={styles.qrClose}
              onPress={() => setQrModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#94a3b8" />
            </Pressable>

            <Ionicons name="shield-checkmark" size={36} color="#10b981" />
            <Text style={styles.qrModalTitle}>Пропуск на матч</Text>
            <Text style={styles.qrModalArena}>{match.arenaName}</Text>
            <Text style={styles.qrModalHall}>{match.hallName}</Text>

            <View style={styles.qrWhiteBox}>
              <Ionicons name="qr-code" size={170} color="#052e16" />
              <Text style={styles.qrCodeString}>{match.qrCode}</Text>
            </View>

            <Text style={styles.qrHint}>
              Поднесите экран к сканеру на входе в спорткомплекс или покажите дежурному администратору
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.12)",
  },
  wrapper: {
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  islandPill: {
    backgroundColor: "#0d1310",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#1b3323",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  islandPillExpanded: {
    paddingBottom: 16,
    borderColor: "#059669",
    backgroundColor: "#111a14",
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  islandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  pulseDotActive: {
    backgroundColor: "#10b981",
    transform: [{ scale: 1.3 }],
  },
  sportIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#162e21",
    alignItems: "center",
    justifyContent: "center",
  },
  islandCenter: {
    flex: 1,
    paddingHorizontal: 10,
  },
  islandTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f8fafc",
  },
  islandSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  islandRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#162e21",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#059669",
  },
  countdownText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#1e2e24",
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  detailCol: {
    flex: 1,
  },
  detailColRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  actionNavText: {
    color: "#052e16",
    fontSize: 13,
    fontWeight: "700",
  },
  actionQrBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#162e21",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#059669",
  },
  actionQrText: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  qrModalCard: {
    width: "100%",
    backgroundColor: "#151d18",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#223127",
    position: "relative",
  },
  qrClose: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 8,
  },
  qrModalArena: {
    fontSize: 15,
    fontWeight: "600",
    color: "#10b981",
    marginTop: 4,
  },
  qrModalHall: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 16,
  },
  qrWhiteBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  qrCodeString: {
    color: "#052e16",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 6,
  },
  qrHint: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
