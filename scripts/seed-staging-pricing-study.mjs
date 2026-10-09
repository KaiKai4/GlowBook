import { createClient } from "@supabase/supabase-js";
import { assertSafeTargetOrExit, readConfirmFlag } from "./lib/target-guard.mjs";
import { PAYMENT_METHODS, SALON_BLUEPRINTS } from "./lib/pricing-study-catalog.mjs";
import {
  buildBusinessHourRows,
  buildCategoryRows,
  buildCustomerRows,
  buildEmployeeCategoryRows,
  buildEmployeeRows,
  buildEmployeeServiceRows,
  buildServiceRows,
  buildWorkScheduleRows,
} from "./lib/pricing-study-rows.mjs";
import {
  buildAppointmentRows,
  buildExpenseRows,
  buildInitialMovementRows,
  buildProductRows,
  buildPurchaseRows,
  buildRetailSaleRows,
  buildStockLocationRows,
} from "./lib/pricing-study-activity.mjs";
import { assertNotProductionUrl, assertSeedEnvironment, chunk, emailFor, loadEnvFileIfPresent, readAppEnv } from "./seed-common.mjs";

/**
 * @typedef {import("./types/seeds.d.cts").DbRow} DbRow
 * @typedef {import("./types/seeds.d.cts").ServiceRow} ServiceRow
 * @typedef {import("./types/seeds.d.cts").ProductRow} ProductRow
 * @typedef {{ tables: Record<string, { rows: number, jsonBytes: number }>, authUsers: number, owners: { salon: string, email: string }[], batchId: string, password: string }} StudySummary
 */

