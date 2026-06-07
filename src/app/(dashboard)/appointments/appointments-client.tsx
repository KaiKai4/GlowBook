"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { CalendarViewModel } from "@/features/appointments/view-models";
import { CalendarDays, Plus } from "lucide-react";
import { AppointmentsDayView } from "./appointments-day-view";
import { DateNav } from "./date-nav";
import { buildAppointmentsHref } from "./calendar-url";

export function AppointmentsClient({
  initialCalendar,
  canManage,
}: {
  initialCalendar: CalendarViewModel;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const calendar = initialCalendar;

  function changeCalendar(next: { date: string; view: CalendarViewModel["view"] }) {
    startTransition(() => {
      router.replace(buildAppointmentsHref(next));
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
            <CalendarDays className="h-6 w-6 text-brand-500" />
            Agenda
          </h1>
          <p className="mt-0.5 text-sm capitalize text-stone-500">
            {calendar.dateLabel} ·{" "}
            <span className="font-semibold text-brand-600">
              {calendar.activeCount} citas activas
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateNav
            date={calendar.date}
            view={calendar.view}
            showWorkerView={calendar.showWorkerView}
            loading={pending}
            onChange={changeCalendar}
          />
          {canManage && (
            <Link href="/appointments/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                Nueva cita
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className={pending ? "opacity-70 transition-opacity" : "transition-opacity"}>
        <AppointmentsDayView
          appointments={calendar.appointments}
          tz={calendar.timezone}
          canManage={canManage}
          view={calendar.view}
          weekDates={calendar.visibleWeekDates}
          employees={calendar.employees}
          businessStart={calendar.businessStart}
          businessEnd={calendar.businessEnd}
          salonName={calendar.salonName}
          cancellationTemplate={calendar.cancellationTemplate}
          paymentMethodOptions={calendar.paymentMethodOptions}
        />
      </div>
    </div>
  );
}
