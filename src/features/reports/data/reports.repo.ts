import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  COMPLETED_APPOINTMENT_STATUS,
  type ReportAppointment,
  type ReportAppointmentItem,
} from "../domain/metrics";
import type {
  AnalyticsAppointment,
  AnalyticsExpenseRow,
  AnalyticsMoneyRow,
  AnalyticsRetailItem,
  InventoryAlertProduct,
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
  employee: RelatedOne<{ id: string; first_name: string; last_name: string }>;
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
  appointments: AnalyticsAppointment[];
  retailSales: AnalyticsMoneyRow[];
  expenses: AnalyticsExpenseRow[];
  inventoryPurchases: AnalyticsMoneyRow[];
  retailItems: AnalyticsRetailItem[];
  inventoryProducts: InventoryAlertProduct[];
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
        "appointment_id, price, discount_amount, service:services(id, name), employee:employees(id, first_name, last_name), appointment:appointments!inner(status)"
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

export async function findHistoricalReportRows({
  salonId,
  start,
  end,
}: OperationalReportRowQuery): Promise<HistoricalReportRows> {
  const supabase = await createSupabaseServerClient();
  const external = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          gte: (column: string, value: string) => {
            lte: (column: string, value: string) => Promise<{ data: unknown; error: Error | null }>;
          };
        };
      };
    };
  };

  const [
    appointmentsResponse,
    retailSalesResponse,
    expensesResponse,
    inventoryPurchasesResponse,
    retailItemsResponse,
    inventoryProductsResponse,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("status, total_price, start_time")
      .eq("salon_id", salonId)
      .gte("start_time", start)
      .lte("start_time", end),
    external
      .from("retail_sales")
      .select("sale_date, total_amount")
      .eq("salon_id", salonId)
      .gte("sale_date", start)
      .lte("sale_date", end),
    external
      .from("expenses")
      .select("expense_date, amount, concept, custom_category, category")
      .eq("salon_id", salonId)
      .gte("expense_date", start.slice(0, 10))
      .lte("expense_date", end.slice(0, 10)),
    external
      .from("inventory_purchases")
      .select("purchase_date, total_cost")
      .eq("salon_id", salonId)
      .gte("purchase_date", start.slice(0, 10))
      .lte("purchase_date", end.slice(0, 10)),
    external
      .from("retail_sale_items")
      .select("quantity, product:inventory_products(id, name), sale:retail_sales(sale_date)")
      .eq("salon_id", salonId)
      .gte("created_at", start)
      .lte("created_at", end),
    (external.from("inventory_products").select(
      "id, name, is_retail_enabled, is_active, deleted_at, inventory_stock_locations(location, quantity, minimum_quantity)"
    ).eq("salon_id", salonId) as unknown as Promise<{ data: unknown; error: Error | null }>),
  ]);

  const responses = [
    appointmentsResponse,
    retailSalesResponse,
    expensesResponse,
    inventoryPurchasesResponse,
    retailItemsResponse,
    inventoryProductsResponse,
  ];
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;

  type RelatedOne<T> = T | T[] | null;
  const one = <T,>(value: RelatedOne<T>): T | null =>
    Array.isArray(value) ? value[0] ?? null : value;

  return {
    appointments: (appointmentsResponse.data ?? []).map((row) => ({
      status: row.status,
      totalPrice: Number(row.total_price ?? 0),
      startTime: row.start_time,
    })),
    retailSales: ((retailSalesResponse.data ?? []) as Array<{
      sale_date: string;
      total_amount: number | string;
    }>).map((row) => ({ date: row.sale_date, amount: Number(row.total_amount ?? 0) })),
    expenses: ((expensesResponse.data ?? []) as Array<{
      expense_date: string;
      amount: number | string;
      concept: string | null;
      custom_category: string | null;
      category: string;
    }>).map((row) => ({
      date: row.expense_date,
      amount: Number(row.amount ?? 0),
      label: row.concept || row.custom_category || row.category || "Otros gastos",
    })),
    inventoryPurchases: ((inventoryPurchasesResponse.data ?? []) as Array<{
      purchase_date: string;
      total_cost: number | string;
    }>).map((row) => ({ date: row.purchase_date, amount: Number(row.total_cost ?? 0) })),
    retailItems: ((retailItemsResponse.data ?? []) as Array<{
      quantity: number | string;
      product: RelatedOne<{ id: string; name: string }>;
      sale: RelatedOne<{ sale_date: string }>;
    }>).flatMap((row) => {
      const product = one(row.product);
      const sale = one(row.sale);
      return product && sale
        ? [{
            date: sale.sale_date,
            productId: product.id,
            productName: product.name,
            quantity: Number(row.quantity ?? 0),
          }]
        : [];
    }),
    inventoryProducts: ((inventoryProductsResponse.data ?? []) as Array<{
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
    }>).filter((row) => row.is_active && !row.deleted_at).map((row) => ({
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
