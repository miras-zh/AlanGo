import { sendChatMessage, ChatMessage } from "@/lib/chatData";
import { tr, type MessageKey } from "@/lib/i18n";

export interface BotQuickPrompt {
  id: string;
  label: MessageKey;
  icon: string;
  text: MessageKey;
}

export const BOT_QUICK_PROMPTS: BotQuickPrompt[] = [
  { id: "shoes", label: "bot.shoesLabel", icon: "footsteps-outline", text: "bot.shoesText" },
  { id: "balls", label: "bot.ballsLabel", icon: "football-outline", text: "bot.ballsText" },
  { id: "parking", label: "bot.parkingLabel", icon: "car-outline", text: "bot.parkingText" },
  { id: "showers", label: "bot.showersLabel", icon: "water-outline", text: "bot.showersText" },
  { id: "slots", label: "bot.slotsLabel", icon: "calendar-outline", text: "bot.slotsText" },
];

interface BotRule {
  // Lower-case stems in Russian, Kazakh and English.
  keywords: string[];
  reply: MessageKey;
}

const BOT_KNOWLEDGE_BASE: BotRule[] = [
  {
    keywords: ["обув", "шип", "сороконожк", "бутс", "футзалк", "бамп", "покрыти", "аяқ киім", "бутсы", "shoe", "boot", "cleat", "studs"],
    reply: "bot.shoesReply",
  },
  {
    keywords: ["мяч", "манишк", "инвентар", "насос", "сетк", "ракетк", "экипировк", "доп", "құрал", "ball", "bib", "equipment", "racket"],
    reply: "bot.ballsReply",
  },
  {
    keywords: ["парковк", "машин", "стоянк", "шлагбаум", "заезд", "проехать", "тұрақ", "көлік", "parking", "car"],
    reply: "bot.parkingReply",
  },
  {
    keywords: ["душ", "раздевалк", "шкафчик", "полотенец", "вода", "саун", "киім ауыстыр", "шкаф", "shower", "locker", "changing", "towel", "sauna"],
    reply: "bot.showersReply",
  },
  {
    keywords: ["слот", "забронироват", "записат", "свободн", "время", "сегодня", "завтра", "брондау", "бос", "уақыт", "бүгін", "ертең", "slot", "book", "free", "today", "tomorrow"],
    reply: "bot.slotsReply",
  },
  {
    keywords: ["отмен", "перенес", "возврат", "деньги", "предоплат", "болдырма", "ауыстыр", "қайтар", "cancel", "refund", "reschedule"],
    reply: "bot.cancelReply",
  },
  {
    keywords: ["привет", "салам", "здравствуй", "добрый", "хай", "hello", "сәлем", "қайырлы", "hi", "hey"],
    reply: "bot.helloReply",
  },
];

export async function processChatBotReply(
  chatId: string,
  userText: string,
  arenaTitle: string,
  botMode: "always" | "after_hours" | "delayed" | "off" = "always"
): Promise<ChatMessage | null> {
  if (botMode === "off") return null;

  const hour = new Date().getHours();
  const isAfterHours = hour >= 22 || hour < 8;

  if (botMode === "after_hours" && !isAfterHours) {
    // During working hours, let human admin answer
    return null;
  }

  const normalized = userText.toLowerCase().trim();

  // Find matching answer
  let matchedReply: string | null = null;
  for (const rule of BOT_KNOWLEDGE_BASE) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      matchedReply = tr(rule.reply);
      break;
    }
  }

  if (!matchedReply) {
    matchedReply = tr("bot.fallbackReply", { arena: arenaTitle });
  }

  // Artificial natural delay (600 - 1000ms)
  await new Promise((res) => setTimeout(res, 750));

  return await sendChatMessage(
    chatId,
    matchedReply,
    "bot",
    tr("bot.senderName", { arena: arenaTitle })
  );
}

