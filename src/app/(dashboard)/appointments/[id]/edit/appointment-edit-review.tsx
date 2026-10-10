"use client";

import { formatWeekdayDayMonth } from "@/infra/format/es-formats";
import { Button } from "@/components/ui/button";
import { formatTimeTz } from "@/infra/format/dates";
import { formatCurrency } from "@/infra/format/money";
import { CalendarDays, Clock3, StickyNote, UserRound } from "lucide-react";
import type { AppointmentScheduleItem } from "@/features/appointments/domain/wizard-availability";

interface AppointmentEditReviewProps {
  date: string;
  notes: string;
  time: string;
  timeZone: string;
  schedule: AppointmentScheduleItem[];
  total: number;
  employeeName: (employeeId: string) => string | undefined;
  submitError: string | null;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export function AppointmentEditReview({
  date,
  notes,
  time,
  timeZone,
  schedule,
  total,
  employeeName,
  submitError,
  submitting,
  onBack,
  onConfirm,
}: AppointmentEditReviewProps) {
  const reviewDate = formatWeekdayDayMonth(new Date(`${date}T12:00:00`), {
    weekday: "long",
    month: "long",
    year: true,
  });
  const lastEnd = schedule.at(-1)?.end ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-100 bg-surface shadow-sm">
        <div className="border-b border-brand-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase text-brand-600">
            Revisión final
          </p>
          <h2 className="mt-1 text-xl font-semibold text-fg">
            Revisa los cambios de la cita
          </h2>
          <p className="mt-1 text-sm text-fg-subtle">
            La cita todavía no se ha actualizado.
          </p>
        </div>

        <div className="grid gap-px bg-surface-sunken sm:grid-cols-2">
          <div className="flex gap-3 bg-surface px-6 py-4">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div>
              <p className="text-xs font-medium text-fg-subtle">Fecha</p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-fg">
                {reviewDate}
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-surface px-6 py-4">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div>
              <p className="text-xs font-medium text-fg-subtle">Horario</p>
              <p className="mt-0.5 text-sm font-semibold text-fg">
                {schedule[0]?.start
                  ? formatTimeTz(schedule[0].start, timeZone)
                  : time}
                {lastEnd ? ` - ${formatTimeTz(lastEnd, timeZone)}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border-subtle px-6 py-5">
          <h3 className="text-sm font-semibold text-fg">Servicios</h3>
          <div className="mt-3 divide-y divide-border-subtle">
            {schedule.map((item, index) => (
              <div
                key={item.row.key}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-fg">
                    {item.service?.name ?? `Servicio ${index + 1}`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {employeeName(item.row.employeeId) ?? "Profesional sin seleccionar"}
                    </span>
                    {item.start && item.end && (
                      <span>
                        {formatTimeTz(item.start, timeZone)} -{" "}
                        {formatTimeTz(item.end, timeZone)}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-fg">
                  {formatCurrency(item.service?.price ?? 0)}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-semibold text-fg-secondary">Total</span>
            <span className="text-lg font-semibold text-fg">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {notes.trim() && (
          <div className="border-t border-border-subtle px-6 py-5">
            <div className="flex gap-3">
              <StickyNote className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div>
                <h3 className="text-sm font-semibold text-fg">Notas</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-fg-muted">
                  {notes}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {submitError && (
        <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={submitting}
          onClick={onBack}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={submitting}
          onClick={onConfirm}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
