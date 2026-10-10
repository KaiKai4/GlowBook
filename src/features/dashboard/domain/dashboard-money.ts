// Totales de dinero que muestra el dashboard, segun los módulos activos del salón.
// Los agregados llegan ya calculados desde report_dashboard_metrics; aquí solo se
// elige la combinacion visible (sin recalcular sumas).

export interface DashboardMoneyFigures {
  appointmentRevenue: number;
  retailRevenue: number;
  monthRevenue: number;
  monthExpenses: number;
  estimatedProfit: number;
}

export interface DashboardMoneyScope {
  includeRetail: boolean;
  includeExpenses: boolean;
}

export interface DashboardMoneyView {
  revenue: number;
  profit: number;
}

export function selectDashboardMoney(
  figures: DashboardMoneyFigures,
  { includeRetail, includeExpenses }: DashboardMoneyScope
): DashboardMoneyView {
  const revenue = includeRetail ? figures.monthRevenue : figures.appointmentRevenue;

  if (includeRetail && includeExpenses) return { revenue, profit: figures.estimatedProfit };
  if (includeRetail) return { revenue, profit: figures.monthRevenue };
  if (includeExpenses) return { revenue, profit: figures.appointmentRevenue - figures.monthExpenses };
  return { revenue, profit: figures.appointmentRevenue };
}
