import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MessageKey, TFunction } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// DEMO DATA. The backend has no events API yet (see CHANGELOG), so the events
// below are local demo content. Dates are generated relative to today so the
// list always stays "upcoming". Registrations and favorites are stored on the
// device only. Replace getEvents() with an API call once the backend exists.
// ---------------------------------------------------------------------------

export type EventSport = "football" | "tennis" | "basketball" | "padel" | "volleyball" | "hockey" | "other";
export type EventType = "tournament" | "open_game" | "master_class";
export type PriceUnit = "person" | "team" | "player";

export interface SportEvent {
  id: string;
  title: string;
  sport: EventSport;
  type: EventType;
  startsAt: Date;
  endsAt: Date;
  city: string; // stored in Russian, like the rest of the app (cityLabel())
  venue: string;
  price: number; // ₸, 0 = free
  priceUnit: PriceUnit;
  imageUrl: string;
  format?: string; // team format like "5×5", when the event has one
  participants?: number; // registered participants, when known
  spotsLeft?: number; // free places, when known
}

export const EVENT_SPORTS: { id: EventSport; label: MessageKey }[] = [
  { id: "football", label: "sport.football" },
  { id: "tennis", label: "sport.tennis" },
  { id: "basketball", label: "sport.basketball" },
  { id: "padel", label: "sport.padel" },
  { id: "volleyball", label: "sport.volleyball" },
  { id: "hockey", label: "sport.hockey" },
  { id: "other", label: "sport.other" },
];

export const EVENT_SPORT_LABEL: Record<EventSport, MessageKey> = Object.fromEntries(
  EVENT_SPORTS.map((s) => [s.id, s.label]),
) as Record<EventSport, MessageKey>;

function at(daysFromToday: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(h, m, 0, 0);
  return d;
}

function demoEvents(): SportEvent[] {
  return [
    {
      id: "1",
      title: "Nomad Padel Cup 2026",
      sport: "padel",
      type: "tournament",
      startsAt: at(1, "10:00"),
      endsAt: at(1, "18:00"),
      city: "Астана",
      venue: "Клуб Nomad",
      price: 8000,
      priceUnit: "person",
      imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600",
      spotsLeft: 4,
    },
    {
      id: "2",
      title: "Ночная лига по футзалу",
      sport: "football",
      type: "tournament",
      startsAt: at(3, "21:00"),
      endsAt: at(3, "23:30"),
      city: "Астана",
      venue: "Футбольный зал Arena",
      price: 15000,
      priceUnit: "team",
      format: "5×5",
      imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600",
      spotsLeft: 2,
    },
    {
      id: "3",
      title: "Турнир Alan Go Open",
      sport: "tennis",
      type: "tournament",
      startsAt: at(5, "09:00"),
      endsAt: at(5, "17:00"),
      city: "Астана",
      venue: "Tennis Center",
      price: 10000,
      priceUnit: "person",
      imageUrl: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600",
      spotsLeft: 12,
    },
    {
      id: "4",
      title: "Открытая игра 3×3",
      sport: "basketball",
      type: "open_game",
      startsAt: at(6, "19:00"),
      endsAt: at(6, "22:00"),
      city: "Астана",
      venue: "Баскетбол Арена",
      price: 5000,
      priceUnit: "player",
      format: "3×3",
      imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600",
      spotsLeft: 6,
    },
    {
      id: "5",
      title: "Мастер-класс по паделу",
      sport: "padel",
      type: "master_class",
      startsAt: at(8, "12:00"),
      endsAt: at(8, "14:00"),
      city: "Алматы",
      venue: "Сквош Клуб Nomad",
      price: 7000,
      priceUnit: "person",
      imageUrl: "https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=600",
      spotsLeft: 0,
    },
    {
      id: "6",
      title: "Волейбольный уикенд",
      sport: "volleyball",
      type: "open_game",
      startsAt: at(11, "11:00"),
      endsAt: at(11, "15:00"),
      city: "Астана",
      venue: "Спорткомплекс Достык",
      price: 6000,
      priceUnit: "person",
      format: "6×6",
      imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600",
      spotsLeft: 3,
    },
    {
      id: "7",
      title: "Любительский хоккейный матч",
      sport: "hockey",
      type: "open_game",
      startsAt: at(13, "20:00"),
      endsAt: at(13, "22:00"),
      city: "Астана",
      venue: "Ледовая арена Барыс",
      price: 9000,
      priceUnit: "player",
      imageUrl: "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=600",
      spotsLeft: 8,
    },
  ];
}

/** Events source. Demo for now; swap for the API when it exists. */
export async function getEvents(): Promise<SportEvent[]> {
  return demoEvents();
}

// --- Filters -----------------------------------------------------------------

