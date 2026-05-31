import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCommand, ["playwright", "test"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
