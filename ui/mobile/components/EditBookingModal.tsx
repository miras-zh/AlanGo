import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Booking } from "@/lib/sportRentData";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";
import { useT } from "@/lib/i18n";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

interface EditBookingModalProps {
  booking: Booking | null;
  onClose: () => void;
  onSave: (b: Booking, updates: { clientName: string; clientPhone: string; notes: string }) => Promise<void>;
}

/**
 * Business: edit the client name, phone and note of a booking (saved on the
 * server). Date and time change through "Reschedule", money through "Payment".
 */
export function EditBookingModal({ booking, onClose, onSave }: EditBookingModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setClientName(booking.clientName || "");
    setClientPhone(booking.clientPhone || "");
    setNotes(booking.notes || "");
  }, [booking]);

  if (!booking) return null;

  const save = async () => {
    if (!clientName.trim() || clientPhone.replace(/\D/g, "").length < 10) {
      Alert.alert(t("common.error"), t("edit.nameAndPhone"));
      return;
    }
    hapticImpact();
    setSaving(true);
    try {
      await onSave(booking, { clientName: clientName.trim(), clientPhone: clientPhone.trim(), notes: notes.trim() });
      hapticSuccess();
      onClose();
    } catch (err) {
      Alert.alert(t("common.error"), getErrorMessage(err, t("edit.saveError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t("request.editContacts")}</Text>
              <Text style={styles.sub}>{t("edit.number", { id: booking.id })}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t("common.close")}>
              <Ionicons name="close" size={20} color={c.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.label}>{t("edit.clientName")}</Text>
            <TextInput style={styles.input} value={clientName} onChangeText={setClientName} placeholderTextColor={c.textMuted} />
            <Text style={styles.label}>{t("account.phone")}</Text>
            <TextInput
              style={styles.input}
              value={clientPhone}
              onChangeText={setClientPhone}
              keyboardType="phone-pad"
              placeholderTextColor={c.textMuted}
            />
            <Text style={styles.label}>{t("request.note")}</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder={t("request.notePlaceholder")}
              placeholderTextColor={c.textMuted}
            />
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.saveBtn} onPress={save} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.saveText}>{t("common.save")}</Text>}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: radii.modal,
      borderTopRightRadius: radii.modal,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: c.textPrimary,
    },
    sub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.subtle,
    },
    body: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: c.surface,
      borderRadius: radii.button,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: c.textPrimary,
    },
    notes: {
      minHeight: 72,
      textAlignVertical: "top",
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
    },
    saveBtn: {
      height: 50,
      borderRadius: radii.button,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary,
    },
    saveText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.onPrimary,
    },
  });
}
