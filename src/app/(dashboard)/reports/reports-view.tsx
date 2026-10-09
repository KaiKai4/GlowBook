"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { buildReportsHref } from "./report-url";
import { DatePicker } from "@/components/ui/date-picker";
import { ExportReportDialog } from "./export-report-dialog";
import { SummaryTab } from "./report-summary-tab";
import { FinanceTab } from "./report-finance-tab";
import { AppointmentsTab } from "./report-appointments-tab";
import { InventoryTab } from "./report-inventory-tab";
import { ExpensesTab } from "./report-expenses-tab";
import { monthLabel, monthRange, selectedMonth, yearQueryParam } from "./report-presentation";

type ReportTab = "summary" | "finance" | "appointments" | "inventory" | "expenses";

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "finance", label: "Finanzas" },
  { id: "appointments", label: "Citas" },
  { id: "inventory", label: "Inventario" },
  { id: "expenses", label: "Gastos" },
];

function currentYear(): number {
  return new Date().getFullYear();
}

export function ReportsView(report: OperationalReportViewModel) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const [month, setMonth] = useState(selectedMonth(report.from));
  const [pending, startTransition] = useTransition();

  const yearParam = yearQueryParam(report.selectedYear, currentYear());

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
          year: yearQueryParam(nextYear, currentYear()),
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
