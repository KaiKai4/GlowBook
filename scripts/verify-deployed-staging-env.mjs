import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

function isLocalUrl(value = "") {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function normalizeUrl(value = "") {
  return value.replace(/\/+$/, "").toLowerCase();
}

function fail(message) {
  console.error(`[verify-deployed-staging-env] ${message}`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Set ${name}.`);
  return value;
}

loadEnvFileIfPresent();

const appEnv = (process.env.GLOWBOOK_ENV ?? "").toLowerCase();
const baseUrl = process.env.E2E_BASE_URL ?? process.env.APP_URL;
const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const productionSupabaseUrl = requireEnv("PRODUCTION_SUPABASE_URL");

if (appEnv !== "staging") {
  fail("Set GLOWBOOK_ENV=staging.");
}

if (!baseUrl) {
  fail("Set E2E_BASE_URL or APP_URL to the deployed staging URL.");
}

if (isLocalUrl(baseUrl)) {
  fail("E2E_BASE_URL or APP_URL must point to deployed staging, not localhost.");
}

if (normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)) {
  fail("NEXT_PUBLIC_SUPABASE_URL matches PRODUCTION_SUPABASE_URL.");
}

try {
  const deployedUrls = await assertDeployedSupabaseMatches({
    baseUrl,
    expectedUrl: supabaseUrl,
  });

  console.log("[verify-deployed-staging-env] OK");
  console.log(`Deployment: ${new URL(baseUrl).hostname}`);
  console.log(`Supabase: ${new URL(deployedUrls[0]).hostname}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
