import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, apiFetch, UPLOAD_TIMEOUT_MS } from "@/lib/api";

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
  photos?: string[]; // gallery, up to 5; photos[0] is the cover
  lengthM?: number;
  widthM?: number;
  maxPeople?: number;
  scheduleConfigured?: boolean; // hall has its own weekly schedule
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
  slotDurations: number[]; // [60, 90, 120] минут (как в Vison)
  // Каскадный график (Vison Cascade Pattern)
  cascadeEnabled?: boolean;
  cascadeStepHours?: number; // 1..6
  cascadeInitialEndTime?: string; // "14:00" (верхняя граница окна)
  cascadeSecondBoundaryEnabled?: boolean;
  cascadeSecondBoundaryTime?: string; // "18:00" (динамическая нижняя граница)
  cascadeCutoffTime?: string; // "23:00" (жесткий потолок приёма заявок)
};

export type Arena = {
  id: number;
  ownerId: number;
  ownerEmail: string;
  title: string;
  category?: string;
  district?: string;
  city: string;
  address: string;
  phone: string;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  logoUrl?: string; // business avatar (square logo), separate from the cover
  description: string;
  features: string[];
  workingHours: string;
  hallsCount: number;
  minPricePerHour?: number;
  sports?: SportType[];
  latitude?: number;
  longitude?: number;
  venueType?: "complex" | "single" | "outdoor";
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
  paidAmount?: number; // Сколько фактически оплачено (например 0, 2000, 10000, 20000)
  paymentStatus?: "not_paid" | "partial" | "paid"; // Не оплачено / Предоплата (частично) / Оплачено 100%
  status: "confirmed" | "pending" | "cancelled" | "rejected";
  source?: "app" | "manual" | "phone" | "telegram";
  gameOutcome?: "completed" | "no_show";
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  dbId?: number;          // numeric bookings.id on the backend
  userId?: number | null; // registered client (null for manual/phone bookings)
  endTime?: string;       // "HH:MM"
  clientRating?: number | null; // 1-5, set by the business after the game
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
    name: "Мико Jo",
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
    category: "Спорткомплекс",
    district: "Есиль",
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
    minPricePerHour: 14000,
    sports: ["Футбол", "Баскетбол", "Теннис"],
    latitude: 51.1085,
    longitude: 71.4025,
  },
  {
    id: 2,
    ownerId: 2,
    ownerEmail: "dev.arena2@sportrent.kz",
    title: "Nomad Pro Complex",
    category: "Премиум спорткластер",
    district: "Есиль",
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
    minPricePerHour: 12000,
    sports: ["Футбол", "Баскетбол", "Сквош и падл"],
    latitude: 51.1215,
    longitude: 71.4110,
  },
  {
    id: 3,
    ownerId: 3,
    ownerEmail: "daulet@sportrent.kz",
    title: "Daulet Tennis & Padel Club",
    category: "Теннисный центр",
    district: "Нура",
    city: "Астана",
    address: "пр. Кабанбай батыра 6/1",
    phone: "+7 (7172) 44-55-66",
    rating: 4.9,
    reviewsCount: 142,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    description: "Национальный ракетный центр: 2 крытых профессиональных корта, панорамный корт для сквоша и падел-тенниса.",
    features: [
      "Профессиональное покрытие Hard Cushion",
      "Магазин экипировки и натяжка струн",
      "Сауна и ледяная купель",
      "Кофейня со спортивным меню",
      "Парковка с зарядкой для электромобилей",
    ],
    workingHours: "07:00 - 23:00 (ежедневно)",
    hallsCount: 2,
    minPricePerHour: 16000,
    sports: ["Теннис", "Сквош и падл"],
    latitude: 51.1435,
    longitude: 71.4285,
  },
  {
    id: 4,
    ownerId: 4,
    ownerEmail: "barys@sportrent.kz",
    title: "Barys Universal Arena",
    category: "Спорткомплекс",
    district: "Есиль",
    city: "Астана",
    address: "пр. Туран 57",
    phone: "+7 (7172) 61-33-00",
    rating: 4.8,
    reviewsCount: 175,
    imageUrl: "https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800",
    description: "Многофункциональный комплекс для игровых видов спорта: мини-футбол, баскетбол, волейбол и командные тренировки.",
    features: [
      "Вместительные трибуны",
      "Просторные раздевалки",
      "Электронные табло со звуковым таймером",
      "Прокат мячей и инвентаря",
      "Спортивный массажный кабинет",
    ],
    workingHours: "08:00 - 23:00 (ежедневно)",
    hallsCount: 3,
    minPricePerHour: 10000,
    sports: ["Футбол", "Баскетбол", "Волейбол"],
    latitude: 51.1190,
    longitude: 71.4080,
  },
  {
    id: 5,
    ownerId: 5,
    ownerEmail: "almaty.arena@sportrent.kz",
    title: "Almaty Arena Sports Hub",
    category: "Ледовый и игровой комплекс",
    district: "Алатауский",
    city: "Алматы",
    address: "мкр. Нуркент 7",
    phone: "+7 (727) 225-10-10",
    rating: 4.9,
    reviewsCount: 210,
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    description: "Многофункциональный спорткомплекс в Алматы: крытый манеж для мини-футбола, волейбольный и баскетбольный залы.",
    features: [
      "Парковка на 300 автомобилей",
      "VIP-раздевалки с индивидуальными душами",
      "Профессиональное освещение 500 люкс",
      "Кафетерий и фитнес-зона",
      "Трибуны на 200 посадочных мест",
    ],
    workingHours: "07:00 - 24:00 (ежедневно)",
    hallsCount: 2,
    minPricePerHour: 15000,
    sports: ["Футбол", "Баскетбол", "Волейбол"],
    latitude: 43.2778,
    longitude: 76.8180,
  },
  {
    id: 6,
    ownerId: 6,
    ownerEmail: "dostyk.padel@sportrent.kz",
    title: "Dostyk Padel & Tennis Club",
    category: "Ракетный клуб",
    district: "Медеуский",
    city: "Алматы",
    address: "пр. Достык 104",
    phone: "+7 (727) 315-40-50",
    rating: 4.95,
    reviewsCount: 165,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    description: "Панорамные корты для падел-тенниса и классического тенниса у подножия гор в Медеуском районе.",
    features: [
      "Панорамные стеклянные корты мирового уровня",
      "Вид на горы Заилийского Алатау",
      "Прокат ракеток Babolat и Bullpadel",
      "Финская сауна",
      "Лаунж-зона и терраса",
    ],
    workingHours: "07:00 - 23:00 (ежедневно)",
    hallsCount: 2,
    minPricePerHour: 18000,
    sports: ["Теннис", "Сквош и падл"],
    latitude: 43.2325,
    longitude: 76.9575,
  },
  {
    id: 7,
    ownerId: 7,
    ownerEmail: "shymkent.grand@sportrent.kz",
    title: "Shymkent Grand Arena",
    category: "Спорткомплекс",
    district: "Аль-Фарабийский",
    city: "Шымкент",
    address: "пр. Байдибек би 128",
    phone: "+7 (7252) 99-88-77",
    rating: 4.85,
    reviewsCount: 92,
    imageUrl: "https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800",
    description: "Современный мультиспортивный комплекс Шымкента для футбола, тенниса и командных соревнований.",
    features: [
      "Бесплатная парковка",
      "Кондиционирование и мощная вентиляция",
      "Душевые и персональные шкафчики",
      "Спортивный инвентарь",
    ],
    workingHours: "08:00 - 24:00 (ежедневно)",
    hallsCount: 2,
    minPricePerHour: 11000,
    sports: ["Футбол", "Баскетбол", "Теннис"],
    latitude: 42.3685,
    longitude: 69.6050,
  },
  // --- Дополнительные арены Алматы (Центр, Абая, Сатпаева, Толе би) ---
  {
    id: 8,
    ownerId: 8,
    ownerEmail: "central.stadium@sportrent.kz",
    title: "Центральный Стадион (Спорткомплекс)",
    category: "Многофункциональный комплекс",
    district: "Алмалинский",
    city: "Алматы",
    address: "ул. Сатпаева 29/3",
    phone: "+7 (727) 292-12-34",
    rating: 4.9,
    reviewsCount: 312,
    imageUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
    description: "Главная спортивная арена в центре Алматы: крытые футбольные манежи, легкоатлетические дорожки и раздевалки европейского стандарта.",
    features: ["Крытый манеж", "Душ и раздевалки", "Мячи и манишки", "Освещение 1000 люкс", "Парковка"],
    workingHours: "07:00 - 24:00",
    hallsCount: 4,
    minPricePerHour: 8000,
    sports: ["Футбол", "Баскетбол"],
    latitude: 43.2385,
    longitude: 76.9242,
  },
  {
    id: 9,
    ownerId: 9,
    ownerEmail: "abay.football@sportrent.kz",
    title: "Football Park Abay",
    category: "Футбольный манеж",
    district: "Бостандыкский",
    city: "Алматы",
    address: "пр. Абая 52",
    phone: "+7 (705) 555-44-33",
    rating: 4.8,
    reviewsCount: 145,
    imageUrl: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800",
    description: "Современное поле с искусственным газоном последнего поколения, подогревом и качественным освещением.",
    features: ["Искусственный газон 60мм", "Душевые кабины", "Аренда манишек", "Кулер с водой"],
    workingHours: "08:00 - 01:00",
    hallsCount: 2,
    minPricePerHour: 9000,
    sports: ["Футбол"],
    latitude: 43.2401,
    longitude: 76.9150,
  },
  {
    id: 10,
    ownerId: 10,
    ownerEmail: "auezov.sports@sportrent.kz",
    title: "Auezov Arena",
    category: "Спортзал",
    district: "Ауэзовский",
    city: "Алматы",
    address: "ул. Ауэзова 84",
    phone: "+7 (707) 333-22-11",
    rating: 4.75,
    reviewsCount: 88,
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
    description: "Универсальный зал с профессиональным паркетом для баскетбола, волейбола и мини-футбола.",
    features: ["Паркетное покрытие", "Электронное табло", "Раздевалки", "Душ"],
    workingHours: "08:00 - 23:00",
    hallsCount: 2,
    minPricePerHour: 10000,
    sports: ["Баскетбол", "Волейбол", "Футбол"],
    latitude: 43.2450,
    longitude: 76.8920,
  },
  {
    id: 11,
    ownerId: 11,
    ownerEmail: "tolebi.club@sportrent.kz",
    title: "Tole Bi Padel & Tennis",
    category: "Ракетный клуб",
    district: "Алмалинский",
    city: "Алматы",
    address: "ул. Толе би 187",
    phone: "+7 (777) 888-99-00",
    rating: 4.88,
    reviewsCount: 120,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    description: "Крытые корты для падел-тенниса и большого тенниса в Алмалинском районе.",
    features: ["Панорамные корты", "Аренда ракеток", "Профессиональные тренеры", "Сауна"],
    workingHours: "07:00 - 23:00",
    hallsCount: 3,
    minPricePerHour: 14000,
    sports: ["Теннис", "Сквош и падл"],
    latitude: 43.2530,
    longitude: 76.8860,
  },
  {
    id: 12,
    ownerId: 12,
    ownerEmail: "gogol.arena@sportrent.kz",
    title: "Gogol Sport Hub",
    category: "Спортзал",
    district: "Алмалинский",
    city: "Алматы",
    address: "ул. Гоголя 125",
    phone: "+7 (701) 900-80-70",
    rating: 4.82,
    reviewsCount: 96,
    imageUrl: "https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800",
    description: "Уютный комплекс с мини-футбольным полем и волейбольной площадкой в историческом центре Алматы.",
    features: ["Терафлекс", "Душ", "Инвентарь", "Парковка"],
    workingHours: "08:00 - 24:00",
    hallsCount: 2,
    minPricePerHour: 8500,
    sports: ["Футбол", "Волейбол"],
    latitude: 43.2570,
    longitude: 76.9140,
  },
  {
    id: 13,
    ownerId: 13,
    ownerEmail: "alfarabi.court@sportrent.kz",
    title: "Al-Farabi Premium Tennis",
    category: "Премиум теннис",
    district: "Бостандыкский",
    city: "Алматы",
    address: "пр. Аль-Фараби 77",
    phone: "+7 (727) 350-00-00",
    rating: 4.96,
    reviewsCount: 180,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    description: "Элитный теннисный комплекс с хард-кортами и премиальным клубным сервисом.",
    features: ["Покрытие Hard Cushion", "VIP-раздевалки", "Спа-зона", "Ресторан"],
    workingHours: "06:30 - 23:30",
    hallsCount: 4,
    minPricePerHour: 22000,
    sports: ["Теннис"],
    latitude: 43.2180,
    longitude: 76.9290,
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

  // --- Арена 3: Daulet Tennis & Padel Club (2 зала) ---
  {
    id: 301,
    arenaId: 3,
    arenaTitle: "Daulet Tennis & Padel Club",
    arenaAddress: "пр. Кабанбай батыра 6/1",
    title: "Центральный корт Grand Slam",
    sportType: "Теннис",
    surfaceType: "Hard Cushion турнирного уровня ITF",
    equipment: [
      "Профессиональное бестеневое освещение 800 Lux",
      "Судейская вышка и электронный счет",
      "Пушка для тренировки ударов",
      "Ракетки Head Speed & Wilson Pro Staff",
      "Раздевалки с сауной и полотенцами",
    ],
    capacity: "Одиночный или парный разряд (до 4 чел)",
    pricePerHour: 18000,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    status: "active",
    description: "Центральный крытый корт национального уровня с мягким покрытием и климат-контролем.",
    rating: 4.9,
    reviewsCount: 142,
  },
  {
    id: 302,
    arenaId: 3,
    arenaTitle: "Daulet Tennis & Padel Club",
    arenaAddress: "пр. Кабанбай батыра 6/1",
    title: "Панорамный падл-корт Sky Padel",
    sportType: "Сквош и падл",
    surfaceType: "Испанский монофиламентный ковер + стекло 12 мм",
    equipment: [
      "Панорамный стеклянный борт без перекладин",
      "Профессиональная натяжная сетка",
      "Прокат топовых ракеток Nox & Bullpadel",
      "Мячи Bullpadel Gold",
    ],
    capacity: "Парная игра (4 человека)",
    pricePerHour: 16000,
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800",
    status: "active",
    description: "Светлый панорамный корт с высокими потолками (10 м) для идеальной игры в падл в любую погоду.",
    rating: 4.9,
    reviewsCount: 96,
  },

  // --- Арена 4: Barys Universal Arena (3 зала) ---
  {
    id: 401,
    arenaId: 4,
    arenaTitle: "Barys Universal Arena",
    arenaAddress: "пр. Туран 57",
    title: "Футзальный манеж Barys",
    sportType: "Футбол",
    surfaceType: "Спортивный полиуретановый терафлекс 8 мм",
    equipment: [
      "Стандартные футзальные ворота 3x2 м",
      "Мячи с низким отскоком Select Futsal Super",
      "Электронное настенное табло",
      "Трибуны на 200 зрителей",
      "Раздевалки с душем",
    ],
    capacity: "5x5 (до 14 человек)",
    pricePerHour: 14000,
    imageUrl: "https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800",
    status: "active",
    description: "Универсальный соревновательный манеж для мини-футбола с удобным покрытием и трибунами.",
    rating: 4.8,
    reviewsCount: 130,
  },
  {
    id: 402,
    arenaId: 4,
    arenaTitle: "Barys Universal Arena",
    arenaAddress: "пр. Туран 57",
    title: "Баскетбольная арена Pro",
    sportType: "Баскетбол",
    surfaceType: "Паркетная доска из клена Junckers (сертификат FIBA)",
    equipment: [
      "Профессиональные гидро-щиты Schelde Sports",
      "Секундомер атаки 24 сек",
      "Мячи Spalding TF-1000",
      "Судейский столик",
    ],
    capacity: "5x5 (стандарт FIBA)",
    pricePerHour: 12000,
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
    status: "active",
    description: "Просторная арена с трибунами для баскетбольных матчей и тренировок.",
    rating: 4.7,
    reviewsCount: 88,
  },
  {
    id: 403,
    arenaId: 4,
    arenaTitle: "Barys Universal Arena",
    arenaAddress: "пр. Туран 57",
    title: "Волейбольный зал Olympus",
    sportType: "Волейбол",
    surfaceType: "Французский Gerflor Taraflex Surface",
    equipment: [
      "Профессиональные алюминиевые волейбольные стойки",
      "Сетка с антеннами и карманами",
      "Судейская вышка",
      "Мячи Mikasa V200W (олимпийский стандарт)",
      "Защитные протекторы на стойках",
    ],
    capacity: "6x6 (до 16 человек)",
    pricePerHour: 10000,
    imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800",
    status: "active",
    description: "Специализированный волейбольный зал с покрытием олимпийского стандарта для максимального комфорта прыжков.",
    rating: 4.8,
    reviewsCount: 64,
  },
  // --- Арена 5: Almaty Arena Sports Hub (2 зала) ---
  {
    id: 501,
    arenaId: 5,
    arenaTitle: "Almaty Arena Sports Hub",
    arenaAddress: "мкр. Нуркент 7",
    title: "Футбольный манеж Almaty Pro",
    sportType: "Футбол",
    surfaceType: "Искусственный газон премиум 50мм с гео-крошкой",
    equipment: [
      "Ворота 3x2 для футзала",
      "Сетка заградительная по периметру",
      "Комплект манишек и мячей",
      "Электронное табло",
    ],
    capacity: "5x5 (до 14 человек)",
    pricePerHour: 16000,
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    status: "active",
    description: "Просторный крытый манеж в Almaty Arena для комфортной игры круглый год.",
    rating: 4.9,
    reviewsCount: 110,
  },
  {
    id: 502,
    arenaId: 5,
    arenaTitle: "Almaty Arena Sports Hub",
    arenaAddress: "мкр. Нуркент 7",
    title: "Баскетбольно-волейбольный зал",
    sportType: "Баскетбол",
    surfaceType: "Канадский кленовый паркет с амортизацией",
    equipment: [
      "Профессиональные баскетбольные щиты Spalding",
      "Волейбольные стойки Mikasa",
      "Электронное судейское табло",
    ],
    capacity: "5x5 (стандарт FIBA)",
    pricePerHour: 15000,
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
    status: "active",
    description: "Универсальный зал с элитным паркетом для баскетбола и волейбола.",
    rating: 4.9,
    reviewsCount: 78,
  },
  // --- Арена 6: Dostyk Padel & Tennis Club (2 зала) ---
  {
    id: 601,
    arenaId: 6,
    arenaTitle: "Dostyk Padel & Tennis Club",
    arenaAddress: "пр. Достык 104",
    title: "Панорамный падел-корт Mountain View",
    sportType: "Сквош и падл",
    surfaceType: "Падел-монофиламент Mondo Supercourt XN",
    equipment: [
      "Панорамное закаленное стекло 12мм",
      "Светодиодное бестеневое освещение 800 люкс",
      "Ракетки и мячи Bullpadel",
    ],
    capacity: "Парная игра (4 человека)",
    pricePerHour: 18000,
    imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    status: "active",
    description: "Эксклюзивный панорамный падел-корт с великолепным видом на горы Медеу.",
    rating: 4.95,
    reviewsCount: 95,
  },
  // --- Арена 7: Shymkent Grand Arena (2 зала) ---
  {
    id: 701,
    arenaId: 7,
    arenaTitle: "Shymkent Grand Arena",
    arenaAddress: "пр. Байдибек би 128",
    title: "Крытый мини-футбольный зал Shymkent",
    sportType: "Футбол",
    surfaceType: "Искусственная трава последнего поколения",
    equipment: [
      "Ворота 3x2",
      "Мячи Select Futsal Super",
      "Манишки 2 цветов",
    ],
    capacity: "5x5 (до 12 человек)",
    pricePerHour: 11000,
    imageUrl: "https://images.unsplash.com/photo-1518604666864-742395639b8d?w=800",
    status: "active",
    description: "Комфортный мини-футбольный зал с мягким искусственным газоном в Шымкенте.",
    rating: 4.85,
    reviewsCount: 52,
  },
];

