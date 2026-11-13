import { useEffect, useMemo, useState } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { cityLabel } from "@/lib/dataLabels";
import { CATALOG_CITIES } from "@/lib/catalogFilters";
import {
  DEFAULT_EVENT_FILTERS,
  EVENT_SPORTS,
  type DateFilter,
  type EventFilterState,
  type EventSport,
  type EventType,
  type PriceRange,
} from "@/lib/eventsData";
import { FilterChip, FilterChips, FilterSection, FilterSheet, FilterToggle } from "@/components/FilterSheet";

const DATES: { id: DateFilter; label: MessageKey }[] = [
  { id: "upcoming", label: "events.dateUpcoming" },
  { id: "today", label: "date.today" },
  { id: "weekend", label: "calendar.weekend" },
  { id: "week", label: "calendar.week" },
];

const EVENT_TYPES: { id: EventType; label: MessageKey }[] = [
  { id: "tournament", label: "events.tournaments" },
  { id: "open_game", label: "events.openGames" },
  { id: "master_class", label: "events.masterClasses" },
];

const PRICE_RANGES: { id: PriceRange; label: MessageKey }[] = [
  { id: "all", label: "price.any" },
  { id: "under5", label: "price.under5" },
  { id: "5to15", label: "price.5to15" },
  { id: "above15", label: "price.above15" },
];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

interface EventsFilterModalProps {
  visible: boolean;
  filters: EventFilterState;
  // Count of events the draft filters would show (for the apply button).
  countFor: (draft: EventFilterState) => number;
  onClose: () => void;
  onApply: (filters: EventFilterState) => void;
}

/**
 * All event filters (period, city, sport, format, price, free places). Works on
 * a draft: closing without "Show results" keeps the applied filters.
 */
export function EventsFilterModal({ visible, filters, countFor, onClose, onApply }: EventsFilterModalProps) {
  const t = useT();
  const [draft, setDraft] = useState<EventFilterState>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const count = useMemo(() => countFor(draft), [countFor, draft]);
  const set = (patch: Partial<EventFilterState>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <FilterSheet
      visible={visible}
      title={t("events.filtersTitle")}
      resultCount={count}
      onClose={onClose}
      onReset={() => setDraft({ ...DEFAULT_EVENT_FILTERS, city: draft.city })}
      onApply={() => onApply(draft)}
    >
      <FilterSection label={t("events.period")}>
        <FilterChips>
          {DATES.map((d) => (
            <FilterChip key={d.id} label={t(d.label)} selected={draft.date === d.id} onPress={() => set({ date: d.id })} />
          ))}
        </FilterChips>
      </FilterSection>

      <FilterSection label={t("account.city")}>
        <FilterChips>
          {CATALOG_CITIES.map((city) => (
            <FilterChip key={city} label={cityLabel(city, t)} selected={draft.city === city} onPress={() => set({ city })} />
          ))}
        </FilterChips>
      </FilterSection>

      <FilterSection label={t("filters.sport")}>
        <FilterChips>
          {EVENT_SPORTS.map((s) => (
            <FilterChip
              key={s.id}
              label={t(s.label)}
              selected={draft.sports.includes(s.id)}
              onPress={() => set({ sports: toggle<EventSport>(draft.sports, s.id) })}
            />
          ))}
        </FilterChips>
      </FilterSection>

      <FilterSection label={t("events.format")}>
        <FilterChips>
          {EVENT_TYPES.map((ty) => (
            <FilterChip
              key={ty.id}
              label={t(ty.label)}
              selected={draft.types.includes(ty.id)}
              onPress={() => set({ types: toggle<EventType>(draft.types, ty.id) })}
            />
          ))}
        </FilterChips>
      </FilterSection>

      <FilterSection label={t("events.participationCost")}>
        <FilterChips>
          {PRICE_RANGES.map((p) => (
            <FilterChip key={p.id} label={t(p.label)} selected={draft.priceRange === p.id} onPress={() => set({ priceRange: p.id })} />
          ))}
        </FilterChips>
      </FilterSection>

      <FilterToggle
        title={t("events.onlyFree")}
        subtitle={t("events.onlyFreeText")}
        value={draft.onlyWithSpots}
        onChange={(onlyWithSpots) => set({ onlyWithSpots })}
      />
    </FilterSheet>
  );
}
