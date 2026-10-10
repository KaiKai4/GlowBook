"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { CalendarViewModel } from "@/features/appointments/view-models";
import { CalendarDays, Plus } from "lucide-react";
import { AppointmentsDayView } from "./appointments-day-view";
import { DateNav } from "./date-nav";
import { buildAppointmentsHref } from "./calendar-url";
import { SalonDisplayProvider } from "./salon-display-context";

export function AppointmentsClient({
  initialCalendar,
  canManage,
}: {
  initialCalendar: CalendarViewModel;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const salonDisplay = useMemo(
    () => ({ tz: initialCalendar.timezone, salonName: initialCalendar.salonName }),
    [initialCalendar.timezone, initialCalendar.salonName]
  );

  function changeCalendar(next: { date: string; view: CalendarViewModel["view"] }) {
    startTransition(() => {
      router.replace(buildAppointmentsHref(next));
    });
  }

  return (
    <SalonDisplayProvider value={salonDisplay}>
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
              <span className="capitalize">{initialCalendar.dateLabel}</span> ·{" "}
              <span className="font-semibold text-brand-600">
                {initialCalendar.activeCount} citas activas
              </span>
            </>
          }
          actions={
            <>
              <DateNav
                date={initialCalendar.date}
                view={initialCalendar.view}
                showWorkerView={initialCalendar.showWorkerView}
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
            appointments={initialCalendar.appointments}
            canManage={canManage}
            view={initialCalendar.view}
            weekDates={initialCalendar.visibleWeekDates}
            employees={initialCalendar.employees}
            businessStart={initialCalendar.businessStart}
            businessEnd={initialCalendar.businessEnd}
            cancellationTemplate={initialCalendar.cancellationTemplate}
            paymentMethodOptions={initialCalendar.paymentMethodOptions}
          />
        </div>
      </div>
    </SalonDisplayProvider>
  );
}