export const DEFAULT_WEEK_SCHEDULE: ScheduleDay[] = [
  {
    dayOfWeek: 1,
    dayName: "Понедельник",
    isClosed: false,
    startTime: "08:00",
    endTime: "23:00",
    slotDurations: [60, 90],
    cascadeEnabled: true,
    cascadeStepHours: 2,
    cascadeInitialEndTime: "14:00",
    cascadeSecondBoundaryEnabled: true,
    cascadeSecondBoundaryTime: "18:00",
    cascadeCutoffTime: "22:00",
  },
  {
    dayOfWeek: 2,
    dayName: "Вторник",
    isClosed: false,
    startTime: "08:00",
    endTime: "23:00",
    slotDurations: [60, 90],
    cascadeEnabled: true,
    cascadeStepHours: 2,
    cascadeInitialEndTime: "14:00",
    cascadeSecondBoundaryEnabled: true,
    cascadeSecondBoundaryTime: "18:00",
    cascadeCutoffTime: "22:00",
  },
  {
    dayOfWeek: 3,
    dayName: "Среда",
    isClosed: false,
    startTime: "08:00",
    endTime: "23:00",
    slotDurations: [60, 90],
    cascadeEnabled: true,
    cascadeStepHours: 2,
    cascadeInitialEndTime: "14:00",
    cascadeSecondBoundaryEnabled: true,
    cascadeSecondBoundaryTime: "18:00",
    cascadeCutoffTime: "22:00",
  },
  {
    dayOfWeek: 4,
    dayName: "Четверг",
    isClosed: false,
    startTime: "08:00",
    endTime: "23:00",
    slotDurations: [60, 90],
    cascadeEnabled: true,
    cascadeStepHours: 2,
    cascadeInitialEndTime: "14:00",
    cascadeSecondBoundaryEnabled: true,
    cascadeSecondBoundaryTime: "18:00",
    cascadeCutoffTime: "22:00",
  },
  {
    dayOfWeek: 5,
    dayName: "Пятница",
    isClosed: false,
    startTime: "08:00",
    endTime: "24:00",
    slotDurations: [60, 90, 120],
    cascadeEnabled: true,
    cascadeStepHours: 2,
    cascadeInitialEndTime: "15:00",
    cascadeSecondBoundaryEnabled: true,
    cascadeSecondBoundaryTime: "19:00",
    cascadeCutoffTime: "23:00",
  },
  {
    dayOfWeek: 6,
    dayName: "Суббота",
    isClosed: false,
    startTime: "09:00",
    endTime: "24:00",
    slotDurations: [60, 90, 120],
    cascadeEnabled: false,
    cascadeStepHours: 2,
    cascadeInitialEndTime: "16:00",
    cascadeSecondBoundaryEnabled: false,
    cascadeSecondBoundaryTime: "20:00",
    cascadeCutoffTime: "23:00",
  },
  {
    dayOfWeek: 0,
    dayName: "Воскресенье",
    isClosed: false,
    startTime: "09:00",
    endTime: "23:00",
    slotDurations: [60, 90],
    cascadeEnabled: false,
    cascadeStepHours: 2,
    cascadeInitialEndTime: "15:00",
    cascadeSecondBoundaryEnabled: false,
    cascadeSecondBoundaryTime: "19:00",
    cascadeCutoffTime: "22:00",
  },
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
    paidAmount: 15000,
    paymentStatus: "paid",
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
    totalPrice: 20000,
    paidAmount: 10000,
    paymentStatus: "partial",
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
    totalPrice: 20000,
    paidAmount: 2000,
    paymentStatus: "partial",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
];

