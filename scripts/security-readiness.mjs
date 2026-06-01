import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_HEADERS = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cross-origin-opener-policy": "same-origin",
};

const BUNDLE_DIRS = [".next/static", "public"];

const REQUIRED_OPERATION_ENVS = [
  "GLOWBOOK_SECURITY_OWNER",
  "GLOWBOOK_SECURITY_CSP_REPORT_REVIEWED",
  "GLOWBOOK_SECURITY_SECRET_ROTATION_STATUS",
  "GLOWBOOK_SECURITY_LOG_SECRET_SCAN",
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

function isLocalUrl(value = "") {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`[security-readiness] ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[security-readiness] OK ${message}`);
}

function envValueLooksReal(value) {
  return Boolean(value && value.length >= 20 && !value.includes("your-") && !value.includes("here"));
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

async function checkHeaders() {
  const appUrl = process.env.E2E_BASE_URL ?? process.env.APP_URL;

  if (!appUrl) {
    fail("Set E2E_BASE_URL or APP_URL to verify deployed security headers.");
    return;
  }

  if (isLocalUrl(appUrl)) {
    fail("E2E_BASE_URL or APP_URL must point to deployed staging, not localhost.");
    return;
  }

  const response = await fetch(new URL("/login", appUrl));

  if (!response.ok) {
    fail(`Could not fetch /login from deployed app: ${response.status} ${response.statusText}.`);
    return;
  }

  for (const [name, expected] of Object.entries(REQUIRED_HEADERS)) {
    const value = response.headers.get(name);
    if (value === expected) {
      pass(`${name}=${expected}`);
    } else {
      fail(`${name} expected ${expected}, received ${value ?? "missing"}.`);
    }
  }

  const permissionsPolicy = response.headers.get("permissions-policy");
  if (
    permissionsPolicy?.includes("camera=()") &&
    permissionsPolicy.includes("microphone=()") &&
    permissionsPolicy.includes("geolocation=()")
  ) {
    pass("permissions-policy restricts camera/microphone/geolocation");
  } else {
    fail("permissions-policy is missing expected camera/microphone/geolocation restrictions.");
  }

  const cspReportOnly = response.headers.get("content-security-policy-report-only");
  if (process.env.GLOWBOOK_CSP_REPORT_ONLY === "true") {
    if (cspReportOnly?.includes("default-src 'self'")) {
      pass("content-security-policy-report-only present");
    } else {
      fail("GLOWBOOK_CSP_REPORT_ONLY=true but deployed CSP report-only header is missing.");
    }
  } else {
    pass("CSP report-only is optional until GLOWBOOK_CSP_REPORT_ONLY=true is deployed");
  }
}

function walkFiles(root) {
  if (!existsSync(root)) return [];

  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

function checkBundleForServerSecrets() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!envValueLooksReal(serviceRoleKey)) {
    pass("SUPABASE_SERVICE_ROLE_KEY not available locally; bundle secret scan skipped");
    return;
  }

  const files = BUNDLE_DIRS.flatMap((dir) => walkFiles(join(process.cwd(), dir)));

  if (files.length === 0) {
    fail("No built static files found. Run npm run build before security readiness.");
    return;
  }

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    if (content.includes(serviceRoleKey)) {
      fail(`SUPABASE_SERVICE_ROLE_KEY appears in public/static artifact: ${file}`);
      return;
    }
  }

  pass("SUPABASE_SERVICE_ROLE_KEY not found in public/static artifacts");
}

loadEnvFileIfPresent();

try {
  await checkHeaders();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

checkBundleForServerSecrets();

if (process.env.GLOWBOOK_SECURITY_REQUIRE_OPERATION_CONFIRMATION === "true") {
  for (const name of REQUIRED_OPERATION_ENVS) {
    if (hasEnv(name)) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is required when GLOWBOOK_SECURITY_REQUIRE_OPERATION_CONFIRMATION=true`);
    }
  }

  if (process.env.GLOWBOOK_SECURITY_LOG_SECRET_SCAN === "no-secrets-found") {
    pass("security log scan confirms no secrets found");
  } else {
    fail("Set GLOWBOOK_SECURITY_LOG_SECRET_SCAN=no-secrets-found after reviewing Vercel/log drain output");
  }
} else {
  pass("CSP/secret rotation operation confirmation is optional until broad launch confirmation");
}

if (process.exitCode) {
  console.log("[security-readiness] Security readiness failed.");
  process.exit(process.exitCode);
}

console.log("[security-readiness] Security readiness passed.");
