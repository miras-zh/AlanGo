import AsyncStorage from "@react-native-async-storage/async-storage";

export type SportType = "Футбол" | "Баскетбол" | "Теннис" | "Волейбол" | "Сквош и падл" | "Другое";

export type Hall = {
  id: number;
  arenaId: number;
  arenaTitle: string;
  arenaAddress: string;
  title: string;
  sportType: SportType;
  surfaceType: string;
  equipment: string[];
  capacity: string;
  pricePerHour: number;
  imageUrl: string;
  status: "active" | "maintenance" | "inactive";
  description: string;
  rating: number;
  reviewsCount: number;
};

export type ScheduleDay = {
  dayOfWeek: number; // 0 = Воскресенье, 1 = Понедельник ... 6 = Суббота
  dayName: string;
  isClosed: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "23:00"
  slotDurations: number[]; // [60, 90] минут (как в Vison)
};

export type Arena = {
  id: number;
  ownerId: number;
  ownerEmail: string;
  title: string;
  city: string;
  address: string;
  phone: string;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  description: string;
  features: string[];
  workingHours: string;
  hallsCount: number;
};

export type Booking = {
  id: string;
  hallId: number;
  hallTitle: string;
  sportType: SportType;
  arenaId: number;
  arenaTitle: string;
  clientName: string;
  clientPhone: string;
  date: string;       // "2026-11-04" или "Сегодня"
  timeSlot: string;   // "19:00 - 20:00"
  durationMinutes: number;
  totalPrice: number;
  status: "confirmed" | "pending" | "cancelled";
  createdAt: string;
};

export type TestAccount = {
  username: string;
  email: string;
  name: string;
  role: "business" | "client";
  arenaId?: number;
  phone: string;
  city: string;
  avatarUrl: string;
};

export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  "dev.arena1": {
    username: "dev.arena1",
    email: "dev.arena1@sportrent.kz",
    name: "Astana Arena Sport",
    role: "business",
    arenaId: 1,
    phone: "+7 (701) 111-22-33",
    city: "Астана",
    avatarUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300",
  },
  "dev.arena2": {
    username: "dev.arena2",
    email: "dev.arena2@sportrent.kz",
    name: "Nomad Pro Complex",
    role: "business",
    arenaId: 2,
    phone: "+7 (702) 444-55-66",
    city: "Астана",
    avatarUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300",
  },
  "dev.client": {
    username: "dev.client",
    email: "client@sportrent.kz",
    name: "Мико Аскаров",
    role: "client",
    phone: "+7 (777) 123-45-67",
    city: "Астана",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
  },
};

export const INITIAL_ARENAS: Arena[] = [
  {
    id: 1,
    ownerId: 1,
    ownerEmail: "dev.arena1@sportrent.kz",
    title: "Astana Arena Sport",
    city: "Астана",
    address: "ул. Нур-Султан 12",
    phone: "+7 (701) 111-22-33",
    rating: 4.8,
    reviewsCount: 124,
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    description: "Крупнейший спортивный комплекс столицы с 3 специализированными залами для командных и индивидуальных видов спорта.",
    features: [
      "Бесплатная парковка на 100 мест",
      "Раздевалки с душем и фенами",
      "Кафе и спорт-бар",
      "Сауна",
      "Прокат экипировки",
      "Трибуны для зрителей",
    ],
    workingHours: "08:00 - 24:00 (ежедневно)",
    hallsCount: 3,
  },
  {
    id: 2,
    ownerId: 2,
    ownerEmail: "dev.arena2@sportrent.kz",
    title: "Nomad Pro Complex",
    city: "Астана",
    address: "пр. Туран 54",
    phone: "+7 (702) 444-55-66",
    rating: 4.9,
    reviewsCount: 98,
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
    description: "Премиальный спортивный кластер с паркетом олимпийского уровня, футбольным манежем и панорамным падл-кортом.",
    features: [
      "Подземный теплый паркинг",
      "Индивидуальные шкафчики с кодовым замком",
      "Фитнес-смузи бар",
      "Прокат ракеток и мячей",
      "Высокоскоростной Wi-Fi",
      "Профессиональная вентиляция",
    ],
    workingHours: "07:00 - 23:00 (ежедневно)",
    hallsCount: 3,
  },
];

