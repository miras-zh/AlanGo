import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { appAlert } from "@/lib/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Booking } from "@/lib/sportRentData";
import { radii, spacing } from "@/constants/theme";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { formatNumber, useT } from "@/lib/i18n";
import { displayDate, sportLabel, weekdayName } from "@/lib/dataLabels";
import { callPhone, openWhatsApp } from "@/lib/contactLinks";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

interface BookingDetailsModalProps {
  visible?: boolean;
  booking: Booking | null;
  onClose: () => void;
  onDismiss?: () => void;
  onConfirm: (b: Booking) => Promise<void>;
  onReject: (b: Booking) => void;
  onReschedule: (b: Booking) => void;
  onCancel: (b: Booking) => Promise<void>;
  onPayment: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  useModal?: boolean;
}

export function bookingStatusMeta(status: Booking["status"], c: Palette) {
  switch (status) {
    case "pending":
      return { key: "request.statusPending" as const, color: c.warning, bg: c.warningSoft, icon: "hourglass-outline" as const };
    case "confirmed":
      return { key: "status.confirmed" as const, color: c.primary, bg: c.primarySoft, icon: "checkmark-circle" as const };
    case "completed":
      return { key: "request.statusCompleted" as const, color: c.textSecondary, bg: c.subtle, icon: "flag-outline" as const };
    case "rejected":
      return { key: "status.rejected" as const, color: c.error, bg: c.subtle, icon: "close-circle" as const };
    default:
      return { key: "status.cancelled" as const, color: c.textMuted, bg: c.subtle, icon: "ban-outline" as const };
  }
}

/**
 * Business: one booking / request in full — hall, time, price, client
 * contacts (call, WhatsApp) and the actions its status allows.
 */
