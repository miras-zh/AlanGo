import { api, UPLOAD_TIMEOUT_MS } from "@/lib/api";
import { clearRefreshToken, getRefreshToken } from "@/lib/auth";

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

export async function getMe(): Promise<Me> {
  const res = await api.get<Me>("/api/auth/me");
  return res.data;
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
  phone?: string;
  city?: string;
  photo?: string;
};

export async function updateMyProfile(data: ProfileUpdate): Promise<Me> {
  const res = await api.patch<Me>("/api/profile", data);
  return res.data;
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
