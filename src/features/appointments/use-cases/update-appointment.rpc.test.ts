import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
} from "@/test/supabase-integration-fixtures";
import type { Database } from "@/types/database.types";

// Edicion de cita (update_appointment) conservando un servicio que despues se desactivo.
// Prueba de conducta de la RPC: la app permite conservar el servicio (allowedInactiveServiceIds)
// y la BD debe aceptarlo; un servicio inactivo que la cita no tenia sigue rechazado.

const integrationEnv = getSupabaseIntegrationEnv();
const configuredTestEmail = process.env.SUPABASE_TEST_EMAIL;
const configuredTestPassword = process.env.SUPABASE_TEST_PASSWORD;

type Db = SupabaseClient<Database>;

const createdAppointmentIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdEmployeeIds: string[] = [];
const createdServiceIds: string[] = [];
const createdCategoryIds: string[] = [];

interface Fixture {
  salonId: string;
  customerId: string;
  employeeId: string;
  serviceId: string;
  otherServiceId: string;
  dayOfWeek: number;
  openLocal: string;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hour = NaN, minute = NaN] = time.slice(0, 5).split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function dateForFutureWeekday(dayOfWeek: number, localTime: string, weeksAhead: number): string {
  const today = new Date();
  const todayDay = (today.getUTCDay() + 6) % 7; // 0=lunes, 6=domingo
  const daysUntil = (((dayOfWeek - todayDay + 7) % 7) || 7) + 7 * weeksAhead;
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntil));
  return `${d.toISOString().slice(0, 10)}T${localTime}:00-05:00`;
}

async function createService(admin: Db, salonId: string, categoryId: string, name: string) {
  const { data, error } = await admin
    .from("services")
    .insert({ salon_id: salonId, category_id: categoryId, name, duration_minutes: 30, price: 10, is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  createdServiceIds.push(data.id);
  return data.id;
}

async function createFixture(admin: Db, salonId: string): Promise<Fixture> {
  const stamp = Date.now();
  const { data: hours, error: hoursError } = await admin
    .from("salon_business_hours")
    .select("day_of_week, open_time, close_time")
    .eq("salon_id", salonId)
    .eq("is_open", true)
    .not("open_time", "is", null)
    .not("close_time", "is", null)
    .order("day_of_week");
  if (hoursError) throw hoursError;

  const businessHour = (hours ?? []).find((hour) => {
    const open = hour.open_time?.slice(0, 5);
    const close = hour.close_time?.slice(0, 5);
    return Boolean(open && close && addMinutesToTime(open, 120) <= close);
  });
  if (!businessHour?.open_time) {
    throw new Error("El test RPC necesita al menos un día abierto de 120 minutos en el salón de prueba.");
  }

  const { data: category, error: categoryError } = await admin
    .from("service_categories")
    .insert({ salon_id: salonId, name: `AUDIT UPD Categoria ${stamp}`, is_active: true })
    .select("id")
    .single();
  if (categoryError) throw categoryError;
  createdCategoryIds.push(category.id);

  const serviceId = await createService(admin, salonId, category.id, `AUDIT UPD Servicio ${stamp}`);
  const otherServiceId = await createService(admin, salonId, category.id, `AUDIT UPD Otro ${stamp}`);

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .insert({
      salon_id: salonId,
      first_name: "AUDIT UPD",
      last_name: "Colaborador",
      email: `audit.upd.${stamp}@glowbook.test`,
      phone: "60008888",
      is_active: true,
    })
    .select("id")
    .single();
  if (employeeError) throw employeeError;
  createdEmployeeIds.push(employee.id);

  const [{ error: esError }, { error: ecError }] = await Promise.all([
    admin.from("employee_services").insert([
      { salon_id: salonId, employee_id: employee.id, service_id: serviceId },
      { salon_id: salonId, employee_id: employee.id, service_id: otherServiceId },
    ]),
    admin.from("employee_categories").insert({ salon_id: salonId, employee_id: employee.id, category_id: category.id }),
  ]);
  if (esError) throw esError;
  if (ecError) throw ecError;

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      salon_id: salonId,
      first_name: "AUDIT UPD",
      last_name: "Cliente",
      email: `audit.upd.customer.${stamp}@glowbook.test`,
      phone: `6998${String(stamp).slice(-4)}`,
      is_active: true,
      is_temporary: false,
    })
    .select("id")
    .single();
  if (customerError) throw customerError;
  createdCustomerIds.push(customer.id);

  return {
    salonId,
    customerId: customer.id,
    employeeId: employee.id,
    serviceId,
    otherServiceId,
    dayOfWeek: businessHour.day_of_week,
    openLocal: businessHour.open_time.slice(0, 5),
  };
}

