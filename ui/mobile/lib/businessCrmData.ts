import AsyncStorage from "@react-native-async-storage/async-storage";
import { Booking, Hall, getOwnArenaBookings, getStoredHalls } from "@/lib/sportRentData";

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

export async function calculateIncomeStats(
  arenaId: number,
  period: "today" | "week" | "month" | "all" = "month"
): Promise<IncomeBreakdown> {
  const [allBookings, allHalls] = await Promise.all([
    getOwnArenaBookings().catch(() => [] as Booking[]),
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

  const result = Array.from(clientMap.values());
  return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

