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
  const days = [0, 1, 2].map((offset) => addDays(today, offset));

  const appointmentsByDay = await Promise.all(
    days.map(async (day) => {
      const isoDate = toISO(day);
      const appts = await findAppointmentsBySalon(profile.salon_id, {
        startDate: `${isoDate}T00:00:00`,
        endDate: `${isoDate}T23:59:59`,
      });
      return {
        date: isoDate,
        label: day.toLocaleDateString("es-PA", { weekday: "long", day: "numeric", month: "long" }),
        appointments: appts.filter((a) => !["cancelled", "completed"].includes(a.status)),
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          <Bell className="h-6 w-6 text-violet-500" />
          Recordatorios
        </h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Envía recordatorios de citas de hoy, mañana y pasado mañana.
        </p>
      </div>

      <RemindersView
        appointmentsByDay={appointmentsByDay as unknown as Parameters<typeof RemindersView>[0]["appointmentsByDay"]}
        tz={tz}
      />
    </div>
  );
}
