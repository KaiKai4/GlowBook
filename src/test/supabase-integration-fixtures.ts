import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type TestSupabaseClient = SupabaseClient<Database>;

export interface SupabaseIntegrationEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SalonOwnerFixture extends AuthCredentials {
  userId: string;
  salonId: string;
  customerId: string;
  employeeId: string;
  serviceId: string;
}

export interface PlatformAdminFixture extends AuthCredentials {
  userId: string;
}

export interface AppointmentFixture {
  appointmentId: string;
  startDate: string;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "").toLowerCase();
}

function isConfiguredValue(value: string | undefined): value is string {
  if (!value) return false;
  if (/^(PASTE|YOUR|TU)[A-Z0-9_-]*_/i.test(value)) return false;
  if (value.includes("your-") || value.includes("here")) return false;
  return true;
}

// Las pruebas de integración solo pueden apuntar a Supabase LOCAL (Docker).
function assertLocalIntegrationTarget(env: SupabaseIntegrationEnv): void {
  const appEnv = (
    process.env.GLOWBOOK_ENV ??
    process.env.APP_ENV ??
    process.env.VERCEL_ENV ??
    ""
  ).toLowerCase();
  const productionUrl = process.env.PRODUCTION_SUPABASE_URL;

  if (appEnv === "production") {
    throw new Error("Supabase integration fixtures cannot run when the app environment is production.");
  }

  if (productionUrl && normalizeUrl(env.url) === normalizeUrl(productionUrl)) {
    throw new Error("Supabase integration fixtures refused to run against PRODUCTION_SUPABASE_URL.");
  }

  if (process.env.GLOWBOOK_TEST_TARGET !== "local") {
    throw new Error(
      "Supabase integration fixtures requieren GLOWBOOK_TEST_TARGET=local. Ejecuta \"npm run test:integration\" con Supabase local activo."
    );
  }

  const host = new URL(env.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Supabase integration fixtures solo admiten un host local (127.0.0.1 o localhost).");
  }
}

// Toma el entorno SOLO de process.env (nunca de .env.local) y falla si falta:
// una prueba de integración no se salta en silencio.
export function getSupabaseIntegrationEnv(): SupabaseIntegrationEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isConfiguredValue(url) || !isConfiguredValue(anonKey) || !isConfiguredValue(serviceRoleKey)) {
    throw new Error(
      "Faltan variables de Supabase para integración (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). Ejecuta \"npm run test:integration\" con Supabase local activo."
    );
  }

  const env = { url, anonKey, serviceRoleKey };
  assertLocalIntegrationTarget(env);
  return env;
}

