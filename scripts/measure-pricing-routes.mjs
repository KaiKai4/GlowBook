import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { assertDeployedSupabaseMatches } from "./deployed-supabase-check.mjs";
import {
  requireBenchmarkPassword,
  assertBenchmarkBatchId,
  assertStagingEnvironment,
  fail,
  mb,
  ownerEmailFor,
} from "./pricing-benchmark-shared.mjs";

const SCOPE = "measure-pricing-routes";

const ROUTES = [
  { key: "dashboard", path: "/" },
  { key: "calendar_daily", path: "/appointments?view=diaria" },
  { key: "calendar_weekly", path: "/appointments?view=semanal" },
  { key: "calendar_employee", path: "/appointments?view=trabajador" },
  { key: "new_appointment", path: "/appointments/new" },
  { key: "reminders", path: "/reminders" },
  { key: "customers", path: "/customers" },
  { key: "employees", path: "/employees" },
  { key: "services", path: "/services" },
  { key: "retail", path: "/storefront" },
  { key: "inventory", path: "/inventory" },
  { key: "expenses", path: "/expenses" },
  { key: "reports_summary", path: "/reports" },
  { key: "reports_finance", path: "/reports?tab=finanzas" },
  { key: "reports_appointments", path: "/reports?tab=citas" },
  { key: "reports_inventory", path: "/reports?tab=inventario" },
  { key: "reports_expenses", path: "/reports?tab=gastos" },
];

/** @param {string} value */
function isLocalUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function bypassHeaders() {
  if (!process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return undefined;
  return {
    "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    "x-vercel-set-bypass-cookie": "true",
  };
}

/** @param {import("@playwright/test").Page} page @param {string} email @param {string} password */
async function login(page, email, password) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Contrase/i).fill(password);
  await page.getByRole("button", { name: /Iniciar/i }).click();
  await page.waitForFunction(() => !window.location.pathname.endsWith("/login"), undefined, {
    timeout: 30_000,
  });
}

/** @param {import("@playwright/test").Page} page */
async function routeTransferBytes(page) {
  return page.evaluate(() =>
    /** @type {PerformanceResourceTiming[]} */ (performance.getEntriesByType("resource"))
      .reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0)
  );
}

/** @param {import("@playwright/test").Page} page @param {{ key: string, path: string }} route */
async function measureRoute(page, route) {
  await page.evaluate(() => {
    performance.clearResourceTimings();
    performance.clearMarks();
    performance.clearMeasures();
  });

  const startedAt = Date.now();
  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await page.locator("main, h1, h2").first().waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  const transferBytes = await routeTransferBytes(page);

  return {
    route: route.key,
    path: route.path,
    status: response?.status() ?? 0,
    durationMs: Date.now() - startedAt,
    transferBytes,
    transferMB: mb(transferBytes),
  };
}

assertStagingEnvironment(SCOPE);

const baseUrl = process.env.E2E_BASE_URL ?? process.env.APP_URL;
if (!baseUrl) fail(SCOPE, "Set E2E_BASE_URL or APP_URL.");
if (isLocalUrl(baseUrl)) fail(SCOPE, "Measure against deployed staging, not localhost.");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) fail(SCOPE, "Set SUPABASE_SERVICE_ROLE_KEY.");
if (!supabaseUrl) fail(SCOPE, "Set NEXT_PUBLIC_SUPABASE_URL.");

const batchId = process.env.PRICING_BENCHMARK_BATCH_ID;
if (!batchId) fail(SCOPE, "Set PRICING_BENCHMARK_BATCH_ID.");
assertBenchmarkBatchId(SCOPE, batchId);

if (process.env.PRICING_ROUTES_CONFIRM !== "measure-pricing-routes") {
  fail(SCOPE, "Set PRICING_ROUTES_CONFIRM=measure-pricing-routes to measure deployed staging routes.");
}

try {
  const deployedUrls = await assertDeployedSupabaseMatches({ baseUrl, expectedUrl: supabaseUrl });
  console.log(`[${SCOPE}] Deployed Supabase host verified: ${new URL(deployedUrls[0]).hostname}`);
} catch (error) {
  fail(SCOPE, error instanceof Error ? error.message : String(error));
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: salons, error: salonsError } = await admin
  .from("salons")
  .select("name, email")
  .like("email", `glowbook.${batchId}.%.owner.%@example.com`)
  .order("name");
if (salonsError) throw salonsError;
if (salons.length === 0) fail(SCOPE, `No benchmark salons found for ${batchId}.`);

const cohorts = ["A", "B", "C", "D", "E"]
  .map((cohort) => {
    const salon = salons.find((item) => item.name.startsWith(`Benchmark ${cohort} - `));
    return salon ? { cohort, email: salon.email } : null;
  })
  .filter((entry) => entry !== null);

const browser = await chromium.launch();
/**
 * @typedef {{ cohort: string, route: string, path: string, status: number, durationMs: number | null, transferBytes: number, transferMB: number, error?: string }} RouteResult
 */

const BENCHMARK_PASSWORD = requireBenchmarkPassword("measure-pricing-routes");

/** @type {RouteResult[]} */
const results = [];

try {
  for (const cohort of cohorts) {
    const context = await browser.newContext({
      baseURL: baseUrl,
      extraHTTPHeaders: bypassHeaders(),
    });
    const page = await context.newPage();
    await login(page, cohort.email ?? ownerEmailFor(batchId, cohort.cohort, 1), BENCHMARK_PASSWORD);

    for (const route of ROUTES) {
      try {
        results.push({ cohort: cohort.cohort, ...(await measureRoute(page, route)) });
      } catch (error) {
        results.push({
          cohort: cohort.cohort,
          route: route.key,
          path: route.path,
          status: 0,
          durationMs: null,
          transferBytes: 0,
          transferMB: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

/** @type {Record<string, { route: string, samples: number, totalDurationMs: number, totalTransferBytes: number, failures: number }>} */
const routeAccumulators = results.reduce((acc, row) => {
    acc[row.route] ??= { route: row.route, samples: 0, totalDurationMs: 0, totalTransferBytes: 0, failures: 0 };
    acc[row.route].samples += 1;
    acc[row.route].totalDurationMs += row.durationMs ?? 0;
    acc[row.route].totalTransferBytes += row.transferBytes ?? 0;
    if (row.status >= 500 || row.status === 0) acc[row.route].failures += 1;
    return acc;
  }, /** @type {Record<string, { route: string, samples: number, totalDurationMs: number, totalTransferBytes: number, failures: number }>} */ ({}));

const byRoute = Object.values(routeAccumulators).map((row) => ({
  route: row.route,
  samples: row.samples,
  avgDurationMs: row.samples ? Math.round(row.totalDurationMs / row.samples) : 0,
  avgTransferMB: row.samples ? mb(row.totalTransferBytes / row.samples) : 0,
  failures: row.failures,
}));

const output = {
  runId: randomUUID(),
  batchId,
  baseUrl,
  measuredAt: new Date().toISOString(),
  results,
  byRoute: byRoute.sort((a, b) => b.avgTransferMB - a.avgTransferMB),
};

console.log(JSON.stringify(output, null, 2));

if (process.env.PRICING_ROUTES_OUTPUT) {
  writeFileSync(process.env.PRICING_ROUTES_OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
}

if (results.some((row) => row.status >= 500 || row.status === 0)) {
  process.exitCode = 1;
}
