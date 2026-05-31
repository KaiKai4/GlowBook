import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SALON_COUNT = 5;
const EMPLOYEES_PER_SALON = 6;
const CATEGORIES_PER_SALON = 4;
const SERVICES_PER_CATEGORY = 5;
const CUSTOMERS_PER_SALON = 100;
const APPOINTMENTS_PER_SALON = 80;
const BATCH_SIZE = 100;

function loadEnvFileIfPresent() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=");
  }
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, "").toLowerCase();
}

function fail(message) {
  console.error(`[seed-staging-smoke] ${message}`);
  process.exit(1);
}

function assertSafeBatchId(batchId) {
  if (!/^smoke-[a-zA-Z0-9-]+$/.test(batchId)) {
    fail("SMOKE_SEED_BATCH_ID must start with 'smoke-' and contain only letters, numbers and hyphens.");
  }
}

function chunk(rows, size = BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function insertRows(admin, table, rows, select = undefined) {
  if (rows.length === 0) return [];

  const inserted = [];
  for (const group of chunk(rows)) {
    let query = admin.from(table).insert(group);
    if (select) query = query.select(select);
    const { data, error } = await query;
    if (error) throw error;
    if (data) inserted.push(...data);
  }

  return inserted;
}

function dateAt(offsetDays, hour, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function emailFor(batchId, entity, salonIndex, itemIndex = 0) {
  return `glowbook.${batchId}.${entity}.${salonIndex}.${itemIndex}@example.com`;
}

loadEnvFileIfPresent();

const appEnv = (
  process.env.GLOWBOOK_ENV ??
  process.env.APP_ENV ??
  process.env.VERCEL_ENV ??
  ""
).toLowerCase();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const confirm = process.env.SMOKE_SEED_CONFIRM;
const batchId = process.env.SMOKE_SEED_BATCH_ID ?? `smoke-${Date.now()}`;

assertSafeBatchId(batchId);

if (appEnv !== "staging" && process.env.SMOKE_SEED_ALLOW_LOCAL !== "true") {
  fail("Set GLOWBOOK_ENV=staging, or SMOKE_SEED_ALLOW_LOCAL=true for local-only experiments.");
}

if (appEnv === "production") {
  fail("Refusing to seed a production environment.");
}

if (!supabaseUrl || !serviceRoleKey) {
  fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

if (
  productionSupabaseUrl &&
  normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)
) {
  fail("Refusing to seed PRODUCTION_SUPABASE_URL.");
}

if (confirm !== "seed-5-salons") {
  fail("Set SMOKE_SEED_CONFIRM=seed-5-salons to acknowledge this creates persistent staging data.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`[seed-staging-smoke] Creating batch ${batchId}`);

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

for (let salonIndex = 1; salonIndex <= SALON_COUNT; salonIndex += 1) {
  const ownerEmail = emailFor(batchId, "owner", salonIndex);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: "GlowBookSmoke123!",
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("Owner Auth user was not created.");

  const ownerId = authData.user.id;

  const { data: salon, error: salonError } = await admin
    .from("salons")
    .insert({
      name: `Smoke ${batchId} Salon ${salonIndex}`,
      email: ownerEmail,
      phone: `60${String(salonIndex).padStart(6, "0")}`,
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
      full_name: `Smoke Owner ${salonIndex}`,
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
    Array.from({ length: CATEGORIES_PER_SALON }, (_, index) => ({
      salon_id: salonId,
      name: `Categoria Smoke ${index + 1}`,
      is_active: true,
    })),
    "id"
  );

  const services = await insertRows(
    admin,
    "services",
    categories.flatMap((category, categoryIndex) =>
      Array.from({ length: SERVICES_PER_CATEGORY }, (_, serviceIndex) => ({
        salon_id: salonId,
        category_id: category.id,
        name: `Servicio Smoke ${categoryIndex + 1}-${serviceIndex + 1}`,
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
    Array.from({ length: EMPLOYEES_PER_SALON }, (_, index) => ({
      salon_id: salonId,
      first_name: `Colaborador ${index + 1}`,
      last_name: "Smoke",
      email: emailFor(batchId, "employee", salonIndex, index + 1),
      phone: `61${String(salonIndex).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
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
    Array.from({ length: CUSTOMERS_PER_SALON }, (_, index) => ({
      salon_id: salonId,
      first_name: `Cliente ${index + 1}`,
      last_name: "Smoke",
      email: emailFor(batchId, "customer", salonIndex, index + 1),
      phone: `62${String(salonIndex).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
      is_active: true,
      is_temporary: false,
    })),
    "id"
  );

  const appointments = [];
  const appointmentItems = [];
  for (let index = 0; index < APPOINTMENTS_PER_SALON; index += 1) {
    const appointmentId = randomUUID();
    const service = services[index % services.length];
    const employee = employees[index % employees.length];
    const customer = customers[index % customers.length];
    const start = dateAt((index % 40) - 20, 9 + (index % 7), (index % 2) * 30);
    const end = new Date(start.getTime() + 30 * 60_000);

    appointments.push({
      id: appointmentId,
      salon_id: salonId,
      customer_id: customer.id,
      created_by: ownerId,
      notes: `Smoke batch ${batchId}`,
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

  console.log(`[seed-staging-smoke] Salon ${salonIndex}/${SALON_COUNT} seeded: ${salonId}`);
}

console.log("[seed-staging-smoke] Done");
console.table(summary);
