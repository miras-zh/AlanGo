import { api, UPLOAD_TIMEOUT_MS } from "@/lib/api";
import { clearRefreshToken, getRefreshToken, updateSessionUser } from "@/lib/auth";

export type Me = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  business_role?: string;
  phone?: string;
  phone_verified: boolean;
  city?: string;
  photo?: string;
  plan?: string;
  created_at: string;
};

export const MOCK_ME: Me = {
  id: 1,
  full_name: "Мико Аскаров",
  email: "miko@sportrent.kz",
  role: "client",
  phone: "+7 (777) 123-45-67",
  phone_verified: true,
  city: "Астана",
  photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
  plan: "pro",
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
};

export async function getMe(): Promise<Me> {
  try {
    const res = await api.get<Me>("/api/auth/me");
    if (res.data) return res.data;
  } catch {
    // fallback
  }
  return MOCK_ME;
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  await api.put("/api/profile/push-token", { token: "" }).catch(() => {});
  try {
    await api.post("/api/logout", refreshToken ? { refresh_token: refreshToken } : undefined);
  } finally {
    await clearRefreshToken();
  }
}

export async function deleteMyAccount(): Promise<void> {
  try {
    await api.delete("/api/profile");
  } finally {
    await clearRefreshToken();
  }
}

export type ProfileUpdate = {
  full_name?: string;
  name?: string;
  phone?: string;
  bio?: string;
  city?: string;
  photo?: string;
};

export async function updateMyProfile(data: ProfileUpdate): Promise<Me> {
  const payload = {
    ...data,
    full_name: data.full_name || data.name,
  };
  try {
    const res = await api.patch<Me>("/api/profile", payload);
    if (res.data) {
      await updateSessionUser({
        name: res.data.full_name,
        phone: res.data.phone,
        city: res.data.city,
      });
      return res.data;
    }
  } catch {
    // fallback mock update
  }
  const updated: Me = {
    ...MOCK_ME,
    full_name: payload.full_name || MOCK_ME.full_name,
    phone: payload.phone || MOCK_ME.phone,
    city: payload.city || MOCK_ME.city,
  };
  await updateSessionUser({
    name: updated.full_name,
    phone: updated.phone,
    city: updated.city,
  });
  return updated;
}

export type SubscriptionInfo = {
  plan: string;
  expires_at?: string;
  status?: string;
  [key: string]: any;
};

export const MOCK_SUBSCRIPTION: SubscriptionInfo = {
  plan: "pro",
  status: "active",
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25).toISOString(),
};

export async function fetchMySubscription(): Promise<SubscriptionInfo> {
  try {
    const res = await api.get<SubscriptionInfo>("/api/subscription");
    if (res.data) return res.data;
  } catch {
    // fallback
  }
  return MOCK_SUBSCRIPTION;
}

export async function changeMySubscriptionPlan(plan: string): Promise<SubscriptionInfo> {
  try {
    const res = await api.post<SubscriptionInfo>("/api/subscription/change", { plan });
    if (res.data) return res.data;
  } catch {
    // fallback
  }
  MOCK_SUBSCRIPTION.plan = plan;
  return MOCK_SUBSCRIPTION;
}

export async function uploadAvatar(photo: {
  uri: string;
  name: string;
  type: string;
}): Promise<Me> {
  const fd = new FormData();
  fd.append("photo", {
    uri: photo.uri,
    name: photo.name,
    type: photo.type,
  } as unknown as Blob);
  const res = await api.post<Me>("/api/profile/avatar", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return res.data;
}
