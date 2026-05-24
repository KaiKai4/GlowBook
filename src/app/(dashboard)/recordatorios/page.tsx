import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RemindersView } from "./reminders-view";
import { Bell } from "lucide-react";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function RecordatoriosPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
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

  const today = new Date();
  const in7Days = addDays(today, 7);

  // Fetch all pending appointments for the next 7 days in one query
  const appointments = await findAppointmentsBySalon(profile.salon_id, {
    startDate: `${toISO(today)}T00:00:00`,
    endDate: `${toISO(in7Days)}T23:59:59`,
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
          <Bell className="h-6 w-6 text-violet-500" />
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
