import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { utcBounds } from "@/lib/utils/dates";
import { RemindersView } from "./reminders-view";
import { Bell } from "lucide-react";

// Add days to a YYYY-MM-DD string (noon UTC avoids DST edges).
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function RecordatoriosPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para ver recordatorios.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: salon } = await supabase
    .from("salons").select("timezone").eq("id", profile.salon_id).single();
  const tz = salon?.timezone ?? "America/Panama";

  // "Today" in the salon's timezone + the next 7 days, as a tz-aware UTC range.
  const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const { start, end } = utcBounds(localToday, addDaysISO(localToday, 7), tz);

  // Fetch all pending appointments for the next 7 days in one query
  const appointments = await findAppointmentsBySalon(profile.salon_id, {
    startDate: start,
    endDate: end,
  });

  const pending = appointments.filter((a) => !["cancelled", "completed"].includes(a.status));

  // All active employees (not just those with appointments in this window)
  const { data: empRows } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("salon_id", profile.salon_id)
    .eq("is_active", true)
    .order("first_name");
  const employees = (empRows ?? []).map((e) => ({
    id: e.id,
    name: `${e.first_name} ${e.last_name}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          <Bell className="h-6 w-6 text-brand-500" />
          Recordatorios
        </h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Envía recordatorios de citas de los próximos 7 días.
        </p>
      </div>

      <RemindersView
        appointments={pending as unknown as Parameters<typeof RemindersView>[0]["appointments"]}
        employees={employees}
        tz={tz}
      />
    </div>
  );
}
