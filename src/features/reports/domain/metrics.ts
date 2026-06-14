import { calculateCommissionReport, type CommissionReport } from "./commissions";

export const COMPLETED_APPOINTMENT_STATUS = "completed";

export const REPORT_STATUS_ORDER = [
  "completed",
  "confirmed",
  "scheduled",
  "cancelled",
  "no_show",
] as const;

export interface ReportAppointment {
  id: string;
  status: string;
  totalPrice: number;
  discountAmount: number;
}

export interface ReportAppointmentItem {
  appointmentId: string;
  price: number;
  serviceId: string | null;
  serviceName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  /** % de comisión del empleado al momento del reporte. */
  employeeCommissionPct: number;
}

export interface ReportStatusBreakdown {
  status: string;
  count: number;
  pct: number;
}

export interface ReportEntityBreakdown {
  name: string;
  count: number;
  revenue: number;
  pct: number;
}

export interface OperationalReportMetrics {
  revenue: number;
  retailRevenue: number;
  grossRevenue: number;
  discounts: number;
  manualExpenses: number;
  inventoryPurchases: number;
  totalExpenses: number;
  estimatedProfit: number;
  completedCount: number;
  totalCount: number;
  avgTicket: number;
  noShowRate: number;
  statusBreakdown: ReportStatusBreakdown[];
  byEmployee: ReportEntityBreakdown[];
  byService: ReportEntityBreakdown[];
  commissions: CommissionReport;
}

function toPercent(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function sortByRevenueThenName(
  a: Pick<ReportEntityBreakdown, "name" | "revenue">,
  b: Pick<ReportEntityBreakdown, "name" | "revenue">
): number {
  return b.revenue - a.revenue || a.name.localeCompare(b.name);
}

export function calculateOperationalReportMetrics(
  appointments: ReportAppointment[],
  items: ReportAppointmentItem[]
): OperationalReportMetrics {
  const completed = appointments.filter(
    (appointment) => appointment.status === COMPLETED_APPOINTMENT_STATUS
  );
  const revenue = completed.reduce(
    (sum, appointment) => sum + Number(appointment.totalPrice ?? 0),
    0
  );
  const discounts = completed.reduce(
    (sum, appointment) => sum + Number(appointment.discountAmount ?? 0),
    0
  );
  const totalCount = appointments.length;
  const noShowCount = appointments.filter((appointment) => appointment.status === "no_show").length;

  return {
    revenue,
    retailRevenue: 0,
    grossRevenue: revenue,
    discounts,
    manualExpenses: 0,
    inventoryPurchases: 0,
    totalExpenses: 0,
    estimatedProfit: revenue,
    completedCount: completed.length,
    totalCount,
    avgTicket: completed.length > 0 ? revenue / completed.length : 0,
    noShowRate: toPercent(noShowCount, totalCount),
    statusBreakdown: calculateStatusBreakdown(appointments),
    byEmployee: calculateEmployeeBreakdown(items),
    byService: calculateServiceBreakdown(items),
    commissions: calculateCommissionReport(items),
  };
}

export function calculateStatusBreakdown(
  appointments: ReportAppointment[]
): ReportStatusBreakdown[] {
  const statusCounts: Record<string, number> = {};
  for (const appointment of appointments) {
    statusCounts[appointment.status] = (statusCounts[appointment.status] ?? 0) + 1;
  }

  const knownStatuses = new Set<string>(REPORT_STATUS_ORDER);
  const unknownStatuses = Object.keys(statusCounts)
    .filter((status) => !knownStatuses.has(status))
    .sort();
  const orderedStatuses = [...REPORT_STATUS_ORDER, ...unknownStatuses];

  return orderedStatuses
    .filter((status) => statusCounts[status])
    .map((status) => ({
      status,
      count: statusCounts[status],
      pct: toPercent(statusCounts[status], appointments.length),
    }));
}

export function calculateEmployeeBreakdown(
  items: ReportAppointmentItem[]
): ReportEntityBreakdown[] {
  const employeeMap: Record<string, { name: string; appointmentIds: Set<string>; revenue: number }> =
    {};

  for (const item of items) {
    if (!item.employeeId || !item.employeeName) continue;

    employeeMap[item.employeeId] ??= {
      name: item.employeeName,
      appointmentIds: new Set<string>(),
      revenue: 0,
    };
    employeeMap[item.employeeId].appointmentIds.add(item.appointmentId);
    employeeMap[item.employeeId].revenue += Number(item.price ?? 0);
  }

  const employees = Object.values(employeeMap)
    .map((employee) => ({
      name: employee.name,
      count: employee.appointmentIds.size,
      revenue: employee.revenue,
    }))
    .sort(sortByRevenueThenName);
  const maxRevenue = employees[0]?.revenue ?? 0;

  return employees.map((employee) => ({
    ...employee,
    pct: toPercent(employee.revenue, maxRevenue),
  }));
}

export function calculateServiceBreakdown(
  items: ReportAppointmentItem[]
): ReportEntityBreakdown[] {
  const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};

  for (const item of items) {
    if (!item.serviceId || !item.serviceName) continue;

    serviceMap[item.serviceId] ??= { name: item.serviceName, count: 0, revenue: 0 };
    serviceMap[item.serviceId].count += 1;
    serviceMap[item.serviceId].revenue += Number(item.price ?? 0);
  }

  const services = Object.values(serviceMap).sort(
    (a, b) => b.count - a.count || b.revenue - a.revenue || a.name.localeCompare(b.name)
  );
  const maxCount = services[0]?.count ?? 0;

  return services.map((service) => ({
    ...service,
    pct: toPercent(service.count, maxCount),
  }));
}
