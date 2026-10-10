"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CalendarView } from "@/features/appointments/view-models";

export type CalView = CalendarView;

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const VIEWS: { value: CalView; label: string }[] = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "trabajador", label: "Por trabajador" },
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
  const views = showWorkerView ? VIEWS : VIEWS.filter((v) => v.value !== "trabajador");

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
        <Button
          variant="outline"
          size="icon"
          onClick={() => shift(-1)}
          disabled={loading}
          className="h-9 w-9 bg-transparent text-fg-muted hover:text-fg"
          aria-label={view === "semanal" ? "Semana anterior" : "Día anterior"}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <DatePicker
          value={date}
          onChange={(nextDate) => go(nextDate)}
          disabled={loading}
          compact
          ariaLabel="Fecha de la agenda"
          className="w-auto"
          triggerClassName="w-40"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => shift(1)}
          disabled={loading}
          className="h-9 w-9 bg-transparent text-fg-muted hover:text-fg"
          aria-label={view === "semanal" ? "Semana siguiente" : "Día siguiente"}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* View toggle */}
      <SegmentedControl
        options={views}
        value={view}
        onChange={(next) => go(date, next)}
        disabled={loading}
        ariaLabel="Vista de la agenda"
      />
    </div>
  );
}
