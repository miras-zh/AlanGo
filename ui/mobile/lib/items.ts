import { api, UPLOAD_TIMEOUT_MS } from "@/lib/api";

export type Item = {
  id: number;
  user_id: number;
  title: string;
  description: string;
  category: string;
  price?: number;
  status: "active" | "completed" | "archived" | string;
  image_url: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_photo?: string;
};

export type ItemEntity = Item;
export type ItemStatus = "active" | "completed" | "archived" | string;

export type PaginatedItems = {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
};

export type ItemListParams = {
  category?: string;
  status?: string;
  q?: string;
  page?: number;
  page_size?: number;
  limit?: number;
};

export const MOCK_SPORT_VENUES: Item[] = [
  {
    id: 1,
    user_id: 1,
    title: "Футбольный зал Arena",
    description: "Профессиональный крытый газон последнего поколения, яркое LED-освещение, раздевалки с душевыми и зона отдыха.",
    category: "Футбол",
    price: 15000,
    status: "active",
    image_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
    metadata: {
      rating: 4.8,
      reviewsCount: 124,
      location: "Астана, ул. Нур-Султан 12",
      features: ["Парковка", "Душ", "Инвентарь", "Трибуны"],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: "Arena Sport",
  },
  {
    id: 2,
    user_id: 1,
    title: "Баскетбольный зал Pro",
    description: "Паркет из канадского клёна с амортизацией, регулируемые щиты Spalding, электронное табло и кондиционирование.",
    category: "Баскетбол",
    price: 12000,
    status: "active",
    image_url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80",
    metadata: {
      rating: 4.7,
      reviewsCount: 89,
      location: "Астана, пр. Туран 54",
      features: ["Паркет", "Раздевалки", "Табло", "Мячи"],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: "Pro Basketball",
  },
  {
    id: 3,
    user_id: 1,
    title: "Теннисный клуб Grand Slam",
    description: "4 крытых корта с покрытием Hard, профессиональное освещение без бликов, аренда ракеток и тренажерный зал.",
    category: "Теннис",
    price: 18000,
    status: "active",
    image_url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80",
    metadata: {
      rating: 4.9,
      reviewsCount: 156,
      location: "Астана, пр. Мангилик Ел 28",
      features: ["Хард", "Кафе", "Аренда ракеток", "Сауна"],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: "Grand Slam Club",
  },
  {
    id: 4,
    user_id: 1,
    title: "Волейбольный комплекс Spike",
    description: "Специальное бесшовное спортивное покрытие Taraflex, профессиональные сетки и антенны, отличная акустика.",
    category: "Волейбол",
    price: 10000,
    status: "active",
    image_url: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80",
    metadata: {
      rating: 4.6,
      reviewsCount: 64,
      location: "Астана, ул. Достык 18",
      features: ["Taraflex", "Сетки", "Душевые", "Парковка"],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: "Spike Club",
  },
  {
    id: 5,
    user_id: 1,
    title: "Сквош и Падл Клуб Nomad",
    description: "Панорамные стеклянные корты для падла и сквоша европейского стандарта. Индивидуальные шкафчики и смузи-бар.",
    category: "Сквош и падл",
    price: 14000,
    status: "active",
    image_url: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80",
    metadata: {
      rating: 4.9,
      reviewsCount: 210,
      location: "Астана, ул. Сыганак 43",
      features: ["Панорамные стекла", "Бар", "Прокат", "Тренеры"],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: "Nomad Sports",
  },
];

export async function listItems(params?: ItemListParams): Promise<PaginatedItems> {
  try {
    const query = {
      ...params,
      page_size: params?.limit ?? params?.page_size,
    };
    const res = await api.get<PaginatedItems>("/api/items", { params: query });
    if (res.data?.items && res.data.items.length > 0) {
      return res.data;
    }
  } catch {
    // fallback to mock
  }
  let filtered = [...MOCK_SPORT_VENUES];
  if (params?.category) {
    filtered = filtered.filter(
      (i) => i.category.toLowerCase() === params.category!.toLowerCase(),
    );
  }
  if (params?.q) {
    const query = params.q.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.title.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query) ||
        (i.metadata?.location && String(i.metadata.location).toLowerCase().includes(query)),
    );
  }
  return {
    items: filtered,
    total: filtered.length,
    page: 1,
    page_size: filtered.length,
  };
}

export async function listPublicItems(params?: ItemListParams): Promise<PaginatedItems> {
  return listItems(params);
}

export async function listMyItems(params?: ItemListParams): Promise<PaginatedItems> {
  try {
    const query = {
      ...params,
      page_size: params?.limit ?? params?.page_size,
    };
    const res = await api.get<PaginatedItems>("/api/items/me", { params: query });
    if (res.data?.items && res.data.items.length > 0) {
      return res.data;
    }
  } catch {
    // fallback
  }
  return {
    items: MOCK_SPORT_VENUES.slice(0, 3),
    total: 3,
    page: 1,
    page_size: 10,
  };
}

export async function getItem(id: number): Promise<Item> {
  try {
    const res = await api.get<Item>(`/api/items/${id}`);
    if (res.data) return res.data;
  } catch {
    // fallback
  }
  const match = MOCK_SPORT_VENUES.find((i) => i.id === id);
  if (match) return match;
  return MOCK_SPORT_VENUES[0];
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
