import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { findBusinessHours } from "@/features/salon/data/salon.repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DateNav, type CalView } from "./date-nav";
import { AppointmentsDayView } from "./appointments-day-view";
import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO() {
  return toISO(new Date());
}

function getWeekDates(date: string): string[] {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return toISO(dd);
  });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const date = params.date ?? todayISO();
  const rawView = (params.view ?? "semanal") as CalView;

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

  // "Por trabajador" only makes sense when the user can see other people's
  // appointments; scoped collaborators fall back to the weekly view.
  const view: CalView = !canViewAll && rawView === "trabajador" ? "semanal" : rawView;

  const supabase = await createSupabaseServerClient();

  // The employee list only feeds the "Por trabajador" view, which is hidden for
  // collaborators who can't see others' appointments — skip the query for them.
  const [salonResult, employeesResult, businessHours] = await Promise.all([
    supabase.from("salons").select("timezone").eq("id", profile.salon_id).single(),
    canViewAll
      ? supabase
          .from("employees")
          .select("id, first_name, last_name")
          .eq("salon_id", profile.salon_id)
          .eq("is_active", true)
          .order("first_name")
      : null,
    findBusinessHours(profile.salon_id),
  ]);

  const tz = salonResult.data?.timezone ?? "America/Panama";

  // Calendar grid spans the salon's open hours (8–21 fallback). The component
  // widens it automatically if any appointment falls outside this range.
  const openDays = businessHours.filter((h) => h.is_open && h.open_time && h.close_time);
  const businessStart = openDays.length
    ? Math.min(...openDays.map((h) => parseInt(h.open_time!.slice(0, 2), 10)))
    : 8;
  const businessEnd = openDays.length
    ? Math.max(...openDays.map((h) => {
        const [hh, mm] = h.close_time!.split(":").map(Number);
        return mm > 0 ? hh + 1 : hh;
      }))
    : 21;
  const employees = (employeesResult?.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
  }[];

  const weekDates = getWeekDates(date);
  const startDate = view === "semanal" ? weekDates[0] : date;
  const endDate = view === "semanal" ? weekDates[6] : date;

  const appointments = await findAppointmentsBySalon(profile.salon_id, {
    startDate: `${startDate}T00:00:00`,
    endDate: `${endDate}T23:59:59`,
  });

  let dateLabel: string;
  if (view === "semanal") {
    const start = new Date(`${weekDates[0]}T12:00:00`);
    const end = new Date(`${weekDates[6]}T12:00:00`);
    const fmtDay = (d: Date) => d.toLocaleDateString("es-PA", { day: "numeric" });
    const fmtMonth = (d: Date) => d.toLocaleDateString("es-PA", { month: "long" });
    dateLabel = `${fmtDay(start)} – ${fmtDay(end)} de ${fmtMonth(end)}`;
  } else {
    dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("es-PA", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  const activeCount = appointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "no_show"
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-brand-500" />
            Agenda
          </h1>
          <p className="text-sm text-stone-500 mt-0.5 capitalize">
            {dateLabel} ·{" "}
            <span className="text-brand-600 font-semibold">{activeCount} citas activas</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateNav date={date} view={view} showWorkerView={canViewAll} />
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
        appointments={appointments as unknown as Parameters<typeof AppointmentsDayView>[0]["appointments"]}
        tz={tz}
        canManage={canManage}
        view={view}
        weekDates={weekDates}
        employees={employees}
        businessStart={businessStart}
        businessEnd={businessEnd}
      />
    </div>
  );
}
