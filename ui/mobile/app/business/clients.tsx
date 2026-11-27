import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { appAlert } from "@/lib/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMyArenaId } from "@/lib/business";
import {
  ClientProfile,
  createClientProfile,
  getClientBookings,
  getClientProfiles,
  updateClientProfile,
} from "@/lib/businessCrmData";
import {
  listArenaBroadcasts,
  sendArenaBroadcast,
  type BroadcastCampaign,
} from "@/lib/notifications";
import type { Booking } from "@/lib/sportRentData";
import { KeyboardSheetView } from "@/components/KeyboardSheetView";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";
import { formatNumber, useT, type MessageKey } from "@/lib/i18n";
import { displayDate } from "@/lib/dataLabels";
import { getErrorMessage } from "@/lib/errorMessage";

const STATUS_FILTERS: { key: string; label: MessageKey | null }[] = [
  { key: "all", label: "clients.all" },
  { key: "vip", label: null },
  { key: "regular", label: "clients.regular" },
  { key: "new", label: "clients.new" },
];

const SEGMENTS: { key: "" | "vip" | "regular" | "new" | "blocked"; label: string }[] = [
  { key: "", label: "Авто" },
  { key: "vip", label: "VIP" },
  { key: "regular", label: "Пост." },
  { key: "new", label: "Новый" },
  { key: "blocked", label: "Блок" },
];

