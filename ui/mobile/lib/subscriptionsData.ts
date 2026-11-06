import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SubscriptionPackage {
  id: string;
  title: string;
  sport: 'football' | 'basketball' | 'tennis' | 'volleyball' | 'padel';
  sportName: string;
  totalVisits: number;
  durationDays: number;
  price: number;
  regularPrice: number;
  discountBadge: string;
  popular?: boolean;
  features: string[];
  gradient: [string, string];
  icon: string;
}

export interface UserSubscription {
  id: string;
  packageId: string;
  title: string;
  sportName: string;
  totalVisits: number;
  remainingVisits: number;
  purchasedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'depleted';
  qrCodeToken: string;
}

const PACKAGES_KEY = '@alango_sub_packages_v1';
const USER_SUBS_KEY = '@alango_user_subs_v1';

export const SUBSCRIPTION_PACKAGES: SubscriptionPackage[] = [
  {
    id: 'sub-football-8',
    title: 'Футбольный Марафон',
    sport: 'football',
    sportName: 'Футбол',
    totalVisits: 8,
    durationDays: 30,
    price: 88000,
    regularPrice: 112000,
    discountBadge: 'ВЫГОДА 24 000 ₸',
    popular: true,
    features: [
      '8 матчей по 1 часу',
      'Любое время и будни, и выходные',
      'Бронь без предоплаты',
      'Бесплатная отмена за 4 часа',
      'Мячи и манишки включены',
    ],
    gradient: ['#065f46', '#059669'],
    icon: 'football',
  },
  {
    id: 'sub-basketball-12',
    title: 'Баскетбольный Безлимит',
    sport: 'basketball',
    sportName: 'Баскетбол',
    totalVisits: 12,
    durationDays: 45,
    price: 115000,
    regularPrice: 156000,
    discountBadge: 'СКИДКА 26%',
    popular: false,
    features: [
      '12 тренировок по 1 часу',
      'Паркетные залы FIBA',
      'Электронное табло',
      'Душевые и сауна включены',
    ],
    gradient: ['#b45309', '#d97706'],
    icon: 'basketball',
  },
  {
    id: 'sub-padel-6',
    title: 'Падел & Теннис Клаб',
    sport: 'padel',
    sportName: 'Падел и сквош',
    totalVisits: 6,
    durationDays: 30,
    price: 72000,
    regularPrice: 90000,
    discountBadge: 'ВЫГОДА 20%',
    popular: true,
    features: [
      '6 часов на панорамных кортах',
      'Профессиональные ракетки в подарок',
      'Приоритет в прайм-тайм',
    ],
    gradient: ['#1e40af', '#3b82f6'],
    icon: 'tennisball',
  },
];

export const INITIAL_USER_SUBSCRIPTIONS: UserSubscription[] = [
  {
    id: 'user-sub-001',
    packageId: 'sub-football-8',
    title: 'Футбольный Марафон (8 игр)',
    sportName: 'Футбол',
    totalVisits: 8,
    remainingVisits: 5,
    purchasedAt: '2026-11-01',
    expiresAt: '2026-12-01',
    status: 'active',
    qrCodeToken: 'ALAN-SUB-FTBL-8819',
  },
];

export async function getUserSubscriptions(): Promise<UserSubscription[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_SUBS_KEY);
    if (!raw) {
      await AsyncStorage.setItem(USER_SUBS_KEY, JSON.stringify(INITIAL_USER_SUBSCRIPTIONS));
      return INITIAL_USER_SUBSCRIPTIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_USER_SUBSCRIPTIONS;
  }
}

export async function buySubscription(pkg: SubscriptionPackage): Promise<UserSubscription> {
  const current = await getUserSubscriptions();
  const now = new Date();
  const expire = new Date(now.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);

  const newSub: UserSubscription = {
    id: `user-sub-${Date.now()}`,
    packageId: pkg.id,
    title: `${pkg.title} (${pkg.totalVisits} посещений)`,
    sportName: pkg.sportName,
    totalVisits: pkg.totalVisits,
    remainingVisits: pkg.totalVisits,
    purchasedAt: now.toISOString().split('T')[0],
    expiresAt: expire.toISOString().split('T')[0],
    status: 'active',
    qrCodeToken: `ALAN-SUB-${pkg.sport.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
  };

  const updated = [newSub, ...current];
  await AsyncStorage.setItem(USER_SUBS_KEY, JSON.stringify(updated));
  return newSub;
}

export async function useSubscriptionVisit(subId: string): Promise<UserSubscription | null> {
  const current = await getUserSubscriptions();
  const target = current.find(s => s.id === subId);
  if (!target || target.remainingVisits <= 0) return null;

  const updatedRemaining = target.remainingVisits - 1;
  const updatedSub: UserSubscription = {
    ...target,
    remainingVisits: updatedRemaining,
    status: updatedRemaining === 0 ? 'depleted' : 'active',
  };

  const updatedList = current.map(s => s.id === subId ? updatedSub : s);
  await AsyncStorage.setItem(USER_SUBS_KEY, JSON.stringify(updatedList));
  return updatedSub;
}

