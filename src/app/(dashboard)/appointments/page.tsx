import { getCalendarView } from "@/features/appointments/use-cases/get-calendar-view";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { AppointmentsClient } from "./appointments-client";

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

  return <AppointmentsClient initialCalendar={calendar} canManage={canManage} />;
}
