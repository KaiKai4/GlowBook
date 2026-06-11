import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

export const BENCHMARK_PASSWORD = "GlowBookBenchmark2026";
export const BENCHMARK_BATCH_PREFIX = "pricing-benchmark-v2";
export const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Yappy", "Transferencia", "Zinli"];

export const TABLES_WITH_SALON_ID = [
  "salons",
  "profiles",
  "roles",
  "role_permissions",
  "salon_business_hours",
  "notification_templates",
  "appointment_reminder_log",
  "customers",
  "employees",
  "employee_services",
  "employee_categories",
  "work_schedules",
  "service_categories",
  "services",
  "appointments",
  "appointment_items",
  "inventory_products",
  "inventory_stock_locations",
  "inventory_movements",
  "inventory_purchases",
  "inventory_purchase_items",
  "retail_sales",
  "retail_sale_items",
  "expenses",
];

export const BENCHMARK_COHORTS = [
  {
    key: "A",
    slug: "agenda-minima",
    label: "Agenda Minima",
    salons: 10,
    collaborators: 1,
    customers: 100,
    appointmentsPerMonth: 200,
    futureDays: 30,
    categories: 2,
    servicesPerCategory: 3,
    modules: { reminders: true, retail: false, inventory: false, expenses: false },
  },
  {
    key: "B",
    slug: "salon-pequeno-realista",
    label: "Salon Pequeno Realista",
    salons: 10,
    collaborators: 2,
    customers: 300,
    appointmentsPerMonth: 400,
    futureDays: 30,
    categories: 4,
    servicesPerCategory: 4,
    modules: { reminders: true, retail: false, inventory: false, expenses: false },
  },
  {
    key: "C",
    slug: "mediano-vitrina-gastos",
    label: "Salon Mediano Con Vitrina y Gastos",
    salons: 10,
    collaborators: 5,
    customers: 1000,
    appointmentsPerMonth: 1200,
    futureDays: 60,
    categories: 5,
    servicesPerCategory: 5,
    retailSalesPerMonth: 200,
    expensesPerMonth: 40,
    products: 40,
    modules: { reminders: true, retail: true, inventory: false, expenses: true },
  },
  {
    key: "D",
    slug: "completo-inventario",
    label: "Salon Completo Con Inventario",
    salons: 10,
    collaborators: 10,
    customers: 3000,
    appointmentsPerMonth: 3000,
    futureDays: 90,
    categories: 6,
    servicesPerCategory: 6,
    retailSalesPerMonth: 500,
    expensesPerMonth: 100,
    purchasesPerMonth: 40,
    products: 120,
    movementsPerMonth: 700,
    modules: { reminders: true, retail: true, inventory: true, expenses: true },
  },
  {
    key: "E",
    slug: "alto-volumen-stress",
    label: "Alto Volumen Stress",
    salons: 10,
    collaborators: 20,
    customers: 10000,
    appointmentsPerMonth: 8000,
    futureDays: 90,
    categories: 8,
    servicesPerCategory: 8,
    retailSalesPerMonth: 1000,
    expensesPerMonth: 500,
    purchasesPerMonth: 100,
    products: 250,
    movementsPerMonth: 1500,
    modules: { reminders: true, retail: true, inventory: true, expenses: true },
  },
];

export function loadEnvFileIfPresent() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=").replace(/^"|"$/g, "");
  }
}

export function normalizeUrl(value) {
  return value.replace(/\/+$/, "").toLowerCase();
}

export function fail(scope, message) {
  console.error(`[${scope}] ${message}`);
  process.exit(1);
}

export function assertStagingEnvironment(scope) {
  loadEnvFileIfPresent();

  const appEnv = (
    process.env.GLOWBOOK_ENV ??
    process.env.APP_ENV ??
    process.env.VERCEL_ENV ??
    ""
  ).toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;

  if (appEnv !== "staging") fail(scope, "Set GLOWBOOK_ENV=staging.");
  if (!supabaseUrl) fail(scope, "Set NEXT_PUBLIC_SUPABASE_URL.");
  if (
    productionSupabaseUrl &&
    normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)
  ) {
    fail(scope, "Refusing to operate against PRODUCTION_SUPABASE_URL.");
  }

  return { appEnv, supabaseUrl };
}

export function assertBenchmarkBatchId(scope, batchId) {
  if (!new RegExp(`^${BENCHMARK_BATCH_PREFIX}-[a-zA-Z0-9-]+$`).test(batchId)) {
    fail(
      scope,
      `Batch id must start with '${BENCHMARK_BATCH_PREFIX}-' and contain only letters, numbers and hyphens.`
    );
  }
}

export function cohortEmailPrefix(batchId, cohortKey) {
  return `glowbook.${batchId}.${cohortKey.toLowerCase()}`;
}

export function ownerEmailFor(batchId, cohortKey, salonIndex) {
  return `${cohortEmailPrefix(batchId, cohortKey)}.owner.${salonIndex}.0@example.com`;
}

export function employeeEmailFor(batchId, cohortKey, salonIndex, employeeIndex) {
  return `${cohortEmailPrefix(batchId, cohortKey)}.employee.${salonIndex}.${employeeIndex}@example.com`;
}

export function getSelectedCohorts(scope) {
  const raw = process.env.PRICING_BENCHMARK_COHORTS;
  if (!raw) return BENCHMARK_COHORTS;
  const selected = new Set(raw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean));
  const cohorts = BENCHMARK_COHORTS.filter((cohort) => selected.has(cohort.key));
  if (cohorts.length === 0) fail(scope, "PRICING_BENCHMARK_COHORTS did not match any cohort keys.");
  return cohorts;
}

export function withSalonOverride(cohort) {
  const override = Number(process.env.PRICING_BENCHMARK_SALONS_PER_COHORT ?? "");
  if (!Number.isInteger(override) || override < 1) return cohort;
  return { ...cohort, salons: override };
}

export function requirePg() {
  try {
    return createRequire(import.meta.url)("pg");
  } catch {
    const fallbackRequire = createRequire("C:/tmp/glowbook-pg-measure/package.json");
    return fallbackRequire("pg");
  }
}

export function mb(bytes) {
  return Number((Number(bytes) / 1024 / 1024).toFixed(3));
}

export function round(value, decimals = 3) {
  return Number(Number(value).toFixed(decimals));
}
