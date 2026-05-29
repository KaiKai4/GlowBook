import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCalendarView } from "@/features/appointments/use-cases/get-calendar-view";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { CalendarDays, Plus } from "lucide-react";
import { AppointmentsDayView } from "./appointments-day-view";
import { DateNav } from "./date-nav";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  const canManage = hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE);
  const canView = canManage || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW);
  const canViewAll = profile.is_owner || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW_ALL);

  if (!canView) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para ver las citas.</p>
      </div>
    );
  }

  const calendar = await getCalendarView({
    salonId: profile.salon_id,
    canViewAll,
    date: params.date,
    view: params.view,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-brand-500" />
            Agenda
          </h1>
          <p className="text-sm text-stone-500 mt-0.5 capitalize">
            {calendar.dateLabel} ·{" "}
            <span className="text-brand-600 font-semibold">
              {calendar.activeCount} citas activas
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateNav
            date={calendar.date}
            view={calendar.view}
            showWorkerView={calendar.showWorkerView}
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
      />
    </div>
  );
}
