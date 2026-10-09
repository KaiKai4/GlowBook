"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { DatePicker } from "@/components/ui/date-picker";
import type { CalendarView } from "@/features/appointments/view-models";

export type CalView = CalendarView;

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const VIEWS: { id: CalView; label: string }[] = [
  { id: "diaria", label: "Diaria" },
  { id: "semanal", label: "Semanal" },
  { id: "trabajador", label: "Por trabajador" },
];

export function DateNav({
  date,
  view,
  showWorkerView = true,
  loading = false,
  onChange,
}: {
  date: string;
  view: CalView;
  showWorkerView?: boolean;
  loading?: boolean;
  onChange: (next: { date: string; view: CalView }) => void;
}) {
  const views = showWorkerView ? VIEWS : VIEWS.filter((v) => v.id !== "trabajador");

  function go(newDate: string, newView?: CalView) {
    onChange({ date: newDate, view: newView ?? view });
  }

  function shift(n: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + (view === "semanal" ? n * 7 : n));
    go(toISODate(d));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {/* Date navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => shift(-1)}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors"
          aria-label={view === "semanal" ? "Semana anterior" : "Día anterior"}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <DatePicker
          value={date}
          onChange={(nextDate) => go(nextDate)}
          disabled={loading}
          compact
          ariaLabel="Fecha de la agenda"
          className="w-auto"
          triggerClassName="w-40"
        />
        <button
          onClick={() => shift(1)}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors"
          aria-label={view === "semanal" ? "Semana siguiente" : "Día siguiente"}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center rounded-lg border border-border bg-surface-muted p-0.5">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => go(date, v.id)}
            disabled={loading}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
              view === v.id
                ? "bg-surface text-brand-700 shadow-sm border border-brand-100"
                : "text-fg-subtle hover:text-fg-secondary"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
