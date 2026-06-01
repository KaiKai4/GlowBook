import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_DOCS = [
  "docs/security.md",
  "docs/production-scale-readiness-checklist.md",
];

const REQUIRED_SECURITY_TEXT = [
  "## Rate Limiting",
  "Decision para lanzamiento amplio",
  "login",
  "invite",
  "join",
  "feedback",
  "operaciones Platform",
  "src/lib/rate-limit",
];

const REQUIRED_CHECKLIST_TEXT = [
  "Rate limiting de hosting/Supabase",
  "login/invitaciones",
  "Fase 53 - Seguridad Operativa",
];

const REQUIRED_CONFIRMATION_ENVS = [
  "GLOWBOOK_RATE_LIMIT_PROVIDER",
  "GLOWBOOK_RATE_LIMIT_LOGIN",
  "GLOWBOOK_RATE_LIMIT_INVITATIONS",
  "GLOWBOOK_RATE_LIMIT_FEEDBACK",
  "GLOWBOOK_RATE_LIMIT_PLATFORM",
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

function fail(message) {
  console.error(`[rate-limit-readiness] ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[rate-limit-readiness] OK ${message}`);
}

function readDoc(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function requireText(docName, content, requiredTexts) {
  for (const text of requiredTexts) {
    if (content.includes(text)) {
      pass(`${docName} contains: ${text}`);
    } else {
      fail(`${docName} missing: ${text}`);
    }
  }
}

loadEnvFileIfPresent();

for (const doc of REQUIRED_DOCS) {
  if (existsSync(join(process.cwd(), doc))) {
    pass(`${doc} exists`);
  } else {
    fail(`${doc} is missing`);
  }
}

const securityDoc = existsSync(join(process.cwd(), "docs/security.md"))
  ? readDoc("docs/security.md")
  : "";
const checklist = existsSync(join(process.cwd(), "docs/production-scale-readiness-checklist.md"))
  ? readDoc("docs/production-scale-readiness-checklist.md")
  : "";

requireText("security", securityDoc, REQUIRED_SECURITY_TEXT);
requireText("scale checklist", checklist, REQUIRED_CHECKLIST_TEXT);

if (process.env.GLOWBOOK_RATE_LIMIT_REQUIRE_PROVIDER_CONFIRMATION === "true") {
  for (const name of REQUIRED_CONFIRMATION_ENVS) {
    if (hasEnv(name)) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is required when GLOWBOOK_RATE_LIMIT_REQUIRE_PROVIDER_CONFIRMATION=true`);
    }
  }
} else {
  pass("provider rate-limit confirmation is optional until broad launch confirmation");
}

if (process.exitCode) {
  console.log("[rate-limit-readiness] Rate limit readiness failed.");
  process.exit(process.exitCode);
}

console.log("[rate-limit-readiness] Rate limit readiness passed.");
