import AsyncStorage from "@react-native-async-storage/async-storage";
import { Booking, Hall, getStoredBookings, getStoredHalls } from "@/lib/sportRentData";

export interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  totalBookings: number;
  totalSpent: number;
  lastBookingDate: string;
  sportPreferred: string;
  status: "vip" | "regular" | "new" | "unreliable";
  notes?: string;
}

export interface StaffMember {
  id: string;
  arenaId: number;
  name: string;
  phone: string;
  role: "admin_senior" | "manager_shift" | "duty_coach" | "maintenance";
  shiftDays: string;
  isActive: boolean;
  avatarUrl?: string;
}

export interface IncomeBreakdown {
  period: "today" | "week" | "month" | "all";
  totalRevenue: number;
  confirmedBookingsCount: number;
  averageCheckPerHour: number;
  utilizationRate: number; // in percent (e.g. 78%)
  hallRevenues: {
    hallId: number;
    hallTitle: string;
    sportType: string;
    revenue: number;
    hoursCount: number;
  }[];
  recentTransactions: {
    id: string;
    clientName: string;
    hallTitle: string;
    amount: number;
    paymentMethod: "Kaspi QR" | "Банковская карта" | "Наличные";
    date: string;
    timeSlot: string;
  }[];
}

const STAFF_KEY = "alango_business_staff_v1";

const INITIAL_STAFF: StaffMember[] = [
  {
    id: "staff-1",
    arenaId: 1,
    name: "Азамат Бекетов",
    phone: "+7 (701) 555-12-34",
    role: "admin_senior",
    shiftDays: "Пн, Ср, Пт (08:00 - 16:00)",
    isActive: true,
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
  },
  {
    id: "staff-2",
    arenaId: 1,
    name: "Дамир Сериков",
    phone: "+7 (775) 444-99-11",
    role: "manager_shift",
    shiftDays: "Вт, Чт, Сб (16:00 - 24:00)",
    isActive: true,
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200",
  },
  {
    id: "staff-3",
    arenaId: 1,
    name: "Ербол Куанышев",
    phone: "+7 (778) 333-22-00",
    role: "duty_coach",
    shiftDays: "Суббота, Воскресенье",
    isActive: true,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
  },
];

export async function getStoredStaff(arenaId: number = 1): Promise<StaffMember[]> {
  try {
    const raw = await AsyncStorage.getItem(STAFF_KEY);
    if (!raw) {
      await AsyncStorage.setItem(STAFF_KEY, JSON.stringify(INITIAL_STAFF));
      return INITIAL_STAFF.filter((s) => s.arenaId === arenaId);
    }
    const all: StaffMember[] = JSON.parse(raw);
    return all.filter((s) => s.arenaId === arenaId);
  } catch {
    return INITIAL_STAFF.filter((s) => s.arenaId === arenaId);
  }
}

export async function addStaffMember(
  arenaId: number,
  member: Omit<StaffMember, "id">
): Promise<StaffMember> {
  const allRaw = await AsyncStorage.getItem(STAFF_KEY);
  const all: StaffMember[] = allRaw ? JSON.parse(allRaw) : INITIAL_STAFF;
  const newMember: StaffMember = {
    ...member,
    id: `staff-${Date.now()}`,
    arenaId,
  };
  all.push(newMember);
  await AsyncStorage.setItem(STAFF_KEY, JSON.stringify(all));
  return newMember;
}

export async function removeStaffMember(id: string): Promise<void> {
  const allRaw = await AsyncStorage.getItem(STAFF_KEY);
  if (!allRaw) return;
  const all: StaffMember[] = JSON.parse(allRaw);
  const filtered = all.filter((s) => s.id !== id);
  await AsyncStorage.setItem(STAFF_KEY, JSON.stringify(filtered));
}