export function BookingDetailsModal({
  visible,
  booking,
  onClose,
  onDismiss,
  onConfirm,
  onReject,
  onReschedule,
  onCancel,
  onPayment,
  onEdit,
  useModal = true,
}: BookingDetailsModalProps) {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const [busy, setBusy] = useState(false);

  if (!booking || (!useModal && visible === false)) return null;
  const b = booking;
  const meta = bookingStatusMeta(b.status, c);
  const isPending = b.status === "pending";
  const isActive = isPending || b.status === "confirmed";
  const total = b.totalPrice || 0;
  const paid = b.paidAmount ?? 0;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? new Date(`${b.date}T00:00:00`) : null;
  const dateLine = day ? `${weekdayName(day.getDay(), t)}, ${displayDate(b.date, t)}` : displayDate(b.date, t);

  const contact = (fn: () => Promise<void>) => {
    hapticSelection();
    fn().catch(() => appAlert(t("common.error"), t("request.contactError")));
  };

  const run = async (fn: () => Promise<void>) => {
    hapticImpact();
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessible={false} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{isPending ? t("request.title") : t("request.bookingTitle")}</Text>
              <Text style={styles.code}>{t("edit.number", { id: b.id })}</Text>
            </View>
            <Pressable testID="detail-close-btn" onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t("common.close")}>
              <Ionicons name="close" size={20} color={c.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={14} color={meta.color} />
              <Text style={[styles.statusText, { color: meta.color }]}>{t(meta.key)}</Text>
            </View>

            {/* Where and when */}
            <View style={styles.card}>
              <Row icon="layers-outline" label={t("request.hall")} value={`${b.hallTitle} · ${sportLabel(b.sportType, t)}`} styles={styles} c={c} />
              <Row icon="calendar-outline" label={t("request.date")} value={dateLine} styles={styles} c={c} />
              <Row icon="time-outline" label={t("request.time")} value={t("request.timeValue", { time: b.timeSlot, n: b.durationMinutes })} styles={styles} c={c} />
              <Row
                icon="wallet-outline"
                label={t("bookings.cost")}
                value={
                  paid > 0
                    ? t("request.priceWithPaid", { price: formatNumber(total), paid: formatNumber(paid) })
                    : `${formatNumber(total)} ₸`
                }
                styles={styles}
                c={c}
                last
              />
            </View>

            {/* Client */}
            <Text style={styles.sectionLabel}>{t("request.client")}</Text>
            <View style={styles.card}>
              <View style={styles.clientRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(b.clientName || "?").trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{b.clientName}</Text>
                  <Text style={styles.clientPhone}>{b.clientPhone}</Text>
                  <Text style={styles.clientSource}>{b.userId ? t("request.fromApp") : b.status === "pending" ? t("request.guest") : t("request.manual")}</Text>
                </View>
              </View>
              <View style={styles.contactRow}>
                <Pressable style={styles.contactBtn} onPress={() => contact(() => callPhone(b.clientPhone))} accessibilityRole="button">
                  <Ionicons name="call" size={16} color={c.primary} />
                  <Text style={styles.contactText}>{t("chat.call")}</Text>
                </Pressable>
                <Pressable
                  style={styles.contactBtn}
                  onPress={() =>
                    contact(() =>
                      openWhatsApp(
                        b.clientPhone,
                        t("request.whatsappText", { name: b.clientName, hall: b.hallTitle, date: displayDate(b.date, t), time: b.timeSlot }),
                      ),
                    )
                  }
                  accessibilityRole="button"
                >
                  <Ionicons name="logo-whatsapp" size={16} color={c.primary} />
                  <Text style={styles.contactText}>WhatsApp</Text>
                </Pressable>
              </View>
            </View>

            {b.notes ? (
              <View style={styles.noteBox}>
                <Ionicons name="document-text-outline" size={14} color={c.textSecondary} />
                <Text style={styles.noteText}>{b.notes}</Text>
              </View>
            ) : null}

            {b.status === "rejected" && b.rejectionReason ? (
              <View style={styles.noteBox}>
                <Ionicons name="alert-circle" size={14} color={c.error} />
                <Text style={styles.noteText}>{t("bookings.reason", { reason: b.rejectionReason })}</Text>
              </View>
            ) : null}

            {isActive ? (
              <View style={styles.secondaryActions}>
                <SmallAction testID="detail-reschedule-btn" icon="swap-horizontal" label={t("request.reschedule")} onPress={() => onReschedule(b)} styles={styles} c={c} />
                <SmallAction testID="detail-payment-btn" icon="card-outline" label={t("bookings.payment")} onPress={() => onPayment(b)} styles={styles} c={c} />
                <SmallAction testID="detail-edit-btn" icon="create-outline" label={t("request.editContacts")} onPress={() => onEdit(b)} styles={styles} c={c} />
              </View>
            ) : null}
          </ScrollView>

          {isActive ? (
            <View style={styles.footer}>
              {isPending ? (
                <>
                  <Pressable style={styles.rejectBtn} disabled={busy} onPress={() => onReject(b)} accessibilityRole="button">
                    <Ionicons name="close" size={18} color={c.error} />
                    <Text style={styles.rejectText}>{t("request.reject")}</Text>
                  </Pressable>
                  <Pressable style={styles.confirmBtn} disabled={busy} onPress={() => run(() => onConfirm(b))} accessibilityRole="button">
                    {busy ? (
                      <ActivityIndicator color={c.onPrimary} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color={c.onPrimary} />
                        <Text style={styles.confirmText}>{t("common.confirm")}</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.rejectBtn}
                  disabled={busy}
                  onPress={() =>
                    appAlert(t("request.cancelTitle"), t("request.cancelText"), [
                      { text: t("request.keep"), style: "cancel" },
                      { text: t("request.cancelBooking"), style: "destructive", onPress: () => run(() => onCancel(b)) },
                    ])
                  }
                  accessibilityRole="button"
                >
                  <Ionicons name="ban-outline" size={18} color={c.error} />
                  <Text style={styles.rejectText}>{t("request.cancelBooking")}</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </SafeAreaView>
      </View>
  );

  if (!useModal) {
    return <View style={StyleSheet.absoluteFill}>{content}</View>;
  }

  return (
    <Modal
      visible={visible ?? !!booking}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      {content}
    </Modal>
  );
}

function Row({
  icon,
  label,
  value,
  last,
  styles,
  c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
  styles: ReturnType<typeof createStyles>;
  c: Palette;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Ionicons name={icon} size={16} color={c.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SmallAction({
  testID,
  icon,
  label,
  onPress,
  styles,
  c,
}: {
  testID?: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  c: Palette;
}) {
  return (
    <Pressable
      testID={testID}
      style={styles.smallAction}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={18} color={c.textPrimary} />
      <Text style={styles.smallActionText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
      maxHeight: "90%",
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
    code: {
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
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    statusPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.icon,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.smallChip,
    },
    statusText: {
      fontSize: 13,
      fontWeight: "700",
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    rowLabel: {
      fontSize: 13,
      color: c.textSecondary,
      width: 84,
    },
    rowValue: {
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
      color: c.textPrimary,
      textAlign: "right",
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      marginTop: spacing.xs,
    },
    clientRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primarySoft,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "800",
      color: c.primary,
    },
    clientName: {
      fontSize: 16,
      fontWeight: "800",
      color: c.textPrimary,
    },
    clientPhone: {
      fontSize: 14,
      color: c.textPrimary,
      marginTop: 2,
    },
    clientSource: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    contactRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    contactBtn: {
      flex: 1,
      height: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.icon,
      borderRadius: radii.button,
      backgroundColor: c.primarySoft,
    },
    contactText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.primary,
    },
    noteBox: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.smallChip,
      backgroundColor: c.subtle,
    },
    noteText: {
      flex: 1,
      fontSize: 13,
      color: c.textPrimary,
    },
    secondaryActions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    smallAction: {
      flex: 1,
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radii.button,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    smallActionText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textPrimary,
    },
    footer: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
    },
    rejectBtn: {
      flex: 1,
      height: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.icon,
      borderRadius: radii.button,
      borderWidth: 1,
      borderColor: c.error,
    },
    rejectText: {
      fontSize: 15,
      fontWeight: "700",
      color: c.error,
    },
    confirmBtn: {
      flex: 1.4,
      height: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.icon,
      borderRadius: radii.button,
      backgroundColor: c.primary,
    },
    confirmText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.onPrimary,
    },
  });
}
