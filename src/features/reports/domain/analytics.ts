// Tipos de view model de reportes e historial. Las cifras llegan ya agregadas desde
// las funciones SQL de supabase/migrations/20240101000066_read_models.sql; este dominio
// solo da formato (etiquetas) y recorta la serie mensual a la ventana exportable.

export interface ReportModuleAvailability {
  inventory: boolean;
  retail: boolean;
  expenses: boolean;
}

export interface ReportMonthPoint {
  monthKey: string;
  label: string;
  appointmentRevenue: number;
  retailRevenue: number;
  totalRevenue: number;
  operationalExpenses: number;
  inventoryPurchases: number;
  totalExpenses: number;
  profit: number;
  marginPct: number;
  completedAppointments: number;
}

export interface BusyHourPoint {
  hour: number;
  label: string;
  total: number;
}

export interface ProductMonthlySales {
  id: string;
  name: string;
  total: number;
  months: number[];
}

export interface TopExpense {
  label: string;
  amount: number;
}

interface InventoryAlert {
  id: string;
  name: string;
  retail: number;
  internal: number;
  storage: number;
  total: number;
  minimum: number;
  state: "agotado" | "bajo" | "disponible";
}

export interface HistoricalReportAnalytics {
  months: ReportMonthPoint[];
  busyHours: BusyHourPoint[];
  productSales: ProductMonthlySales[];
  topExpenses: TopExpense[];
  inventoryAlerts: InventoryAlert[];
}

/** Acumulado de un periodo: mismas definiciones que los totales del reporte. */
export interface LifetimeReportTotals {
  appointmentRevenue: number;
  retailRevenue: number;
  grossRevenue: number;
  operationalExpenses: number;
  inventoryPurchases: number;
  totalExpenses: number;
  estimatedProfit: number;
  completedAppointments: number;
}

export interface MonthlyExportRow {
  monthKey: string;
  completedAppointments: number;
  appointmentRevenue: number;
  retailRevenue: number;
  grossRevenue: number;
  operationalExpenses: number;
  inventoryPurchases: number;
  totalExpenses: number;
  profit: number;
}

const BUSY_HOUR_LABEL_YEAR = 2026;

/** Etiqueta de hora en formato 12 h, p. ej. "3 p. m.". */
export function busyHourLabel(hour: number): string {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "numeric",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(BUSY_HOUR_LABEL_YEAR, 0, 1, hour)));
}

/** Un mes tiene movimientos si hay citas completadas, ingresos o gastos distintos de cero. */
function hasMonthlyActivity(row: MonthlyExportRow): boolean {
  return row.completedAppointments !== 0 || row.grossRevenue !== 0 || row.totalExpenses !== 0;
}

/**
 * Recorta la serie continua (meses en cero incluidos) a la ventana exportable: desde el
 * primer mes con movimientos hasta el mayor entre el ultimo con movimientos y el mes
 * actual. Sin movimientos devuelve lista vacia.
 */
export function trimMonthlyRows<T extends MonthlyExportRow>(rows: T[], currentMonthKey: string): T[] {
  const firstActive = rows.findIndex(hasMonthlyActivity);
  if (firstActive === -1) return [];

  let lastActive = firstActive;
  rows.forEach((row, index) => {
    if (hasMonthlyActivity(row)) lastActive = index;
  });

  const currentIndex = rows.findIndex((row) => row.monthKey === currentMonthKey);
  return rows.slice(firstActive, Math.max(lastActive, currentIndex) + 1);
}
