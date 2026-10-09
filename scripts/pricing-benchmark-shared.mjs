import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const BENCHMARK_COHORTS = [
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

function loadEnvFileIfPresent() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=").replace(/^"|"$/g, "");
  }
}

/** @param {string} value */
function normalizeUrl(value) {
  return value.replace(/\/+$/, "").toLowerCase();
}

/** @param {string} scope @param {string} message @returns {never} */
export function fail(scope, message) {
  console.error(`[${scope}] ${message}`);
  process.exit(1);
}

/**
 * Contraseña de los usuarios de benchmark. Se lee de GLOWBOOK_BENCHMARK_PASSWORD:
 * no hay contraseña literal en el código.
 * @param {string} scope
 * @returns {string}
 */
export function requireBenchmarkPassword(scope) {
  loadEnvFileIfPresent();
  const password = process.env.GLOWBOOK_BENCHMARK_PASSWORD;
  if (!password) {
    fail(scope, "Define GLOWBOOK_BENCHMARK_PASSWORD con la contraseña de los usuarios de benchmark.");
  }
  return password;
}

/** @param {string} scope */
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

/**
 * Contraseña común de los usuarios de benchmark. Se lee del entorno (nunca
 * literal en el código) y falla con un mensaje claro si no está definida.
 */

/** @param {string} batchId @param {string} scope */
export function assertBenchmarkBatchId(scope, batchId) {
  const prefix = `${BENCHMARK_BATCH_PREFIX}-`;
  if (!batchId.startsWith(prefix) || !/^[a-zA-Z0-9-]+$/.test(batchId.slice(prefix.length))) {
    fail(
      scope,
      `Batch id must start with '${BENCHMARK_BATCH_PREFIX}-' and contain only letters, numbers and hyphens.`
    );
  }
}

/** @param {string} batchId @param {string} cohortKey */
function cohortEmailPrefix(batchId, cohortKey) {
  return `glowbook.${batchId}.${cohortKey.toLowerCase()}`;
}

/** @param {string} batchId @param {string} cohortKey @param {number} salonIndex */
export function ownerEmailFor(batchId, cohortKey, salonIndex) {
  return `${cohortEmailPrefix(batchId, cohortKey)}.owner.${salonIndex}.0@example.com`;
}

/** @param {string} batchId @param {string} cohortKey @param {number} salonIndex @param {number} employeeIndex */
export function employeeEmailFor(batchId, cohortKey, salonIndex, employeeIndex) {
  return `${cohortEmailPrefix(batchId, cohortKey)}.employee.${salonIndex}.${employeeIndex}@example.com`;
}

/** @param {string} scope */
export function getSelectedCohorts(scope) {
  const raw = process.env.PRICING_BENCHMARK_COHORTS;
  if (!raw) return BENCHMARK_COHORTS;
  const selected = new Set(raw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean));
  const cohorts = BENCHMARK_COHORTS.filter((cohort) => selected.has(cohort.key));
  if (cohorts.length === 0) fail(scope, "PRICING_BENCHMARK_COHORTS did not match any cohort keys.");
  return cohorts;
}

/**
 * @template {{ salons: number }} T
 * @param {T} cohort
 * @returns {T}
 */
export function withSalonOverride(cohort) {
  const override = Number(process.env.PRICING_BENCHMARK_SALONS_PER_COHORT ?? "");
  if (!Number.isInteger(override) || override < 1) return cohort;
  return { ...cohort, salons: override };
}

/** @param {number} bytes */
export function mb(bytes) {
  return Number((Number(bytes) / 1024 / 1024).toFixed(3));
}

/** @param {number | string} value */
export function round(value, decimals = 3) {
  return Number(Number(value).toFixed(decimals));
}
