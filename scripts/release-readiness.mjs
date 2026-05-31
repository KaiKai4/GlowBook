import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

function normalizeUrl(value = "") {
  return value.replace(/\/+$/, "").toLowerCase();
}

function envPresent(name) {
  const value = process.env[name];
  if (!value) return false;
  if (/^(PASTE|YOUR|TU)[A-Z0-9_-]*_/i.test(value)) return false;
  if (value.includes("your-") || value.includes("here")) return false;
  return true;
}

function envEquals(name, expected) {
  return String(process.env[name] ?? "").toLowerCase() === expected;
}

function docExists(path) {
  return existsSync(join(process.cwd(), path));
}

const checks = [];

function addCheck(phase, status, message) {
  checks.push({ phase, status, message });
}

function requireEnv(phase, name) {
  if (envPresent(name)) {
    addCheck(phase, "ok", `${name} is set`);
    return true;
  }

  addCheck(phase, "block", `${name} is missing`);
  return false;
}

function requireConfirmation(phase, name, reason) {
  if (envEquals(name, "true")) {
    addCheck(phase, "ok", `${name}=true`);
    return true;
  }

  addCheck(phase, "block", `${name}=true required after ${reason}`);
  return false;
}

loadEnvFileIfPresent();

const expectedDocs = [
  "docs/architecture-audit-2026-05-31.md",
  "docs/architecture-audit-phases-2026-05-31.md",
  "docs/production-readiness-checklist.md",
  "docs/release-readiness-2026-05-31.md",
  "docs/runbooks/deploy.md",
  "docs/runbooks/database-restore.md",
  "docs/runbooks/load-smoke-5-salons.md",
  "docs/launch-support.md",
];

for (const doc of expectedDocs) {
  addCheck("docs", docExists(doc) ? "ok" : "block", `${doc} ${docExists(doc) ? "exists" : "is missing"}`);
}

const phase37 = "phase 37 staging";
if (envEquals("GLOWBOOK_ENV", "staging")) {
  addCheck(phase37, "ok", "GLOWBOOK_ENV=staging");
} else {
  addCheck(phase37, "block", "GLOWBOOK_ENV=staging is required");
}

requireEnv(phase37, "APP_URL");
requireEnv(phase37, "E2E_BASE_URL");
requireEnv(phase37, "NEXT_PUBLIC_SUPABASE_URL");
requireEnv(phase37, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
requireEnv(phase37, "PRODUCTION_SUPABASE_URL");

const hasServiceRole = envPresent("SUPABASE_SERVICE_ROLE_KEY");
const hasManualOwner = envPresent("E2E_SALON_OWNER_EMAIL") && envPresent("E2E_SALON_OWNER_PASSWORD");
const hasManualPlatformAdmin =
  envPresent("E2E_PLATFORM_ADMIN_EMAIL") && envPresent("E2E_PLATFORM_ADMIN_PASSWORD");

if (hasServiceRole || (hasManualOwner && hasManualPlatformAdmin)) {
  addCheck(phase37, "ok", "E2E credentials are available");
} else {
  addCheck(
    phase37,
    "block",
    "SUPABASE_SERVICE_ROLE_KEY or both manual E2E credential pairs are required"
  );
}

if (
  envPresent("NEXT_PUBLIC_SUPABASE_URL") &&
  envPresent("PRODUCTION_SUPABASE_URL") &&
  normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ===
    normalizeUrl(process.env.PRODUCTION_SUPABASE_URL)
) {
  addCheck(phase37, "block", "staging Supabase URL matches PRODUCTION_SUPABASE_URL");
}

requireConfirmation("phase 37 staging", "RELEASE_STAGING_E2E_CONFIRMED", "staging E2E passed");
requireConfirmation("phase 38 restore", "RELEASE_RESTORE_CONFIRMED", "a restore test passed");
requireConfirmation("phase 39 smoke", "RELEASE_SMOKE_5_SALONS_CONFIRMED", "5-salon smoke passed and cleanup/restore completed");
requireConfirmation("phase 40 performance", "RELEASE_SUPABASE_LOG_REVIEW_CONFIRMED", "Supabase logs/performance were reviewed");
requireConfirmation("phase 41 observability", "RELEASE_OBSERVABILITY_CONFIRMED", "hosting logs or log drain were verified");
requireConfirmation("phase 45 support", "RELEASE_SUPPORT_OWNER_CONFIRMED", "launch support owner was assigned");

console.log("GlowBook Release Readiness");
console.log(new Date().toISOString());
console.log("");

for (const item of checks) {
  const prefix = item.status === "ok" ? "[OK]" : "[BLOCK]";
  console.log(`${prefix} ${item.phase}: ${item.message}`);
}

const blocked = checks.filter((item) => item.status === "block");
console.log("");
console.log(`Summary: ${checks.length - blocked.length} ok, ${blocked.length} blocked`);

if (blocked.length > 0) {
  console.log("Release decision: do not launch yet.");
  process.exit(1);
}

console.log("Release decision: launch gate passed.");
