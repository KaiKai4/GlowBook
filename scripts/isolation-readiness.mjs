import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "e2e/multi-tenant-isolation.spec.ts",
  "src/test/supabase-integration-fixtures.ts",
  "src/features/appointments/use-cases/create-appointment.rpc.test.ts",
  "src/features/platform/data/salon-overviews.rpc.test.ts",
  "docs/database-contracts.md",
  "scripts/require-staging-e2e-env.mjs",
];

const REQUIRED_E2E_TEXT = [
  "multi-tenant isolation",
  "denies direct access to another Salon employee detail",
  "denies direct access to another Salon appointment edit screen",
  "keeps Platform admin routes unavailable to a Salon owner",
  "createSalonOwnerFixture",
  "createScheduledAppointmentFixture",
  "/employees/",
  "/appointments/",
  "/admin",
];

const REQUIRED_RPC_TEXT = [
  "rejects cross-tenant customers and services",
  "rejects overlapping bookings for the same employee",
  "platform_salon_overviews RPC grants",
  "denies authenticated salon users",
];

const REQUIRED_CONTRACT_TEXT = [
  "Scale Readiness Evidence 2026-06-01",
  "tenant isolation through RLS",
  "Platform-only access",
  "create_appointment(payload jsonb)",
  "The deployed staging E2E pass is still a separate launch-wide gate",
];

const REQUIRED_STAGING_GUARD_TEXT = [
  "Set GLOWBOOK_ENV=staging before running staging E2E",
  "E2E_BASE_URL must point to the deployed staging URL, not localhost",
  "Refusing to run staging E2E against PRODUCTION_SUPABASE_URL",
  "assertDeployedSupabaseMatches",
];

/** @param {string} message */
function fail(message) {
  console.error(`[isolation-readiness] ${message}`);
  process.exitCode = 1;
}

/** @param {string} message */
function pass(message) {
  console.log(`[isolation-readiness] OK ${message}`);
}

/** @param {string} path */
function read(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** @param {string} label @param {string} content @param {string[]} requiredTexts */
function requireText(label, content, requiredTexts) {
  for (const text of requiredTexts) {
    if (content.includes(text)) {
      pass(`${label} contains: ${text}`);
    } else {
      fail(`${label} missing: ${text}`);
    }
  }
}

for (const file of REQUIRED_FILES) {
  if (existsSync(join(process.cwd(), file))) {
    pass(`${file} exists`);
  } else {
    fail(`${file} is missing`);
  }
}

const e2eSpec = existsSync(join(process.cwd(), "e2e/multi-tenant-isolation.spec.ts"))
  ? read("e2e/multi-tenant-isolation.spec.ts")
  : "";
const appointmentRpc = existsSync(join(process.cwd(), "src/features/appointments/use-cases/create-appointment.rpc.test.ts"))
  ? read("src/features/appointments/use-cases/create-appointment.rpc.test.ts")
  : "";
const platformRpc = existsSync(join(process.cwd(), "src/features/platform/data/salon-overviews.rpc.test.ts"))
  ? read("src/features/platform/data/salon-overviews.rpc.test.ts")
  : "";
const databaseContracts = existsSync(join(process.cwd(), "docs/database-contracts.md"))
  ? read("docs/database-contracts.md")
  : "";
const stagingGuard = existsSync(join(process.cwd(), "scripts/require-staging-e2e-env.mjs"))
  ? read("scripts/require-staging-e2e-env.mjs")
  : "";

requireText("multi-tenant E2E", e2eSpec, REQUIRED_E2E_TEXT);
requireText("appointment RPC", appointmentRpc, REQUIRED_RPC_TEXT.slice(0, 2));
requireText("platform RPC", platformRpc, REQUIRED_RPC_TEXT.slice(2));
requireText("database contracts", databaseContracts, REQUIRED_CONTRACT_TEXT);
requireText("staging E2E guard", stagingGuard, REQUIRED_STAGING_GUARD_TEXT);

if (process.exitCode) {
  console.log("[isolation-readiness] Isolation readiness failed.");
  process.exit(process.exitCode);
}

console.log("[isolation-readiness] Isolation readiness passed.");
