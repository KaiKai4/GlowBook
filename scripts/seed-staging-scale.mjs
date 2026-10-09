import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertSafeTargetOrExit, readConfirmFlag } from "./lib/target-guard.mjs";
import { assertNotProductionUrl, assertSeedEnvironment, dateAt, emailFor, insertRows, loadEnvFileIfPresent, readAppEnv } from "./seed-common.mjs";

const DEFAULTS = {
  salons: 25,
  employeesPerSalon: 8,
  categoriesPerSalon: 5,
  servicesPerCategory: 6,
  customersPerSalon: 150,
  appointmentsPerSalon: 120,
};
const MAX_SALONS = 250;

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[seed-staging-scale] ${message}`);
  process.exit(1);
}

/** @param {string} name @param {number} fallback */
function integerEnv(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

/** @param {string} batchId */
function assertSafeBatchId(batchId) {
  if (!/^scale-[a-zA-Z0-9-]+$/.test(batchId)) {
    fail("SCALE_SEED_BATCH_ID must start with 'scale-' and contain only letters, numbers and hyphens.");
  }
}

loadEnvFileIfPresent();

const appEnv = readAppEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const confirm = process.env.SCALE_SEED_CONFIRM;
const batchId = process.env.SCALE_SEED_BATCH_ID ?? `scale-${Date.now()}`;

assertSafeBatchId(batchId);

assertSeedEnvironment({
  appEnv,
  allowLocal: process.env.SCALE_SEED_ALLOW_LOCAL === "true",
  allowLocalFlag: "SCALE_SEED_ALLOW_LOCAL",
  fail,
});

if (!supabaseUrl || !serviceRoleKey) {
  fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

assertNotProductionUrl({ supabaseUrl, productionSupabaseUrl, fail });

if (confirm !== "seed-scale-salons") {
  fail("Set SCALE_SEED_CONFIRM=seed-scale-salons to acknowledge this creates persistent staging scale data.");
}

const config = {
  salons: integerEnv("SCALE_SALON_COUNT", DEFAULTS.salons, { min: 1, max: MAX_SALONS }),
  employeesPerSalon: integerEnv("SCALE_EMPLOYEES_PER_SALON", DEFAULTS.employeesPerSalon),
  categoriesPerSalon: integerEnv("SCALE_CATEGORIES_PER_SALON", DEFAULTS.categoriesPerSalon),
  servicesPerCategory: integerEnv("SCALE_SERVICES_PER_CATEGORY", DEFAULTS.servicesPerCategory),
  customersPerSalon: integerEnv("SCALE_CUSTOMERS_PER_SALON", DEFAULTS.customersPerSalon),
  appointmentsPerSalon: integerEnv("SCALE_APPOINTMENTS_PER_SALON", DEFAULTS.appointmentsPerSalon),
};

assertSafeTargetOrExit("seed-staging-scale", {
  url: supabaseUrl,
  env: process.env.GLOWBOOK_ENV ?? process.env.APP_ENV ?? process.env.VERCEL_ENV,
  confirmFlag: readConfirmFlag(process.argv),
  productionUrl: process.env.PRODUCTION_SUPABASE_URL,
});
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`[seed-staging-scale] Creating batch ${batchId}`);
console.table(config);

const summary = {
  batchId,
  salons: 0,
  owners: 0,
  employees: 0,
  categories: 0,
  services: 0,
  customers: 0,
  appointments: 0,
};

for (let salonIndex = 1; salonIndex <= config.salons; salonIndex += 1) {
  const ownerEmail = emailFor(batchId, "owner", salonIndex);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: "GlowBookScale123!",
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("Owner Auth user was not created.");

  const ownerId = authData.user.id;

  const { data: salon, error: salonError } = await admin
    .from("salons")
    .insert({
      name: `Scale ${batchId} Salon ${salonIndex}`,
      email: ownerEmail,
      phone: `70${String(salonIndex).padStart(6, "0")}`,
      timezone: "America/Panama",
      theme: salonIndex % 2 === 0 ? "viridian" : "violet",
      bg_style: "neutral",
      disabled_features: [],
      min_booking_notice_minutes: 0,
    })
    .select("id")
    .single();
  if (salonError) throw salonError;

  const salonId = salon.id;

  await insertRows(admin, "profiles", [
    {
      id: ownerId,
      salon_id: salonId,
      full_name: `Scale Owner ${salonIndex}`,
      is_owner: true,
      is_active: true,
    },
  ]);

  await insertRows(
    admin,
    "salon_business_hours",
    Array.from({ length: 7 }, (_, day) => ({
      salon_id: salonId,
      day_of_week: day,
      is_open: true,
      open_time: "08:00",
      close_time: "18:00",
    }))
  );

  const categories = await insertRows(
    admin,
    "service_categories",
    Array.from({ length: config.categoriesPerSalon }, (_, index) => ({
      salon_id: salonId,
      name: `Categoria Scale ${index + 1}`,
      is_active: true,
    })),
    "id"
  );

  const services = await insertRows(
    admin,
    "services",
    categories.flatMap((category, categoryIndex) =>
      Array.from({ length: config.servicesPerCategory }, (_, serviceIndex) => ({
        salon_id: salonId,
        category_id: category.id,
        name: `Servicio Scale ${categoryIndex + 1}-${serviceIndex + 1}`,
        duration_minutes: serviceIndex % 2 === 0 ? 30 : 45,
        price: 15 + serviceIndex * 5,
        is_active: true,
      }))
    ),
    "id, category_id"
  );

  const employees = await insertRows(
    admin,
    "employees",
    Array.from({ length: config.employeesPerSalon }, (_, index) => ({
      salon_id: salonId,
      first_name: `Colaborador ${index + 1}`,
      last_name: "Scale",
      email: emailFor(batchId, "employee", salonIndex, index + 1),
      phone: `71${String(salonIndex).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
      is_active: true,
    })),
    "id"
  );

  await insertRows(
    admin,
    "employee_services",
    employees.flatMap((employee) =>
      services.map((service) => ({
        salon_id: salonId,
        employee_id: employee.id,
        service_id: service.id,
      }))
    )
  );

  await insertRows(
    admin,
    "employee_categories",
    employees.flatMap((employee) =>
      categories.map((category) => ({
        salon_id: salonId,
        employee_id: employee.id,
        category_id: category.id,
      }))
    )
  );

  await insertRows(
    admin,
    "work_schedules",
    employees.flatMap((employee) =>
      Array.from({ length: 7 }, (_, day) => ({
        salon_id: salonId,
        employee_id: employee.id,
        day_of_week: day,
        start_time: "08:00",
        end_time: "18:00",
        is_active: true,
      }))
    )
  );

  const customers = await insertRows(
    admin,
    "customers",
    Array.from({ length: config.customersPerSalon }, (_, index) => ({
      salon_id: salonId,
      first_name: `Cliente ${index + 1}`,
      last_name: "Scale",
      email: emailFor(batchId, "customer", salonIndex, index + 1),
      phone: `72${String(salonIndex).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
      is_active: true,
      is_temporary: false,
    })),
    "id"
  );

  const appointments = [];
  const appointmentItems = [];
  for (let index = 0; index < config.appointmentsPerSalon; index += 1) {
    const appointmentId = randomUUID();
    const service = services[index % services.length];
    const employee = employees[index % employees.length];
    const customer = customers[index % customers.length];
    const start = dateAt((index % 60) - 30, 8 + (index % 9), (index % 2) * 30);
    const end = new Date(start.getTime() + 30 * 60_000);

    appointments.push({
      id: appointmentId,
      salon_id: salonId,
      customer_id: customer.id,
      created_by: ownerId,
      notes: `Scale batch ${batchId}`,
      status: index % 5 === 0 ? "completed" : "scheduled",
    });

    appointmentItems.push({
      salon_id: salonId,
      appointment_id: appointmentId,
      service_id: service.id,
      employee_id: employee.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: 30,
      price: 25,
      ordering: 1,
      blocks_calendar: index % 5 !== 0,
    });
  }

  await insertRows(admin, "appointments", appointments);
  await insertRows(admin, "appointment_items", appointmentItems);

  summary.salons += 1;
  summary.owners += 1;
  summary.employees += employees.length;
  summary.categories += categories.length;
  summary.services += services.length;
  summary.customers += customers.length;
  summary.appointments += appointments.length;

  console.log(`[seed-staging-scale] Salon ${salonIndex}/${config.salons} seeded: ${salonId}`);
}

console.log("[seed-staging-scale] Done");
console.table(summary);
