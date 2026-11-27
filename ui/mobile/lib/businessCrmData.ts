import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import type { Booking, SportType } from "@/lib/sportRentData";

export interface ClientProfile {
  id: number;
  arenaId: number;
  userId?: number | null;
  name: string;
  phone: string;
  avatarUrl?: string;
  hasApp: boolean;
  hasPush: boolean;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  paidAmount: number;
  unpaidAmount: number;
  lastBookingDate: string;
  sportPreferred: string;
  rating: number;
  ratingsCount: number;
  status: "vip" | "regular" | "new" | "blocked";
  segmentOverride: string;
  tags: string;
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

export type ExpenseCategory =
  | "rent"
  | "salary"
  | "utilities"
  | "equipment"
  | "marketing"
  | "other";

export interface ArenaExpense {
  id: number;
  arena_id: number;
  category: ExpenseCategory;
  title: string;
  amount: number;
  expense_date: string;
  notes: string;
  created_at: string;
}

export interface IncomeBreakdown {
  period: "today" | "week" | "month" | "all";
  totalRevenue: number;
  collectedAmount: number;
  unpaidAmount: number;
  totalExpenses: number;
  netProfit: number;
  accruedProfit: number;
  confirmedBookingsCount: number;
  hoursPlayed: number;
  averageCheckPerHour: number | null;
  utilizationRate: number;
  growthPercent: number | null;
  hallRevenues: {
    hallId: number;
    hallTitle: string;
    sportType: string;
    revenue: number;
    collected: number;
    hoursCount: number;
  }[];
  expenseCategories: {
    category: ExpenseCategory;
    amount: number;
    count: number;
  }[];
  recentTransactions: {
    id: string;
    clientName: string;
    hallTitle: string;
    amount: number;
    paidAmount: number;
    date: string;
    timeSlot: string;
  }[];
  expenses: ArenaExpense[];
}

export interface SmartReminderItem {
  kind: "pending_request" | "unpaid_booking" | "dormant_client";
  title: string;
  subtitle: string;
  booking_id?: number;
  client_id?: number;
  client_name?: string;
  phone?: string;
  amount_due?: number;
}

export interface ArenaReminder {
  id: number;
  arena_id: number;
  booking_id?: number | null;
  client_id?: number | null;
  title: string;
  notes: string;
  due_date: string;
  due_time: string;
  remind_push: boolean;
  status: "pending" | "done";
  created_at: string;
}

export interface RemindersDashboard {
  smart: SmartReminderItem[];
  tasks: ArenaReminder[];
}

const STAFF_KEY = "alango_business_staff_v1";
const DEMO_STAFF_IDS = new Set(["staff-1", "staff-2", "staff-3"]);

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

function mapClientRow(r: any): ClientProfile {
  const seg = r.segment;
  const status: ClientProfile["status"] =
    seg === "vip" || seg === "regular" || seg === "new" || seg === "blocked"
      ? seg
      : "new";
  return {
    id: Number(r.id),
    arenaId: Number(r.arena_id),
    userId: r.user_id ?? null,
    name: String(r.name || ""),
    phone: String(r.phone || ""),
    avatarUrl: r.avatar_url || undefined,
    hasApp: Boolean(r.has_app),
    hasPush: Boolean(r.has_push),
    totalBookings: Number(r.total_bookings ?? 0),
    confirmedBookings: Number(r.confirmed_bookings ?? 0),
    cancelledBookings: Number(r.cancelled_bookings ?? 0),
    totalSpent: Number(r.total_spent ?? 0),
    paidAmount: Number(r.paid_amount ?? 0),
    unpaidAmount: Number(r.unpaid_amount ?? 0),
    lastBookingDate: String(r.last_booking_date || ""),
    sportPreferred: String(r.sport_preferred || "football"),
    rating: Number(r.rating ?? 5),
    ratingsCount: Number(r.ratings_count ?? 0),
    status,
    segmentOverride: String(r.segment_override || ""),
    tags: String(r.tags || ""),
    notes: String(r.notes || ""),
  };
}

export async function getClientProfiles(_arenaId?: number): Promise<ClientProfile[]> {
  const res = await api.get<{ clients: any[] }>("/api/business/clients");
  const rows = Array.isArray(res.data?.clients) ? res.data.clients : [];
  return rows.map(mapClientRow);
}

export async function createClientProfile(payload: {
  name: string;
  phone: string;
  segment?: string;
  tags?: string;
  notes?: string;
}): Promise<ClientProfile> {
  const res = await api.post<{ client: any }>("/api/business/clients", payload);
  return mapClientRow(res.data.client);
}

export async function updateClientProfile(
  clientId: number,
  payload: {
    name?: string;
    segment?: string;
    tags?: string;
    notes?: string;
  }
): Promise<ClientProfile> {
  const res = await api.patch<{ client: any }>(
    `/api/business/clients/${clientId}`,
    payload
  );
  return mapClientRow(res.data.client);
}

export async function getClientBookings(clientId: number): Promise<Booking[]> {
  const res = await api.get<{ bookings: any[] }>(
    `/api/business/clients/${clientId}/bookings`
  );
  const rows = Array.isArray(res.data?.bookings) ? res.data.bookings : [];
  return rows.map((b: any) => ({
    id: b.booking_code || String(b.id),
    dbId: Number(b.id),
    hallId: Number(b.hall_id),
    hallTitle: String(b.hall_title || ""),
    arenaId: Number(b.arena_id),
    arenaTitle: String(b.arena_title || ""),
    sportType: (b.sport_type || "football") as SportType,
    date: String(b.booking_date || ""),
    timeSlot: String(b.time_slot || ""),
    startTime: String(b.start_time || ""),
    endTime: String(b.end_time || ""),
    durationMinutes: Number(b.duration_minutes ?? 60),
    totalPrice: Number(b.total_price ?? 0),
    paidAmount: Number(b.paid_amount ?? 0),
    paymentStatus: b.payment_status || "not_paid",
    status: b.status || "confirmed",
    clientName: String(b.client_name || ""),
    clientPhone: String(b.client_phone || ""),
    notes: b.notes || undefined,
    createdAt: b.created_at || new Date().toISOString(),
  }));
}

export async function calculateIncomeStats(
  _arenaId: number,
  period: "today" | "week" | "month" | "all" = "month"
): Promise<IncomeBreakdown> {
  const res = await api.get<any>("/api/business/finance", { params: { period } });
  const d = res.data || {};
  return {
    period: d.period || period,
    totalRevenue: Number(d.total_revenue ?? 0),
    collectedAmount: Number(d.collected_amount ?? 0),
    unpaidAmount: Number(d.unpaid_amount ?? 0),
    totalExpenses: Number(d.total_expenses ?? 0),
    netProfit: Number(d.net_profit ?? 0),
    accruedProfit: Number(d.accrued_profit ?? 0),
    confirmedBookingsCount: Number(d.confirmed_bookings_count ?? 0),
    hoursPlayed: Number(d.hours_played ?? 0),
    averageCheckPerHour:
      d.average_check_per_hour != null ? Number(d.average_check_per_hour) : null,
    utilizationRate: Number(d.utilization_rate ?? 0),
    growthPercent: d.growth_percent != null ? Number(d.growth_percent) : null,
    hallRevenues: Array.isArray(d.hall_revenues)
      ? d.hall_revenues.map((h: any) => ({
          hallId: Number(h.hall_id),
          hallTitle: String(h.hall_title || ""),
          sportType: String(h.sport_type || ""),
          revenue: Number(h.revenue ?? 0),
          collected: Number(h.collected ?? 0),
          hoursCount: Number(h.hours_count ?? 0),
        }))
      : [],
    expenseCategories: Array.isArray(d.expense_categories)
      ? d.expense_categories.map((c: any) => ({
          category: c.category as ExpenseCategory,
          amount: Number(c.amount ?? 0),
          count: Number(c.count ?? 0),
        }))
      : [],
    recentTransactions: Array.isArray(d.recent_transactions)
      ? d.recent_transactions.map((t: any) => ({
          id: String(t.id),
          clientName: String(t.client_name || ""),
          hallTitle: String(t.hall_title || ""),
          amount: Number(t.amount ?? 0),
          paidAmount: Number(t.paid_amount ?? 0),
          date: String(t.date || ""),
          timeSlot: String(t.time_slot || ""),
        }))
      : [],
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
  };
}

export async function createArenaExpense(payload: {
  category: ExpenseCategory;
  title: string;
  amount: number;
  expense_date: string;
  notes?: string;
}): Promise<ArenaExpense> {
  const res = await api.post<{ expense: ArenaExpense }>(
    "/api/business/expenses",
    payload
  );
  return res.data.expense;
}

export async function deleteArenaExpense(id: number): Promise<void> {
  await api.delete(`/api/business/expenses/${id}`);
}

export async function getRemindersDashboard(): Promise<RemindersDashboard> {
  const res = await api.get<RemindersDashboard>("/api/business/reminders");
  return {
    smart: Array.isArray(res.data?.smart) ? res.data.smart : [],
    tasks: Array.isArray(res.data?.tasks) ? res.data.tasks : [],
  };
}

export async function createArenaReminder(payload: {
  title: string;
  due_date: string;
  due_time: string;
  notes?: string;
  remind_push?: boolean;
}): Promise<ArenaReminder> {
  const res = await api.post<{ reminder: ArenaReminder }>(
    "/api/business/reminders",
    payload
  );
  return res.data.reminder;
}

export async function updateArenaReminder(
  id: number,
  payload: { status?: "pending" | "done" }
): Promise<ArenaReminder> {
  const res = await api.patch<{ reminder: ArenaReminder }>(
    `/api/business/reminders/${id}`,
    payload
  );
  return res.data.reminder;
}

export async function deleteArenaReminder(id: number): Promise<void> {
  await api.delete(`/api/business/reminders/${id}`);
}
