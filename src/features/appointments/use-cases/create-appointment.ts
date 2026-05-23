import { err, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findOccupiedSlots,
  findWorkSchedules,
} from "../data/appointments.repo";
import { evaluateTimeRange } from "../domain/availability";
import { buildItemPayloads } from "../domain/scheduling";
import type { SchedulingContext } from "../domain/scheduling";
import type { CreateAppointmentInput } from "../schemas";
import type { BusinessHour, SalonConfig } from "../domain/types";

interface Deps {
  salonId: string;
  userId: string;
}

export async function createAppointment(
  input: CreateAppointmentInput,
  { salonId, userId }: Deps
): Promise<Result<string>> {
  const supabase = await createSupabaseServerClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, salon_id")
    .eq("id", input.customer_id)
    .eq("salon_id", salonId)
    .single();

  if (!customer) return err("Cliente no encontrado en este salón.");

  const { data: salon } = await supabase
    .from("salons")
    .select("min_booking_notice_minutes, min_appointment_duration_minutes, allow_off_hours_bookings, timezone")
    .eq("id", salonId)
    .single();

  if (!salon) return err("Salón no encontrado.");

  const { data: businessHours } = await supabase
    .from("salon_business_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("salon_id", salonId);

  const serviceIds = input.assignments.map((a) => a.service_id);
  const employeeIds = input.assignments.map((a) => a.employee_id);

  const { data: services } = await supabase
    .from("services")
    .select("id, salon_id, duration_minutes, price, is_active, category_id")
    .in("id", serviceIds)
    .eq("salon_id", salonId);

  const { data: employees } = await supabase
    .from("employees")
    .select("id, salon_id, is_active, profile_id")
    .in("id", employeeIds)
    .eq("salon_id", salonId);

  if (!services || !employees) return err("Datos inválidos.");

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  const assignments = input.assignments.map((a) => ({
    service: serviceMap.get(a.service_id),
    employee: employeeMap.get(a.employee_id),
  }));

  if (assignments.some((a) => !a.service || !a.employee)) {
    return err("Servicio o profesional no encontrado en el salón.");
  }

  const validAssignments = assignments as Array<{
    service: NonNullable<(typeof assignments)[number]["service"]>;
    employee: NonNullable<(typeof assignments)[number]["employee"]>;
  }>;

  const startTime = new Date(input.start_time);

  const schedulesCache = new Map<string, Awaited<ReturnType<typeof findWorkSchedules>>>();
  const slotsCache = new Map<string, Awaited<ReturnType<typeof findOccupiedSlots>>>();

  for (const { employee } of validAssignments) {
    if (!schedulesCache.has(employee.id)) {
      schedulesCache.set(employee.id, await findWorkSchedules(employee.id));
    }
    const key = `${employee.id}-${startTime.toDateString()}`;
    if (!slotsCache.has(key)) {
      slotsCache.set(key, await findOccupiedSlots(employee.id, startTime));
    }
  }

  const ctx: SchedulingContext = {
    salonConfig: salon as SalonConfig,
    businessHours: (businessHours ?? []) as BusinessHour[],
    getWorkSchedules: (empId) => schedulesCache.get(empId) ?? [],
    getOccupiedSlots: (empId, date) => slotsCache.get(`${empId}-${date.toDateString()}`) ?? [],
  };

  let payloads;
  try {
    payloads = buildItemPayloads(salonId, startTime, validAssignments, ctx);
  } catch (e) {
    return err((e as Error).message);
  }

  const totalEnd = payloads[payloads.length - 1].end_time;
  const globalViolations = evaluateTimeRange({
    start: startTime,
    end: totalEnd,
    salonConfig: salon as SalonConfig,
    businessHours: (businessHours ?? []) as BusinessHour[],
    enforceSalonSchedule: true,
    enforceNotice: true,
    enforceMinDuration: true,
  });

  if (globalViolations.length > 0) {
    return err(globalViolations[0].message);
  }

  const rpcPayload = {
    salon_id: salonId,
    customer_id: input.customer_id,
    created_by: userId,
    notes: input.notes ?? "",
    items: payloads.map((p) => ({
      salon_id: salonId,
      service_id: p.service_id,
      employee_id: p.employee_id,
      start_time: p.start_time.toISOString(),
      end_time: p.end_time.toISOString(),
      duration_minutes: p.duration_minutes,
      price: p.price,
      ordering: p.ordering,
      blocks_calendar: true,
    })),
  };

  const { data: appointmentId, error: rpcError } = await supabase.rpc(
    "create_appointment",
    { payload: rpcPayload }
  );

  if (rpcError) {
    if (rpcError.message?.includes("no_overlap_per_employee")) {
      return err("El profesional ya tiene una cita en ese horario. Elige otro horario.");
    }
    return err("Error al crear la cita. Intenta de nuevo.");
  }

  return ok(appointmentId as string);
}