export const INITIAL_HALLS: Hall[] = [
  // --- Арена 1: Astana Arena Sport (3 зала) ---
  {
    id: 101,
    arenaId: 1,
    arenaTitle: "Astana Arena Sport",
    arenaAddress: "ул. Нур-Султан 12",
    title: "Футбольный зал Arena 1",
    sportType: "Футбол",
    surfaceType: "Искусственный газон 60 мм (FIFA Quality Pro)",
    equipment: [
      "Бестеневой LED-свет 500 Lux",
      "Ворота 3х2 м с сеткой-гасителем",
      "Электронное табло со счетом и таймером",
      "Профессиональные мячи Select & Nike",
      "Комплект манишек (синие, красные)",
      "Раздевалка с 12 душевыми кабинами",
    ],
    capacity: "5x5 / 6x6 (до 14 человек)",
    pricePerHour: 15000,
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    status: "active",
    description: "Профессиональный крытый манеж с мягким наполнителем газона. Отличная амортизация для снижения нагрузки на суставы.",
    rating: 4.8,
    reviewsCount: 124,
  },
  {
    id: 102,
    arenaId: 1,
    arenaTitle: "Astana Arena Sport",
    arenaAddress: "ул. Нур-Султан 12",
    title: "Баскетбольный зал Arena Basket",
    sportType: "Баскетбол",
    surfaceType: "Амортизационный трёхслойный паркет (канадский клён)",
    equipment: [
      "Гидравлические мобильные стойки Spalding",
      "Стеклянные щиты с кольцами Pro Image",
      "Табло счета с индикацией 24 секунд",
      "Мячи Molten GG7X и Wilson Solution",
      "Судейский столик с микрофоном",
      "Музыкальная акустика по залу",
    ],
    capacity: "5x5 (стандартное поле FIBA)",
    pricePerHour: 14000,
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
    status: "active",
    description: "Соревновательный зал с великолепным сцеплением паркета и комфортным освещением без бликов.",
    rating: 4.7,
    reviewsCount: 89,
  },
  {
    id: 103,
    arenaId: 1,
    arenaTitle: "Astana Arena Sport",
    arenaAddress: "ул. Нур-Султан 12",
    title: "Теннисный корт Arena Tennis",
    sportType: "Теннис",
    surfaceType: "Hard Cushion с 7-слойным смягчением",
    equipment: [
      "Теннисная сетка европейского стандарта",
      "Судейская вышка",
      "Пушка для подачи мячей (Spinshot)",
      "Прокат ракеток Wilson & Head",
      "Корзины для сбора мячей",
      "Зона отдыха с кулером",
    ],
    capacity: "Одиночный или парный разряд (до 4 чел)",
    pricePerHour: 16000,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    status: "active",
    description: "Крытый корт со стабильным отскоком мяча и терморегуляцией (+20°C круглый год).",
    rating: 4.9,
    reviewsCount: 156,
  },

  // --- Арена 2: Nomad Pro Complex (3 зала) ---
  {
    id: 201,
    arenaId: 2,
    arenaTitle: "Nomad Pro Complex",
    arenaAddress: "пр. Туран 54",
    title: "Футбольный манеж Nomad Turf",
    sportType: "Футбол",
    surfaceType: "Синтетический монофиламентный газон 50 мм",
    equipment: [
      "LED-прожекторы высокой четкости",
      "Ворота с защитными матами",
      "Мячи Adidas Tiro League",
      "Манишки 3 цветов",
      "Душевые с термостатом",
      "Музыкальная колонка Bluetooth",
    ],
    capacity: "5x5 (до 12 человек)",
    pricePerHour: 13000,
    imageUrl: "https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800",
    status: "active",
    description: "Уютный всепогодный манеж для любительских матчей и тренировок с отличной вентиляцией.",
    rating: 4.8,
    reviewsCount: 74,
  },
  {
    id: 202,
    arenaId: 2,
    arenaTitle: "Nomad Pro Complex",
    arenaAddress: "пр. Туран 54",
    title: "Баскетбольный корт Nomad Court",
    sportType: "Баскетбол",
    surfaceType: "Спортивный дубовый паркет с пружинящей подложкой",
    equipment: [
      "Профессиональные кольца с амортизатором",
      "Электронное двухстороннее табло",
      "Мячи Wilson Evolution (размер 7 и 6)",
      "Отдельная раздевалка с полотенцами",
      "Пит-стоп с изотониками",
    ],
    capacity: "5x5 / 3x3",
    pricePerHour: 12000,
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    status: "active",
    description: "Премиальная площадка для тренировок, стритбол-турниров и корпоративных игр.",
    rating: 4.7,
    reviewsCount: 65,
  },
  {
    id: 203,
    arenaId: 2,
    arenaTitle: "Nomad Pro Complex",
    arenaAddress: "пр. Туран 54",
    title: "Сквош и Падл корт Nomad Padel",
    sportType: "Сквош и падл",
    surfaceType: "Панорамное закаленное стекло 12 мм + моноволоконный ковер",
    equipment: [
      "Панорамный обзор 360°",
      "Профессиональная сетка для падла",
      "Ракетки Bullpadel & Babolat в прокат",
      "Мячи Head Padel Pro",
      "Запись игры на видеокамеру",
    ],
    capacity: "Парная игра (4 человека)",
    pricePerHour: 14000,
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800",
    status: "active",
    description: "Самый современный падл-корт в городе. Полное соответствие нормативам World Padel Tour.",
    rating: 4.9,
    reviewsCount: 110,
  },
];

