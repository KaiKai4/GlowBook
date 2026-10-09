import { normalizeUrl } from "./lib/url.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { assertDeployedSupabaseMatches } from "./deployed-supabase-check.mjs";

const OWNER_ROUTES = [
  "/",
  "/appointments",
  "/appointments/new",
  "/customers",
  "/employees",
  "/services",
  "/reports",
];

const PLATFORM_ROUTES = ["/admin", "/admin/salons", "/admin/audit"];

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

/** @param {string} value */
function isLocalUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[measure-scale-routes] ${message}`);
  process.exit(1);
}

/** @param {string} name */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Set ${name}.`);
  return value;
}

function vercelBypassHeaders() {
  if (!process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return undefined;

  return {
    "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    "x-vercel-set-bypass-cookie": "true",
  };
}

/** @param {string} batchId @param {number} salonIndex */
function ownerEmailFor(batchId, salonIndex) {
  return `glowbook.${batchId}.owner.${salonIndex}.0@example.com`;
}

/** @param {import("@playwright/test").Page} page @param {{ email: string, password: string }} credentials */
async function login(page, credentials) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(credentials.email);
  await page.waitForTimeout(250);
  await page.getByLabel(/Contrase/i).fill(credentials.password);
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Iniciar/i }).click();

  const loginError = page.getByText(/Email o contrase/i);
  await Promise.race([
    page.waitForFunction(() => !window.location.pathname.endsWith("/login"), undefined, {
      timeout: 30_000,
    }),
    loginError.waitFor({ state: "visible", timeout: 30_000 }).then(() => {
      throw new Error(`Could not sign in as ${credentials.email}.`);
    }).catch(() => new Promise(() => {})),
  ]);
}

/** @param {import("@playwright/test").Page} page @param {string} route */
async function measureRoute(page, route) {
  const startedAt = Date.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.locator("h1, h2, main").first().waitFor({ state: "visible", timeout: 15_000 });

  return {
    route,
    status: response?.status() ?? 0,
    durationMs: Date.now() - startedAt,
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} admin @returns {Promise<{ email: string, password: string, userId: string, temporary: true }>} */
async function createTemporaryPlatformAdmin(admin) {
  const email = `glowbook.scale-perf.platform.${Date.now()}.${randomUUID()}@example.com`;
  const password = "GlowBookScale123!";

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("Platform Auth user was not created.");

  const userId = authData.user.id;

  try {
    const { error } = await admin.from("platform_admins").insert({ user_id: userId });
    if (error) throw error;
    return { email, password, userId, temporary: true };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

/** @param {import("@supabase/supabase-js").SupabaseClient} admin @param {{ email: string, password: string, temporary: false } | { email: string, password: string, temporary: true, userId: string } | null | undefined} credentials */
async function cleanupTemporaryPlatformAdmin(admin, credentials) {
  if (!credentials?.temporary) return;

  await admin.from("platform_admins").delete().eq("user_id", credentials.userId);
  await admin.auth.admin.deleteUser(credentials.userId);
}

loadEnvFileIfPresent();

const appEnv = (
  process.env.GLOWBOOK_ENV ??
  process.env.APP_ENV ??
  process.env.VERCEL_ENV ??
  ""
).toLowerCase();
const baseUrl = process.env.E2E_BASE_URL ?? process.env.APP_URL;
const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const batchId = requireEnv("SCALE_MEASURE_BATCH_ID");
const confirm = process.env.SCALE_MEASURE_CONFIRM;

if (appEnv !== "staging") {
  fail("Set GLOWBOOK_ENV=staging before measuring scale routes.");
}

if (!baseUrl) {
  fail("Set E2E_BASE_URL or APP_URL to the deployed staging URL.");
}

if (isLocalUrl(baseUrl)) {
  fail("E2E_BASE_URL or APP_URL must point to the deployed staging URL, not localhost.");
}

if (
  productionSupabaseUrl &&
  normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)
) {
  fail("Refusing to measure routes against PRODUCTION_SUPABASE_URL.");
}

if (!/^scale-[a-zA-Z0-9-]+$/.test(batchId)) {
  fail("SCALE_MEASURE_BATCH_ID must start with 'scale-' and contain only letters, numbers and hyphens.");
}

if (confirm !== "measure-scale-routes") {
  fail("Set SCALE_MEASURE_CONFIRM=measure-scale-routes to acknowledge this uses staging scale data.");
}

try {
  const deployedUrls = await assertDeployedSupabaseMatches({
    baseUrl,
    expectedUrl: supabaseUrl,
  });
  console.log(
    `[measure-scale-routes] Deployed Supabase host verified: ${new URL(deployedUrls[0]).hostname}`
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ownerCredentials = {
  email: process.env.SCALE_MEASURE_OWNER_EMAIL ?? ownerEmailFor(batchId, 1),
  password: process.env.SCALE_MEASURE_OWNER_PASSWORD ?? "GlowBookScale123!",
};

/** @type {{ email: string, password: string, temporary: false } | { email: string, password: string, temporary: true, userId: string } | null} */
let platformCredentials =
  process.env.E2E_PLATFORM_ADMIN_EMAIL && process.env.E2E_PLATFORM_ADMIN_PASSWORD
    ? {
        email: process.env.E2E_PLATFORM_ADMIN_EMAIL,
        password: process.env.E2E_PLATFORM_ADMIN_PASSWORD,
        temporary: false,
      }
    : null;

const browser = await chromium.launch();
const results = [];

try {
  if (!platformCredentials) {
    platformCredentials = await createTemporaryPlatformAdmin(admin);
  }

  const ownerContext = await browser.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: vercelBypassHeaders(),
  });
  const ownerPage = await ownerContext.newPage();
  await login(ownerPage, ownerCredentials);

  for (const route of OWNER_ROUTES) {
    results.push({ role: "salon_owner", ...(await measureRoute(ownerPage, route)) });
  }

  await ownerContext.close();

  const platformContext = await browser.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: vercelBypassHeaders(),
  });
  const platformPage = await platformContext.newPage();
  await login(platformPage, platformCredentials);

  for (const route of PLATFORM_ROUTES) {
    results.push({ role: "platform_admin", ...(await measureRoute(platformPage, route)) });
  }

  await platformContext.close();
} finally {
  await browser.close();
  await cleanupTemporaryPlatformAdmin(admin, platformCredentials);
}

const failures = results.filter((result) => result.status >= 500 || result.status === 0);

console.log(`[measure-scale-routes] Batch ${batchId}`);
console.table(results);

if (failures.length > 0) {
  console.error("[measure-scale-routes] One or more measured routes failed.");
  process.exit(1);
}
