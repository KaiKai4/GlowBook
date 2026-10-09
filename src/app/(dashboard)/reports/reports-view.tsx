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
import { cn } from "@/components/ui/cn";
import { formatCurrency } from "@/infra/format/dates";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { buildReportsHref } from "./report-url";
import {
  BusyHoursChart,
  MonthlyAreaChart,
  ProductSalesChart,
  TopExpensesChart,
} from "./report-charts";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { ExportReportDialog } from "./export-report-dialog";

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
  const [year = NaN, monthNumber = NaN] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function monthLabel(month: string): string {
  const [year = NaN, monthNumber = NaN] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PA", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 15))
  );
}

function currentYear(): number {
  return new Date().getFullYear();
}

export function ReportsView(report: OperationalReportViewModel) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const [month, setMonth] = useState(selectedMonth(report.from));
  const [pending, startTransition] = useTransition();

  // El año del acumulado solo viaja en la URL si no es el año en curso, para
  // mantener limpia la URL del caso comun.
  const yearParam = report.selectedYear === currentYear() ? undefined : report.selectedYear;

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    startTransition(() => {
      router.replace(buildReportsHref({ ...monthRange(nextMonth), year: yearParam }));
    });
  }

  function changeYear(nextYear: number) {
    startTransition(() => {
      router.replace(
        buildReportsHref({
          ...monthRange(month),
          year: nextYear === currentYear() ? undefined : nextYear,
        })
      );
    });
  }

  const cancelled = report.statusBreakdown.find((status) => status.status === "cancelled")?.count ?? 0;

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-fg">
            <BarChart3 className="h-6 w-6 text-brand-600" />
            Reportes
          </h1>
          <p className="mt-1 text-sm capitalize text-fg-subtle">{monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <DatePicker
            label="Mes de las métricas"
            value={month}
            onChange={changeMonth}
            disabled={pending}
            granularity="month"
            className="min-w-52"
            ariaLabel="Seleccionar mes de las métricas"
          />
          <ExportReportDialog
            monthKey={month}
            monthLabel={monthLabel(month)}
            year={report.selectedYear}
          />
        </div>
      </header>

      <div className="rounded-xl border border-brand-100 bg-surface">
        <nav className="flex overflow-x-auto border-b border-brand-100 px-4" aria-label="Secciones de reportes">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative min-h-12 shrink-0 px-4 text-sm font-medium transition-colors",
                activeTab === tab.id ? "text-brand-700" : "text-fg-muted hover:text-fg"
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
          <SummaryTab report={report} onChangeYear={changeYear} yearPending={pending} />
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

function SummaryTab({
  report,
  onChangeYear,
  yearPending,
}: {
  report: OperationalReportViewModel;
  onChangeYear: (year: number) => void;
  yearPending: boolean;
}) {
  const cards = [
    {
      label: "Ingresos del mes",
      value: formatCurrency(report.grossRevenue),
      detail: report.modules.retail ? "Citas y vitrina del mes elegido" : "Citas completadas del mes elegido",
      icon: CircleDollarSign,
      tone: "positive" as const,
      visible: true,
    },
    {
      label: "Egresos del mes",
      value: formatCurrency(report.totalExpenses),
      detail: expenseSources(report),
      icon: TrendingDown,
      tone: "negative" as const,
      visible: report.modules.expenses || report.modules.inventory,
    },
    {
      label: "Ganancia del mes",
      value: formatCurrency(report.estimatedProfit),
      detail: "Ingresos menos egresos del mes",
      icon: report.estimatedProfit >= 0 ? TrendingUp : TrendingDown,
      tone: report.estimatedProfit >= 0 ? "positive" as const : "negative" as const,
      visible: true,
    },
    {
      label: "Citas completadas",
      value: report.completedCount.toString(),
      detail: "Durante el mes elegido",
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
      <YearlyTotalsStrip report={report} onChangeYear={onChangeYear} pending={yearPending} />
      <MonthlyAreaChart
        title="Ingresos vs. egresos"
        description="Comparación mensual de los últimos 12 meses"
        points={report.analytics.months}
        series={[
          {
            key: "totalRevenue",
            label: "Ingresos",
            color: "var(--color-chart-success)",
            fill: "var(--color-chart-success-soft)",
            value: (point) => point.totalRevenue,
          },
          {
            key: "totalExpenses",
            label: "Egresos",
            color: "var(--color-chart-danger)",
            fill: "var(--color-chart-danger-soft)",
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
                  color: "var(--color-chart-info)",
                  fill: "var(--color-chart-info-soft)",
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
      <CommissionsTable report={report} />
    </div>
  );
}

// Liquidación de comisiones del periodo: ingresos por empleado × su %.
function CommissionsTable({ report }: { report: OperationalReportViewModel }) {
  const { rows, totalCommission } = report.commissions;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-100 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-fg-secondary">Comisiones del mes</h3>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-fg-subtle">Total a pagar</p>
          <p className="text-lg font-semibold text-brand-700">{formatCurrency(totalCommission)}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-fg-subtle">
          Sin citas completadas con empleado en este mes.
        </p>
      ) : (
        <div>
          <div className="hidden grid-cols-[1.4fr_0.7fr_1fr_0.6fr_1fr] gap-3 bg-surface-muted px-5 py-2.5 text-xs font-semibold uppercase text-fg-subtle md:grid">
            <span>Empleado</span>
            <span className="text-right">Citas</span>
            <span className="text-right">Ingresos</span>
            <span className="text-right">%</span>
            <span className="text-right">Comisión</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.employeeId}
              className="grid grid-cols-2 gap-2 border-t border-border-subtle px-5 py-3 text-sm md:grid-cols-[1.4fr_0.7fr_1fr_0.6fr_1fr]"
            >
              <span className="font-semibold text-fg-secondary">{row.name}</span>
              <span className="text-right text-fg-subtle md:tabular-nums">{row.appointments}</span>
              <span className="text-right text-fg-muted tabular-nums">{formatCurrency(row.revenue)}</span>
              <span className="text-right text-fg-subtle tabular-nums">{row.commissionPct}%</span>
              <span className="text-right font-semibold text-brand-700 tabular-nums">
                {formatCurrency(row.commission)}
              </span>
            </div>
          ))}
        </div>
      )}
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
  positive: { icon: "text-success-fg", surface: "bg-success-subtle" },
  negative: { icon: "text-danger-strong", surface: "bg-danger-subtle" },
  brand: { icon: "text-brand-700", surface: "bg-brand-50" },
  blue: { icon: "text-info-fg", surface: "bg-info-subtle" },
  amber: { icon: "text-warning-fg", surface: "bg-warning-subtle" },
};

