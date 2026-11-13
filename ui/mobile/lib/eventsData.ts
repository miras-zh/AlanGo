import { monthGenitive, sportLabel } from "@/lib/dataLabels";
import { formatNumber, type MessageKey, type TFunction } from "@/lib/i18n";
export type SportCategoryId =
  | "all"
  | "football"
  | "tennis"
  | "basketball"
  | "padel"
  | "other";

export type EventType = "all" | "tournament" | "open_game" | "master_class";

export interface SportEvent {
  id: string;
  title: string;
  sport: SportCategoryId;
  categoryLabel: string;
  date: string;
  time: string;
  location: string;
  price: string;
  rawPrice: number;
  imageUrl: string;
  type: EventType;
  spotsLeft: number;
  isFavorite?: boolean;
}

export const SPORT_CATEGORIES: {
  id: SportCategoryId;
  label: MessageKey;
  iconName: string;
}[] = [
  { id: "all", label: "sport.all", iconName: "apps-outline" },
  { id: "football", label: "sport.football", iconName: "football-outline" },
  { id: "tennis", label: "sport.tennis", iconName: "tennisball-outline" },
  { id: "basketball", label: "sport.basketball", iconName: "basketball-outline" },
  { id: "padel", label: "sport.padel", iconName: "disc-outline" },
  { id: "other", label: "sport.other", iconName: "ellipsis-horizontal" },
];

// Demo events keep Russian strings (date "14 Ноября", category, price); these
// helpers render them in the selected language.
const RU_MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function eventCategory(ev: SportEvent, t: TFunction): string {
  return sportLabel(ev.categoryLabel, t);
}

export function eventDate(ev: SportEvent, t: TFunction): string {
  const m = /^(\d{1,2})\s+(\S+)/.exec(ev.date);
  const month = m ? RU_MONTHS_GEN.indexOf(m[2].toLowerCase()) : -1;
  return m && month >= 0 ? t("date.dayMonth", { day: m[1], month: monthGenitive(month, t) }) : ev.date;
}

export function eventPrice(ev: SportEvent, t: TFunction): string {
  const price = formatNumber(ev.rawPrice);
  if (ev.price.includes("команда")) return t("events.perTeam", { price });
  if (ev.price.includes("игрок")) return t("events.perPlayer", { price });
  return t("events.price", { price });
}

export function eventDetails(ev: SportEvent, t: TFunction): string {
  return t("events.details", {
    category: eventCategory(ev, t),
    date: eventDate(ev, t),
    time: ev.time,
    location: ev.location,
    price: eventPrice(ev, t),
  });
}

export const INITIAL_EVENTS: SportEvent[] = [
  {
    id: "1",
    title: "Nomad Padel Cup 2026",
    sport: "padel",
    categoryLabel: "Сквош и падл",
    date: "14 Ноября",
    time: "10:00 – 18:00",
    location: "Клуб Nomad",
    price: "8 000 ₸",
    rawPrice: 8000,
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600",
    type: "tournament",
    spotsLeft: 4,
    isFavorite: false,
  },
  {
    id: "2",
    title: "Ночная лига по футзалу 5x5",
    sport: "football",
    categoryLabel: "Футбол",
    date: "16 Ноября",
    time: "21:00 – 23:30",
    location: "Футбольный зал Arena",
    price: "15 000 ₸ / команда",
    rawPrice: 15000,
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600",
    type: "tournament",
    spotsLeft: 2,
    isFavorite: false,
  },
  {
    id: "3",
    title: "Турнир Alan Go Open",
    sport: "tennis",
    categoryLabel: "Теннис",
    date: "18 Ноября",
    time: "09:00 – 17:00",
    location: "Tennis Center",
    price: "10 000 ₸",
    rawPrice: 10000,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600",
    type: "tournament",
    spotsLeft: 8,
    isFavorite: false,
  },
  {
    id: "4",
    title: "Открытая игра 3x3",
    sport: "basketball",
    categoryLabel: "Баскетбол",
    date: "20 Ноября",
    time: "19:00 – 22:00",
    location: "Баскетбол Арена",
    price: "5 000 ₸ / игрок",
    rawPrice: 5000,
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600",
    type: "open_game",
    spotsLeft: 6,
    isFavorite: false,
  },
  {
    id: "5",
    title: "Мастер-класс по падел-теннису",
    sport: "padel",
    categoryLabel: "Сквош и падл",
    date: "22 Ноября",
    time: "12:00 – 14:00",
    location: "Сквош Клуб Nomad",
    price: "7 000 ₸",
    rawPrice: 7000,
    imageUrl: "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?w=600",
    type: "master_class",
    spotsLeft: 5,
    isFavorite: false,
  },
  {
    id: "6",
    title: "Кубок Астаны по волейболу",
    sport: "other",
    categoryLabel: "Волейбол",
    date: "25 Ноября",
    time: "15:00 – 19:00",
    location: "Спорткомплекс Достык",
    price: "6 000 ₸",
    rawPrice: 6000,
    imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600",
    type: "tournament",
    spotsLeft: 3,
    isFavorite: false,
  },
];

export interface EventFilterState {
  sportCategory: SportCategoryId;
  eventType: EventType;
  priceRange: "all" | "under5" | "5to15" | "above15";
  dateFilter: string; // "all" | "today" | "weekend" | "week" | specific date
  onlyWithSpots: boolean;
}

export const DEFAULT_EVENT_FILTERS: EventFilterState = {
  sportCategory: "all",
  eventType: "all",
  priceRange: "all",
  dateFilter: "all",
  onlyWithSpots: false,
};

export function filterEvents(
  events: SportEvent[],
  filters: EventFilterState
): SportEvent[] {
  return events.filter((ev) => {
    // 1. Sport category
    if (filters.sportCategory !== "all") {
      if (filters.sportCategory === "padel") {
        if (ev.sport !== "padel") return false;
      } else if (filters.sportCategory === "other") {
        if (ev.sport !== "other") return false;
      } else if (ev.sport !== filters.sportCategory) {
        return false;
      }
    }

    // 2. Event type
    if (filters.eventType !== "all" && ev.type !== filters.eventType) {
      return false;
    }

    // 3. Price range
    if (filters.priceRange === "under5" && ev.rawPrice > 5000) return false;
    if (filters.priceRange === "5to15" && (ev.rawPrice < 5000 || ev.rawPrice > 15000)) {
      return false;
    }
    if (filters.priceRange === "above15" && ev.rawPrice < 15000) return false;

    // 4. Spots
    if (filters.onlyWithSpots && ev.spotsLeft <= 0) return false;

    // 5. Date filter
    if (filters.dateFilter !== "all") {
      if (filters.dateFilter === "today" && !ev.date.includes("14")) return false;
      if (filters.dateFilter === "weekend" && !ev.date.includes("16") && !ev.date.includes("18")) {
        return false;
      }
    }

    return true;
  });
}
