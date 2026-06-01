import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_DOCS = [
  "docs/launch-support.md",
  "docs/runbooks/incidents.md",
  "docs/runbooks/deploy.md",
  "docs/runbooks/rollback.md",
  "docs/runbooks/database-restore.md",
  "docs/runbooks/platform-operations.md",
];

const REQUIRED_INCIDENT_SECTIONS = [
  "Incidente: Sospecha De Datos Cruzados",
  "Incidente: Citas No Se Crean",
  "Incidente: Supabase Lento",
  "Incidente: Salon Suspendido Por Error",
  "Incidente: Reportes Lentos",
  "Postmortem",
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

function readDoc(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function fail(message) {
  console.error(`[support-readiness] ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[support-readiness] OK ${message}`);
}

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

const launchSupport = existsSync(join(process.cwd(), "docs/launch-support.md"))
  ? readDoc("docs/launch-support.md")
  : "";
const incidents = existsSync(join(process.cwd(), "docs/runbooks/incidents.md"))
  ? readDoc("docs/runbooks/incidents.md")
  : "";

if (/KaiKaira \/ project owner/i.test(launchSupport) || hasEnv("GLOWBOOK_SUPPORT_OWNER")) {
  pass("support owner is defined");
} else {
  fail("support owner is missing");
}

if (launchSupport.includes("Owner Suplente")) {
  pass("backup owner section exists");
} else {
  fail("backup owner section is missing");
}

if (launchSupport.includes("Canales De Soporte")) {
  pass("support channels section exists");
} else {
  fail("support channels section is missing");
}

for (const section of REQUIRED_INCIDENT_SECTIONS) {
  if (incidents.includes(section)) {
    pass(`incident section present: ${section}`);
  } else {
    fail(`incident section missing: ${section}`);
  }
}

if (process.env.GLOWBOOK_SUPPORT_REQUIRE_CONFIRMED_CHANNELS === "true") {
  for (const name of [
    "GLOWBOOK_SUPPORT_OWNER",
    "GLOWBOOK_SUPPORT_BACKUP_OWNER",
    "GLOWBOOK_SUPPORT_CHANNEL",
    "GLOWBOOK_SUPPORT_FIRST_WEEK_SCHEDULE",
  ]) {
    if (hasEnv(name)) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is required when GLOWBOOK_SUPPORT_REQUIRE_CONFIRMED_CHANNELS=true`);
    }
  }
} else {
  pass("real support channels are optional until broad launch confirmation");
}

if (process.exitCode) {
  console.log("[support-readiness] Support readiness failed.");
  process.exit(process.exitCode);
}

console.log("[support-readiness] Support readiness passed.");
