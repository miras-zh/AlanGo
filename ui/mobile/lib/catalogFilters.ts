import type { MessageKey, TFunction } from "@/lib/i18n";
import { sportLabel } from "@/lib/dataLabels";
import type { ArenaWithHalls, Hall } from "@/lib/sportRentData";
import { ALL_SPORTS, sportMatches } from "@/components/SportCategoryTiles";

// Filters of the Halls / Sports complexes catalog. Sport and city are shared
// by both tabs; each tab keeps its own sort; price, venue type and amenities
// apply to halls only.

export type CatalogTab = "halls" | "arenas";
export type HallSort = "popular" | "price_asc" | "price_desc" | "rating";
export type ArenaSort = "rating" | "halls" | "price";
export type Facility = "all" | "complex" | "single" | "outdoor";
export type Amenity = "parking" | "locker" | "shower" | "lighting" | "inventory";

export interface CatalogFilters {
  sport: string; // ALL_SPORTS or a stored sport value
  city: string; // stored (Russian) city name
  hallSort: HallSort;
  arenaSort: ArenaSort;
  maxPrice: number | null; // null = any price
  facility: Facility;
  amenities: Amenity[];
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  sport: ALL_SPORTS,
  city: "Астана",
  hallSort: "popular",
  arenaSort: "rating",
  maxPrice: null,
  facility: "all",
  amenities: [],
};

export const HALL_SORTS: { id: HallSort; label: MessageKey }[] = [
  { id: "popular", label: "halls.sortPopular" },
  { id: "price_asc", label: "halls.sortCheap" },
  { id: "price_desc", label: "halls.sortExpensive" },
  { id: "rating", label: "halls.sortRating" },
];

export const ARENA_SORTS: { id: ArenaSort; label: MessageKey }[] = [
  { id: "rating", label: "arenas.sortRating" },
  { id: "halls", label: "arenas.sortHalls" },
  { id: "price", label: "arenas.sortPrice" },
];

export const PRICE_LIMITS: (number | null)[] = [null, 10000, 15000, 25000];

export const FACILITIES: { id: Facility; label: MessageKey }[] = [
  { id: "all", label: "filters.anyVenue" },
  { id: "complex", label: "venue.complex" },
  { id: "single", label: "venue.single" },
  { id: "outdoor", label: "venue.outdoor" },
];

// Amenities are matched by Russian keyword stems in the hall's equipment and
// description and in the arena's features (all stored as owner-entered text).
export const AMENITIES: { id: Amenity; label: MessageKey; stems: string[] }[] = [
  { id: "parking", label: "amenity.parkingShort", stems: ["парков", "паркинг"] },
  { id: "locker", label: "amenity.lockerShort", stems: ["раздевал", "шкафч"] },
  { id: "shower", label: "amenity.showerShort", stems: ["душ"] },
  { id: "lighting", label: "amenity.lightingShort", stems: ["освещ", "свет", "led", "прожектор"] },
  { id: "inventory", label: "amenity.inventoryShort", stems: ["мяч", "манишк", "ракетк", "инвентар", "прокат"] },
];

export const CATALOG_CITIES = ["Астана", "Алматы", "Шымкент", "Караганда", "Актобе"];

const sameCity = (a?: string, b?: string) => !a || !b || a.toLowerCase() === b.toLowerCase();

export function filterHalls(
  halls: Hall[],
  arenas: ArenaWithHalls[],
  f: CatalogFilters,
  query: string,
  t: TFunction,
): Hall[] {
  const arenaById = new Map(arenas.map((a) => [a.id, a]));
  const q = query.trim().toLowerCase();
  const list = halls.filter((h) => {
    const arena = arenaById.get(h.arenaId);
    if (!sameCity(f.city, arena?.city)) return false;
    if (!sportMatches(f.sport, h.sportType)) return false;
    if (f.maxPrice !== null && h.pricePerHour > f.maxPrice) return false;
    if (f.facility !== "all" && (arena?.venueType ?? "complex") !== f.facility) return false;
    if (f.amenities.length) {
      const text = [...(h.equipment ?? []), h.description ?? "", ...(arena?.features ?? [])].join(" ").toLowerCase();
      const ok = f.amenities.every((id) => AMENITIES.find((a) => a.id === id)?.stems.some((s) => text.includes(s)));
      if (!ok) return false;
    }
    if (
      q &&
      ![h.title, h.arenaTitle, h.arenaAddress, h.sportType, sportLabel(h.sportType, t), h.surfaceType]
        .join(" ")
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    return true;
  });
  if (f.hallSort === "price_asc") list.sort((a, b) => a.pricePerHour - b.pricePerHour);
  else if (f.hallSort === "price_desc") list.sort((a, b) => b.pricePerHour - a.pricePerHour);
  else if (f.hallSort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return list;
}

function minPrice(a: ArenaWithHalls): number {
  const prices = a.halls.map((h) => h.pricePerHour).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : Number.MAX_SAFE_INTEGER;
}

export function filterArenas(arenas: ArenaWithHalls[], f: CatalogFilters, query: string): ArenaWithHalls[] {
  const q = query.trim().toLowerCase();
  const list = arenas.filter((a) => {
    if (!sameCity(f.city, a.city)) return false;
    if (f.sport !== ALL_SPORTS && !a.availableSports.some((s) => sportMatches(f.sport, s))) return false;
    if (q && !`${a.title} ${a.address}`.toLowerCase().includes(q)) return false;
    return true;
  });
  return list.sort((a, b) => {
    if (f.arenaSort === "halls") return b.halls.length - a.halls.length;
    if (f.arenaSort === "price") return minPrice(a) - minPrice(b);
    return (b.rating || 0) - (a.rating || 0);
  });
}

/** Filters that differ from the defaults on the given tab (city doesn't count). */
export function activeCatalogFilters(f: CatalogFilters, tab: CatalogTab): number {
  let n = 0;
  if (f.sport !== ALL_SPORTS) n += 1;
  if (tab === "halls") {
    if (f.hallSort !== DEFAULT_CATALOG_FILTERS.hallSort) n += 1;
    if (f.maxPrice !== null) n += 1;
    if (f.facility !== "all") n += 1;
    n += f.amenities.length;
  } else if (f.arenaSort !== DEFAULT_CATALOG_FILTERS.arenaSort) {
    n += 1;
  }
  return n;
}
