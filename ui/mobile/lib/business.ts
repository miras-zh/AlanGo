import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSessionUser, updateSessionUser } from "@/lib/auth";
import { persistAuthResponse } from "@/lib/registration";
import { tr, type MessageKey } from "@/lib/i18n";

// Self-service business account (backend: internal/user/business.go).

export type VenueType = "complex" | "single" | "outdoor";

export const VENUE_TYPES: {
  id: VenueType;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: "business-outline" | "basketball-outline" | "sunny-outline";
}[] = [
  {
    id: "complex",
    titleKey: "venue.complex",
    descriptionKey: "venue.complexDesc",
    icon: "business-outline",
  },
  {
    id: "single",
    titleKey: "venue.single",
    descriptionKey: "venue.singleDesc",
    icon: "basketball-outline",
  },
  {
    id: "outdoor",
    titleKey: "venue.outdoor",
    descriptionKey: "venue.outdoorDesc",
    icon: "sunny-outline",
  },
];

export const BUSINESS_SPORTS = [
  "Футбол",
  "Мини-футбол",
  "Хоккей",
  "Баскетбол",
  "Волейбол",
  "Теннис",
  "Настольный теннис",
  "Падел",
  "Сквош",
  "Бадминтон",
  "Единоборства",
  "Фитнес",
];

export type BusinessArena = {
  id: number;
  title: string;
  category: string;
  venue_type: VenueType;
  city: string;
  address: string;
  sports: string[];
  halls_count: number;
  hidden: boolean;
};

export type BusinessState = {
  role: string;
  business_role: string;
  arena: BusinessArena | null;
};

export type BusinessOnboardPayload = {
  venue_type: VenueType;
  title: string;
  sports: string[];
  city: string;
};

// Current business state. "none" = never opened a business account,
// "active" = business mode, "disabled" = arena kept but hidden.
export type BusinessStatus = "none" | "active" | "disabled";

export function businessStatus(state: BusinessState | null): BusinessStatus {
  if (!state?.arena) return "none";
  return state.role === "business" ? "active" : "disabled";
}

export async function fetchMyBusiness(): Promise<BusinessState> {
  const res = await api.get<BusinessState>("/api/business/me");
  const data = res.data;
  const user = getSessionUser();
  if (user && (user.role !== data.role || user.arenaId !== data.arena?.id)) {
    await updateSessionUser({
      role: data.role,
      business_role: data.business_role,
      arenaId: data.arena?.id,
    });
  }
  return data;
}

async function persistBusinessResponse(data: any): Promise<void> {
  const user = getSessionUser();
  await persistAuthResponse(data, user?.name || tr("user.defaultName"), {
    // Keep what the server response doesn't carry (avatar, etc.).
    avatar_url: user?.avatar_url,
    arenaId: data?.arena?.id ?? user?.arenaId,
    business_role: data?.user_info?.business_role,
  });
}

export async function onboardBusiness(payload: BusinessOnboardPayload): Promise<BusinessArena> {
  const res = await api.post<any>("/api/business/onboard", payload);
  await persistBusinessResponse(res.data);
  return res.data.arena;
}

export async function disableBusiness(): Promise<void> {
  const res = await api.post<any>("/api/profile/business/disable");
  await persistBusinessResponse(res.data);
}

export async function enableBusiness(): Promise<void> {
  const res = await api.post<any>("/api/profile/business/enable");
  await persistBusinessResponse(res.data);
}

// The arena the business cabinet works with. Staff sessions carry their
// arenaId; owners resolve theirs on the server (session value is only an
// offline fallback). Never falls back to someone else's arena.
export async function resolveMyArenaId(): Promise<number | null> {
  const user = getSessionUser();
  if (!user) return null;
  if (String(user.id).startsWith("staff_")) return user.arenaId ?? null;
  try {
    const state = await fetchMyBusiness();
    return state.arena?.id ?? null;
  } catch {
    return user.arenaId ?? null;
  }
}

export function useMyArenaId(): { arenaId: number | null; loading: boolean; reload: () => Promise<void> } {
  const [arenaId, setArenaId] = useState<number | null>(getSessionUser()?.arenaId ?? null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setArenaId(await resolveMyArenaId());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { arenaId, loading, reload };
}