export function createIntegrationAdminClient(
  env: SupabaseIntegrationEnv
): TestSupabaseClient {
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createIntegrationUserClient(
  env: SupabaseIntegrationEnv
): TestSupabaseClient {
  return createClient<Database>(env.url, env.anonKey);
}

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${randomUUID()}@example.com`;
}

export async function createSalonOwnerFixture(
  admin: TestSupabaseClient,
  label = "E2E",
  disabledFeatures: string[] = []
): Promise<SalonOwnerFixture> {
  const email = uniqueEmail("glowbook.owner");
  const password = "GlowBookTest123!";

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("Auth user not created");

  const userId = authData.user.id;

  try {
    const { data: salon, error: salonError } = await admin
      .from("salons")
      .insert({
        name: `${label} Salon ${Date.now()}`,
        email,
        phone: "60000000",
        timezone: "America/Panama",
        theme: "violet",
        bg_style: "neutral",
        disabled_features: disabledFeatures,
        min_booking_notice_minutes: 0,
      })
      .select("id")
      .single();
    if (salonError) throw salonError;

    const salonId = salon.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      salon_id: salonId,
      full_name: `${label} Owner`,
      is_owner: true,
      is_active: true,
    });
    if (profileError) throw profileError;

    const businessHours = Array.from({ length: 7 }, (_, day) => ({
      salon_id: salonId,
      day_of_week: day,
      is_open: true,
      open_time: "09:00",
      close_time: "17:00",
    }));

    const { error: hoursError } = await admin
      .from("salon_business_hours")
      .insert(businessHours);
    if (hoursError) throw hoursError;

    const operationalData = await seedSalonOperationalData(admin, salonId);

    return { email, password, userId, salonId, ...operationalData };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

async function seedSalonOperationalData(admin: TestSupabaseClient, salonId: string) {
  const stamp = Date.now();

  const { data: category, error: categoryError } = await admin
    .from("service_categories")
    .insert({
      salon_id: salonId,
      name: `E2E Categoria ${stamp}`,
      is_active: true,
    })
    .select("id")
    .single();
  if (categoryError) throw categoryError;

  const { data: service, error: serviceError } = await admin
    .from("services")
    .insert({
      salon_id: salonId,
      category_id: category.id,
      name: `E2E Servicio ${stamp}`,
      duration_minutes: 30,
      price: 15,
      is_active: true,
    })
    .select("id")
    .single();
  if (serviceError) throw serviceError;

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .insert({
      salon_id: salonId,
      first_name: "E2E",
      last_name: "Colaborador",
      email: uniqueEmail("glowbook.employee"),
      phone: "61111111",
      is_active: true,
    })
    .select("id")
    .single();
  if (employeeError) throw employeeError;

  const [{ error: serviceAssignError }, { error: categoryAssignError }, { error: scheduleError }] =
    await Promise.all([
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
      admin.from("work_schedules").insert(
        Array.from({ length: 7 }, (_, day) => ({
          salon_id: salonId,
          employee_id: employee.id,
          day_of_week: day,
          start_time: "09:00",
          end_time: "17:00",
          is_active: true,
        }))
      ),
    ]);

  if (serviceAssignError) throw serviceAssignError;
  if (categoryAssignError) throw categoryAssignError;
  if (scheduleError) throw scheduleError;

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      salon_id: salonId,
      first_name: "E2E",
      last_name: "Cliente",
      email: uniqueEmail("glowbook.customer"),
      phone: `6${String(stamp).slice(-7).padStart(7, "0")}`,
      is_active: true,
      is_temporary: false,
    })
    .select("id")
    .single();
  if (customerError) throw customerError;

  return {
    customerId: customer.id,
    employeeId: employee.id,
    serviceId: service.id,
  };
}

export async function createScheduledAppointmentFixture(
  admin: TestSupabaseClient,
  fixture: SalonOwnerFixture,
  options: { daysAhead: number; hour?: number; notes?: string }
): Promise<AppointmentFixture> {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + options.daysAhead);
  start.setUTCHours(options.hour ?? 15, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      salon_id: fixture.salonId,
      customer_id: fixture.customerId,
      created_by: fixture.userId,
      notes: options.notes ?? "E2E appointment",
      status: "scheduled",
    })
    .select("id")
    .single();
  if (appointmentError) throw appointmentError;

  const { error: itemError } = await admin.from("appointment_items").insert({
    salon_id: fixture.salonId,
    appointment_id: appointment.id,
    service_id: fixture.serviceId,
    employee_id: fixture.employeeId,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    duration_minutes: 30,
    price: 15,
    ordering: 1,
    blocks_calendar: true,
  });
  if (itemError) throw itemError;

  return {
    appointmentId: appointment.id,
    startDate: start.toISOString().slice(0, 10),
  };
}

export async function createPlatformAdminFixture(
  admin: TestSupabaseClient
): Promise<PlatformAdminFixture> {
  const email = uniqueEmail("glowbook.platform");
  const password = "GlowBookTest123!";

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("Auth user not created");

  const userId = authData.user.id;

  try {
    const { error } = await admin.from("platform_admins").insert({ user_id: userId });
    if (error) throw error;
    return { email, password, userId };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

export async function cleanupSalonOwnerFixture(
  admin: TestSupabaseClient,
  fixture: SalonOwnerFixture | null
) {
  if (!fixture) return;

  await admin.from("profiles").delete().eq("id", fixture.userId);
  await admin.auth.admin.deleteUser(fixture.userId);
  await admin.from("salons").delete().eq("id", fixture.salonId);
}

export async function cleanupPlatformAdminFixture(
  admin: TestSupabaseClient,
  fixture: PlatformAdminFixture | null
) {
  if (!fixture) return;

  await admin.from("platform_admins").delete().eq("user_id", fixture.userId);
  await admin.auth.admin.deleteUser(fixture.userId);
}
