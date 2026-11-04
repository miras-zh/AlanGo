import { apiFetch } from "./api";

export type ItemStatus = "draft" | "active" | "archived";

export interface ItemEntity {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: ItemStatus;
  category: string;
  price: number;
  image_url: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ItemsListResponse {
  items: ItemEntity[];
  total: number;
}

export async function listPublicItems(): Promise<ItemsListResponse> {
  return apiFetch<ItemsListResponse>("/items", { skipAuth: true });
}

export async function listMyItems(): Promise<ItemsListResponse> {
  return apiFetch<ItemsListResponse>("/items/my");
}

export async function createItem(input: {
  title: string;
  description?: string;
  category?: string;
  price?: number;
  status?: ItemStatus;
}): Promise<ItemEntity> {
  return apiFetch<ItemEntity>("/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateItem(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    category: string;
    price: number;
    status: ItemStatus;
  }>
): Promise<ItemEntity> {
  return apiFetch<ItemEntity>(`/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteItem(id: string): Promise<void> {
  await apiFetch(`/items/${id}`, { method: "DELETE" });
}
