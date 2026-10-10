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
  startTime: string;
  endTime: string;
  outsideStartTime: string;
  outsideEndTime: string;
}

function dateForFutureWeekday(dayOfWeek: number, localTime: string): string {
  const today = new Date();
  const todayDay = (today.getUTCDay() + 6) % 7; // 0=Monday, 6=Sunday
  const daysUntil = (((dayOfWeek - todayDay + 7) % 7) || 7) + 14;
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntil));
  return `${d.toISOString().slice(0, 10)}T${localTime}:00-05:00`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hour = NaN, minute = NaN] = time.slice(0, 5).split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

async function createFixture(admin: Db, salonId: string): Promise<Fixture> {
  const stamp = Date.now();
  const { data: hours, error: hoursError } = await admin
    .from("salon_business_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("salon_id", salonId)
    .eq("is_open", true)
    .not("open_time", "is", null)
    .not("close_time", "is", null)
    .order("day_of_week");
  if (hoursError) throw hoursError;

  const businessHour = (hours ?? []).find((hour) => {
    const open = hour.open_time?.slice(0, 5);
    const close = hour.close_time?.slice(0, 5);
    if (!open || !close) return false;
    return addMinutesToTime(open, 30) <= close;
  });

  if (!businessHour || !businessHour.open_time || !businessHour.close_time) {
    throw new Error("El test RPC necesita al menos un día abierto de 30 minutos en el salón de prueba.");
  }

  const dayOfWeek = businessHour.day_of_week;
  const validStartLocal = businessHour.open_time.slice(0, 5);
  const outsideStartLocal = addMinutesToTime(businessHour.close_time.slice(0, 5), 30);
  const outsideEndLocal = addMinutesToTime(outsideStartLocal, 30);

  const { data: category, error: categoryError } = await admin
    .from("service_categories")
    .insert({
      salon_id: salonId,
      name: `AUDIT RPC Categoria ${stamp}`,
      is_active: true,
    })
    .select("id")
    .single();
  if (categoryError) throw categoryError;
  createdCategoryIds.push(category.id);

  const { data: service, error: serviceError } = await admin
    .from("services")
    .insert({
      salon_id: salonId,
      category_id: category.id,
      name: `AUDIT RPC Servicio ${stamp}`,
      duration_minutes: 30,
      price: 10,
      is_active: true,
    })
    .select("id")
    .single();
  if (serviceError) throw serviceError;
  createdServiceIds.push(service.id);

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .insert({
      salon_id: salonId,
      first_name: "AUDIT RPC",
      last_name: "Colaborador",
      email: `audit.rpc.${stamp}@glowbook.test`,
      phone: "60009999",
      is_active: true,
    })
    .select("id")
    .single();
  if (employeeError) throw employeeError;
  createdEmployeeIds.push(employee.id);

  const [{ error: employeeServiceError }, { error: employeeCategoryError }] = await Promise.all([
    admin.from("employee_services").insert({
      salon_id: salonId,
      employee_id: employee.id,
      service_id: service.id,
    }),
    admin.from("employee_categories").insert({
      salon_id: salonId,
      employee_id: employee.id,
      category_id: category.id,
    }),
  ]);
  if (employeeServiceError) throw employeeServiceError;
  if (employeeCategoryError) throw employeeCategoryError;

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      salon_id: salonId,
      first_name: "AUDIT RPC",
      last_name: "Cliente",
      email: `audit.rpc.customer.${stamp}@glowbook.test`,
      phone: `6999${String(stamp).slice(-4)}`,
      is_active: true,
      is_temporary: false,
    })
    .select("id")
    .single();
  if (customerError) throw customerError;
  createdCustomerIds.push(customer.id);

  const start = new Date(dateForFutureWeekday(dayOfWeek, validStartLocal));
  const end = new Date(start.getTime() + 30 * 60_000);

  return {
    salonId,
    customerId: customer.id,
    employeeId: employee.id,
    serviceId: service.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    outsideStartTime: new Date(dateForFutureWeekday(dayOfWeek, outsideStartLocal)).toISOString(),
    outsideEndTime: new Date(dateForFutureWeekday(dayOfWeek, outsideEndLocal)).toISOString(),
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

describe(
  "create_appointment RPC (requires Supabase integration env vars)",
  () => {
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
      ownerFixture = await createSalonOwnerFixture(admin, "RPC");
      email = ownerFixture.email;
      password = ownerFixture.password;
      salonId = ownerFixture.salonId;
    }

    const { data: session, error: signInError } = await user.auth.signInWithPassword({
      email,
      password,
    });
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

  it("rejects manipulated payloads before inserting appointment data", async () => {
    const cases = [
      {
        name: "without items",
        payload: { customer_id: fixture.customerId, items: [] },
        message: "Selecciona al menos un servicio",
      },
      {
        name: "shorter than salón minimum duration",
        payload: {
          customer_id: fixture.customerId,
          items: [
            {
              service_id: fixture.serviceId,
              employee_id: fixture.employeeId,
              start_time: fixture.startTime,
              end_time: new Date(new Date(fixture.startTime).getTime() + 5 * 60_000).toISOString(),
              ordering: 1,
            },
          ],
        },
        message: "duración mínima",
      },
      {
        name: "outside salón business hours",
        payload: {
          customer_id: fixture.customerId,
          items: [
            {
              service_id: fixture.serviceId,
              employee_id: fixture.employeeId,
              start_time: fixture.outsideStartTime,
              end_time: fixture.outsideEndTime,
              ordering: 1,
            },
          ],
        },
        message: "fuera del horario",
      },
    ];

    for (const testCase of cases) {
      const { error } = await user.rpc("create_appointment", { payload: testCase.payload });
      expect(error?.message, testCase.name).toContain(testCase.message);
    }

    const { count, error: countError } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", fixture.customerId);

    expect(countError).toBeNull();
    expect(count).toBe(0);
  });

  it("creates a valid appointment and lets the trigger recalculate the header", async () => {
    const { data: appointmentId, error } = await user.rpc("create_appointment", {
      payload: {
        customer_id: fixture.customerId,
        notes: "AUDIT RPC valid appointment",
        items: [
          {
            service_id: fixture.serviceId,
            employee_id: fixture.employeeId,
            start_time: fixture.startTime,
            end_time: fixture.endTime,
            ordering: 1,
          },
        ],
      },
    });

    expect(error).toBeNull();
    expect(appointmentId).toEqual(expect.any(String));
    createdAppointmentIds.push(appointmentId as string);

    const { data: appointment, error: readError } = await admin
      .from("appointments")
      .select("start_time, end_time, total_price, appointment_items(id)")
      .eq("id", appointmentId as string)
      .single();

    expect(readError).toBeNull();
    expect(new Date(appointment?.start_time ?? "").getTime()).toBe(new Date(fixture.startTime).getTime());
    expect(new Date(appointment?.end_time ?? "").getTime()).toBe(new Date(fixture.endTime).getTime());
    expect(Number(appointment?.total_price)).toBe(10);
    expect(appointment?.appointment_items).toHaveLength(1);
  });

  it("rejects overlapping bookings for the same employee", async () => {
    const payload = {
      customer_id: fixture.customerId,
      notes: "AUDIT RPC overlap guard",
      items: [
        {
          service_id: fixture.serviceId,
          employee_id: fixture.employeeId,
          start_time: fixture.startTime,
          end_time: fixture.endTime,
          ordering: 1,
        },
      ],
    };

    const { data: appointmentId, error } = await user.rpc("create_appointment", { payload });
    expect(error).toBeNull();
    expect(appointmentId).toEqual(expect.any(String));
    createdAppointmentIds.push(appointmentId as string);

    const { error: overlapError } = await user.rpc("create_appointment", { payload });
    expect(overlapError?.message).toMatch(/overlap|conflict|no_overlap|violates/i);

    const { count, error: countError } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", fixture.customerId);

    expect(countError).toBeNull();
    expect(count).toBe(1);
  });

  it("rejects cross-tenant customers and services", async () => {
    let otherTenant: SalonOwnerFixture | null = null;

    try {
      otherTenant = await createSalonOwnerFixture(admin, "RPC Tenant");

      const { error: customerError } = await user.rpc("create_appointment", {
        payload: {
          customer_id: otherTenant.customerId,
          notes: "AUDIT RPC cross-tenant customer",
          items: [
            {
              service_id: fixture.serviceId,
              employee_id: fixture.employeeId,
              start_time: fixture.startTime,
              end_time: fixture.endTime,
              ordering: 1,
            },
          ],
        },
      });
      expect(customerError?.message).toContain("Cliente inválido");

      const { error: serviceError } = await user.rpc("create_appointment", {
        payload: {
          customer_id: fixture.customerId,
          notes: "AUDIT RPC cross-tenant service",
          items: [
            {
              service_id: otherTenant.serviceId,
              employee_id: fixture.employeeId,
              start_time: fixture.startTime,
              end_time: fixture.endTime,
              ordering: 1,
            },
          ],
        },
      });
      expect(serviceError?.message).toContain("Servicio inválido");

      const { count, error: countError } = await admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", fixture.customerId);

      expect(countError).toBeNull();
      expect(count).toBe(0);
    } finally {
      await cleanupSalonOwnerFixture(admin, otherTenant);
    }
  }, 30_000);
  }
);
