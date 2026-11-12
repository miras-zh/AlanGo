import { api } from "@/lib/api";
import { getSessionUser, updateSessionUser } from "@/lib/auth";
import { persistAuthResponse } from "@/lib/registration";

// Self-service business account (backend: internal/user/business.go).

export type VenueType = "complex" | "single" | "outdoor";

export const VENUE_TYPES: {
  id: VenueType;
  title: string;
  description: string;
  icon: "business-outline" | "basketball-outline" | "sunny-outline";
}[] = [
  {
    id: "complex",
    title: "Спорткомплекс",
    description: "Здание с несколькими залами или площадками под разные виды спорта.",
    icon: "business-outline",
  },
  {
    id: "single",
    title: "Отдельный зал",
    description: "Один крытый зал или площадка, которую вы сдаёте в аренду.",
    icon: "basketball-outline",
  },
  {
    id: "outdoor",
    title: "Открытая площадка",
    description: "Уличное поле или корт: футбольное поле, теннисный корт, каток.",
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
  await persistAuthResponse(data, user?.name || "Пользователь AlanGo", {
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
