import { normalizeUrl } from "./lib/url.mjs";
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

function isLocalUrl(value = "") {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/** @param {string} name */
function envPresent(name) {
  const value = process.env[name];
  if (!value) return false;
  if (/^(PASTE|YOUR|TU)[A-Z0-9_-]*_/i.test(value)) return false;
  if (value.includes("your-") || value.includes("here")) return false;
  return true;
}

/** @param {string} name @param {string} expected */
function envEquals(name, expected) {
  return String(process.env[name] ?? "").toLowerCase() === expected;
}

/** @param {string} path */
function docExists(path) {
  return existsSync(join(process.cwd(), path));
}

/** @type {{ phase: string, status: string, message: string }[]} */
const checks = [];

/** @param {string} message @param {string} phase @param {string} status */
function addCheck(phase, status, message) {
  checks.push({ phase, status, message });
}

/** @param {string} name @param {string} phase */
function requireEnv(phase, name) {
  if (envPresent(name)) {
    addCheck(phase, "ok", `${name} is set`);
    return true;
  }

  addCheck(phase, "block", `${name} is missing`);
  return false;
}

/** @param {string} name @param {string} phase @param {string} reason */
function requireConfirmation(phase, name, reason) {
  if (envEquals(name, "true")) {
    addCheck(phase, "ok", `${name}=true`);
    return true;
  }

  addCheck(phase, "block", `${name}=true required after ${reason}`);
  return false;
}

function requireApprovedStage() {
  const value = String(process.env.GLOWBOOK_SCALE_DECISION_APPROVED_STAGE ?? "").toLowerCase();
  const allowedStages = ["pilot", "growth", "controlled-growth", "broad-launch"];

  if (allowedStages.includes(value)) {
    addCheck("release decision", "ok", `approved stage: ${value}`);
    return value;
  }

  addCheck(
    "release decision",
    "block",
    "GLOWBOOK_SCALE_DECISION_APPROVED_STAGE must be one of: pilot, growth, controlled-growth, broad-launch"
  );
  return "unconfirmed";
}

/** @param {string} phase @param {string} scriptPath @param {string} successMessage */
function runNodeGate(phase, scriptPath, successMessage) {
  if (!docExists(scriptPath)) {
    addCheck(phase, "block", `${scriptPath} is missing`);
    return false;
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });

  if (result.status === 0) {
    addCheck(phase, "ok", successMessage);
    return true;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" | ");

  addCheck(phase, "block", `${scriptPath} failed${output ? `: ${output}` : ""}`);
  return false;
}

loadEnvFileIfPresent();

const expectedDocs = [
  "docs/archive/architecture-history/architecture-audit-2026-06-01.md",
  "docs/archive/architecture-history/architecture-scale-phases-2026-06-01.md",
  "docs/production-scale-readiness-checklist.md",
  "docs/archive/readiness-snapshots/release-scale-readiness-2026-06-01.md",
  "docs/capacity-plan.md",
  "docs/archive/readiness-snapshots/performance-review-2026-06-01.md",
  "docs/runbooks/load-scale-salons.md",
  "docs/runbooks/vercel-staging-env.md",
  "docs/runbooks/restore.md",
  "docs/runbooks/incident.md",
  "docs/security.md",
  "docs/launch-support.md",
];

for (const doc of expectedDocs) {
  addCheck("docs", docExists(doc) ? "ok" : "block", `${doc} ${docExists(doc) ? "exists" : "is missing"}`);
}

const environment = "scale environment";
if (envEquals("GLOWBOOK_ENV", "staging")) {
  addCheck(environment, "ok", "GLOWBOOK_ENV=staging");
} else {
  addCheck(environment, "block", "GLOWBOOK_ENV=staging is required for scale readiness evidence");
}

