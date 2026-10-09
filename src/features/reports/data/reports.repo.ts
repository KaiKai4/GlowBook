import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AppointmentMonthBucket,
  BusyHourBucket,
  ExpenseGroupBucket,
  InventoryAlertProduct,
  MonthAmountBucket,
  ProductMonthBucket,
} from "../domain/analytics";

export interface HistoricalReportRows {
  appointmentMonths: AppointmentMonthBucket[];
  busyHours: BusyHourBucket[];
  retailMonths: MonthAmountBucket[];
  expenseGroups: ExpenseGroupBucket[];
  purchaseMonths: MonthAmountBucket[];
  productMonths: ProductMonthBucket[];
  inventoryProducts: InventoryAlertProduct[];
}

export interface HistoricalReportRowQuery {
  salonId: string;
  start: string;
  end: string;
  timezone: string;
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
