import { api } from "@/lib/api";
import { selectionHaptic } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SNOOZE_STORAGE_KEY = "@alango_update_snooze_until";
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000;

interface AppVersionResponse {
  latest_version: string;
  latest_build: number;
  min_version: string;
  min_build: number;
  update_url: string;
  title: string;
  message: string;
}

export function AppUpdatePrompt() {
  const { tokens } = useTheme();
  const t = useT();

  const [visible, setVisible] = useState(false);
  const [isForce, setIsForce] = useState(false);
  const [data, setData] = useState<AppVersionResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkVersion() {
      try {
        const res = await api.get<AppVersionResponse>("/api/app/version");
        if (!mounted || !res.data) return;

        const info = res.data;
        setData(info);

        const rawBuild =
          Constants.nativeBuildVersion ??
          (Platform.OS === "ios"
            ? Constants.expoConfig?.ios?.buildNumber
            : Constants.expoConfig?.android?.versionCode);
        const currentBuild = parseInt(String(rawBuild || "1"), 10);

        const snoozeRaw = await AsyncStorage.getItem(SNOOZE_STORAGE_KEY);
        if (snoozeRaw) {
          const snoozeUntil = parseInt(snoozeRaw, 10);
          if (Date.now() < snoozeUntil) return;
        }

        if (info.min_build > 0 && currentBuild < info.min_build) {
          setIsForce(true);
          setVisible(true);
          return;
        }

        if (info.latest_build > 0 && currentBuild < info.latest_build) {
          setIsForce(false);
          setVisible(true);
        }
      } catch {}
    }

    checkVersion();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdate = async () => {
    selectionHaptic();
    const url = data?.update_url || "https://apps.apple.com";
    Linking.openURL(url).catch(() => {});
  };

  const handleClose = async () => {
    if (isForce) return;
    selectionHaptic();
    try {
      await AsyncStorage.setItem(SNOOZE_STORAGE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
    } catch {}
    setVisible(false);
  };

  if (!visible || !data) return null;

  const titleText = isForce ? t("update.required") : t("update.available");
  const descText =
    data.message && data.message.trim().length > 0
      ? data.message
      : isForce
        ? t("update.requiredDesc")
        : t("update.defaultDesc");

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconCircle, { backgroundColor: tokens.accent + "18" }]}>
            <Ionicons
              name={isForce ? "alert-circle" : "sparkles"}
              size={32}
              color={tokens.accent}
            />
          </View>

          {data.latest_version ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: tokens.accent + "15", borderColor: tokens.accent + "33" },
              ]}
            >
              <Text style={[styles.badgeText, { color: tokens.accent }]}>
                v{data.latest_version}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.title, { color: tokens.text }]}>{titleText}</Text>
          <Text style={[styles.description, { color: tokens.muted }]}>{descText}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={handleUpdate}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: tokens.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="arrow-up-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{t("update.button")}</Text>
            </Pressable>

            {!isForce ? (
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: tokens.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: tokens.muted }]}>
                  {t("update.later")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  actions: {
    width: "100%",
    gap: 10,
  },
  primaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryBtn: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
