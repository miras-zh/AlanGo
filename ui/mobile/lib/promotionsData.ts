import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Promotion {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  discountPercent: number;
  bannerGradient: [string, string];
  icon: string;
  description: string;
  conditions: string;
  activeHours?: {
    startHour: number; // e.g. 10 (10:00)
    endHour: number;   // e.g. 16 (16:00)
    weekdaysOnly: boolean;
  };
  promoCode?: string;
  isEnabled: boolean;
}

const STORAGE_KEY = '@alango_promotions_v1';

export const INITIAL_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-happy-hours',
    title: 'Дневные Счастливые Часы',
    tagline: 'Скидка 20% в будни с 10:00 до 16:00',
    badge: '-20% ДНЕВНОЙ',
    discountPercent: 20,
    bannerGradient: ['#065f46', '#047857'],
    icon: 'sunny',
    description: 'Играйте днем по специальному сниженному тарифу. Отлично подходит для свободных тренировок и команд на удаленке.',
    conditions: 'Понедельник — Пятница, с 10:00 до 16:00 на любые футбольные и баскетбольные залы.',
    activeHours: {
      startHour: 10,
      endHour: 16,
      weekdaysOnly: true,
    },
    isEnabled: true,
  },
  {
    id: 'promo-hot-slot',
    title: 'Горящие вечерние слоты',
    tagline: 'Скидка 30% на оставшиеся слоты сегодня',
    badge: '🔥 -30% HOT',
    discountPercent: 30,
    bannerGradient: ['#b45309', '#d97706'],
    icon: 'flame',
    description: 'Специальная цена на слоты, оставшиеся не забронированными за 3 часа до начала игры.',
    conditions: 'Действует на ближайшие свободные слоты на текущую дату.',
    promoCode: 'HOT30',
    isEnabled: true,
  },
  {
    id: 'promo-welcome',
    title: 'Первая игра в AlanGo',
    tagline: 'Бонус 2 000 ₸ на первую аренду зала',
    badge: '🎁 2 000 ₸',
    discountPercent: 15,
    bannerGradient: ['#1e40af', '#3b82f6'],
    icon: 'gift',
    description: 'Скидка на первое бронирование любого спорткомплекса при регистрации.',
    conditions: 'Применяется автоматически при первом заказе через приложение.',
    promoCode: 'STARTALAN',
    isEnabled: true,
  },
];

export async function getPromotions(): Promise<Promotion[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROMOTIONS));
      return INITIAL_PROMOTIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_PROMOTIONS;
  }
}

export async function togglePromotion(id: string): Promise<Promotion[]> {
  const current = await getPromotions();
  const updated = current.map(p => p.id === id ? { ...p, isEnabled: !p.isEnabled } : p);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function calculateSlotPrice(
  basePrice: number,
  slotHour: number,
  isWeekend: boolean,
  promotions: Promotion[]
): { finalPrice: number; discount: number; appliedPromo?: Promotion } {
  const happyHourPromo = promotions.find(p => p.id === 'promo-happy-hours' && p.isEnabled);

  if (happyHourPromo && happyHourPromo.activeHours) {
    const { startHour, endHour, weekdaysOnly } = happyHourPromo.activeHours;
    const isApplicableDay = weekdaysOnly ? !isWeekend : true;
    if (isApplicableDay && slotHour >= startHour && slotHour < endHour) {
      const discount = Math.round((basePrice * happyHourPromo.discountPercent) / 100);
      return {
        finalPrice: basePrice - discount,
        discount,
        appliedPromo: happyHourPromo,
      };
    }
  }

  return { finalPrice: basePrice, discount: 0 };
}

