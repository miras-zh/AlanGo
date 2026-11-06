import { sendChatMessage, ChatMessage } from "@/lib/chatData";

export interface BotQuickPrompt {
  id: string;
  label: string;
  icon: string;
  text: string;
}

export const BOT_QUICK_PROMPTS: BotQuickPrompt[] = [
  {
    id: "shoes",
    label: "Обувь и шипы",
    icon: "footsteps-outline",
    text: "Какая обувь разрешена на поле?",
  },
  {
    id: "balls",
    label: "Мячи и инвентарь",
    icon: "basketball-outline",
    text: "Предоставляются ли мячи и манишки?",
  },
  {
    id: "parking",
    label: "Парковка",
    icon: "car-outline",
    text: "Где находится парковка и платная ли она?",
  },
  {
    id: "showers",
    label: "Раздевалки и душ",
    icon: "water-outline",
    text: "Есть ли раздевалки, шкафчики и горячий душ?",
  },
  {
    id: "booking",
    label: "Свободные слоты",
    icon: "calendar-outline",
    text: "Как забронировать свободный слот на сегодня?",
  },
];

interface BotRule {
  keywords: string[];
  reply: string;
}

const BOT_KNOWLEDGE_BASE: BotRule[] = [
  {
    keywords: ["обув", "шип", "сороконожк", "бутс", "футзалк", "бамп", "покрыти"],
    reply:
      "На нашем искусственном газоне разрешены сороконожки (TF) и футзалки. Бутсы с металлическими шипами (SG/FG) строго запрещены для сохранности сертифицированного покрытия поля ⚽️👟",
  },
  {
    keywords: ["мяч", "манишк", "инвентар", "насос", "сетк", "ракетк", "экипировк"],
    reply:
      "Да! При аренде зала администратор бесплатно выдает профессиональный игровой мяч (FIFA/Molten/Wilson) и два комплекта разноцветных манишек на ресепшн. Ракетки и доп. мячи можно также взять в аренду 🎾🏀",
  },
  {
    keywords: ["парковк", "машин", "стоянк", "шлагбаум", "заезд", "проехать"],
    reply:
      "У комплекса есть собственная бесплатная охраняемая парковка на 50 автомобилей. Для въезда через шлагбаум просто покажите подтвержденную бронь на экране смартфона охране 🚗🅿️",
  },
  {
    keywords: ["душ", "раздевалк", "шкафчик", "полотенец", "вода", "саун"],
    reply:
      "В стоимость бронирования входят просторные раздевалки с индивидуальными электронными шкафчиками и душевые с постоянной горячей водой. Чистые полотенца доступны на ресепшн 🚿🧖‍♂️",
  },
  {
    keywords: ["слот", "забронироват", "записат", "свободн", "время", "сегодня", "завтра"],
    reply:
      "Вы можете выбрать и забронировать подходящий слот прямо в приложении во вкладке «Залы» с мгновенным подтверждением, либо напишите удобное время здесь, и дежурный менеджер подтвердит запись! 📅⚡️",
  },
  {
    keywords: ["отмен", "перенес", "возврат", "деньги", "предоплат"],
    reply:
      "Бесплатная отмена или перенос бронирования возможны не позднее чем за 12 часов до начала слота. При своевременной отмене средства возвращаются в полном объеме на ваш баланс или карту 🔄💳",
  },
  {
    keywords: ["привет", "салам", "здравствуй", "добрый", "хай", "hello"],
    reply:
      "Здравствуйте! 🤖 Я AI-ассистент спортивного комплекса. Готов быстро ответить на любые вопросы по залам, инвентарю, правилам посещения и свободным окнам. Чем могу помочь?",
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
      matchedReply = rule.reply;
      break;
    }
  }

  if (!matchedReply) {
    matchedReply = `Спасибо за сообщение! Запрос передан дежурному администратору арены «${arenaTitle}». Также вы можете выбрать типовой вопрос из подсказок внизу экрана 🤖`;
  }

  // Artificial natural delay (600 - 1000ms)
  await new Promise((res) => setTimeout(res, 750));

  return await sendChatMessage(
    chatId,
    matchedReply,
    "bot",
    `${arenaTitle} (Бот)`
  );
}

