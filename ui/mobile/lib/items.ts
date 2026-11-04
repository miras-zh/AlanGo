import { api, UPLOAD_TIMEOUT_MS } from "@/lib/api";

export type Item = {
  id: number;
  user_id: number;
  title: string;
  description: string;
  category: string;
  status: "active" | "completed" | "archived" | string;
  image_url: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_photo?: string;
};

export type PaginatedItems = {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
};

export async function listItems(params?: {
  category?: string;
  status?: string;
  q?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedItems> {
  const res = await api.get<PaginatedItems>("/api/items", { params });
  return res.data;
}

export async function listMyItems(params?: {
  category?: string;
  status?: string;
  q?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedItems> {
  const res = await api.get<PaginatedItems>("/api/items/me", { params });
  return res.data;
}

export async function getItem(id: number): Promise<Item> {
  const res = await api.get<Item>(`/api/items/${id}`);
  return res.data;
}

export async function createItem(payload: {
  title: string;
  description?: string;
  category?: string;
  status?: string;
  metadata?: Record<string, any>;
}): Promise<Item> {
  const res = await api.post<Item>("/api/items", payload);
  return res.data;
}

export async function updateItem(
  id: number,
  payload: {
    title?: string;
    description?: string;
    category?: string;
    status?: string;
    metadata?: Record<string, any>;
  },
): Promise<Item> {
  const res = await api.patch<Item>(`/api/items/${id}`, payload);
  return res.data;
}

export async function uploadItemImage(
  id: number,
  photo: { uri: string; name: string; type: string },
): Promise<Item> {
  const fd = new FormData();
  fd.append("photo", {
    uri: photo.uri,
    name: photo.name,
    type: photo.type,
  } as unknown as Blob);
  const res = await api.post<Item>(`/api/items/${id}/image`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return res.data;
}

export async function deleteItem(id: number): Promise<void> {
  await api.delete(`/api/items/${id}`);
}
