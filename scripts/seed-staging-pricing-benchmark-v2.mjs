import { createClient } from "@supabase/supabase-js";
import { assertSafeTargetOrExit, readConfirmFlag } from "./lib/target-guard.mjs";
import { estimateRows } from "./lib/pricing-benchmark-model.mjs";
import { seedSalon } from "./lib/pricing-benchmark-salon.mjs";
import {
  BENCHMARK_BATCH_PREFIX,
  requireBenchmarkPassword,
  assertBenchmarkBatchId,
  assertStagingEnvironment,
  fail,
  getSelectedCohorts,
  withSalonOverride,
} from "./pricing-benchmark-shared.mjs";

/**
 * @typedef {import("./types/seeds.d.cts").PermissionRow} PermissionRow
 * @typedef {import("./types/seeds.d.cts").SeedSummary} SeedSummary
 */

const SCOPE = "seed-pricing-benchmark-v2";
const BENCHMARK_PASSWORD = requireBenchmarkPassword(SCOPE);
const INSERT_BATCH_SIZE = Number(process.env.PRICING_BENCHMARK_INSERT_BATCH_SIZE ?? 500);
const ALLOW_SYNTHETIC_AUTH_ON_FAILURE = process.env.PRICING_BENCHMARK_ALLOW_SYNTHETIC_AUTH_ON_FAILURE === "true";

assertStagingEnvironment(SCOPE);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) fail(SCOPE, "Set SUPABASE_SERVICE_ROLE_KEY.");
if (!supabaseUrl) fail(SCOPE, "Set NEXT_PUBLIC_SUPABASE_URL.");

const batchId = process.env.PRICING_BENCHMARK_BATCH_ID ?? `${BENCHMARK_BATCH_PREFIX}-${Date.now()}`;
assertBenchmarkBatchId(SCOPE, batchId);

const cohorts = getSelectedCohorts(SCOPE).map(withSalonOverride);
const dryRun = process.env.PRICING_BENCHMARK_DRY_RUN === "true";
const confirm = process.env.PRICING_BENCHMARK_CONFIRM;

if (dryRun) {
  console.log(JSON.stringify({ batchId, dryRun: true, cohorts: estimateRows(cohorts) }, null, 2));
  process.exit(0);
}

if (confirm !== "seed-pricing-benchmark-v2") {
  fail(SCOPE, "Set PRICING_BENCHMARK_CONFIRM=seed-pricing-benchmark-v2 to create persistent staging benchmark data.");
}

if (cohorts.some((cohort) => cohort.key === "E") && process.env.PRICING_BENCHMARK_HEAVY_CONFIRM !== "include-stress-cohort") {
  fail(SCOPE, "Cohort E is heavy. Set PRICING_BENCHMARK_HEAVY_CONFIRM=include-stress-cohort or exclude E with PRICING_BENCHMARK_COHORTS.");
}

assertSafeTargetOrExit("seed-staging-pricing-benchmark-v2", {
  url: supabaseUrl,
  env: process.env.GLOWBOOK_ENV ?? process.env.APP_ENV ?? process.env.VERCEL_ENV,
  confirmFlag: readConfirmFlag(process.argv),
  productionUrl: process.env.PRODUCTION_SUPABASE_URL,
});
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: permissions, error: permissionsError } = await admin.from("permissions").select("id, key");
if (permissionsError) throw permissionsError;

/** @type {SeedSummary} */
const summary = {
  batchId,
  password: BENCHMARK_PASSWORD,
  accounts: [],
  totalRows: 0,
  cohorts: Object.fromEntries(
    cohorts.map((cohort) => [cohort.key, { label: cohort.label, salons: 0, authUsers: 0, tables: {} }])
  ),
};

let globalSalonIndex = 0;
for (const cohort of cohorts) {
  for (let salonNumber = 1; salonNumber <= cohort.salons; salonNumber += 1) {
    globalSalonIndex += 1;
    console.log(`[${SCOPE}] Seeding cohort ${cohort.key} salon ${salonNumber}/${cohort.salons}`);
    await seedSalon({
      admin,
      cohort,
      batchId,
      salonNumber,
      globalSalonIndex,
      summary,
      permissionIds: /** @type {PermissionRow[]} */ (permissions),
      password: BENCHMARK_PASSWORD,
      allowSynthetic: ALLOW_SYNTHETIC_AUTH_ON_FAILURE,
      batchSize: INSERT_BATCH_SIZE,
    });
    summary.cohorts[cohort.key].salons += 1;
  }
}

console.log(JSON.stringify(summary, null, 2));
