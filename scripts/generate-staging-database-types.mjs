import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ENV_PATH = join(ROOT, ".env.local");
const OUTPUT_PATH = join(ROOT, "src", "types", "database.types.ts");

function loadEnvFile() {
  if (!existsSync(ENV_PATH)) throw new Error("Missing .env.local.");

  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=");
  }
}

function stagingProjectId() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const match = value?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/);
  if (!match) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase project URL.");
  return match[1];
}

/** @param {string} value */
function sessionPoolerUrl(value) {
  const url = new URL(value);
  if (url.port === "6543" && url.hostname.includes("pooler.supabase")) {
    url.port = "5432";
  }
  return url.toString();
}

/** @param {string[]} args */
function runSupabase(args) {
  if (process.platform === "win32") {
    return spawnSync(
      "cmd.exe",
      ["/d", "/s", "/c", "npx.cmd", "supabase", ...args],
      { cwd: ROOT, encoding: "utf8", shell: false, windowsHide: true }
    );
  }

  return spawnSync("npx", ["supabase", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
  });
}

/** @param {string} databaseUrl @param {import("node:child_process").SpawnSyncReturns<string>} result */
function sanitizedError(result, databaseUrl) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    .replaceAll(databaseUrl, "[REDACTED_DB_URL]")
    .trim();
}

loadEnvFile();

const rawDatabaseUrl = process.env.STAGING_DATABASE_URL;
if (!rawDatabaseUrl) throw new Error("Missing STAGING_DATABASE_URL.");

const databaseUrl = sessionPoolerUrl(rawDatabaseUrl);
const projectId = stagingProjectId();

let result = runSupabase([
  "gen",
  "types",
  "typescript",
  "--db-url",
  databaseUrl,
  "--schema",
  "public",
]);

if (result.status !== 0) {
  const error = sanitizedError(result, databaseUrl);
  if (!error.includes("docker API")) {
    throw new Error(`Could not generate types from STAGING_DATABASE_URL.\n${error}`);
  }

  console.warn("[WARN] Docker is unavailable; retrying with the explicit staging project ID.");
  result = runSupabase([
    "gen",
    "types",
    "typescript",
    "--project-id",
    projectId,
    "--schema",
    "public",
  ]);
}

if (result.status !== 0) {
  throw new Error(`Could not generate staging database types.\n${sanitizedError(result, databaseUrl)}`);
}

writeFileSync(OUTPUT_PATH, result.stdout, "utf8");
console.log(`Generated database types from staging project ${projectId}.`);
