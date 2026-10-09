import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

function loadEnvFileIfPresent() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=");
  }
}

/** @param {string} name */
function getArgValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function getTarget() {
  const value = getArgValue("target") ?? "production";
  if (!["production", "staging"].includes(value)) {
    console.error(`[BLOCK] Unsupported target "${value}". Use production or staging.`);
    process.exit(1);
  }
  return value;
}

/** @param {string} target */
function getDatabaseUrl(target) {
  const explicit = process.env.SUPABASE_DB_URL;
  if (explicit) return explicit;

  if (target === "production") return process.env.PRODUCTION_DATABASE_URL;
  return process.env.STAGING_DATABASE_URL;
}

/** @param {string} databaseUrl */
function getSessionPoolerUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.port !== "6543" || !url.hostname.includes("pooler.supabase")) return null;
    url.port = "5432";
    return url.toString();
  } catch {
    return null;
  }
}

function getLocalVersions() {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.error("[BLOCK] supabase/migrations directory is missing.");
    process.exit(1);
  }

  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .map((name) => name.split("_")[0])
    .sort();
}

/** @param {string} databaseUrl */
function runSupabaseMigrationList(databaseUrl) {
  if (process.platform === "win32") {
    return spawnSync(
      "cmd.exe",
      ["/d", "/s", "/c", "npx.cmd", "supabase", "migration", "list", "--db-url", databaseUrl],
      {
        cwd: ROOT,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
      }
    );
  }

  return spawnSync("npx", ["supabase", "migration", "list", "--db-url", databaseUrl], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
  });
}

/** @param {string} output */
function parseRemoteVersions(output) {
  const versions = new Set();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.replaceAll("│", "|");
    if (!line.includes("|")) continue;

    const parts = line.split("|").map((/** @type {string} */ part) => part.trim());
    if (parts.length < 2) continue;

    const remoteColumn = parts[1];
    const match = remoteColumn.match(/\b(\d{14})\b/);
    if (match) versions.add(match[1]);
  }

  return [...versions].sort();
}

loadEnvFileIfPresent();

const target = getTarget();
const databaseUrl = getDatabaseUrl(target);

console.log("GlowBook Migration Gate");
console.log(`Target: ${target}`);
console.log("");

if (!databaseUrl) {
  const expected = target === "production" ? "PRODUCTION_DATABASE_URL" : "STAGING_DATABASE_URL";
  console.error(`[BLOCK] Missing ${expected}.`);
  console.error("Set it in .env.local or provide SUPABASE_DB_URL for this command.");
  process.exit(1);
}

const localVersions = getLocalVersions();
let effectiveDatabaseUrl = databaseUrl;
let result = runSupabaseMigrationList(effectiveDatabaseUrl);

if (result.status !== 0) {
  const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const sessionPoolerUrl = getSessionPoolerUrl(databaseUrl);
  if (sessionPoolerUrl && combinedOutput.includes("prepared statement")) {
    console.warn("[WARN] Pooler transaction URL failed. Retrying with session pooler port 5432.");
    effectiveDatabaseUrl = sessionPoolerUrl;
    result = runSupabaseMigrationList(effectiveDatabaseUrl);
  }
}

if (result.status !== 0) {
  console.error("[BLOCK] Could not read remote migration history.");
  console.error("Supabase CLI returned an error. Re-run the command after confirming DB credentials and network.");
  if (result.error) {
    console.error(result.error.message);
  }
  if (result.stderr) {
    const sanitized = result.stderr
      .replaceAll(databaseUrl, "[REDACTED_DB_URL]")
      .replaceAll(effectiveDatabaseUrl, "[REDACTED_DB_URL]");
    console.error(sanitized.trim());
  }
  if (result.stdout) {
    const sanitized = result.stdout
      .replaceAll(databaseUrl, "[REDACTED_DB_URL]")
      .replaceAll(effectiveDatabaseUrl, "[REDACTED_DB_URL]");
    console.error(sanitized.trim());
  }
  process.exit(1);
}

const remoteVersions = parseRemoteVersions(`${result.stdout}\n${result.stderr}`);
const remoteSet = new Set(remoteVersions);
const pending = localVersions.filter((version) => !remoteSet.has(version));

console.log(`Local migrations: ${localVersions.length}`);
console.log(`Remote migrations: ${remoteVersions.length}`);

if (pending.length > 0) {
  console.log("");
  console.error("[BLOCK] Remote database is missing local migrations:");
  for (const version of pending) console.error(`- ${version}`);
  console.error("");
  console.error("Apply migrations to the correct Supabase project before deploying code that depends on them.");
  process.exit(1);
}

console.log("");
console.log("[OK] Remote database has all local migration versions.");
