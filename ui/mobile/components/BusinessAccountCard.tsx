import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  businessStatus,
  disableBusiness,
  enableBusiness,
  fetchMyBusiness,
  type BusinessState,
} from "@/lib/business";
import { getRefreshToken, getSessionUser, getToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

// Profile card that opens, disables and re-enables the business account
// (same three states as Vison's AccountSettings business block).
export function BusinessAccountCard() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [state, setState] = useState<BusinessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const user = getSessionUser();
    if (!user || user.role === "guest") {
      setState(null);
      setLoading(false);
      return;
    }
    try {
      setState(await fetchMyBusiness());
    } catch {
      // Backend without /api/business/me yet, or offline — treat as "none".
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const status = businessStatus(state);

  const handleDisable = () => {
    hapticImpact();
    Alert.alert(
      "Отключить бизнес-аккаунт?",
      "Ваша площадка временно скроется из поиска и каталога, а аккаунт переключится в режим клиента. Все данные, залы и цены сохранятся — включить обратно можно в любой момент.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Отключить",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await disableBusiness();
              await load();
              hapticSuccess();
              // Leave the business cabinet if we were in it — the account is a client now.
              router.replace("/(tabs)/profile");
            } catch (err) {
              Alert.alert("Ошибка", getErrorMessage(err, "Не удалось отключить бизнес-аккаунт"));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleEnable = async () => {
    hapticSelection();
    setBusy(true);
    try {
      await enableBusiness();
      await load();
      hapticSuccess();
      router.replace("/business");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err, "Не удалось включить бизнес-аккаунт"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (status === "none") {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, styles.cardAccent, pressed && styles.pressed]}
        onPress={async () => {
          hapticSelection();
          const user = getSessionUser();
          const [token, refreshToken] = await Promise.all([getToken(), getRefreshToken()]);
          if (!user || user.role === "guest" || (!token && !refreshToken)) {
            Alert.alert(
              "Требуется авторизация",
              "Чтобы открыть бизнес-аккаунт, войдите или зарегистрируйтесь.",
              [
                { text: "Отмена", style: "cancel" },
                { text: "Войти", onPress: () => router.push("/login") },
              ],
            );
            return;
          }
          router.push("/business-onboarding");
        }}
      >
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name="briefcase-outline" size={20} color={c.primary} />
          </View>
          <View style={styles.texts}>
            <Text style={styles.title}>Бизнес-аккаунт</Text>
            <Text style={styles.subtitle}>
              Сдавайте спорткомплекс, зал или площадку в аренду и принимайте брони
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.primary} />
        </View>
        <View style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Создать бизнес-аккаунт</Text>
        </View>
      </Pressable>
    );
  }

  const active = status === "active";
  const arenaTitle = state?.arena?.title;

  return (
    <View style={[styles.card, active && styles.cardAccent]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, !active && styles.iconWrapMuted]}>
          <Ionicons
            name={active ? "checkmark-circle" : "pause-circle-outline"}
            size={20}
            color={active ? c.primary : c.textSecondary}
          />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title}>
            {active ? "Бизнес-аккаунт активен" : "Бизнес-аккаунт отключён"}
          </Text>
          <Text style={styles.subtitle}>
            {active
              ? `«${arenaTitle}» видна в каталоге, клиенты могут бронировать.`
              : `«${arenaTitle}» скрыта из каталога. Все данные сохранены.`}
          </Text>
        </View>
      </View>

      {active ? (
        <>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => {
              hapticSelection();
              router.push("/business");
            }}
          >
            <Text style={styles.primaryBtnText}>Открыть бизнес-кабинет</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, (pressed || busy) && styles.pressed]}
            onPress={handleDisable}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={c.error} />
            ) : (
              <Text style={styles.dangerText}>Отключить бизнес-аккаунт</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}
          onPress={handleEnable}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={c.background} />
          ) : (
            <Text style={styles.primaryBtnText}>Включить бизнес-аккаунт</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.card,
    gap: spacing.md,
  },
  cardAccent: {
    borderColor: c.primary,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceElevated,
  },
  iconWrapMuted: {
    backgroundColor: c.surfaceElevated,
  },
  texts: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: c.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: c.textSecondary,
    lineHeight: 17,
  },
  primaryBtn: {
    height: 46,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primary,
  },
  primaryBtnText: {
    ...typography.button,
    color: c.background,
  },
  secondaryBtn: {
    height: 46,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  dangerText: {
    ...typography.button,
    color: c.error,
  },
  pressed: {
    opacity: 0.7,
  },
});