export default function BusinessClientsScreen() {
  const c = usePalette();
  const t = useT();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { arenaId, loading: arenaLoading } = useMyArenaId();

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add client modal
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit / view client modal
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editSegment, setEditSegment] = useState<"" | "vip" | "regular" | "new" | "blocked">("");
  const [editTags, setEditTags] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [clientBookings, setClientBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Broadcast modal
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [bcSegment, setBcSegment] = useState<"all" | "vip" | "regular">("all");
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [sendingBc, setSendingBc] = useState(false);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);

  const loadData = useCallback(async () => {
    if (arenaLoading) return;
    try {
      const list = arenaId ? await getClientProfiles(arenaId) : [];
      setClients(list);
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [arenaId, arenaLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredClients = clients.filter((cl) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      cl.name.toLowerCase().includes(q) ||
      cl.phone.includes(searchQuery) ||
      cl.tags.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (selectedFilter === "all") return true;
    return cl.status === selectedFilter;
  });

  const handleCall = (phone: string) => {
    hapticImpact();
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      appAlert(t("chat.call"), t("clients.phone", { phone }));
    });
  };

  const handleWhatsApp = (phone: string, clientName: string) => {
    hapticSelection();
    const cleanPhone = phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(t("clients.whatsapp", { name: clientName }));
    const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${text}`;
    Linking.canOpenURL(waUrl)
      .then((supported) => {
        if (supported) Linking.openURL(waUrl);
        else Linking.openURL(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`);
      })
      .catch(() => {
        appAlert("WhatsApp", t("clients.phone", { phone }));
      });
  };

  const handleOpenChat = () => {
    hapticSelection();
    if (arenaId) router.push(`/chat/${arenaId}`);
    else router.push("/(tabs)/notifications");
  };

  const openClientModal = (cl: ClientProfile) => {
    hapticSelection();
    setSelectedClient(cl);
    setEditName(cl.name);
    setEditSegment((cl.segmentOverride as any) || "");
    setEditTags(cl.tags || "");
    setEditNotes(cl.notes || "");
    setClientBookings([]);
    setLoadingBookings(true);
    getClientBookings(cl.id)
      .then(setClientBookings)
      .catch(() => setClientBookings([]))
      .finally(() => setLoadingBookings(false));
  };

  const handleSaveClient = async () => {
    if (!selectedClient) return;
    setSavingEdit(true);
    try {
      const updated = await updateClientProfile(selectedClient.id, {
        name: editName.trim() || undefined,
        segment: editSegment,
        tags: editTags.trim(),
        notes: editNotes.trim(),
      });
      setClients((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSelectedClient(null);
      hapticSuccess();
      appAlert(t("common.success"), t("clients.saveSuccess"));
    } catch (err) {
      appAlert(t("common.error"), getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddClient = async () => {
    setSavingAdd(true);
    try {
      const created = await createClientProfile({
        name: newName.trim(),
        phone: newPhone.trim(),
        notes: newNotes.trim(),
      });
      setClients((prev) => {
        const exists = prev.some((x) => x.id === created.id);
        return exists ? prev.map((x) => (x.id === created.id ? created : x)) : [created, ...prev];
      });
      setAddVisible(false);
      setNewName("");
      setNewPhone("");
      setNewNotes("");
      hapticSuccess();
      appAlert(t("common.success"), t("clients.saveSuccess"));
    } catch (err) {
      appAlert(t("common.error"), getErrorMessage(err));
    } finally {
      setSavingAdd(false);
    }
  };

  const openBroadcastModal = () => {
    hapticSelection();
    setBroadcastVisible(true);
    listArenaBroadcasts().then(setCampaigns).catch(() => {});
  };

  const handleSendBroadcast = async () => {
    if (!bcTitle.trim() || !bcBody.trim()) {
      appAlert(t("common.error"), t("broadcast.required"));
      return;
    }
    setSendingBc(true);
    try {
      const res = await sendArenaBroadcast({
        title: bcTitle.trim(),
        body: bcBody.trim(),
        segment: bcSegment,
      });
      hapticSuccess();
      setBcTitle("");
      setBcBody("");
      setCampaigns((prev) => [res.campaign, ...prev]);
      appAlert(
        t("common.success"),
        t("broadcast.sentSuccess", {
          recipients: res.campaign.recipients_count,
          push: res.campaign.push_sent_count,
        })
      );
    } catch (err) {
      appAlert(t("common.error"), getErrorMessage(err));
    } finally {
      setSendingBc(false);
    }
  };

  const totalClientsCount = clients.length;
  const totalLtv = clients.reduce((sum, cl) => sum + cl.totalSpent, 0);
  const appLinkedCount = clients.filter((cl) => cl.hasApp).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle}>{t("clients.title")}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {t("clients.count", { count: totalClientsCount })} • {appLinkedCount} Push • {formatNumber(totalLtv)} ₸
          </Text>
        </View>

        <Pressable style={styles.headerIconBtn} onPress={openBroadcastModal} hitSlop={8}>
          <Ionicons name="megaphone-outline" size={18} color={c.primary} />
        </Pressable>

        <Pressable
          style={[styles.headerIconBtn, { marginLeft: 8 }]}
          onPress={() => {
            hapticSelection();
            setAddVisible(true);
          }}
          hitSlop={8}
        >
          <Ionicons name="person-add-outline" size={18} color={c.primary} />
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={c.textMuted} style={{ marginLeft: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("clients.search")}
          placeholderTextColor={c.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Segment Filters */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const active = selectedFilter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => {
                hapticSelection();
                setSelectedFilter(f.key);
              }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label ? t(f.label) : "⭐ VIP"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={c.primary} size="small" />
        </View>
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={c.border} />
              <Text style={styles.emptyTitle}>
                {clients.length === 0 ? t("clients.emptyAll") : t("clients.notFound")}
              </Text>
              <Text style={styles.emptySub}>
                {clients.length === 0 ? t("clients.emptyAllText") : t("clients.notFoundText")}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isVip = item.status === "vip";
            const isRegular = item.status === "regular";
            const isNew = item.status === "new";
            const isBlocked = item.status === "blocked";

            return (
              <Pressable style={styles.clientCard} onPress={() => openClientModal(item)}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.clientName}>{item.name}</Text>
                    <Text style={styles.clientPhone}>{item.phone || "—"}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isVip && styles.statusBadgeVip,
                      isRegular && styles.statusBadgeRegular,
                      isNew && styles.statusBadgeNew,
                      isBlocked && { backgroundColor: "rgba(240,68,82,0.14)" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isVip && { color: c.warning },
                        isRegular && { color: c.primary },
                        isNew && { color: "#3B82F6" },
                        isBlocked && { color: c.error },
                      ]}
                    >
                      {isVip
                        ? "⭐ VIP"
                        : isRegular
                        ? t("clients.statusRegular")
                        : isNew
                        ? t("clients.statusNew")
                        : t("clients.statusBlocked")}
                    </Text>
                  </View>
                </View>

                {/* Link / Rating / Debt pills */}
                <View style={styles.pillsRow}>
                  <View style={[styles.metaPill, item.hasApp && styles.metaPillGreen]}>
                    <Ionicons
                      name={item.hasApp ? "notifications-outline" : "call-outline"}
                      size={11}
                      color={item.hasApp ? c.primary : c.textSecondary}
                    />
                    <Text style={[styles.metaPillText, item.hasApp && { color: c.primary }]}>
                      {item.hasApp ? t("clients.hasApp") : t("clients.offlineOnly")}
                    </Text>
                  </View>

                  {item.ratingsCount > 0 ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>
                        {t("clients.ratingLabel", { rating: item.rating.toFixed(1) })}
                      </Text>
                    </View>
                  ) : null}

                  {item.unpaidAmount > 0 ? (
                    <View style={[styles.metaPill, { backgroundColor: c.warningSoft }]}>
                      <Text style={[styles.metaPillText, { color: c.warning }]}>
                        {t("clients.debtBadge", { amount: formatNumber(item.unpaidAmount) })}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Metrics */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>{t("clients.bookings")}</Text>
                    <Text style={styles.metricVal}>{item.totalBookings}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>{t("clients.turnover")}</Text>
                    <Text style={[styles.metricVal, { color: c.primary }]}>
                      {formatNumber(item.totalSpent)} ₸
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>{t("clients.lastActivity")}</Text>
                    <Text style={styles.metricVal}>
                      {item.lastBookingDate ? displayDate(item.lastBookingDate, t) : "—"}
                    </Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Ionicons name="document-text-outline" size={13} color={c.textSecondary} />
                    <Text style={styles.notesText} numberOfLines={2}>
                      {item.notes}
                    </Text>
                  </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.cardActionsRow}>
                  <Pressable style={styles.callBtn} onPress={() => handleCall(item.phone)}>
                    <Ionicons name="call" size={15} color={c.textPrimary} />
                    <Text style={styles.callBtnText}>{t("staff.call")}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.whatsappBtn}
                    onPress={() => handleWhatsApp(item.phone, item.name)}
                  >
                    <Ionicons name="logo-whatsapp" size={15} color={c.textPrimary} />
                    <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                  </Pressable>

                  <Pressable style={styles.chatBtn} onPress={handleOpenChat}>
                    <Ionicons name="chatbubble-ellipses" size={15} color={c.primary} />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Client Detail & Edit Modal */}
      <Modal
        visible={!!selectedClient}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedClient(null)}
      >
        <KeyboardSheetView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("clients.modalEditTitle")}</Text>
              <Pressable onPress={() => setSelectedClient(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <Text style={styles.inputLabel}>{t("clients.nameLabel")}</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("clients.segmentLabel")}</Text>
              <View style={styles.chipsWrap}>
                {SEGMENTS.map((seg) => {
                  const active = editSegment === seg.key;
                  return (
                    <Pressable
                      key={seg.key || "auto"}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setEditSegment(seg.key)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {seg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>{t("clients.tagsLabel")}</Text>
              <TextInput
                style={styles.input}
                value={editTags}
                onChangeText={setEditTags}
                placeholder={t("clients.tagsPlaceholder")}
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("clients.notesLabel")}</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder={t("clients.notesPlaceholder")}
                placeholderTextColor={c.textMuted}
                multiline
              />

              <Pressable
                style={[styles.saveBtn, savingEdit && { opacity: 0.6 }]}
                disabled={savingEdit}
                onPress={handleSaveClient}
              >
                <Text style={styles.saveBtnText}>
                  {savingEdit ? t("common.saving") : t("common.save")}
                </Text>
              </Pressable>

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>
                {t("clients.historyTitle")}
              </Text>
              {loadingBookings ? (
                <ActivityIndicator color={c.primary} size="small" />
              ) : clientBookings.length === 0 ? (
                <Text style={styles.emptyBookingsText}>{t("clients.noBookings")}</Text>
              ) : (
                clientBookings.slice(0, 8).map((b) => (
                  <View key={String(b.dbId || b.id)} style={styles.bookingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingRowTitle}>{b.hallTitle}</Text>
                      <Text style={styles.bookingRowSub}>
                        {displayDate(b.date, t)} · {b.timeSlot}
                      </Text>
                    </View>
                    <Text style={styles.bookingRowPrice}>
                      {formatNumber(b.totalPrice)} ₸
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardSheetView>
      </Modal>

      {/* Add Client Modal */}
      <Modal
        visible={addVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddVisible(false)}
      >
        <KeyboardSheetView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("clients.modalAddTitle")}</Text>
              <Pressable onPress={() => setAddVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <Text style={styles.inputLabel}>{t("clients.nameLabel")}</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Алихан / Команда"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("clients.phoneLabel")}</Text>
              <TextInput
                style={styles.input}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                placeholder="+7 701 000 00 00"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.inputLabel}>{t("clients.notesLabel")}</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder={t("clients.notesPlaceholder")}
                placeholderTextColor={c.textMuted}
                multiline
              />

              <Pressable
                style={[styles.saveBtn, savingAdd && { opacity: 0.6 }]}
                disabled={savingAdd}
                onPress={handleAddClient}
              >
                <Text style={styles.saveBtnText}>
                  {savingAdd ? t("common.saving") : t("clients.addBtn")}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardSheetView>
      </Modal>

      {/* Broadcast Modal */}
      <Modal
        visible={broadcastVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBroadcastVisible(false)}
      >
        <KeyboardSheetView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("broadcast.arenaTitle")}</Text>
              <Pressable onPress={() => setBroadcastVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <Text style={styles.inputLabel}>{t("broadcast.segment")}</Text>
              <View style={styles.chipsWrap}>
                {(["all", "vip", "regular"] as const).map((seg) => {
                  const active = bcSegment === seg;
                  const label =
                    seg === "all"
                      ? t("clients.all")
                      : seg === "vip"
                      ? "VIP"
                      : t("clients.regular");
                  return (
                    <Pressable
                      key={seg}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setBcSegment(seg)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>{t("broadcast.titleLabel")}</Text>
              <TextInput
                style={styles.input}
                value={bcTitle}
                onChangeText={setBcTitle}
                placeholder={t("broadcast.titlePlaceholder")}
                placeholderTextColor={c.textMuted}
                maxLength={160}
              />

              <Text style={styles.inputLabel}>{t("broadcast.bodyLabel")}</Text>
              <TextInput
                style={[styles.input, { minHeight: 84, textAlignVertical: "top" }]}
                value={bcBody}
                onChangeText={setBcBody}
                placeholder={t("broadcast.bodyPlaceholder")}
                placeholderTextColor={c.textMuted}
                multiline
                maxLength={2000}
              />

              <Pressable
                style={[styles.saveBtn, sendingBc && { opacity: 0.6 }]}
                disabled={sendingBc}
                onPress={handleSendBroadcast}
              >
                <Text style={styles.saveBtnText}>
                  {sendingBc ? t("broadcast.sending") : t("broadcast.send")}
                </Text>
              </Pressable>

              {campaigns.length > 0 ? (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <Text style={styles.inputLabel}>{t("broadcast.history")}</Text>
                  {campaigns.slice(0, 5).map((item) => (
                    <View key={item.id} style={styles.bookingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookingRowTitle}>{item.title}</Text>
                        <Text style={styles.bookingRowSub}>
                          {t("broadcast.recipientsSummary", {
                            recipients: item.recipients_count,
                            push: item.push_sent_count,
                          })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardSheetView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    backBtn: {
      paddingRight: 6,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    headerSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.primary,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: c.subtle,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: c.textPrimary,
      marginLeft: 8,
    },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    filterChipActive: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    filterText: {
      fontSize: 12,
      color: c.textSecondary,
      fontWeight: "600",
    },
    filterTextActive: {
      color: c.primary,
      fontWeight: "700",
    },
    centerWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    list: {
      padding: 16,
      gap: 12,
    },
    emptyWrap: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: c.textPrimary,
    },
    emptySub: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 18,
    },
    clientCard: {
      backgroundColor: c.surface,
      borderRadius: radii.card,
      padding: 14,
      borderWidth: 1,
      borderColor: c.subtle,
      gap: 10,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    clientName: {
      fontSize: 15,
      fontWeight: "800",
      color: c.textPrimary,
    },
    clientPhone: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.subtle,
    },
    statusBadgeVip: {
      backgroundColor: c.warningSoft,
    },
    statusBadgeRegular: {
      backgroundColor: c.primarySoft,
    },
    statusBadgeNew: {
      backgroundColor: "rgba(59, 130, 246, 0.15)",
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textSecondary,
    },
    pillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    metaPillGreen: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    metaPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textSecondary,
    },
    metricsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: c.background,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    metricItem: {
      alignItems: "center",
      flex: 1,
    },
    metricLabel: {
      fontSize: 11,
      color: c.textMuted,
    },
    metricVal: {
      fontSize: 13,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: 2,
    },
    notesBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.background,
      borderRadius: 8,
      padding: 8,
    },
    notesText: {
      flex: 1,
      fontSize: 12,
      color: c.textSecondary,
    },
    cardActionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    callBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: c.surfaceElevated,
    },
    callBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textPrimary,
    },
    whatsappBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: "rgba(37, 211, 102, 0.18)",
    },
    whatsappBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textPrimary,
    },
    chatBtn: {
      width: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      backgroundColor: c.primarySoft,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: c.overlay,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.modal,
      borderTopRightRadius: radii.modal,
      padding: spacing.xl,
      maxHeight: "90%",
      borderTopWidth: 1,
      borderColor: c.glassBorder,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textSecondary,
    },
    input: {
      backgroundColor: c.background,
      borderRadius: radii.smallChip,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      color: c.textPrimary,
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radii.smallChip,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
    },
    chipTextActive: {
      color: c.primary,
      fontWeight: "700",
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.button,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 4,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: "800",
      color: c.onPrimary,
    },
    emptyBookingsText: {
      fontSize: 13,
      color: c.textMuted,
      paddingVertical: 8,
    },
    bookingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.background,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    bookingRowTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textPrimary,
    },
    bookingRowSub: {
      fontSize: 11,
      color: c.textSecondary,
      marginTop: 2,
    },
    bookingRowPrice: {
      fontSize: 13,
      fontWeight: "800",
      color: c.primary,
    },
  });
