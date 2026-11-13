import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { cityLabel } from "@/lib/dataLabels";
import { formatNumber } from "@/lib/i18n";
import {
  AMENITIES,
  ARENA_SORTS,
  CATALOG_CITIES,
  DEFAULT_CATALOG_FILTERS,
  FACILITIES,
  HALL_SORTS,
  PRICE_LIMITS,
  type CatalogFilters,
  type CatalogTab,
} from "@/lib/catalogFilters";
import { SportCategoryTiles } from "@/components/SportCategoryTiles";
import { FilterChip, FilterChips, FilterSection, FilterSheet } from "@/components/FilterSheet";

type Props = {
  visible: boolean;
  tab: CatalogTab;
  filters: CatalogFilters;
  // Result count the draft would give on the current tab.
  countFor: (draft: CatalogFilters) => number;
  onClose: () => void;
  onApply: (filters: CatalogFilters) => void;
};

/** Halls / sports complexes filters. Hall-only blocks are hidden on the complexes tab. */
export function CatalogFilterModal({ visible, tab, filters, countFor, onClose, onApply }: Props) {
  const t = useT();
  const [draft, setDraft] = useState<CatalogFilters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const count = useMemo(() => countFor(draft), [countFor, draft]);
  const set = (patch: Partial<CatalogFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const halls = tab === "halls";

  return (
    <FilterSheet
      visible={visible}
      title={t("filters.title")}
      resultCount={count}
      onClose={onClose}
      onReset={() => setDraft({ ...DEFAULT_CATALOG_FILTERS, city: draft.city })}
      onApply={() => onApply(draft)}
    >
      <FilterSection label={t("filters.sport")}>
        <SportCategoryTiles variant="compact" selected={draft.sport} onSelect={(sport) => set({ sport })} />
      </FilterSection>

      <FilterSection label={t("account.city")}>
        <FilterChips>
          {CATALOG_CITIES.map((city) => (
            <FilterChip
              key={city}
              label={cityLabel(city, t)}
              selected={draft.city === city}
              onPress={() => set({ city })}
            />
          ))}
        </FilterChips>
      </FilterSection>

      <FilterSection label={t("halls.sort")}>
        <FilterChips>
          {halls
            ? HALL_SORTS.map((s) => (
                <FilterChip key={s.id} label={t(s.label)} selected={draft.hallSort === s.id} onPress={() => set({ hallSort: s.id })} />
              ))
            : ARENA_SORTS.map((s) => (
                <FilterChip key={s.id} label={t(s.label)} selected={draft.arenaSort === s.id} onPress={() => set({ arenaSort: s.id })} />
              ))}
        </FilterChips>
      </FilterSection>

      {halls ? (
        <>
          <FilterSection label={t("filters.pricePerHour")}>
            <FilterChips>
              {PRICE_LIMITS.map((limit) => (
                <FilterChip
                  key={String(limit)}
                  label={limit === null ? t("price.any") : t("price.upTo", { price: formatNumber(limit) })}
                  selected={draft.maxPrice === limit}
                  onPress={() => set({ maxPrice: limit })}
                />
              ))}
            </FilterChips>
          </FilterSection>

          <FilterSection label={t("filters.facilityType")}>
            <FilterChips>
              {FACILITIES.map((f) => (
                <FilterChip key={f.id} label={t(f.label)} selected={draft.facility === f.id} onPress={() => set({ facility: f.id })} />
              ))}
            </FilterChips>
          </FilterSection>

          <FilterSection label={t("filters.amenitiesShort")}>
            <FilterChips>
              {AMENITIES.map((a) => {
                const on = draft.amenities.includes(a.id);
                return (
                  <FilterChip
                    key={a.id}
                    label={t(a.label)}
                    selected={on}
                    icon={on ? "checkmark" : undefined}
                    onPress={() =>
                      set({ amenities: on ? draft.amenities.filter((x) => x !== a.id) : [...draft.amenities, a.id] })
                    }
                  />
                );
              })}
            </FilterChips>
          </FilterSection>
        </>
      ) : null}
    </FilterSheet>
  );
}
