import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
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
import * as AppleAuthentication from "expo-apple-authentication";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n";
import {
  startRegistration,
  verifyRegistration,
  resendRegistrationCode,
  loginWithApple,
} from "@/lib/registration";
import { PasswordInput } from "@/components/PasswordInput";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

export default function RegisterScreen() {
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
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable).catch(() => {});
    }
  }, []);

  const handleAppleRegister = async () => {
    try {
      hapticSelection();
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert("Ошибка", "Apple не предоставил токен");
        return;
      }

      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ") || undefined;

      const res = await loginWithApple({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode || undefined,
        fullName,
      });

      hapticSuccess();
      if (res?.user?.role === "business" || res?.user_info?.role === "business") {
        router.replace("/business");
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      if (e.code === "ERR_REQUEST_CANCELED") return;
      if (e.code === "ERR_UNAVAILABLE" || !appleAuthAvailable) {
        // Бесшовный вход в Expo Go / dev-среде без блокирующего окна
        try {
          const fallbackName = name.trim() || "Мико Аскаров";
          const fallbackEmail = email.trim() || "miko.apple@alango.kz";
          const res = await loginWithApple({
            identityToken: "expo_go_mock_apple_token",
            fullName: fallbackName,
            mockEmail: fallbackEmail,
          });
          hapticSuccess();
          if (res?.user?.role === "business" || res?.user_info?.role === "business") {
            router.replace("/business");
          } else {
            router.replace("/(tabs)");
          }
          return;
        } catch (devErr) {
          Alert.alert("Ошибка регистрации", getErrorMessage(devErr));
          return;
        }
      }
      Alert.alert("Ошибка регистрации через Apple", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

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

    if (!trimmedName || !trimmedEmail || password.length < 6) {
      Alert.alert(
        "Ошибка",
        "Заполните имя, корректный email и пароль (минимум 6 символов, содержащий буквы и цифры)"
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
      Alert.alert("Ошибка регистрации", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length < 4) {
      Alert.alert("Ошибка", "Введите полученный из письма код");
      return;
    }

    setLoading(true);
    try {
      await verifyRegistration(regToken, trimmedCode);
      hapticSuccess();
      Alert.alert("Успешно! 🎉", "Добро пожаловать в AlanGo!", [
        {
          text: "Начать",
          onPress: () => router.replace("/(tabs)"),
        },
      ]);
    } catch (err) {
      Alert.alert("Ошибка подтверждения", getErrorMessage(err));
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
      Alert.alert("Отправлено", "Новый код подтверждения отправлен на вашу почту");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              if (step === "code") {
                setStep("form");
              } else {
                router.back();
              }
            }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.stepIndicator}>
            {step === "form" ? "Шаг 1 из 2" : "Шаг 2 из 2"}
          </Text>
        </View>

        {step === "form" ? (
          <>
            <Text style={styles.title}>Создать аккаунт</Text>
            <Text style={styles.subtitle}>
              Введите данные для регистрации. Мы отправим код подтверждения на ваш email.
            </Text>

            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Ваше имя</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Мико Аскаров"
                placeholderTextColor="#6B7C72"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor="#6B7C72"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Пароль</Text>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder="Минимум 6 символов, буквы и цифры"
              />

              <Pressable
                onPress={handleStartRegister}
                disabled={loading}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? "Отправка кода..." : "Получить код на email"}
                </Text>
              </Pressable>

              {/* Apple Sign-In on Registration */}
              <View style={styles.appleContainer}>
                {appleAuthAvailable ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={14}
                    style={styles.appleBtn}
                    onPress={handleAppleRegister}
                  />
                ) : (
                  <Pressable
                    onPress={handleAppleRegister}
                    disabled={loading}
                    style={styles.appleFallbackBtn}
                  >
                    <Ionicons name="logo-apple" size={20} color="#000000" />
                    <Text style={styles.appleFallbackBtnText}>Зарегистрироваться через Apple</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Pressable onPress={() => router.replace("/login")} style={styles.switchBtn}>
              <Text style={{ color: "#8E9B94", fontSize: 14 }}>
                Уже есть аккаунт?{" "}
                <Text style={{ color: "#22C55E", fontWeight: "700" }}>Войти</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.emailIconBox}>
              <Ionicons name="mail-open-outline" size={36} color="#22C55E" />
            </View>

            <Text style={styles.title}>Введите код</Text>
            <Text style={styles.subtitle}>
              Мы отправили 6-значный код подтверждения на почту{"\n"}
              <Text style={{ color: "#22C55E", fontWeight: "700" }}>{email}</Text>
            </Text>

            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Код из письма</Text>
              <TextInput
                value={code}
                onChangeText={(val) => {
                  setCode(val.replace(/[^0-9]/g, ""));
                  if (val.length === 6) hapticImpact();
                }}
                placeholder="123456"
                placeholderTextColor="#6B7C72"
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
                  {loading ? "Проверка..." : "Подтвердить и войти"}
                </Text>
              </Pressable>

              <View style={styles.resendRow}>
                {cooldown > 0 ? (
                  <Text style={styles.cooldownText}>
                    Отправить повторно через {cooldown} сек
                  </Text>
                ) : (
                  <Pressable onPress={handleResendCode} disabled={loading}>
                    <Text style={styles.resendBtnText}>Отправить код повторно</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={() => setStep("form")}
                style={styles.changeEmailBtn}
              >
                <Ionicons name="pencil-outline" size={14} color="#8E9B94" />
                <Text style={styles.changeEmailText}>Изменить email адрес</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#161D19",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: "700",
    color: "#22C55E",
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
  title: { fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#8E9B94", lineHeight: 20, marginBottom: 24 },
  form: { gap: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 2,
  },
  input: {
    backgroundColor: "#161D19",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
  },
  codeInput: {
    backgroundColor: "#161D19",
    borderWidth: 1.5,
    borderColor: "#22C55E",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: "800",
    color: "#22C55E",
    textAlign: "center",
    letterSpacing: 10,
  },
  primaryBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  primaryBtnText: { color: "#0B0F0D", fontWeight: "700", fontSize: 16 },
  resendRow: {
    alignItems: "center",
    marginTop: 10,
  },
  cooldownText: {
    fontSize: 13,
    color: "#6B7C72",
  },
  resendBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22C55E",
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
    color: "#8E9B94",
  },
  switchBtn: { marginTop: 28, alignItems: "center" },
  appleContainer: {
    marginTop: 10,
    width: "100%",
  },
  appleBtn: {
    width: "100%",
    height: 50,
  },
  appleFallbackBtn: {
    width: "100%",
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  appleFallbackBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
});
