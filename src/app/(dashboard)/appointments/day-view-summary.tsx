"use client";

import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { CalendarAppointment } from "@/features/appointments/view-models";
import {
  SUMMARY_FILTERS,
  type SummaryFilter,
} from "@/features/appointments/domain/summary-filter";
import { summaryAppointments } from "./day-view-data";
import { SummaryRow } from "./day-view-summary-row";

export function AppointmentsSummary({
  appointments, tz, canManage, onComplete, onCancel,
}: {
  appointments: CalendarAppointment[];
  tz: string;
  canManage: boolean;
  onComplete: (appt: CalendarAppointment) => void;
  onCancel: (appt: CalendarAppointment) => void;
}) {
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("upcoming");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const listAppts = useMemo(
    () => summaryAppointments(appointments, summaryFilter),
    [appointments, summaryFilter]
  );

  return (
    <div className="rounded-2xl border border-brand-100 bg-surface shadow-tile overflow-visible">
      <div className="rounded-t-2xl border-b border-brand-100 bg-surface px-5 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <nav className="flex items-end gap-8" aria-label="Filtros del resumen de citas">
            {SUMMARY_FILTERS.map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setSummaryFilter(f.value)}
                className={cn(
                  "relative shrink-0 px-0.5 pb-3 text-sm font-medium transition-colors",
                  summaryFilter === f.value
                    ? "text-brand-700 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600"
                    : "text-fg-subtle hover:text-fg-secondary"
                )}
              >
                {f.label}
              </button>
            ))}
          </nav>
          <h2 className="flex items-center gap-1.5 pb-3 text-sm font-semibold text-brand-700 uppercase tracking-wide">
            <ListFilter className="h-3.5 w-3.5" />
            Resumen de citas
          </h2>
        </div>
      </div>

      {listAppts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-fg-subtle">No hay citas para este filtro.</p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {listAppts.map((appt) => (
            <SummaryRow
              key={appt.id}
              appt={appt}
              tz={tz}
              canManage={canManage}
              actionsOpen={openActionsId === appt.id}
              onToggleActions={() => setOpenActionsId(openActionsId === appt.id ? null : appt.id)}
              onComplete={() => onComplete(appt)}
              onCancel={() => {
                setOpenActionsId(null);
                onCancel(appt);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
