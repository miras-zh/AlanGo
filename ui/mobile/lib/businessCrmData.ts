import AsyncStorage from "@react-native-async-storage/async-storage";
import { Booking, Hall, getOwnArenaBookings, getStoredHalls } from "@/lib/sportRentData";
import { tr } from "@/lib/i18n";

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
  hoursPlayed: number;
  averageCheckPerHour: number | null; // null when nothing was played
  utilizationRate: number; // percent of open hours booked, 0..100
  growthPercent: number | null; // vs the previous period; null if no baseline
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
    date: string;
    timeSlot: string;
  }[];
}

const STAFF_KEY = "alango_business_staff_v1";

// Staff is stored on the device per arena (no backend yet). There is no
// demo seed: a new business starts with an empty team.
export async function getStoredStaff(arenaId: number): Promise<StaffMember[]> {
  try {
    const raw = await AsyncStorage.getItem(STAFF_KEY);
    if (!raw) return [];
    const all: StaffMember[] = JSON.parse(raw);
    return all.filter((s) => s.arenaId === arenaId && !DEMO_STAFF_IDS.has(s.id));
  } catch {
    return [];
  }
}

// Ids of the demo team that older builds seeded into storage.
const DEMO_STAFF_IDS = new Set(["staff-1", "staff-2", "staff-3"]);

export async function addStaffMember(
  arenaId: number,
  member: Omit<StaffMember, "id">
): Promise<StaffMember> {
  const allRaw = await AsyncStorage.getItem(STAFF_KEY);
  const all: StaffMember[] = allRaw ? JSON.parse(allRaw) : [];
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

// Hours a hall is bookable per day, used for the utilization estimate until
// real working hours are wired into the calculation.
const OPEN_HOURS_PER_DAY = 15;
const PERIOD_DAYS: Record<"today" | "week" | "month", number> = { today: 1, week: 7, month: 30 };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Booking dates come as "YYYY-MM-DD" (older local records may say "Сегодня").
function bookingDay(date: string): Date | null {
  if (date === "Сегодня") return startOfDay(new Date());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function inRange(b: Booking, from: Date, to: Date): boolean {
  const d = bookingDay(b.date);
  return d !== null && d >= from && d < to;
}

// Revenue analytics from the arena's real confirmed bookings only — no
// placeholders: a new business sees zeros.
export async function calculateIncomeStats(
  arenaId: number,
  period: "today" | "week" | "month" | "all" = "month"
): Promise<IncomeBreakdown> {
  const [allBookings, allHalls] = await Promise.all([
    getOwnArenaBookings().catch(() => [] as Booking[]),
    getStoredHalls(),
  ]);

  const arenaHalls = allHalls.filter((h) => h.arenaId === arenaId);
  const confirmedAll = allBookings.filter(
    (b) =>
      b.arenaId === arenaId && (b.status === "confirmed" || (b.status as any) === "completed")
  );

  const tomorrow = new Date(startOfDay(new Date()).getTime() + 86400000);
  let confirmed = confirmedAll;
  let previous: Booking[] | null = null;
  let days = 0;
  if (period !== "all") {
    days = PERIOD_DAYS[period];
    const from = new Date(tomorrow.getTime() - days * 86400000);
    const prevFrom = new Date(from.getTime() - days * 86400000);
    confirmed = confirmedAll.filter((b) => inRange(b, from, tomorrow));
    previous = confirmedAll.filter((b) => inRange(b, prevFrom, from));
  }

  const sum = (list: Booking[]) => list.reduce((acc, b) => acc + b.totalPrice, 0);
  const totalRevenue = sum(confirmed);
  const hoursPlayed = confirmed.reduce((acc, b) => acc + b.durationMinutes / 60, 0);

  let growthPercent: number | null = null;
  if (previous) {
    const prevRevenue = sum(previous);
    if (prevRevenue > 0) {
      growthPercent = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10;
    }
  }

  const availableHours = period === "all" ? 0 : arenaHalls.length * OPEN_HOURS_PER_DAY * days;
  const utilizationRate =
    availableHours > 0 ? Math.min(100, Math.round((hoursPlayed / availableHours) * 100)) : 0;

  const hallRevenues = arenaHalls.map((h) => {
    const hallBookings = confirmed.filter((b) => b.hallId === h.id);
    return {
      hallId: h.id,
      hallTitle: h.title,
      sportType: h.sportType,
      revenue: sum(hallBookings),
      hoursCount: Math.round(hallBookings.reduce((acc, b) => acc + b.durationMinutes / 60, 0) * 10) / 10,
    };
  });

  const recentTransactions = confirmed.slice(0, 10).map((b) => ({
    id: `tx-${b.id}`,
    clientName: b.clientName,
    hallTitle: b.hallTitle,
    amount: b.totalPrice,
    date: b.date,
    timeSlot: b.timeSlot,
  }));

  return {
    period,
    totalRevenue,
    confirmedBookingsCount: confirmed.length,
    hoursPlayed: Math.round(hoursPlayed * 10) / 10,
    averageCheckPerHour: hoursPlayed > 0 ? Math.round(totalRevenue / hoursPlayed) : null,
    utilizationRate,
    growthPercent,
    hallRevenues,
    recentTransactions,
  };
}

// Clients are derived only from the arena's real bookings.
export async function getClientProfiles(arenaId: number): Promise<ClientProfile[]> {
  const bookings = await getOwnArenaBookings().catch(() => [] as Booking[]);
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
        name: b.clientName || tr("user.client"),
        phone,
        totalBookings: 1,
        totalSpent: b.totalPrice,
        lastBookingDate: b.date,
        sportPreferred: b.sportType || "football",
        status: b.totalPrice > 40000 ? "vip" : "regular",
      });
    }
  }

  const result = Array.from(clientMap.values());
  return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

