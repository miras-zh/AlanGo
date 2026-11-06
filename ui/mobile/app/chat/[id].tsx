import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ChatMessage,
  ChatDialog,
  getStoredMessages,
  sendChatMessage,
  markChatAsRead,
  subscribeToChats,
  getStoredDialogs,
} from "@/lib/chatData";
import { processChatBotReply, BOT_QUICK_PROMPTS } from "@/lib/arenaChatBot";
import { hapticImpact, hapticSelection, hapticSuccess } from "@/lib/haptics";

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
  }>();

  const chatId = params.id || "1";
  const [dialog, setDialog] = useState<ChatDialog | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  const flatListRef = useRef<FlatList>(null);

  const loadData = useCallback(async () => {
    const dialogs = await getStoredDialogs();
    const found = dialogs.find((d) => d.id === chatId);
    if (found) {
      setDialog(found);
    }
    const msgs = await getStoredMessages(chatId);
    setMessages(msgs);
    setLoading(false);
    await markChatAsRead(chatId);
  }, [chatId]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChats(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    hapticImpact();
    setInputText("");

    // 1. Send client message
    const clientMsg = await sendChatMessage(chatId, text, "client", "Вы");
    setMessages((prev) => [...prev, clientMsg]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // 2. Trigger ChatBot reply if enabled
    const currentDialog = dialog;
    const botMode = currentDialog?.botMode || "always";

    if (botMode !== "off") {
      setIsBotTyping(true);
      try {
        const botMsg = await processChatBotReply(
          chatId,
          text,
          currentDialog?.arenaTitle || params.name || "Арена",
          botMode
        );
        if (botMsg) {
          hapticSuccess();
          setMessages((prev) => [...prev, botMsg]);
        }
      } catch (e) {
        console.error("Bot error:", e);
      } finally {
        setIsBotTyping(false);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 150);
      }
    }
  };

  const handleCall = () => {
    hapticSelection();
    const phone = dialog?.clientPhone || "+77011234567";
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert("Звонок", `Телефон арены: ${phone}`);
    });
  };

  const arenaTitle = dialog?.arenaTitle || params.name || "Спортивная Арена";
  const arenaAvatar =
    dialog?.arenaAvatar ||
    params.avatar ||
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            hapticSelection();
            router.back();
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerAvatarWrap}>
          <Image source={{ uri: arenaAvatar }} style={styles.headerAvatar} />
          <View style={styles.onlineBadge} />
        </View>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {arenaTitle}
          </Text>
          <View style={styles.botBadgeRow}>
            <View style={styles.botIconWrap}>
              <Ionicons name="hardware-chip-outline" size={11} color="#22C55E" />
            </View>
            <Text style={styles.botStatusText}>AI-Бот ответит за 1 сек</Text>
          </View>
        </View>

        <Pressable style={styles.callBtn} onPress={handleCall} hitSlop={10}>
          <Ionicons name="call" size={18} color="#22C55E" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* Messages List */}
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator color="#22C55E" size="small" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            renderItem={({ item }) => {
              const isMe = item.senderRole === "client";
              const isBot = item.senderRole === "bot";

              const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <View
                  style={[
                    styles.messageRow,
                    isMe ? styles.messageRowMe : styles.messageRowOther,
                  ]}
                >
                  {!isMe && (
                    <View style={styles.msgAvatarWrap}>
                      {isBot ? (
                        <View style={styles.botAvatar}>
                          <Ionicons name="sparkles" size={12} color="#22C55E" />
                        </View>
                      ) : (
                        <Image
                          source={{ uri: arenaAvatar }}
                          style={styles.msgSmallAvatar}
                        />
                      )}
                    </View>
                  )}

                  <View
                    style={[
                      styles.bubble,
                      isMe
                        ? styles.bubbleMe
                        : isBot
                        ? styles.bubbleBot
                        : styles.bubbleOther,
                    ]}
                  >
                    {!isMe && (
                      <View style={styles.senderHeader}>
                        <Text
                          style={[
                            styles.senderName,
                            isBot && { color: "#22C55E" },
                          ]}
                        >
                          {item.senderName}
                        </Text>
                        {isBot && (
                          <View style={styles.botTag}>
                            <Text style={styles.botTagText}>BOT</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <Text
                      style={[
                        styles.msgText,
                        isMe ? styles.msgTextMe : styles.msgTextOther,
                      ]}
                    >
                      {item.text}
                    </Text>

                    {/* Booking Reference Widget inside message */}
                    {item.bookingRef && (
                      <View style={styles.bookingCardWidget}>
                        <View style={styles.widgetHeader}>
                          <Ionicons
                            name="calendar-sharp"
                            size={14}
                            color="#22C55E"
                          />
                          <Text style={styles.widgetTitle}>
                            Подтвержденная бронь
                          </Text>
                        </View>
                        <Text style={styles.widgetHall}>
                          {item.bookingRef.hallTitle}
                        </Text>
                        <Text style={styles.widgetTime}>
                          {item.bookingRef.date}, {item.bookingRef.timeSlot}
                        </Text>
                        <View style={styles.widgetFooter}>
                          <Text style={styles.widgetPrice}>
                            {item.bookingRef.totalPrice.toLocaleString("ru-RU")}{" "}
                            ₸
                          </Text>
                          <View style={styles.confirmedBadge}>
                            <Text style={styles.confirmedBadgeText}>
                              Активно
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    <View style={styles.timeRow}>
                      <Text
                        style={[
                          styles.timeText,
                          isMe ? styles.timeTextMe : styles.timeTextOther,
                        ]}
                      >
                        {timeStr}
                      </Text>
                      {isMe && (
                        <Ionicons
                          name={item.isRead ? "checkmark-done" : "checkmark"}
                          size={14}
                          color="#22C55E"
                          style={{ marginLeft: 3 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              isBotTyping ? (
                <View style={styles.typingRow}>
                  <View style={styles.botAvatar}>
                    <Ionicons name="sparkles" size={12} color="#22C55E" />
                  </View>
                  <View style={styles.typingBubble}>
                    <ActivityIndicator size="small" color="#22C55E" />
                    <Text style={styles.typingText}>Ассистент печатает...</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Quick Prompts Bar */}
        <View style={styles.quickPromptsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickPromptsScroll}
          >
            {BOT_QUICK_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt.id}
                style={styles.promptChip}
                onPress={() => {
                  hapticSelection();
                  handleSend(prompt.text);
                }}
              >
                <Ionicons
                  name={prompt.icon as any}
                  size={13}
                  color="#22C55E"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.promptChipText}>{prompt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Задайте вопрос или напишите время..."
            placeholderTextColor="#6B7C72"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />

          <Pressable
            style={[
              styles.sendBtn,
              inputText.trim().length > 0 && styles.sendBtnActive,
            ]}
            onPress={() => handleSend()}
            disabled={inputText.trim().length === 0}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={inputText.trim().length > 0 ? "#0B0F0D" : "#4B5563"}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#131916",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  backBtn: {
    paddingRight: 10,
  },
  headerAvatarWrap: {
    position: "relative",
    marginRight: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1F2923",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: "#131916",
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  botBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  botIconWrap: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    padding: 2,
    borderRadius: 4,
  },
  botStatusText: {
    fontSize: 11,
    color: "#22C55E",
    fontWeight: "600",
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  messageRowMe: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  msgAvatarWrap: {
    marginBottom: 4,
  },
  msgSmallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: "#166534",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#18201C",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  bubbleBot: {
    backgroundColor: "#131916",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  senderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E9B94",
  },
  botTag: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  botTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#22C55E",
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextMe: {
    color: "#FFFFFF",
  },
  msgTextOther: {
    color: "#F3F4F6",
  },
  bookingCardWidget: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  widgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  widgetTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#22C55E",
    textTransform: "uppercase",
  },
  widgetHall: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  widgetTime: {
    fontSize: 12,
    color: "#8E9B94",
    marginTop: 2,
  },
  widgetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  widgetPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  confirmedBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confirmedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#22C55E",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  timeTextMe: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  timeTextOther: {
    color: "#6B7C72",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#131916",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  typingText: {
    fontSize: 12,
    color: "#8E9B94",
    fontStyle: "italic",
  },
  quickPromptsWrap: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
  },
  quickPromptsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18201C",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  promptChipText: {
    fontSize: 11,
    color: "#E5E7EB",
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#131916",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#0B0F0D",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    paddingTop: 8,
    color: "#FFFFFF",
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendBtnActive: {
    backgroundColor: "#22C55E",
  },
});

