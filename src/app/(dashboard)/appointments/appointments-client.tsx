"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-brand-500" aria-hidden="true" />
            Agenda
          </span>
        }
        description={
          <>
            <span className="capitalize">{calendar.dateLabel}</span> ·{" "}
            <span className="font-semibold text-brand-600">
              {calendar.activeCount} citas activas
            </span>
          </>
        }
        actions={
          <>
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
          </>
        }
      />

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