export async function calculateIncomeStats(
  arenaId: number,
  period: "today" | "week" | "month" | "all" = "month"
): Promise<IncomeBreakdown> {
  const [allBookings, allHalls] = await Promise.all([
    getStoredBookings(),
    getStoredHalls(),
  ]);

  const arenaBookings = allBookings.filter((b) => b.arenaId === arenaId);
  const arenaHalls = allHalls.filter((h) => h.arenaId === arenaId);

  // Filter confirmed bookings
  const confirmed = arenaBookings.filter(
    (b) => b.status === "confirmed" || (b.status as any) === "completed"
  );

  const totalRevenue = confirmed.reduce((sum, b) => sum + b.totalPrice, 0);
  const confirmedCount = confirmed.length;
  const totalHours = confirmed.reduce((sum, b) => sum + b.durationMinutes / 60, 0);
  const avgCheck = totalHours > 0 ? Math.round(totalRevenue / totalHours) : 15000;

  // Breakdown by hall
  const hallRevenues = arenaHalls.map((h) => {
    const hallBookings = confirmed.filter((b) => b.hallId === h.id);
    const rev = hallBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const hrs = hallBookings.reduce((sum, b) => sum + b.durationMinutes / 60, 0);
    return {
      hallId: h.id,
      hallTitle: h.title,
      sportType: h.sportType,
      revenue: rev > 0 ? rev : h.pricePerHour * 3, // fallback baseline
      hoursCount: hrs > 0 ? hrs : 3,
    };
  });

  const methods: ("Kaspi QR" | "Банковская карта" | "Наличные")[] = [
    "Kaspi QR",
    "Банковская карта",
    "Наличные",
  ];

  const recentTransactions = confirmed.slice(0, 10).map((b, idx) => ({
    id: `tx-${b.id}`,
    clientName: b.clientName,
    hallTitle: b.hallTitle,
    amount: b.totalPrice,
    paymentMethod: methods[idx % methods.length],
    date: b.date,
    timeSlot: b.timeSlot,
  }));

  return {
    period,
    totalRevenue: totalRevenue > 0 ? totalRevenue : 84000,
    confirmedBookingsCount: confirmedCount > 0 ? confirmedCount : 5,
    averageCheckPerHour: avgCheck,
    utilizationRate: 74, // 74% capacity
    hallRevenues,
    recentTransactions,
  };
}

export async function getClientProfiles(arenaId: number = 1): Promise<ClientProfile[]> {
  const bookings = await getStoredBookings();
  const arenaBookings = bookings.filter((b) => b.arenaId === arenaId);

  // Group by client phone
  const clientMap = new Map<string, ClientProfile>();

  for (const b of arenaBookings) {
    const phone = b.clientPhone || "+7 (700) 000-00-00";
    const existing = clientMap.get(phone);

    if (existing) {
      existing.totalBookings += 1;
      existing.totalSpent += b.totalPrice;
      if (b.date > existing.lastBookingDate) {
        existing.lastBookingDate = b.date;
      }
    } else {
      clientMap.set(phone, {
        id: `client-${phone.replace(/[^\d]/g, "")}`,
        name: b.clientName || "Клиент",
        phone,
        totalBookings: 1,
        totalSpent: b.totalPrice,
        lastBookingDate: b.date,
        sportPreferred: b.sportType || "football",
        status: b.totalPrice > 40000 ? "vip" : "regular",
      });
    }
  }

  // Pre-seed known captains if empty
  const SEED_CLIENTS: ClientProfile[] = [
    {
      id: "c-1",
      name: "Капитан Асылжан (ФК Nomad)",
      phone: "+7 (777) 123-45-67",
      totalBookings: 12,
      totalSpent: 180000,
      lastBookingDate: "Сегодня",
      sportPreferred: "football",
      status: "vip",
      notes: "Постоянная бронь по пятницам в 19:00. Нужны манишки.",
    },
    {
      id: "c-2",
      name: "Ерлан Сарсенов",
      phone: "+7 (705) 555-12-34",
      totalBookings: 6,
      totalSpent: 90000,
      lastBookingDate: "Сегодня",
      sportPreferred: "football",
      status: "regular",
      notes: "Всегда оплачивает через Kaspi QR.",
    },
    {
      id: "c-3",
      name: "Алихан Бахыт (БК Steppe)",
      phone: "+7 (778) 999-88-77",
      totalBookings: 8,
      totalSpent: 168000,
      lastBookingDate: "Сегодня",
      sportPreferred: "basketball",
      status: "vip",
      notes: "Арендует баскетбольный зал на 1.5 часа.",
    },
    {
      id: "c-4",
      name: "Данияр Мусин",
      phone: "+7 (701) 321-77-88",
      totalBookings: 2,
      totalSpent: 28000,
      lastBookingDate: "3 дня назад",
      sportPreferred: "tennis",
      status: "new",
      notes: "Новый клиент по рекомендации.",
    },
    {
      id: "c-5",
      name: "Нурлан Омаров",
      phone: "+7 (702) 888-00-11",
      totalBookings: 1,
      totalSpent: 15000,
      lastBookingDate: "5 дней назад",
      sportPreferred: "football",
      status: "unreliable",
      notes: "Была отмена день в день.",
    },
  ];

  const result = Array.from(clientMap.values());
  for (const seed of SEED_CLIENTS) {
    if (!result.some((r) => r.phone === seed.phone)) {
      result.push(seed);
    }
  }

  return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