export const DEFAULT_WEEK_SCHEDULE: ScheduleDay[] = [
  { dayOfWeek: 1, dayName: "Понедельник", isClosed: false, startTime: "08:00", endTime: "23:00", slotDurations: [60, 90] },
  { dayOfWeek: 2, dayName: "Вторник",     isClosed: false, startTime: "08:00", endTime: "23:00", slotDurations: [60, 90] },
  { dayOfWeek: 3, dayName: "Среда",       isClosed: false, startTime: "08:00", endTime: "23:00", slotDurations: [60, 90] },
  { dayOfWeek: 4, dayName: "Четверг",     isClosed: false, startTime: "08:00", endTime: "23:00", slotDurations: [60, 90] },
  { dayOfWeek: 5, dayName: "Пятница",     isClosed: false, startTime: "08:00", endTime: "24:00", slotDurations: [60, 90, 120] },
  { dayOfWeek: 6, dayName: "Суббота",     isClosed: false, startTime: "09:00", endTime: "24:00", slotDurations: [60, 90, 120] },
  { dayOfWeek: 0, dayName: "Воскресенье", isClosed: false, startTime: "09:00", endTime: "23:00", slotDurations: [60, 90] },
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: "SR-101",
    hallId: 101,
    hallTitle: "Футбольный зал Arena 1",
    sportType: "Футбол",
    arenaId: 1,
    arenaTitle: "Astana Arena Sport",
    clientName: "Ерлан Сарсенов",
    clientPhone: "+7 (705) 555-12-34",
    date: "Сегодня",
    timeSlot: "19:00 - 20:00",
    durationMinutes: 60,
    totalPrice: 15000,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "SR-102",
    hallId: 102,
    hallTitle: "Баскетбольный зал Arena Basket",
    sportType: "Баскетбол",
    arenaId: 1,
    arenaTitle: "Astana Arena Sport",
    clientName: "Алихан Бахыт",
    clientPhone: "+7 (778) 999-88-77",
    date: "Сегодня",
    timeSlot: "20:00 - 21:30",
    durationMinutes: 90,
    totalPrice: 21000,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "SR-201",
    hallId: 203,
    hallTitle: "Сквош и Падл корт Nomad Padel",
    sportType: "Сквош и падл",
    arenaId: 2,
    arenaTitle: "Nomad Pro Complex",
    clientName: "Диас Маратов",
    clientPhone: "+7 (701) 333-77-11",
    date: "Завтра",
    timeSlot: "18:00 - 19:30",
    durationMinutes: 90,
    totalPrice: 21000,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
];

