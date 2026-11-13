import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n";
import {
  startRegistration,
  verifyRegistration,
  resendRegistrationCode,
} from "@/lib/registration";
import { PasswordInput } from "@/components/PasswordInput";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export default function RegisterScreen() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regToken, setRegToken] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleStartRegister = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || password.length < 8) {
      Alert.alert(
        t("common.error"),
        t("register.fillForm")
      );
      return;
    }

    setLoading(true);
    try {
      const res = await startRegistration({
        full_name: trimmedName,
        email: trimmedEmail,
        password,
      });
      hapticSuccess();
      setRegToken(res.token);
      setStep("code");
      setCooldown(60);
    } catch (err) {
      Alert.alert(t("register.errorTitle"), getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length < 4) {
      Alert.alert(t("common.error"), t("register.enterCode"));
      return;
    }

    setLoading(true);
    try {
      await verifyRegistration(regToken, trimmedCode);
      hapticSuccess();
      Alert.alert(t("register.successTitle"), t("register.successText"), [
        {
          text: t("register.start"),
          onPress: () => router.replace("/(tabs)"),
        },
      ]);
    } catch (err) {
      Alert.alert(t("register.verifyErrorTitle"), getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    hapticSelection();
    setLoading(true);
    try {
      await resendRegistrationCode(regToken);
      hapticSuccess();
      setCooldown(60);
      Alert.alert(t("register.sentTitle"), t("register.sentText"));
    } catch (err) {
      Alert.alert(t("common.error"), getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    hapticSelection();
    if (step === "code") {
      setStep("form");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.stepIndicator}>
            {t("register.step", { n: step === "form" ? 1 : 2 })}
          </Text>
        </View>

        {step === "form" ? (
          <>
            <Text style={styles.title}>{t("register.title")}</Text>
            <Text style={styles.subtitle}>
              {t("register.subtitle")}
            </Text>

            <View style={styles.form}>
              <Text style={styles.fieldLabel}>{t("register.name")}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("register.namePlaceholder")}
                placeholderTextColor={c.textMuted}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={c.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>{t("login.password")}</Text>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder={t("register.passwordPlaceholder")}
              />

              <Pressable
                onPress={handleStartRegister}
                disabled={loading}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? t("register.sendingCode") : t("register.getCode")}
                </Text>
              </Pressable>

              <SocialAuthButtons mode="signup" />
            </View>

            <Pressable onPress={() => router.replace("/login")} style={styles.switchBtn}>
              <Text style={{ color: c.textSecondary, fontSize: 14 }}>
                {t("register.haveAccount")}{" "}
                <Text style={{ color: c.primary, fontWeight: "700" }}>{t("login.submit")}</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.emailIconBox}>
              <Ionicons name="mail-open-outline" size={36} color={c.primary} />
            </View>

            <Text style={styles.title}>{t("register.codeTitle")}</Text>
            <Text style={styles.subtitle}>
              {t("register.codeSent")}{"\n"}
              <Text style={{ color: c.primary, fontWeight: "700" }}>{email}</Text>
            </Text>

            <View style={styles.form}>
              <Text style={styles.fieldLabel}>{t("register.codeLabel")}</Text>
              <TextInput
                value={code}
                onChangeText={(val) => {
                  setCode(val.replace(/[^0-9]/g, ""));
                  if (val.length === 6) hapticImpact();
                }}
                placeholder="123456"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.codeInput}
                autoFocus
              />

              <Pressable
                onPress={handleVerifyCode}
                disabled={loading || code.length < 4}
                style={[
                  styles.primaryBtn,
                  code.length < 4 && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? t("register.checking") : t("register.confirmAndLogin")}
                </Text>
              </Pressable>

              <View style={styles.resendRow}>
                {cooldown > 0 ? (
                  <Text style={styles.cooldownText}>
                    {t("register.resendIn", { n: cooldown })}
                  </Text>
                ) : (
                  <Pressable onPress={handleResendCode} disabled={loading}>
                    <Text style={styles.resendBtnText}>{t("register.resend")}</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={() => setStep("form")}
                style={styles.changeEmailBtn}
              >
                <Ionicons name="pencil-outline" size={14} color={c.textSecondary} />
                <Text style={styles.changeEmailText}>{t("register.changeEmail")}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: "700",
    color: c.primary,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  emailIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  title: { fontSize: 26, fontWeight: "800", color: c.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 24 },
  form: { gap: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textPrimary,
    marginBottom: 2,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.subtle,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: c.textPrimary,
  },
  codeInput: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: "800",
    color: c.primary,
    textAlign: "center",
    letterSpacing: 10,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  primaryBtnText: { color: c.background, fontWeight: "700", fontSize: 16 },
  resendRow: {
    alignItems: "center",
    marginTop: 10,
  },
  cooldownText: {
    fontSize: 13,
    color: c.textMuted,
  },
  resendBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.primary,
  },
  changeEmailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  changeEmailText: {
    fontSize: 13,
    color: c.textSecondary,
  },
  switchBtn: { marginTop: 28, alignItems: "center" },
});
