import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  COMPLETED_APPOINTMENT_STATUS,
  type ReportAppointment,
  type ReportAppointmentItem,
} from "../domain/metrics";
import type {
  AppointmentMonthBucket,
  BusyHourBucket,
  ExpenseGroupBucket,
  InventoryAlertProduct,
  MonthAmountBucket,
  ProductMonthBucket,
} from "../domain/analytics";

type AppointmentRow = Pick<
  Database["public"]["Tables"]["appointments"]["Row"],
  "id" | "status" | "total_price" | "discount_amount"
>;

type RelatedOne<T> = T | T[] | null;

type AppointmentItemRow = {
  appointment_id: string;
  price: number | null;
  discount_amount: number | null;
  service: RelatedOne<{ id: string; name: string }>;
  employee: RelatedOne<{
    id: string;
    first_name: string;
    last_name: string;
    commission_percentage: number | string | null;
  }>;
  appointment?: RelatedOne<{ status: string }>;
};

export interface OperationalReportRows {
  appointments: ReportAppointment[];
  items: ReportAppointmentItem[];
  newCustomers: number;
}

export interface OperationalReportRowQuery {
  salonId: string;
  start: string;
  end: string;
}

export interface HistoricalReportRows {
  appointmentMonths: AppointmentMonthBucket[];
  busyHours: BusyHourBucket[];
  retailMonths: MonthAmountBucket[];
  expenseGroups: ExpenseGroupBucket[];
  purchaseMonths: MonthAmountBucket[];
  productMonths: ProductMonthBucket[];
  inventoryProducts: InventoryAlertProduct[];
}

export interface HistoricalReportRowQuery extends OperationalReportRowQuery {
  timezone: string;
}

function firstRelation<T>(value: RelatedOne<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function normalizeAppointment(row: AppointmentRow): ReportAppointment {
  return {
    id: row.id,
    status: row.status,
    totalPrice: Number(row.total_price ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
  };
}

function normalizeItem(row: AppointmentItemRow): ReportAppointmentItem {
  const service = firstRelation(row.service);
  const employee = firstRelation(row.employee);
  const employeeName = employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : null;

  return {
    appointmentId: row.appointment_id,
    price: Math.max(0, Number(row.price ?? 0) - Number(row.discount_amount ?? 0)),
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? null,
    employeeId: employee?.id ?? null,
    employeeName: employeeName || null,
    employeeCommissionPct: employee ? Number(employee.commission_percentage ?? 0) : 0,
  };
}

export async function findSalonTimezone(salonId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salons")
    .select("timezone")
    .eq("id", salonId)
    .maybeSingle();

  if (error) throw error;
  return data?.timezone ?? null;
}

export interface SalonReportIdentity {
  name: string;
  timezone: string | null;
  created_at: string;
}

/** Identidad para reportes historicos: el created_at acota el rango total. */
export async function findSalonReportIdentity(
  salonId: string
): Promise<SalonReportIdentity | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salons")
    .select("name, timezone, created_at")
    .eq("id", salonId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findOperationalReportRows({
  salonId,
  start,
  end,
}: OperationalReportRowQuery): Promise<OperationalReportRows> {
  const supabase = await createSupabaseServerClient();

  const [appointmentsResponse, itemsResponse, newCustomersResponse] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, total_price, discount_amount")
      .eq("salon_id", salonId)
      .gte("start_time", start)
      .lte("start_time", end),
    supabase
      .from("appointment_items")
      .select(
        "appointment_id, price, discount_amount, service:services(id, name), employee:employees(id, first_name, last_name, commission_percentage), appointment:appointments!inner(status)"
      )
      .eq("salon_id", salonId)
      .eq("appointment.status", COMPLETED_APPOINTMENT_STATUS)
      .gte("start_time", start)
      .lte("start_time", end),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("is_temporary", false)
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

  if (appointmentsResponse.error) throw appointmentsResponse.error;
  if (itemsResponse.error) throw itemsResponse.error;
  if (newCustomersResponse.error) throw newCustomersResponse.error;

  const appointments = (appointmentsResponse.data ?? []).map(normalizeAppointment);
  const items = ((itemsResponse.data ?? []) as unknown as AppointmentItemRow[]).map(normalizeItem);

  return {
    appointments,
    items,
    newCustomers: newCustomersResponse.count ?? 0,
  };
}

interface MonthlyHistoryPayload {
  appointmentMonths: AppointmentMonthBucket[] | null;
  busyHours: BusyHourBucket[] | null;
  retailMonths: MonthAmountBucket[] | null;
  expenseGroups: ExpenseGroupBucket[] | null;
  purchaseMonths: MonthAmountBucket[] | null;
  productMonths: ProductMonthBucket[] | null;
}

// La agregacion por mes/hora corre en SQL (RPC report_monthly_history) en la
// zona horaria del salon: el costo deja de crecer con el numero de filas del
// periodo. La RPC es security invoker, asi que la RLS del usuario aplica igual
// que con las queries directas que reemplaza. Los productos de inventario se
// consultan aparte porque alimentan alertas de stock, no series temporales.
export async function findHistoricalReportRows({
  salonId,
  start,
  end,
  timezone,
}: HistoricalReportRowQuery): Promise<HistoricalReportRows> {
  const supabase = await createSupabaseServerClient();
  // Los tipos generados aun no incluyen las tablas de inventario; mismo cast
  // puntual que usaba la version anterior de esta query.
  const external = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: Error | null }>;
      };
    };
  };

  const [historyResponse, inventoryProductsResponse] = await Promise.all([
    supabase.rpc("report_monthly_history", {
      p_salon_id: salonId,
      p_start: start,
      p_end: end,
      p_timezone: timezone,
    }),
    external
      .from("inventory_products")
      .select(
        "id, name, is_retail_enabled, is_active, deleted_at, inventory_stock_locations(location, quantity, minimum_quantity)"
      )
      .eq("salon_id", salonId),
  ]);

  if (historyResponse.error) throw historyResponse.error;
  if (inventoryProductsResponse.error) throw inventoryProductsResponse.error;

  const history = (historyResponse.data ?? {}) as unknown as MonthlyHistoryPayload;
  const inventoryRows = (inventoryProductsResponse.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    is_retail_enabled: boolean;
    is_active: boolean;
    deleted_at: string | null;
    inventory_stock_locations: Array<{
      location: "retail" | "internal" | "storage";
      quantity: number | string;
      minimum_quantity: number | string;
    }> | null;
  }>;

  return {
    appointmentMonths: history.appointmentMonths ?? [],
    busyHours: history.busyHours ?? [],
    retailMonths: history.retailMonths ?? [],
    expenseGroups: history.expenseGroups ?? [],
    purchaseMonths: history.purchaseMonths ?? [],
    productMonths: history.productMonths ?? [],
    inventoryProducts: inventoryRows
      .filter((row) => row.is_active && !row.deleted_at)
      .map((row) => ({
        id: row.id,
        name: row.name,
        isRetailEnabled: row.is_retail_enabled,
        locations: (row.inventory_stock_locations ?? []).map((location) => ({
          location: location.location,
          quantity: Number(location.quantity ?? 0),
          minimumQuantity: Number(location.minimum_quantity ?? 0),
        })),
      })),
  };
}