const PASSWORD = "GlowBookPricing123!";

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[seed-pricing-study] ${message}`);
  process.exit(1);
}

/** @param {string} batchId */
function assertSafeBatchId(batchId) {
  if (!/^pricing-[a-zA-Z0-9-]+$/.test(batchId)) {
    fail("PRICING_STUDY_BATCH_ID must start with 'pricing-' and contain only letters, numbers and hyphens.");
  }
}

/** @param {{ tables: Record<string, { rows: number, jsonBytes: number }> }} summary @param {string} table @param {unknown[]} rows @returns {void} */
function addPayloadBytes(summary, table, rows) {
  if (!summary.tables[table]) summary.tables[table] = { rows: 0, jsonBytes: 0 };
  summary.tables[table].rows += rows.length;
  summary.tables[table].jsonBytes += Buffer.byteLength(JSON.stringify(rows), "utf8");
}

/** @param {import("@supabase/supabase-js").SupabaseClient} admin @param {string} table @param {unknown[]} rows @param {{ tables: Record<string, { rows: number, jsonBytes: number }> }} summary @param {string} [select] @returns {Promise<DbRow[]>} */
async function insertRows(admin, table, rows, summary, select = undefined) {
  if (rows.length === 0) return [];
  addPayloadBytes(summary, table, rows);

  /** @type {DbRow[]} */
  const inserted = [];
  for (const group of chunk(rows)) {
    const insertQuery = admin.from(table).insert(group);
    const query = select ? insertQuery.select(select) : insertQuery;
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data) inserted.push(.../** @type {DbRow[]} */ (/** @type {unknown} */ (data)));
  }

  return inserted;
}

loadEnvFileIfPresent();

const appEnv = readAppEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const confirm = process.env.PRICING_STUDY_CONFIRM;
const batchId = process.env.PRICING_STUDY_BATCH_ID ?? `pricing-${Date.now()}`;

assertSafeBatchId(batchId);

assertSeedEnvironment({ appEnv, allowLocal: process.env.PRICING_STUDY_ALLOW_LOCAL === "true", allowLocalFlag: "PRICING_STUDY_ALLOW_LOCAL", fail });
if (!supabaseUrl || !serviceRoleKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
assertNotProductionUrl({ supabaseUrl, productionSupabaseUrl, fail });
if (confirm !== "seed-pricing-study") {
  fail("Set PRICING_STUDY_CONFIRM=seed-pricing-study to create persistent staging pricing data.");
}

assertSafeTargetOrExit("seed-staging-pricing-study", {
  url: supabaseUrl,
  env: process.env.GLOWBOOK_ENV ?? process.env.APP_ENV ?? process.env.VERCEL_ENV,
  confirmFlag: readConfirmFlag(process.argv),
  productionUrl: process.env.PRODUCTION_SUPABASE_URL,
});
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** @type {StudySummary} */
const summary = {
  batchId,
  password: PASSWORD,
  owners: [],
  tables: {},
  authUsers: 0,
};

console.log(`[seed-pricing-study] Creating batch ${batchId} in staging.`);

for (let salonIndex = 1; salonIndex <= SALON_BLUEPRINTS.length; salonIndex += 1) {
  const salonBlueprint = SALON_BLUEPRINTS[salonIndex - 1];
  const ownerEmail = emailFor(batchId, "owner", salonIndex);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { seed_batch: batchId, seed_kind: "pricing-study" },
  });
  if (authError || !authData.user) throw authError ?? new Error("Owner Auth user was not created.");

  const ownerId = authData.user.id;
  summary.authUsers += 1;
  summary.owners.push({ salon: salonBlueprint.name, email: ownerEmail });

  const salons = await insertRows(
    admin,
    "salons",
    [
      {
        name: salonBlueprint.name,
        email: ownerEmail,
        phone: `60${String(salonIndex).padStart(6, "0")}`,
        address: `Local ${salonIndex}, Ciudad de Panama`,
        timezone: "America/Panama",
        theme: salonBlueprint.theme,
        primary_color: salonBlueprint.primaryColor,
        secondary_color: "#A78BFA",
        bg_style: "neutral",
        card_style: "soft",
        sidebar_style: "clean",
        disabled_features: [],
        payment_methods: PAYMENT_METHODS,
        min_booking_notice_minutes: 0,
        min_appointment_duration_minutes: 15,
        allow_off_hours_bookings: false,
        is_active: true,
      },
    ],
    summary,
    "id"
  );
  const salonId = salons[0].id;

  await insertRows(admin, "profiles", [
    {
      id: ownerId,
      salon_id: salonId,
      full_name: `Owner ${salonBlueprint.name}`,
      is_owner: true,
      is_active: true,
    },
  ], summary);

  await insertRows(admin, "salon_business_hours", buildBusinessHourRows(salonId), summary);

  const categories = await insertRows(admin, "service_categories", buildCategoryRows(salonId), summary, "id, name");

  const services = /** @type {ServiceRow[]} */ (await insertRows(
    admin,
    "services",
    buildServiceRows(salonId, categories, salonIndex),
    summary,
    "id, category_id, duration_minutes, price, name"
  ));

  const employees = await insertRows(admin, "employees", buildEmployeeRows(salonId, batchId, salonIndex), summary, "id");

  await insertRows(admin, "employee_services", buildEmployeeServiceRows(salonId, employees, services), summary);
  await insertRows(admin, "employee_categories", buildEmployeeCategoryRows(salonId, employees, categories), summary);
  await insertRows(admin, "work_schedules", buildWorkScheduleRows(salonId, employees), summary);

  const customers = await insertRows(admin, "customers", buildCustomerRows(salonId, batchId, salonIndex), summary, "id");

  const { appointments, appointmentItems } = buildAppointmentRows({ salonId, ownerId, salonIndex, services, employees, customers });
  await insertRows(admin, "appointments", appointments, summary);
  await insertRows(admin, "appointment_items", appointmentItems, summary);

  const products = /** @type {ProductRow[]} */ (await insertRows(
    admin,
    "inventory_products",
    buildProductRows(salonId, salonIndex),
    summary,
    "id, cost_price, sale_price, name"
  ));

  await insertRows(admin, "inventory_stock_locations", buildStockLocationRows(salonId, products, salonIndex), summary);
  await insertRows(admin, "inventory_movements", buildInitialMovementRows(salonId, products, salonIndex, batchId), summary);

  const purchases = buildPurchaseRows(salonId, products, salonIndex);
  await insertRows(admin, "inventory_purchases", purchases.purchases, summary);
  await insertRows(admin, "inventory_purchase_items", purchases.purchaseItems, summary);

  const retail = buildRetailSaleRows(salonId, products, customers, salonIndex);
  await insertRows(admin, "retail_sales", retail.retailSales, summary);
  await insertRows(admin, "retail_sale_items", retail.retailSaleItems, summary);

  await insertRows(admin, "expenses", buildExpenseRows(salonId, salonIndex), summary);
}

const totalJsonBytes = Object.values(summary.tables).reduce((total, table) => total + table.jsonBytes, 0);
const estimatedSupabaseBytes = Math.round(totalJsonBytes * 1.65);

console.log("[seed-pricing-study] Done.");
console.log(
  JSON.stringify(
    {
      batchId: summary.batchId,
      password: summary.password,
      owners: summary.owners,
      authUsers: summary.authUsers,
      tables: summary.tables,
      totals: {
        jsonPayloadBytes: totalJsonBytes,
        jsonPayloadMB: Number((totalJsonBytes / 1024 / 1024).toFixed(3)),
        estimatedSupabaseStorageBytes: estimatedSupabaseBytes,
        estimatedSupabaseStorageMB: Number((estimatedSupabaseBytes / 1024 / 1024).toFixed(3)),
      },
      note: "Storage is estimated from inserted JSON payload plus a conservative database-overhead factor. Exact project DB size requires Supabase database metrics or a direct Postgres connection.",
    },
    null,
    2
  )
);