function itemAt(fixture: Fixture, serviceId: string, offsetMinutes: number, ordering: number) {
  const start = new Date(
    dateForFutureWeekday(fixture.dayOfWeek, addMinutesToTime(fixture.openLocal, offsetMinutes), 2),
  );
  return {
    service_id: serviceId,
    employee_id: fixture.employeeId,
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + 30 * 60_000).toISOString(),
    ordering,
  };
}

async function cleanup(admin: Db) {
  if (createdAppointmentIds.length) {
    await admin.from("appointments").delete().in("id", createdAppointmentIds);
    createdAppointmentIds.length = 0;
  }
  if (createdCustomerIds.length) {
    await admin.from("customers").delete().in("id", createdCustomerIds);
    createdCustomerIds.length = 0;
  }
  if (createdEmployeeIds.length) {
    await admin.from("employees").delete().in("id", createdEmployeeIds);
    createdEmployeeIds.length = 0;
  }
  if (createdServiceIds.length) {
    await admin.from("services").delete().in("id", createdServiceIds);
    createdServiceIds.length = 0;
  }
  if (createdCategoryIds.length) {
    await admin.from("service_categories").delete().in("id", createdCategoryIds);
    createdCategoryIds.length = 0;
  }
}

describe("update_appointment RPC con servicio desactivado (requires Supabase integration env vars)", () => {
  let user: Db;
  let admin: Db;
  let salonId: string;
  let fixture: Fixture;
  let ownerFixture: SalonOwnerFixture | null = null;

  beforeAll(async () => {
    admin = createIntegrationAdminClient(integrationEnv);
    user = createIntegrationUserClient(integrationEnv);

    let email = configuredTestEmail;
    let password = configuredTestPassword;

    if (!email || !password) {
      ownerFixture = await createSalonOwnerFixture(admin, "UPD");
      email = ownerFixture.email;
      password = ownerFixture.password;
      salonId = ownerFixture.salonId;
    }

    const { data: session, error: signInError } = await user.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    if (ownerFixture) return;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("salon_id")
      .eq("id", session.user.id)
      .single();
    if (profileError) throw profileError;

    salonId = profile.salon_id;
  }, 30_000);

  afterAll(async () => {
    await cleanup(admin);
    await cleanupSalonOwnerFixture(admin, ownerFixture);
  }, 30_000);

  beforeEach(async () => {
    fixture = await createFixture(admin, salonId);
  }, 30_000);

  afterEach(async () => {
    await cleanup(admin);
  });

  it("permite conservar un servicio ya asignado aunque este desactivado, pero rechaza añadir otro inactivo", async () => {
    const { data: appointmentId, error: createError } = await user.rpc("create_appointment", {
      payload: {
        customer_id: fixture.customerId,
        notes: "AUDIT UPD servicio desactivado",
        items: [itemAt(fixture, fixture.serviceId, 0, 0)],
      },
    });
    expect(createError).toBeNull();
    expect(appointmentId).toEqual(expect.any(String));
    createdAppointmentIds.push(appointmentId as string);

    // El servicio de la cita se desactiva despues de asignarlo; el otro servicio nunca estuvo en la cita.
    const { error: deactivateError } = await admin
      .from("services")
      .update({ is_active: false })
      .in("id", [fixture.serviceId, fixture.otherServiceId]);
    expect(deactivateError).toBeNull();

    // Editar la cita cambiando la hora y conservando el servicio desactivado
    const { error: keepError } = await user.rpc("update_appointment", {
      payload: {
        appointment_id: appointmentId,
        notes: "AUDIT UPD servicio desactivado editada",
        items: [itemAt(fixture, fixture.serviceId, 60, 0)],
      },
    });
    expect(keepError).toBeNull();

    const { data: items, error: readError } = await admin
      .from("appointment_items")
      .select("service_id")
      .eq("appointment_id", appointmentId as string);
    expect(readError).toBeNull();
    expect(items?.map((item) => item.service_id)).toEqual([fixture.serviceId]);

    // Añadir un servicio inactivo que la cita no tenia sigue rechazado
    const { error: addError } = await user.rpc("update_appointment", {
      payload: {
        appointment_id: appointmentId,
        notes: "AUDIT UPD servicio inactivo nuevo",
        items: [
          itemAt(fixture, fixture.serviceId, 60, 0),
          itemAt(fixture, fixture.otherServiceId, 90, 1),
        ],
      },
    });
    expect(addError?.message).toContain("Servicio inválido para este salón");
  });
});
