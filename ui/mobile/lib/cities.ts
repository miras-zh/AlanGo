import AsyncStorage from "@react-native-async-storage/async-storage";

export const TOP_CITIES = ["Астана", "Алматы", "Шымкент"];

export const KZ_CITIES = [
  // Города республиканского значения
  "Астана",
  "Алматы",
  "Шымкент",
  // Областные центры и крупные города
  "Актобе",
  "Актау",
  "Атырау",
  "Караганда",
  "Кокшетау",
  "Конаев",
  "Костанай",
  "Кызылорда",
  "Павлодар",
  "Петропавловск",
  "Семей",
  "Талдыкорган",
  "Тараз",
  "Туркестан",
  "Уральск",
  "Усть-Каменогорск",
  "Жезказган",
  // Прочие города
  "Экибастуз",
  "Рудный",
  "Темиртау",
  "Балхаш",
  "Жанаозен",
  "Кентау",
  "Сатпаев",
  "Риддер",
  "Степногорск",
  "Щучинск",
  "Аксу",
  "Аркалык",
  "Каскелен",
  "Талгар",
  "Есик",
  "Косшы",
  "Сарань",
  "Шахтинск",
  "Абай",
  "Аягоз",
  "Лисаковск",
  "Житикара",
  "Ушарал",
  "Алтай",
  "Жаркент",
  "Зайсан",
];

const CITY_STORAGE_KEY = "alango_selected_city";
const DEFAULT_CITY = "Астана";

type CityChangeListener = (city: string) => void;
const listeners = new Set<CityChangeListener>();

export async function getSelectedCity(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(CITY_STORAGE_KEY);
    if (saved && KZ_CITIES.includes(saved)) {
      return saved;
    }
  } catch {
    // Fall back to default
  }
  return DEFAULT_CITY;
}

export async function setSelectedCity(city: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CITY_STORAGE_KEY, city);
    listeners.forEach((listener) => {
      try {
        listener(city);
      } catch {
        // Safe dispatch
      }
    });
  } catch {
    // ignore
  }
}

export function subscribeCityChange(listener: CityChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

