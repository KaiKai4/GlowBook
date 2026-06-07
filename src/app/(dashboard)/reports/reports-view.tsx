"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleDollarSign,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/dates";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { buildReportsHref } from "./report-url";
import {
  BusyHoursChart,
  MonthlyAreaChart,
  ProductSalesChart,
  TopExpensesChart,
} from "./report-charts";
import { DatePicker } from "@/components/ui/date-picker";

type ReportTab = "summary" | "finance" | "appointments" | "inventory" | "expenses";

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "finance", label: "Finanzas" },
  { id: "appointments", label: "Citas" },
  { id: "inventory", label: "Inventario" },
  { id: "expenses", label: "Gastos" },
];

function selectedMonth(from: string): string {
  return from.slice(0, 7);
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PA", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 15))
  );
}

export function ReportsView(report: OperationalReportViewModel) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const [month, setMonth] = useState(selectedMonth(report.from));
  const [pending, startTransition] = useTransition();

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    startTransition(() => {
      router.replace(buildReportsHref(monthRange(nextMonth)));
    });
  }

  const cancelled = report.statusBreakdown.find((status) => status.status === "cancelled")?.count ?? 0;

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
            <BarChart3 className="h-6 w-6 text-brand-600" />
            Reportes
          </h1>
          <p className="mt-1 text-sm capitalize text-stone-500">{monthLabel(month)}</p>
        </div>
        <DatePicker
          label="Mes de las métricas"
          value={month}
          onChange={changeMonth}
          disabled={pending}
          granularity="month"
          className="min-w-52"
          ariaLabel="Seleccionar mes de las métricas"
        />
      </header>

      <div className="rounded-xl border border-brand-100 bg-white">
        <nav className="flex overflow-x-auto border-b border-brand-100 px-4" aria-label="Secciones de reportes">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative min-h-12 shrink-0 px-4 text-sm font-medium transition-colors",
                activeTab === tab.id ? "text-brand-700" : "text-stone-600 hover:text-stone-900"
              )}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className={cn("transition-opacity duration-200", pending && "opacity-55")}>
        {activeTab === "summary" && (
          <SummaryTab report={report} />
        )}
        {activeTab === "finance" && (
          <FinanceTab report={report} />
        )}
        {activeTab === "appointments" && (
          <AppointmentsTab report={report} cancelled={cancelled} />
        )}
        {activeTab === "inventory" && (
          <InventoryTab report={report} />
        )}
        {activeTab === "expenses" && (
          <ExpensesTab report={report} />
        )}
      </div>
    </div>
  );
}

function SummaryTab({ report }: { report: OperationalReportViewModel }) {
  const cards = [
    {
      label: "Ingresos totales",
      value: formatCurrency(report.grossRevenue),
      detail: report.modules.retail ? "Citas y vitrina" : "Citas completadas",
      icon: CircleDollarSign,
      tone: "positive" as const,
      visible: true,
    },
    {
      label: "Egresos totales",
      value: formatCurrency(report.totalExpenses),
      detail: expenseSources(report),
      icon: TrendingDown,
      tone: "negative" as const,
      visible: report.modules.expenses || report.modules.inventory,
    },
    {
      label: "Ganancias totales",
      value: formatCurrency(report.estimatedProfit),
      detail: "Ingresos menos egresos",
      icon: report.estimatedProfit >= 0 ? TrendingUp : TrendingDown,
      tone: report.estimatedProfit >= 0 ? "positive" as const : "negative" as const,
      visible: true,
    },
    {
      label: "Citas completadas",
      value: report.completedCount.toString(),
      detail: "Durante el mes",
      icon: CalendarCheck,
      tone: "brand" as const,
      visible: true,
    },
    {
      label: "Clientes nuevos",
      value: report.newCustomers.toString(),
      detail: "Registrados durante el mes",
      icon: UserPlus,
      tone: "blue" as const,
      visible: true,
    },
  ];

  return (
    <div className="space-y-5">
      <MetricGrid cards={cards} />
      <MonthlyAreaChart
        title="Ingresos vs. egresos"
        description="Comparación mensual de los últimos 12 meses"
        points={report.analytics.months}
        series={[
          {
            key: "totalRevenue",
            label: "Ingresos",
            color: "#16a34a",
            fill: "#86efac",
            value: (point) => point.totalRevenue,
          },
          {
            key: "totalExpenses",
            label: "Egresos",
            color: "#ef4444",
            fill: "#fca5a5",
            value: (point) => point.totalExpenses,
          },
        ]}
      />
    </div>
  );
}

