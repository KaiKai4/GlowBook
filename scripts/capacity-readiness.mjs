import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_DOCS = [
  "docs/capacity-plan.md",
  "docs/performance-review-2026-06-01.md",
  "docs/production-scale-readiness-checklist.md",
  "docs/runbooks/database-restore.md",
];

const REQUIRED_CAPACITY_TEXT = [
  "Plan actual observado: Free",
  "Plan actual observado: Hobby",
  "Supabase Free no incluye automatic backups",
  "Vercel Hobby solo retiene runtime logs por 1 hora",
  "Decision recomendada antes de 100+ salones reales",
  "Fase 48 dataset 25/50/100 salones",
  "Fase 52 restore local con dataset de 100 salones",
];

const REQUIRED_CONFIRMATION_ENVS = [
  "GLOWBOOK_CAPACITY_SUPABASE_PLAN",
  "GLOWBOOK_CAPACITY_SUPABASE_REGION",
  "GLOWBOOK_CAPACITY_SUPABASE_BACKUPS",
  "GLOWBOOK_CAPACITY_SUPABASE_CONNECTIONS",
  "GLOWBOOK_CAPACITY_SUPABASE_AUTH_LIMITS",
  "GLOWBOOK_CAPACITY_VERCEL_PLAN",
  "GLOWBOOK_CAPACITY_VERCEL_REGION",
  "GLOWBOOK_CAPACITY_VERCEL_BANDWIDTH",
  "GLOWBOOK_CAPACITY_VERCEL_ALERTS",
];

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

/** @param {string} message */
function fail(message) {
  console.error(`[capacity-readiness] ${message}`);
  process.exitCode = 1;
}

/** @param {string} message */
function pass(message) {
  console.log(`[capacity-readiness] OK ${message}`);
}

/** @param {string} path */
function readDoc(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** @param {string} name */
function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

loadEnvFileIfPresent();

for (const doc of REQUIRED_DOCS) {
  if (existsSync(join(process.cwd(), doc))) {
    pass(`${doc} exists`);
  } else {
    fail(`${doc} is missing`);
  }
}

const capacityPlan = existsSync(join(process.cwd(), "docs/capacity-plan.md"))
  ? readDoc("docs/capacity-plan.md")
  : "";

for (const text of REQUIRED_CAPACITY_TEXT) {
  if (capacityPlan.includes(text)) {
    pass(`capacity plan contains: ${text}`);
  } else {
    fail(`capacity plan missing: ${text}`);
  }
}

const stagingSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;

if (stagingSupabaseUrl && productionSupabaseUrl) {
  if (normalizeUrl(stagingSupabaseUrl) === normalizeUrl(productionSupabaseUrl)) {
    fail("NEXT_PUBLIC_SUPABASE_URL matches PRODUCTION_SUPABASE_URL");
  } else {
    pass("staging and production Supabase URLs differ");
  }
} else {
  fail("NEXT_PUBLIC_SUPABASE_URL and PRODUCTION_SUPABASE_URL are required");
}

if (process.env.GLOWBOOK_CAPACITY_REQUIRE_CONFIRMED_LIMITS === "true") {
  for (const name of REQUIRED_CONFIRMATION_ENVS) {
    if (hasEnv(name)) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is required when GLOWBOOK_CAPACITY_REQUIRE_CONFIRMED_LIMITS=true`);
    }
  }
} else {
  pass("dashboard limits are optional until broad launch confirmation");
}

if (process.exitCode) {
  console.log("[capacity-readiness] Capacity readiness failed.");
  process.exit(process.exitCode);
}

console.log("[capacity-readiness] Capacity readiness passed.");
