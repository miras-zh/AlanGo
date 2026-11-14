import AsyncStorage from "@react-native-async-storage/async-storage";

export const FAVORITE_HALLS_KEY = "alango_favorite_halls";
export const FAVORITE_ARENAS_KEY = "alango_favorite_arenas";
export const FAVORITE_PROMOTIONS_KEY = "alango_favorite_promotions";

async function readIds<T extends number | string>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function toggleId<T extends number | string>(key: string, id: T): Promise<T[]> {
  const current = await readIds<T>(key);
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  await AsyncStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function getFavoriteHallIds(): Promise<number[]> {
  return readIds<number>(FAVORITE_HALLS_KEY);
}

export function toggleFavoriteHallId(hallId: number): Promise<number[]> {
  return toggleId<number>(FAVORITE_HALLS_KEY, hallId);
}

export function getFavoriteArenaIds(): Promise<number[]> {
  return readIds<number>(FAVORITE_ARENAS_KEY);
}

export function toggleFavoriteArenaId(arenaId: number): Promise<number[]> {
  return toggleId<number>(FAVORITE_ARENAS_KEY, arenaId);
}

export function getFavoritePromotionIds(): Promise<string[]> {
  return readIds<string>(FAVORITE_PROMOTIONS_KEY);
}

export function toggleFavoritePromotionId(promoId: string): Promise<string[]> {
  return toggleId<string>(FAVORITE_PROMOTIONS_KEY, promoId);
}

export async function pruneFavoritePromotionIds(validIds: Set<string>): Promise<string[]> {
  const current = await getFavoritePromotionIds();
  const pruned = current.filter((id) => validIds.has(id));
  if (pruned.length !== current.length) {
    await AsyncStorage.setItem(FAVORITE_PROMOTIONS_KEY, JSON.stringify(pruned));
  }
  return pruned;
}