function FinanceTab({ report }: { report: OperationalReportViewModel }) {
  return (
    <div className="space-y-5">
      <MetricGrid
        cards={[
          {
            label: "Ingresos por citas",
            value: formatCurrency(report.revenue),
            detail: "Citas completadas y pagadas",
            icon: CalendarCheck,
            tone: "positive",
            visible: true,
          },
          {
            label: "Ingresos por vitrina",
            value: formatCurrency(report.retailRevenue),
            detail: "Ventas de productos",
            icon: ShoppingBag,
            tone: "blue",
            visible: report.modules.retail,
          },
          {
            label: "Ingresos totales",
            value: formatCurrency(report.grossRevenue),
            detail: report.modules.retail ? "Citas y vitrina" : "Solo citas",
            icon: WalletCards,
            tone: "positive",
            visible: true,
          },
          {
            label: "Gastos operativos",
            value: formatCurrency(report.manualExpenses),
            detail: "Egresos registrados",
            icon: ReceiptText,
            tone: "negative",
            visible: report.modules.expenses,
          },
          {
            label: "Reposiciones de inventario",
            value: formatCurrency(report.inventoryPurchases),
            detail: "Compras de productos",
            icon: PackageSearch,
            tone: "amber",
            visible: report.modules.inventory,
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <MonthlyAreaChart
          title="Margen de ganancia"
          description="Ganancia sobre ingresos totales por mes"
          points={report.analytics.months}
          percent
          series={[
            {
              key: "marginPct",
              label: "Margen",
              color: "var(--color-brand-600)",
              fill: "var(--color-brand-300)",
              value: (point) => point.marginPct,
            },
          ]}
        />
        <MonthlyAreaChart
          title="Ingresos por origen"
          description="Citas completadas frente a ventas de vitrina"
          points={report.analytics.months}
          series={[
            {
              key: "appointmentRevenue",
              label: "Citas",
              color: "var(--color-brand-600)",
              fill: "var(--color-brand-300)",
              value: (point) => point.appointmentRevenue,
            },
            ...(report.modules.retail
              ? [{
                  key: "retailRevenue" as const,
                  label: "Vitrina",
                  color: "#0ea5e9",
                  fill: "#7dd3fc",
                  value: (point: OperationalReportViewModel["analytics"]["months"][number]) => point.retailRevenue,
                }]
              : []),
          ]}
        />
      </div>
      <MonthlyAreaChart
        title="Ganancias por mes"
        description="Resultado mensual después de gastos operativos y reposiciones activas"
        points={report.analytics.months}
        series={[
          {
            key: "profit",
            label: "Ganancia",
            color: "var(--color-brand-600)",
            fill: "var(--color-brand-300)",
            value: (point) => point.profit,
          },
        ]}
      />
    </div>
  );
}

function AppointmentsTab({
  report,
  cancelled,
}: {
  report: OperationalReportViewModel;
  cancelled: number;
}) {
  return (
    <div className="space-y-5">
      <MetricGrid
        cards={[
          {
            label: "Citas agendadas",
            value: report.totalCount.toString(),
            detail: "Registradas durante el mes",
            icon: CalendarClock,
            tone: "blue",
            visible: true,
          },
          {
            label: "Citas completadas",
            value: report.completedCount.toString(),
            detail: "Finalizadas durante el mes",
            icon: CalendarCheck,
            tone: "positive",
            visible: true,
          },
          {
            label: "Citas canceladas",
            value: cancelled.toString(),
            detail: "Canceladas durante el mes",
            icon: CalendarX,
            tone: "negative",
            visible: true,
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <MonthlyAreaChart
          title="Citas completadas por mes"
          description="Evolución de los últimos 12 meses"
          points={report.analytics.months}
          series={[
            {
              key: "completedAppointments",
              label: "Citas completadas",
              color: "var(--color-brand-600)",
              fill: "var(--color-brand-300)",
              value: (point) => point.completedAppointments,
              format: (value) => `${value} ${value === 1 ? "cita" : "citas"}`,
            },
          ]}
        />
        <BusyHoursChart points={report.analytics.busyHours} />
      </div>
    </div>
  );
}

function InventoryTab({ report }: { report: OperationalReportViewModel }) {
  if (!report.modules.inventory) {
    return <UnavailableModule module="Inventario" />;
  }

  return (
    <div className="space-y-5">
      <InventoryAlertsTable alerts={report.analytics.inventoryAlerts} />
      {report.modules.retail ? (
        <ProductSalesChart products={report.analytics.productSales} months={report.analytics.months} />
      ) : (
        <UnavailableModule module="Vitrina" compact />
      )}
    </div>
  );
}

function ExpensesTab({ report }: { report: OperationalReportViewModel }) {
  if (!report.modules.expenses && !report.modules.inventory) {
    return <UnavailableModule module="Gastos e inventario" />;
  }

  return (
    <div className="space-y-5">
      <MetricGrid
        cards={[
          {
            label: "Gastos totales",
            value: formatCurrency(report.totalExpenses),
            detail: expenseSources(report),
            icon: TrendingDown,
            tone: "negative",
            visible: true,
          },
          {
            label: "Gastos de restock",
            value: formatCurrency(report.inventoryPurchases),
            detail: "Reposiciones de productos",
            icon: PackageSearch,
            tone: "amber",
            visible: report.modules.inventory,
          },
          {
            label: "Gastos operativos",
            value: formatCurrency(report.manualExpenses),
            detail: "Egresos registrados",
            icon: ReceiptText,
            tone: "negative",
            visible: report.modules.expenses,
          },
        ]}
      />
      <TopExpensesChart expenses={report.analytics.topExpenses} />
    </div>
  );
}

type MetricTone = "positive" | "negative" | "brand" | "blue" | "amber";

interface MetricCardData {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: MetricTone;
  visible: boolean;
}

const TONES: Record<MetricTone, { icon: string; surface: string }> = {
  positive: { icon: "text-emerald-700", surface: "bg-emerald-50" },
  negative: { icon: "text-red-700", surface: "bg-red-50" },
  brand: { icon: "text-brand-700", surface: "bg-brand-50" },
  blue: { icon: "text-sky-700", surface: "bg-sky-50" },
  amber: { icon: "text-amber-700", surface: "bg-amber-50" },
};

function MetricGrid({ cards }: { cards: MetricCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.filter((card) => card.visible).map((card) => {
        const Icon = card.icon;
        const tone = TONES[card.tone];
        return (
          <article key={card.label} className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-600">{card.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-stone-950">{card.value}</p>
                <p className="mt-1 text-xs text-stone-500">{card.detail}</p>
              </div>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone.surface)}>
                <Icon className={cn("h-5 w-5", tone.icon)} />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function InventoryAlertsTable({
  alerts,
}: {
  alerts: OperationalReportViewModel["analytics"]["inventoryAlerts"];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="text-base font-semibold text-stone-900">Alertas de inventario</h2>
        <p className="mt-1 text-sm text-stone-500">Productos agotados o por debajo del mínimo configurado</p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-stone-500">No hay alertas de stock.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
              <tr>
                <th className="px-5 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Vitrina</th>
                <th className="px-4 py-3 text-right">Uso interno</th>
                <th className="px-4 py-3 text-right">Bodega</th>
                <th className="px-4 py-3 text-right">Stock actual</th>
                <th className="px-4 py-3 text-right">Stock mínimo</th>
                <th className="px-5 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-5 py-4 font-medium text-stone-900">{alert.name}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-stone-600">{alert.retail}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-stone-600">{alert.internal}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-stone-600">{alert.storage}</td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-stone-900">{alert.total}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-stone-600">{alert.minimum}</td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        alert.state === "agotado" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      )}
                    >
                      {alert.state === "agotado" ? "Agotado" : "Stock bajo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UnavailableModule({ module, compact = false }: { module: string; compact?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-dashed border-stone-300 bg-white text-center", compact ? "p-8" : "p-16")}>
      <PackageSearch className="mx-auto h-7 w-7 text-stone-400" />
      <p className="mt-3 text-sm font-semibold text-stone-700">El módulo de {module} no está activo.</p>
      <p className="mt-1 text-sm text-stone-500">Los reportes omiten esos datos automáticamente.</p>
    </section>
  );
}

function expenseSources(report: OperationalReportViewModel): string {
  if (report.modules.expenses && report.modules.inventory) return "Gastos y reposiciones";
  if (report.modules.expenses) return "Gastos operativos";
  if (report.modules.inventory) return "Reposiciones";
  return "Sin módulos de egresos";
}