// --- Persistent Storage Helpers ---

const ARENAS_KEY = "sportrent.arenas.v1";
const HALLS_KEY = "sportrent.halls.v1";
const SCHEDULES_KEY = "sportrent.schedules.v1";
const BOOKINGS_KEY = "sportrent.bookings.v1";

export async function getStoredArenas(): Promise<Arena[]> {
  try {
    const raw = await AsyncStorage.getItem(ARENAS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_ARENAS;
}

export async function getStoredHalls(): Promise<Hall[]> {
  try {
    const raw = await AsyncStorage.getItem(HALLS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_HALLS;
}

export async function getStoredSchedule(arenaId: number): Promise<ScheduleDay[]> {
  try {
    const raw = await AsyncStorage.getItem(`${SCHEDULES_KEY}.${arenaId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_WEEK_SCHEDULE;
}

export async function saveStoredSchedule(arenaId: number, schedule: ScheduleDay[]): Promise<void> {
  await AsyncStorage.setItem(`${SCHEDULES_KEY}.${arenaId}`, JSON.stringify(schedule));
}

export async function getStoredBookings(): Promise<Booking[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_BOOKINGS;
}

export async function saveNewBooking(booking: Omit<Booking, "id" | "createdAt">): Promise<Booking> {
  const current = await getStoredBookings();
  const created: Booking = {
    ...booking,
    id: `SR-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [created, ...current];
  await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));
  return created;
}

export async function saveUpdatedHall(hall: Hall): Promise<void> {
  const halls = await getStoredHalls();
  const idx = halls.findIndex((h) => h.id === hall.id);
  if (idx >= 0) {
    halls[idx] = hall;
  } else {
    halls.unshift(hall);
  }
  await AsyncStorage.setItem(HALLS_KEY, JSON.stringify(halls));
}

export async function saveUpdatedArena(arena: Arena): Promise<void> {
  const arenas = await getStoredArenas();
  const idx = arenas.findIndex((a) => a.id === arena.id);
  if (idx >= 0) {
    arenas[idx] = arena;
  } else {
    arenas.unshift(arena);
  }
  await AsyncStorage.setItem(ARENAS_KEY, JSON.stringify(arenas));
}

export async function updateBookingStatus(
  id: string,
  status: "confirmed" | "pending" | "cancelled"
): Promise<void> {
  const bookings = await getStoredBookings();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx >= 0) {
    bookings[idx] = { ...bookings[idx], status };
    await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }
}

export async function saveNewHall(arenaId: number, data: Partial<Hall>): Promise<Hall> {
  const halls = await getStoredHalls();
  const arenas = await getStoredArenas();
  const arena = arenas.find((a) => a.id === arenaId) || arenas[0];

  const newHall: Hall = {
    id: Date.now(),
    arenaId,
    arenaTitle: arena.title,
    arenaAddress: arena.address,
    title: data.title || "Новый зал",
    sportType: data.sportType || "Футбол",
    surfaceType: data.surfaceType || "Спортивное покрытие",
    equipment: data.equipment && data.equipment.length > 0 ? data.equipment : ["Освещение", "Раздевалки"],
    capacity: data.capacity || "До 12 человек",
    pricePerHour: data.pricePerHour || 12000,
    imageUrl: data.imageUrl || "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    status: data.status || "active",
    description: data.description || "Новая спортивная площадка",
    rating: 5.0,
    reviewsCount: 1,
  };

  const updated = [newHall, ...halls];
  await AsyncStorage.setItem(HALLS_KEY, JSON.stringify(updated));
  return newHall;
}
