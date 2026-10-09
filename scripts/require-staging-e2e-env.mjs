import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { assertDeployedSupabaseMatches } from "./deployed-supabase-check.mjs";

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

/** @param {string} value @returns {string} */
function normalizeUrl(value) {
  return value.replace(/\/+$/, "").toLowerCase();
}

/** @param {string} value @returns {boolean} */
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
  console.error(`[staging-e2e] ${message}`);
  process.exit(1);
}

loadEnvFileIfPresent();

const appEnv = (
  process.env.GLOWBOOK_ENV ??
  process.env.APP_ENV ??
  process.env.VERCEL_ENV ??
  ""
).toLowerCase();
const baseUrl = process.env.E2E_BASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const hasManualOwner = Boolean(
  process.env.E2E_SALON_OWNER_EMAIL && process.env.E2E_SALON_OWNER_PASSWORD
);
const hasManualPlatformAdmin = Boolean(
  process.env.E2E_PLATFORM_ADMIN_EMAIL && process.env.E2E_PLATFORM_ADMIN_PASSWORD
);

if (appEnv !== "staging") {
  fail("Set GLOWBOOK_ENV=staging before running staging E2E.");
}

if (!baseUrl) {
  fail("Set E2E_BASE_URL to the deployed staging URL.");
}

if (isLocalUrl(baseUrl)) {
  fail("E2E_BASE_URL must point to the deployed staging URL, not localhost.");
}

if (!supabaseUrl || !anonKey) {
  fail("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for staging.");
}

if (!serviceRoleKey && (!hasManualOwner || !hasManualPlatformAdmin)) {
  fail("Provide SUPABASE_SERVICE_ROLE_KEY for temporary fixtures or both manual E2E credential pairs.");
}

if (
  productionSupabaseUrl &&
  normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)
) {
  fail("Refusing to run staging E2E against PRODUCTION_SUPABASE_URL.");
}

console.log("[staging-e2e] Environment guard passed.");

try {
  const deployedUrls = await assertDeployedSupabaseMatches({
    baseUrl,
    expectedUrl: supabaseUrl,
  });
  console.log(
    `[staging-e2e] Deployed Supabase host verified: ${new URL(deployedUrls[0]).hostname}`
  );
} catch (error) {
  console.error(`[staging-e2e] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCommand, ["playwright", "test"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`[staging-e2e] Failed to start Playwright: ${result.error.message}`);
}

if (result.status !== 0) {
  console.error(`[staging-e2e] Playwright exited with status ${result.status ?? "unknown"}.`);
}

process.exit(result.status ?? 1);