export type DateFilter = "upcoming" | "today" | "weekend" | "week";
export type PriceRange = "all" | "under5" | "5to15" | "above15";

export interface EventFilterState {
  sports: EventSport[]; // empty = all sports
  types: EventType[]; // empty = all types
  priceRange: PriceRange;
  onlyWithSpots: boolean;
}

export const DEFAULT_EVENT_FILTERS: EventFilterState = {
  sports: [],
  types: [],
  priceRange: "all",
  onlyWithSpots: false,
};

export function activeFilterCount(f: EventFilterState): number {
  return f.sports.length + f.types.length + (f.priceRange !== "all" ? 1 : 0) + (f.onlyWithSpots ? 1 : 0);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function matchesDate(ev: SportEvent, filter: DateFilter, now = new Date()): boolean {
  if (ev.endsAt.getTime() < now.getTime()) return false; // past events never show
  const day = startOfDay(ev.startsAt).getTime();
  const today = startOfDay(now);
  if (filter === "today") return day === today.getTime();
  if (filter === "week") {
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return day < end.getTime();
  }
  if (filter === "weekend") {
    // Coming Saturday and Sunday (today included if it is the weekend).
    const dow = today.getDay();
    const sat = new Date(today);
    sat.setDate(today.getDate() + (dow === 0 ? -1 : 6 - dow));
    const mon = new Date(sat);
    mon.setDate(sat.getDate() + 2);
    return day >= sat.getTime() && day < mon.getTime();
  }
  return true;
}

export function filterEvents(
  events: SportEvent[],
  opts: { filters: EventFilterState; date: DateFilter; city: string; query: string; t: TFunction },
): SportEvent[] {
  const { filters, date, city, query, t } = opts;
  const q = query.trim().toLowerCase();
  return events
    .filter((ev) => {
      if (city && ev.city.toLowerCase() !== city.toLowerCase()) return false;
      if (!matchesDate(ev, date)) return false;
      if (filters.sports.length && !filters.sports.includes(ev.sport)) return false;
      if (filters.types.length && !filters.types.includes(ev.type)) return false;
      if (filters.priceRange === "under5" && ev.price > 5000) return false;
      if (filters.priceRange === "5to15" && (ev.price < 5000 || ev.price > 15000)) return false;
      if (filters.priceRange === "above15" && ev.price < 15000) return false;
      if (filters.onlyWithSpots && ev.spotsLeft !== undefined && ev.spotsLeft <= 0) return false;
      if (q) {
        const hay = [ev.title, ev.venue, t(EVENT_SPORT_LABEL[ev.sport])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

// --- Display helpers ---------------------------------------------------------

export function eventPrice(ev: SportEvent, t: TFunction): { amount: string; unit: string } {
  if (ev.price <= 0) return { amount: t("sub.free"), unit: "" };
  const unit = ev.priceUnit === "team" ? t("events.unitTeam") : ev.priceUnit === "player" ? t("events.unitPlayer") : "";
  return { amount: `${formatNumber(ev.price)} ₸`, unit };
}

function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function eventTimeRange(ev: SportEvent): string {
  return `${hm(ev.startsAt)} – ${hm(ev.endsAt)}`;
}

// --- Device-local registrations & favorites ----------------------------------

const FAV_KEY = "alango.events.favorites";
const REG_KEY = "alango.events.registered";

type UserEventState = { favorites: string[]; registered: string[] };
let state: UserEventState = { favorites: [], registered: [] };
let loaded = false;
const listeners = new Set<(s: UserEventState) => void>();

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const [fav, reg] = await Promise.all([AsyncStorage.getItem(FAV_KEY), AsyncStorage.getItem(REG_KEY)]);
    state = { favorites: fav ? JSON.parse(fav) : [], registered: reg ? JSON.parse(reg) : [] };
    listeners.forEach((l) => l(state));
  } catch {
    // keep empty
  }
}

function update(next: UserEventState) {
  state = next;
  listeners.forEach((l) => l(state));
  AsyncStorage.setItem(FAV_KEY, JSON.stringify(next.favorites)).catch(() => {});
  AsyncStorage.setItem(REG_KEY, JSON.stringify(next.registered)).catch(() => {});
}

export function toggleEventFavorite(id: string) {
  const has = state.favorites.includes(id);
  update({ ...state, favorites: has ? state.favorites.filter((x) => x !== id) : [...state.favorites, id] });
}

export function registerForEvent(id: string) {
  if (!state.registered.includes(id)) update({ ...state, registered: [...state.registered, id] });
}

export function cancelEventRegistration(id: string) {
  update({ ...state, registered: state.registered.filter((x) => x !== id) });
}

/** Favorites and registrations of this device, kept in sync across screens. */
export function useEventUserState(): UserEventState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    load();
    setS(state);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