// Acumulado del año seleccionado: se reinicia cada 1 de enero (el año nuevo
// arranca sin movimientos). El selector permite consultar años anteriores; el
// histórico completo sigue disponible en la exportación.
function YearlyTotalsStrip({
  report,
  onChangeYear,
  pending,
}: {
  report: OperationalReportViewModel;
  onChangeYear: (year: number) => void;
  pending: boolean;
}) {
  const { yearly, selectedYear, availableYears } = report;
  const items = [
    {
      label: `Ingresos ${selectedYear}`,
      value: formatCurrency(yearly.grossRevenue),
      visible: true,
    },
    {
      label: `Egresos ${selectedYear}`,
      value: formatCurrency(yearly.totalExpenses),
      visible: report.modules.expenses || report.modules.inventory,
    },
    {
      label: `Ganancia ${selectedYear}`,
      value: formatCurrency(yearly.estimatedProfit),
      visible: true,
    },
    {
      label: `Citas completadas ${selectedYear}`,
      value: yearly.completedAppointments.toString(),
      visible: true,
    },
  ];

  return (
    <section
      aria-label={`Acumulado del año ${selectedYear}`}
      className="rounded-xl border border-border bg-surface-muted/70 px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Acumulado del año · reinicia cada 1 de enero
        </p>
        <Select
          value={String(selectedYear)}
          onChange={(event) => onChangeYear(Number(event.target.value))}
          disabled={pending}
          className="h-9 w-32"
          title="Año del acumulado"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              Año {year}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.filter((item) => item.visible).map((item) => (
          <div key={item.label}>
            <p className="text-xs font-medium text-fg-subtle">{item.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg-secondary">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricGrid({ cards }: { cards: MetricCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.filter((card) => card.visible).map((card) => {
        const Icon = card.icon;
        const tone = TONES[card.tone];
        return (
          <article key={card.label} className="rounded-xl border border-brand-100 bg-surface p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg-muted">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-fg-strong">{card.value}</p>
                <p className="mt-1 text-xs text-fg-subtle">{card.detail}</p>
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
    <section className="overflow-hidden rounded-xl border border-brand-100 bg-surface shadow-sm">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-base font-semibold text-fg">Alertas de inventario</h2>
        <p className="mt-1 text-sm text-fg-subtle">Productos agotados o por debajo del mínimo configurado</p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-fg-subtle">No hay alertas de stock.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold text-fg-subtle">
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
            <tbody className="divide-y divide-border-subtle">
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-5 py-4 font-medium text-fg">{alert.name}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.retail}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.internal}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.storage}</td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-fg">{alert.total}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.minimum}</td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        alert.state === "agotado" ? "bg-danger-subtle text-danger-strong" : "bg-warning-subtle text-warning-fg"
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
    <section className={cn("rounded-xl border border-dashed border-border-strong bg-surface text-center", compact ? "p-8" : "p-16")}>
      <PackageSearch className="mx-auto h-7 w-7 text-fg-subtle" />
      <p className="mt-3 text-sm font-semibold text-fg-secondary">El módulo de {module} no está activo.</p>
      <p className="mt-1 text-sm text-fg-subtle">Los reportes omiten esos datos automáticamente.</p>
    </section>
  );
}

function expenseSources(report: OperationalReportViewModel): string {
  if (report.modules.expenses && report.modules.inventory) return "Gastos y reposiciones";
  if (report.modules.expenses) return "Gastos operativos";
  if (report.modules.inventory) return "Reposiciones";
  return "Sin módulos de egresos";
}
