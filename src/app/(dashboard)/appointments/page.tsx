import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DateNav } from "./date-nav";
import { AppointmentsDayView } from "./appointments-day-view";
import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const date = params.date ?? todayISO();

  const canManage = hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE);

  const supabase = await createSupabaseServerClient();
  const { data: salon } = await supabase
    .from("salons").select("timezone").eq("id", profile.salon_id).single();
  const tz = salon?.timezone ?? "America/Panama";

  const appointments = await findAppointmentsBySalon(profile.salon_id, {
    startDate: `${date}T00:00:00`,
    endDate: `${date}T23:59:59`,
  });

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("es-PA", {
    weekday: "long", day: "numeric", month: "long",
  });

  const activeCount = appointments.filter((a) => a.status !== "cancelled").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-violet-500" />
            Agenda
          </h1>
          <p className="text-sm text-stone-400 mt-0.5 capitalize">
            {dateLabel} ·{" "}
            <span className="text-violet-600 font-semibold">{activeCount} citas activas</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateNav date={date} />
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

      {/* Day view: calendar + list */}
      <AppointmentsDayView
        appointments={appointments as unknown as Parameters<typeof AppointmentsDayView>[0]["appointments"]}
        tz={tz}
        canManage={canManage}
      />
    </div>
  );
}
