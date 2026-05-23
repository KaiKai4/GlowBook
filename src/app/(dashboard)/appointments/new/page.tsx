import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findCustomers } from "@/features/customers/data/customers.repo";
import { findCategoriesWithServices } from "@/features/services/data/services.repo";
import { findEmployees } from "@/features/employees/data/employees.repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppointmentWizard } from "./appointment-wizard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AssignedRef { service?: { id: string } | null; category?: { id: string } | null }
interface WsRef { day_of_week: number; start_time: string; end_time: string; is_active: boolean }

export default async function NewAppointmentPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para crear citas.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [customersResult, categories, employees, { data: salon }, { data: businessHours }] =
    await Promise.all([
      findCustomers(profile.salon_id, { perPage: 200, isActive: true }),
      findCategoriesWithServices(profile.salon_id),
      findEmployees(profile.salon_id, true),
      supabase
        .from("salons")
        .select("min_booking_notice_minutes, min_appointment_duration_minutes, allow_off_hours_bookings, timezone")
        .eq("id", profile.salon_id)
        .single(),
      supabase
        .from("salon_business_hours")
        .select("day_of_week, is_open, open_time, close_time")
        .eq("salon_id", profile.salon_id),
    ]);

  const customers = customersResult.data.map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
  }));

  const categoryOptions = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
  }));

  const services = categories.flatMap((cat) =>
    (cat.services ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category_id: cat.id,
      duration_minutes: s.duration_minutes,
      price: Number(s.price),
    }))
  );

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    name: `${e.first_name} ${e.last_name}`,
    service_ids: ((e.services ?? []) as AssignedRef[]).map((s) => s.service?.id).filter((id): id is string => !!id),
    category_ids: ((e.categories ?? []) as AssignedRef[]).map((c) => c.category?.id).filter((id): id is string => !!id),
    work_schedules: ((e.work_schedules ?? []) as WsRef[]).map((w) => ({
      day_of_week: w.day_of_week,
      start_time: w.start_time,
      end_time: w.end_time,
      is_active: w.is_active,
    })),
  }));

  const ready = services.length > 0 && employeeOptions.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/appointments" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Agenda
        </Link>
        <h1 className="text-2xl font-bold text-stone-900 mt-2">Nueva cita</h1>
        <p className="text-sm text-stone-400 mt-0.5">Completa los pasos para agendar una cita.</p>
      </div>

      {!ready ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
          Para agendar necesitas al menos un servicio y un colaborador que lo realice.
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {services.length === 0 && (
              <li>No hay servicios. <Link href="/services" className="underline font-medium">Crear servicio</Link></li>
            )}
            {employeeOptions.length === 0 && (
              <li>No hay colaboradores. <Link href="/employees" className="underline font-medium">Crear colaborador</Link></li>
            )}
          </ul>
        </div>
      ) : (
        <AppointmentWizard
          customers={customers}
          categories={categoryOptions}
          services={services}
          employees={employeeOptions}
          salonConfig={{
            min_booking_notice_minutes: salon?.min_booking_notice_minutes ?? 60,
            min_appointment_duration_minutes: salon?.min_appointment_duration_minutes ?? 30,
            allow_off_hours_bookings: salon?.allow_off_hours_bookings ?? false,
            timezone: salon?.timezone ?? "America/Panama",
          }}
          businessHours={(businessHours ?? []).map((b) => ({
            day_of_week: b.day_of_week,
            is_open: b.is_open,
            open_time: b.open_time,
            close_time: b.close_time,
          }))}
        />
      )}
    </div>
  );
}
