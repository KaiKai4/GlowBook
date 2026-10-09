// Forma de las metricas operativas del periodo. Los valores llegan agregados desde SQL
// (report_period_totals, report_operational_breakdown, report_commissions); este modulo
// solo define los tipos que consume la UI, sin calcular nada.

interface ReportStatusBreakdown {
  status: string;
  count: number;
  pct: number;
}

interface ReportEntityBreakdown {
  name: string;
  count: number;
  revenue: number;
  pct: number;
}

interface EmployeeCommission {
  employeeId: string;
  name: string;
  /** Citas completadas distintas atendidas en el periodo. */
  appointments: number;
  /** Ingresos generados por ese empleado (servicios cobrados). */
  revenue: number;
  /** % de comision aplicado. */
  commissionPct: number;
  /** Comision a pagar = revenue * commissionPct / 100, redondeada a 2 decimales. */
  commission: number;
}

interface CommissionReport {
  rows: EmployeeCommission[];
  totalRevenue: number;
  totalCommission: number;
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