requireEnv(environment, "APP_URL");
requireEnv(environment, "E2E_BASE_URL");
requireEnv(environment, "NEXT_PUBLIC_SUPABASE_URL");
requireEnv(environment, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
requireEnv(environment, "SUPABASE_SERVICE_ROLE_KEY");
requireEnv(environment, "PRODUCTION_SUPABASE_URL");

for (const name of ["APP_URL", "E2E_BASE_URL"]) {
  if (envPresent(name) && isLocalUrl(process.env[name])) {
    addCheck(environment, "block", `${name} must point to deployed staging, not localhost`);
  }
}

if (
  envPresent("NEXT_PUBLIC_SUPABASE_URL") &&
  envPresent("PRODUCTION_SUPABASE_URL") &&
  normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) === normalizeUrl(process.env.PRODUCTION_SUPABASE_URL)
) {
  addCheck(environment, "block", "staging Supabase URL matches PRODUCTION_SUPABASE_URL");
}

runNodeGate(
  "phase 46 baseline",
  "scripts/baseline-readiness.mjs",
  "baseline readiness gate passed"
);
runNodeGate(
  "phase 47 isolation",
  "scripts/isolation-readiness.mjs",
  "isolation readiness gate passed"
);
runNodeGate(
  "phase 47 isolation",
  "scripts/verify-deployed-staging-env.mjs",
  "deployed staging environment matches configured Supabase"
);
runNodeGate(
  "phase 48 dataset",
  "scripts/dataset-readiness.mjs",
  "dataset readiness gate passed"
);
runNodeGate(
  "phase 49 performance",
  "scripts/performance-readiness.mjs",
  "performance readiness gate passed"
);
runNodeGate(
  "phase 50 observability",
  "scripts/observability-readiness.mjs",
  "observability readiness gate passed"
);
runNodeGate(
  "phase 51 capacity",
  "scripts/capacity-readiness.mjs",
  "capacity readiness gate passed"
);
runNodeGate(
  "phase 52 restore",
  "scripts/restore-readiness.mjs",
  "restore readiness gate passed"
);
runNodeGate(
  "phase 53 security",
  "scripts/rate-limit-readiness.mjs",
  "rate limit readiness gate passed"
);
runNodeGate(
  "phase 53 security",
  "scripts/security-readiness.mjs",
  "security readiness gate passed"
);
runNodeGate(
  "phase 54 support",
  "scripts/support-readiness.mjs",
  "support readiness gate passed"
);
runNodeGate(
  "phase 55 reminders",
  "scripts/reminders-readiness.mjs",
  "reminders readiness gate passed"
);

requireConfirmation("phase 46 baseline", "SCALE_BASELINE_CONFIRMED", "national release baseline was reviewed");
requireConfirmation("phase 47 isolation", "SCALE_ISOLATION_CONFIRMED", "multi-tenant negative tests passed against staging");
requireConfirmation("phase 48 dataset", "SCALE_DATASET_CONFIRMED", "scale dataset was seeded and cleaned");
requireConfirmation("phase 49 performance", "SCALE_PERFORMANCE_CONFIRMED", "performance review with scale data was completed");
requireConfirmation("phase 50 observability", "SCALE_OBSERVABILITY_CONFIRMED", "log drain/error tracking and alerts were verified");
requireConfirmation("phase 51 capacity", "SCALE_CAPACITY_CONFIRMED", "Supabase/Vercel capacity plan was reviewed");
requireConfirmation("phase 52 restore", "SCALE_RESTORE_CONFIRMED", "large dataset restore was tested");
requireConfirmation("phase 53 security", "SCALE_SECURITY_CONFIRMED", "rate limits/CSP/secrets decision was reviewed");
requireConfirmation("phase 54 support", "SCALE_SUPPORT_CONFIRMED", "incident support runbook and owner were reviewed");
requireConfirmation("phase 55 reminders", "SCALE_REMINDERS_DECISION_CONFIRMED", "automatic reminders decision was reviewed");
const approvedStage = requireApprovedStage();

console.log("GlowBook Scale Release Readiness");
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
  console.log("Scale release decision: do not launch broadly yet.");
  process.exit(1);
}

if (approvedStage === "broad-launch") {
  console.log("Scale release decision: broad launch gate passed.");
} else {
  console.log(`Scale release decision: ${approvedStage} gate passed; broad launch remains a separate upgrade decision.`);
}
