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

/** @param {string} message */
function fail(message) {
  console.error(`[observability-readiness] ${message}`);
  process.exitCode = 1;
}

/** @param {string} message */
function pass(message) {
  console.log(`[observability-readiness] OK ${message}`);
}

/** @param {string} value */
function hasUsableUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function redactedPayload() {
  return {
    level: "info",
    event: "observability.readiness",
    module: "system",
    action: "verify_observability",
    metadata: {
      source: "npm run observability:readiness",
      secret: "[redacted]",
      token: "[redacted]",
    },
  };
}

const REQUIRED_ALERT_ENVS = [
  "GLOWBOOK_OBSERVABILITY_ALERT_5XX",
  "GLOWBOOK_OBSERVABILITY_ALERT_SUPABASE_ERRORS",
  "GLOWBOOK_OBSERVABILITY_ALERT_PLATFORM_ERRORS",
  "GLOWBOOK_OBSERVABILITY_ALERT_LATENCY",
  "GLOWBOOK_OBSERVABILITY_RETENTION_DAYS",
];

/** @param {string} url @param {string | undefined} token */
async function postWebhook(url, token) {
  /** @type {Record<string, string>} */
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(redactedPayload()),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
}

loadEnvFileIfPresent();

const adapterPath = join(process.cwd(), "src/lib/observability/index.ts");
const testPath = join(process.cwd(), "src/lib/observability/index.test.ts");
const webhookUrl = process.env.GLOWBOOK_OBSERVABILITY_WEBHOOK_URL;
const webhookToken = process.env.GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN;
const requireWebhook = process.env.GLOWBOOK_OBSERVABILITY_REQUIRE_WEBHOOK === "true";
const requireAlerts = process.env.GLOWBOOK_OBSERVABILITY_REQUIRE_ALERTS === "true";

if (existsSync(adapterPath)) {
  pass("src/lib/observability adapter exists");
} else {
  fail("src/lib/observability adapter is missing");
}

if (existsSync(testPath)) {
  pass("observability redaction tests exist");
} else {
  fail("observability redaction tests are missing");
}

if (!webhookUrl) {
  if (requireWebhook) {
    fail("GLOWBOOK_OBSERVABILITY_REQUIRE_WEBHOOK=true but GLOWBOOK_OBSERVABILITY_WEBHOOK_URL is missing");
  } else {
    pass("webhook/log drain is optional until broad launch provider is chosen");
  }
} else if (!hasUsableUrl(webhookUrl)) {
  fail("GLOWBOOK_OBSERVABILITY_WEBHOOK_URL must be an absolute http/https URL");
} else {
  try {
    await postWebhook(webhookUrl, webhookToken);
    pass("webhook accepted synthetic readiness event");
  } catch (error) {
    fail(`webhook readiness event failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (requireAlerts) {
  for (const name of REQUIRED_ALERT_ENVS) {
    if (process.env[name]?.trim()) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is required when GLOWBOOK_OBSERVABILITY_REQUIRE_ALERTS=true`);
    }
  }
} else {
  pass("alert configuration confirmation is optional until broad launch confirmation");
}

if (process.exitCode) {
  console.log("[observability-readiness] Observability readiness failed.");
  process.exit(process.exitCode);
}

console.log("[observability-readiness] Observability readiness passed.");
