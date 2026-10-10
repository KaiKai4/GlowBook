import { getCalendarView } from "@/features/appointments";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
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
        <p className="text-fg-subtle">No tienes permiso para ver las citas.</p>
      </div>
    );
  }

  const calendar = await getCalendarView({
    salonId: profile.salon_id,
    canViewAll,
    date: params.date,
    view: params.view,
  });

  // Un fallo de carga llega al error boundary de la ruta, como antes de ADR 0029.
  if (!calendar.ok) throw new Error(calendar.error);

  return <AppointmentsClient initialCalendar={calendar.value} canManage={canManage} />;
}