// --- Persistent Storage Helpers ---

const ARENAS_KEY = "sportrent.arenas.v1";
const HALLS_KEY = "sportrent.halls.v1";
const SCHEDULES_KEY = "sportrent.schedules.v1";
const BOOKINGS_KEY = "sportrent.bookings.v1";

export async function getStoredArenas(params?: {
  q?: string;
  city?: string;
  district?: string;
  sport?: string;
}): Promise<Arena[]> {
  try {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.city) query.set("city", params.city);
    if (params?.district) query.set("district", params.district);
    if (params?.sport) query.set("sport", params.sport);
    const qs = query.toString();
    const res = await apiFetch<{ arenas: any[] }>(`/arenas${qs ? `?${qs}` : ""}`);
    if (res?.arenas && Array.isArray(res.arenas) && res.arenas.length > 0) {
      const mapped: Arena[] = res.arenas.map((a: any) => ({
        id: a.id,
        ownerId: a.ownerId ?? a.owner_id ?? 0,
        ownerEmail: a.ownerEmail ?? a.owner_email ?? "",
        title: a.title,
        category: a.category,
        district: a.district,
        city: a.city,
        address: a.address,
        phone: a.phone,
        rating: a.rating ?? 4.8,
        reviewsCount: a.reviewsCount ?? a.reviews_count ?? 50,
        imageUrl: a.imageUrl ?? a.image_url ?? "",
        logoUrl: a.logoUrl ?? a.logo_url ?? "",
        description: a.description ?? "",
        features: a.features ?? [],
        workingHours: a.workingHours ?? a.working_hours ?? "08:00 - 23:00",
        hallsCount: a.hallsCount ?? a.halls_count ?? (a.halls ? a.halls.length : 3),
        minPricePerHour: a.minPricePerHour ?? a.min_price_per_hour ?? 12000,
        sports: a.sports ?? ["Футбол", "Баскетбол", "Теннис"],
        latitude: a.latitude ?? a.lat,
        longitude: a.longitude ?? a.lng,
        venueType: a.venue_type ?? "complex",
      }));
      await AsyncStorage.setItem(ARENAS_KEY, JSON.stringify(mapped));
      return mapped;
    }
  } catch {
    // Offline or server down: fallback to cached
  }

  try {
    const raw = await AsyncStorage.getItem(ARENAS_KEY);
    if (raw) {
      let parsed: Arena[] = JSON.parse(raw);
      // Ensure coordinates from INITIAL_ARENAS are attached
      parsed = parsed.map((item) => {
        const init = INITIAL_ARENAS.find((ia) => ia.id === item.id);
        return {
          ...item,
          latitude: item.latitude || init?.latitude,
          longitude: item.longitude || init?.longitude,
        };
      });
      const existingIds = new Set(parsed.map((a) => a.id));
      const missing = INITIAL_ARENAS.filter((a) => !existingIds.has(a.id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        await AsyncStorage.setItem(ARENAS_KEY, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
  } catch {}
  return INITIAL_ARENAS;
}

export async function getStoredHalls(params?: {
  sport?: string;
  arena_id?: number;
  q?: string;
}): Promise<Hall[]> {
  try {
    const query = new URLSearchParams();
    if (params?.sport) query.set("sport", params.sport);
    if (params?.arena_id) query.set("arena_id", String(params.arena_id));
    if (params?.q) query.set("q", params.q);
    const qs = query.toString();
    const res = await apiFetch<{ halls: any[] }>(`/halls${qs ? `?${qs}` : ""}`);
    if (res?.halls && Array.isArray(res.halls) && res.halls.length > 0) {
      const mapped: Hall[] = res.halls.map((h: any) => ({
        id: h.id,
        arenaId: h.arenaId ?? h.arena_id,
        arenaTitle: h.arenaTitle ?? h.arena_title ?? "",
        arenaAddress: h.arenaAddress ?? h.arena_address ?? "",
        title: h.title,
        sportType: h.sportType ?? h.sport_type ?? "Футбол",
        surfaceType: h.surfaceType ?? h.surface_type ?? "Паркет",
        equipment: h.equipment ?? [],
        capacity: h.capacity ?? "",
        pricePerHour: h.pricePerHour ?? h.price_per_hour ?? 12000,
        imageUrl: h.imageUrl ?? h.image_url ?? "",
        photos: h.photos ?? [],
        lengthM: h.length_m ?? 0,
        widthM: h.width_m ?? 0,
        maxPeople: h.max_people ?? 0,
        scheduleConfigured: h.schedule_configured ?? false,
        status: h.status ?? "active",
        description: h.description ?? "",
        rating: h.rating ?? 0,
        reviewsCount: h.reviewsCount ?? h.reviews_count ?? 0,
      }));
      await AsyncStorage.setItem(HALLS_KEY, JSON.stringify(mapped));
      return mapped;
    }
  } catch {
    // Fallback to cached
  }

  try {
    const raw = await AsyncStorage.getItem(HALLS_KEY);
    if (raw) {
      const parsed: Hall[] = JSON.parse(raw);
      const existingIds = new Set(parsed.map((h) => h.id));
      const missing = INITIAL_HALLS.filter((h) => !existingIds.has(h.id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        await AsyncStorage.setItem(HALLS_KEY, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
  } catch {}
  return INITIAL_HALLS;
}

export type ArenaWithHalls = Arena & {
  halls: Hall[];
  minPrice: number;
  availableSports: SportType[];
};

export async function getArenasWithHalls(): Promise<ArenaWithHalls[]> {
  const [arenas, halls] = await Promise.all([getStoredArenas(), getStoredHalls()]);
  return arenas.map((arena) => {
    const arenaHalls = halls.filter((h) => h.arenaId === arena.id);
    const sportsSet = new Set<SportType>(arena.sports || []);
    let minP = arena.minPricePerHour || 999999;
    arenaHalls.forEach((h) => {
      sportsSet.add(h.sportType);
      if (h.pricePerHour && h.pricePerHour < minP) minP = h.pricePerHour;
    });
    return {
      ...arena,
      halls: arenaHalls,
      minPrice: minP === 999999 ? 12000 : minP,
      availableSports: Array.from(sportsSet),
      hallsCount: arenaHalls.length || arena.hallsCount,
    };
  });
}

export async function getStoredSchedule(arenaId: number): Promise<ScheduleDay[]> {
  try {
    const res = await apiFetch<{ schedule: any[] }>(`/arenas/${arenaId}/schedule`);
    if (res?.schedule && Array.isArray(res.schedule) && res.schedule.length > 0) {
      const mapped: ScheduleDay[] = res.schedule.map((d: any) => ({
        dayOfWeek: d.dayOfWeek ?? d.day_of_week ?? 0,
        dayName: d.dayName ?? d.day_name ?? "День",
        isClosed: d.isClosed ?? d.is_closed ?? false,
        startTime: d.startTime ?? d.start_time ?? "08:00",
        endTime: d.endTime ?? d.end_time ?? "23:00",
        slotDurations: d.slotDurations ?? d.slot_durations ?? [60, 90],
      }));
      await AsyncStorage.setItem(`${SCHEDULES_KEY}.${arenaId}`, JSON.stringify(mapped));
      return mapped;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(`${SCHEDULES_KEY}.${arenaId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_WEEK_SCHEDULE;
}

export async function saveStoredSchedule(arenaId: number, schedule: ScheduleDay[]): Promise<void> {
  await AsyncStorage.setItem(`${SCHEDULES_KEY}.${arenaId}`, JSON.stringify(schedule));
  try {
    await apiFetch(`/arenas/${arenaId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({
        schedule: schedule.map((s) => ({
          day_of_week: s.dayOfWeek,
          day_name: s.dayName,
          is_closed: s.isClosed,
          start_time: s.startTime,
          end_time: s.endTime,
          slot_durations: s.slotDurations,
        })),
      }),
    });
  } catch {
    // Saved locally in AsyncStorage
  }
}

function mapApiBooking(b: any): Booking {
  return {
    id: b.booking_code || String(b.id),
    hallId: b.hall_id,
    hallTitle: b.hall_title || "Зал",
    sportType: b.sport_type || "Футбол",
    arenaId: b.arena_id,
    arenaTitle: b.arena_title || "Спорткомплекс",
    clientName: b.client_name,
    clientPhone: b.client_phone,
    date: b.booking_date,
    timeSlot: b.time_slot,
    durationMinutes: b.duration_minutes || 60,
    totalPrice: b.total_price,
    status: b.status,
    createdAt: b.created_at || new Date().toISOString(),
    dbId: typeof b.id === "number" ? b.id : undefined,
    userId: b.user_id ?? null,
    endTime: b.end_time,
    clientRating: b.client_rating ?? null,
  };
}

// True once the booking's end time has passed (venue time, UTC+5).
export function isBookingFinished(b: Booking, now = new Date()): boolean {
  if (b.status === "cancelled" || b.status === "rejected") return false;
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return false;
  const end = (b.endTime || "23:59").replace("24:00", "23:59");
  const t = Date.parse(`${b.date}T${end}:00+05:00`);
  return Number.isFinite(t) && t <= now.getTime();
}

// Business rates the client of a finished booking (PUT /api/bookings/{id}/client-rating).
export async function rateBookingClient(dbId: number, score: number): Promise<void> {
  await apiFetch(`/bookings/${dbId}/client-rating`, {
    method: "PUT",
    body: JSON.stringify({ score }),
  });
}

// Business cabinet: the owner's arena bookings *with* client contacts
// (GET /api/business/bookings). No cache and no demo fallback — a new
// business simply has no bookings yet.
export async function getOwnArenaBookings(): Promise<Booking[]> {
  const res = await apiFetch<{ bookings: any[] }>("/business/bookings");
  return Array.isArray(res?.bookings) ? res.bookings.map(mapApiBooking) : [];
}

export async function getStoredBookings(arenaId?: number): Promise<Booking[]> {
  try {
    const res = await apiFetch<{ bookings: any[] }>(
      `/bookings${arenaId ? `?arena_id=${arenaId}` : ""}`
    );
    if (res?.bookings && Array.isArray(res.bookings) && res.bookings.length > 0) {
      const mapped: Booking[] = res.bookings.map(mapApiBooking);
      await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(mapped));
      return mapped;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(BOOKINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_BOOKINGS;
}

export async function saveNewBooking(booking: Omit<Booking, "id" | "createdAt">): Promise<Booking> {
  let created: Booking = {
    ...booking,
    id: `SR-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    const res = await apiFetch<any>("/bookings", {
      method: "POST",
      body: JSON.stringify({
        hall_id: booking.hallId,
        arena_id: booking.arenaId,
        client_name: booking.clientName,
        client_phone: booking.clientPhone,
        booking_date: booking.date,
        time_slot: booking.timeSlot,
        duration_minutes: booking.durationMinutes,
        total_price: booking.totalPrice,
      }),
    });
    if (res && (res.id || res.booking_code)) {
      created = {
        ...booking,
        id: res.booking_code || String(res.id),
        createdAt: res.created_at || new Date().toISOString(),
      };
    }
  } catch {
    // Saved locally in AsyncStorage
  }

  const current = await getStoredBookings();
  const updated = [created, ...current.filter((b) => b.id !== created.id)];
  await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));
  return created;
}

function hallPayload(hall: Partial<Hall> & { arenaId: number }) {
  return {
    arena_id: hall.arenaId,
    title: hall.title,
    sport_type: hall.sportType,
    surface_type: hall.surfaceType,
    price_per_hour: hall.pricePerHour,
    description: hall.description ?? "",
    capacity: hall.capacity ?? "",
    equipment: hall.equipment ?? [],
    length_m: hall.lengthM ?? 0,
    width_m: hall.widthM ?? 0,
    max_people: hall.maxPeople ?? 0,
    status: hall.status ?? "active",
  };
}

// Saves the hall on the server (owner only). Errors propagate to the UI —
// no silent local-only "success".
export async function saveUpdatedHall(hall: Hall): Promise<void> {
  await apiFetch("/halls", {
    method: "POST",
    body: JSON.stringify({ id: hall.id, ...hallPayload(hall) }),
  });
}

export async function saveUpdatedArena(arena: Arena): Promise<void> {
  await apiFetch(`/arenas/${arena.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: arena.title,
      category: arena.category,
      district: arena.district,
      city: arena.city,
      address: arena.address,
      phone: arena.phone,
      description: arena.description,
      features: arena.features,
      sports: arena.sports,
      working_hours: arena.workingHours,
      latitude: arena.latitude,
      longitude: arena.longitude,
    }),
  });

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
  status: "confirmed" | "pending" | "cancelled" | "rejected"
): Promise<void> {
  const bookings = await getStoredBookings();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx >= 0) {
    bookings[idx] = { ...bookings[idx], status };
    await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }

  try {
    await apiFetch(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  } catch {}
}

export async function rejectBookingWithReason(
  id: string,
  reason: string
): Promise<void> {
  const bookings = await getStoredBookings();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx >= 0) {
    bookings[idx] = {
      ...bookings[idx],
      status: "rejected",
      rejectionReason: reason,
    };
    await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }

  try {
    await apiFetch(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", reason }),
    });
  } catch {}
}

export async function setBookingGameOutcome(
  id: string,
  gameOutcome: "completed" | "no_show"
): Promise<void> {
  const bookings = await getStoredBookings();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx >= 0) {
    bookings[idx] = { ...bookings[idx], gameOutcome };
    await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }
}

export async function updateBookingPayment(
  id: string,
  paidAmount: number
): Promise<Booking | null> {
  const bookings = await getStoredBookings();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx < 0) return null;

  const current = bookings[idx];
  const total = current.totalPrice || 0;
  let paymentStatus: "not_paid" | "partial" | "paid" = "not_paid";
  if (paidAmount >= total && total > 0) {
    paymentStatus = "paid";
  } else if (paidAmount > 0) {
    paymentStatus = "partial";
  }

  const updated: Booking = {
    ...current,
    paidAmount,
    paymentStatus,
  };

  bookings[idx] = updated;
  await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));

  try {
    await apiFetch(`/bookings/${id}/payment`, {
      method: "PATCH",
      body: JSON.stringify({ paidAmount, paymentStatus }),
    });
  } catch {}

  return updated;
}

export async function updateBookingDetails(
  id: string,
  updates: Partial<Booking>
): Promise<Booking | null> {
  const bookings = await getStoredBookings();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx < 0) return null;

  const current = bookings[idx];
  const totalPrice = updates.totalPrice ?? current.totalPrice;
  const paidAmount = updates.paidAmount ?? current.paidAmount ?? 0;

  let paymentStatus = updates.paymentStatus ?? current.paymentStatus ?? "not_paid";
  if (paidAmount >= totalPrice && totalPrice > 0) {
    paymentStatus = "paid";
  } else if (paidAmount > 0) {
    paymentStatus = "partial";
  } else {
    paymentStatus = "not_paid";
  }

  const updated: Booking = {
    ...current,
    ...updates,
    totalPrice,
    paidAmount,
    paymentStatus,
  };

  bookings[idx] = updated;
  await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));

  try {
    await apiFetch(`/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updated),
    });
  } catch {}

  return updated;
}

// Creates a hall on the server and returns it with its real id (needed to
// upload gallery photos right after).
export async function saveNewHall(arenaId: number, data: Partial<Hall>): Promise<Hall> {
  const res = await apiFetch<any>("/halls", {
    method: "POST",
    body: JSON.stringify(hallPayload({ ...data, arenaId })),
  });
  return {
    id: res.id,
    arenaId,
    arenaTitle: "",
    arenaAddress: "",
    title: res.title ?? data.title ?? "",
    sportType: res.sport_type ?? data.sportType ?? "Футбол",
    surfaceType: res.surface_type ?? data.surfaceType ?? "",
    equipment: res.equipment ?? data.equipment ?? [],
    capacity: res.capacity ?? data.capacity ?? "",
    pricePerHour: res.price_per_hour ?? data.pricePerHour ?? 0,
    imageUrl: res.image_url ?? "",
    photos: res.photos ?? [],
    lengthM: res.length_m ?? data.lengthM ?? 0,
    widthM: res.width_m ?? data.widthM ?? 0,
    maxPeople: res.max_people ?? data.maxPeople ?? 0,
    status: res.status ?? "active",
    description: res.description ?? data.description ?? "",
    rating: 0,
    reviewsCount: 0,
  };
}

// Arena logo (business avatar): POST/DELETE /api/arenas/{id}/logo, owner only.
export async function uploadArenaLogo(
  arenaId: number,
  photo: { uri: string; name: string; type: string },
): Promise<string> {
  const fd = new FormData();
  fd.append("photo", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
  const res = await api.post<{ logo_url: string }>(`/api/arenas/${arenaId}/logo`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return res.data?.logo_url ?? "";
}

export async function deleteArenaLogo(arenaId: number): Promise<void> {
  await api.delete(`/api/arenas/${arenaId}/logo`);
}

// Arena cover (banner) — the wide photo on the sports-complex card,
// separate from the logo and from the halls' photos.
export async function uploadArenaCover(
  arenaId: number,
  photo: { uri: string; name: string; type: string },
): Promise<string> {
  const fd = new FormData();
  fd.append("photo", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
  const res = await api.post<{ image_url: string }>(`/api/arenas/${arenaId}/cover`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return res.data?.image_url ?? "";
}

export async function deleteArenaCover(arenaId: number): Promise<void> {
  await api.delete(`/api/arenas/${arenaId}/cover`);
}

// Keeps the cached arena list in sync after a cover change.
export async function cacheArenaCover(arenaId: number, imageUrl: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ARENAS_KEY);
    if (!raw) return;
    const arenas: Arena[] = JSON.parse(raw);
    const next = arenas.map((a) => (a.id === arenaId ? { ...a, imageUrl } : a));
    await AsyncStorage.setItem(ARENAS_KEY, JSON.stringify(next));
  } catch {}
}

// Keeps the cached arena list in sync after a logo change.
export async function cacheArenaLogo(arenaId: number, logoUrl: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ARENAS_KEY);
    if (!raw) return;
    const arenas: Arena[] = JSON.parse(raw);
    const next = arenas.map((a) => (a.id === arenaId ? { ...a, logoUrl } : a));
    await AsyncStorage.setItem(ARENAS_KEY, JSON.stringify(next));
  } catch {}
}

// Gallery: POST/DELETE /api/halls/{id}/photos (owner only, max 5).
export async function uploadHallPhoto(
  hallId: number,
  photo: { uri: string; name: string; type: string },
): Promise<{ photos: string[]; image_url: string }> {
  const fd = new FormData();
  fd.append("photo", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
  const res = await api.post(`/api/halls/${hallId}/photos`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return res.data;
}

export async function deleteHallPhoto(
  hallId: number,
  url: string,
): Promise<{ photos: string[]; image_url: string }> {
  const res = await api.delete(`/api/halls/${hallId}/photos`, { params: { url } });
  return res.data;
}

// ---------------------------------------------------------------------------
// Per-hall schedule and slot availability (backend: internal/sport/hall_schedule.go)
// ---------------------------------------------------------------------------

function mapScheduleDay(d: any): ScheduleDay {
  return {
    dayOfWeek: d.day_of_week ?? 0,
    dayName: d.day_name ?? "",
    isClosed: d.is_closed ?? false,
    startTime: d.start_time ?? "08:00",
    endTime: d.end_time ?? "23:00",
    slotDurations: d.slot_durations?.length ? d.slot_durations : [60],
  };
}

// Monday first, Sunday last — the order owners expect.
function mondayFirst(days: ScheduleDay[]): ScheduleDay[] {
  return [...days].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7));
}

export async function getHallSchedule(hallId: number): Promise<ScheduleDay[]> {
  const res = await apiFetch<{ schedule: any[] }>(`/halls/${hallId}/schedule`);
  return mondayFirst((res?.schedule ?? []).map(mapScheduleDay));
}

export async function saveHallSchedule(hallId: number, schedule: ScheduleDay[]): Promise<ScheduleDay[]> {
  const res = await apiFetch<{ schedule: any[] }>(`/halls/${hallId}/schedule`, {
    method: "PUT",
    body: JSON.stringify({
      schedule: schedule.map((s) => ({
        day_of_week: s.dayOfWeek,
        day_name: s.dayName,
        is_closed: s.isClosed,
        start_time: s.startTime,
        end_time: s.endTime,
        slot_durations: s.slotDurations,
      })),
    }),
  });
  return mondayFirst((res?.schedule ?? []).map(mapScheduleDay));
}

export type SlotStatus = "free" | "booked" | "closed" | "past";

export type HallSlot = { start: string; end: string; label: string; status: SlotStatus };

export type HallAvailability = {
  date: string;
  isClosed: boolean;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  slotDurations: number[];
  pricePerHour: number;
  price: number;
  slots: HallSlot[];
};

export async function getHallAvailability(
  hallId: number,
  date: string,
  durationMinutes?: number,
): Promise<HallAvailability> {
  const qs = `date=${encodeURIComponent(date)}${durationMinutes ? `&duration=${durationMinutes}` : ""}`;
  const d = await apiFetch<any>(`/halls/${hallId}/availability?${qs}`);
  return {
    date: d.date,
    isClosed: d.is_closed,
    startTime: d.start_time,
    endTime: d.end_time,
    durationMinutes: d.duration_minutes,
    slotDurations: d.slot_durations ?? [60],
    pricePerHour: d.price_per_hour,
    price: d.price,
    slots: d.slots ?? [],
  };
}

// Creates a booking on the server; the server validates the slot against the
// hall schedule and other bookings and computes the price.
export async function createHallBooking(data: {
  hallId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  clientName: string;
  clientPhone: string;
  notes?: string;
}): Promise<Booking> {
  const b = await apiFetch<any>("/bookings", {
    method: "POST",
    body: JSON.stringify({
      hall_id: data.hallId,
      booking_date: data.date,
      start_time: data.startTime,
      duration_minutes: data.durationMinutes,
      client_name: data.clientName,
      client_phone: data.clientPhone,
      notes: data.notes ?? "",
    }),
  });
  return mapApiBooking(b);
}

// Local calendar date as YYYY-MM-DD.
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// The signed-in user's nearest booking today: ongoing, or starting within
// the next 3 hours. Used by the home "live match" banner.
export type ActiveBooking = {
  code: string;
  arenaTitle: string;
  hallTitle: string;
  sportType: string;
  date: string;
  startTime: string;
  endTime: string;
  startsInMinutes: number; // <= 0 when already started
  endsInMinutes: number;
};

export async function getMyActiveBooking(): Promise<ActiveBooking | null> {
  const res = await apiFetch<{ bookings: any[] }>("/bookings?my=true");
  const now = new Date();
  const today = isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = String(t || "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };
  const candidates = (res?.bookings ?? [])
    .filter((b) => b.booking_date === today && b.status !== "cancelled")
    .map((b) => ({ b, start: toMin(b.start_time), end: toMin(b.end_time) }))
    .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end) && x.end > nowMin && x.start - nowMin <= 180)
    .sort((x, y) => x.start - y.start);
  const next = candidates[0];
  if (!next) return null;
  return {
    code: next.b.booking_code || String(next.b.id),
    arenaTitle: next.b.arena_title || "",
    hallTitle: next.b.hall_title || "",
    sportType: next.b.sport_type || "",
    date: next.b.booking_date,
    startTime: next.b.start_time,
    endTime: next.b.end_time,
    startsInMinutes: next.start - nowMin,
    endsInMinutes: next.end - nowMin,
  };
}
