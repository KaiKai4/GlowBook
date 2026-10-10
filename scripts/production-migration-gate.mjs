// Gate de migraciones: compara supabase/migrations/ con el historial remoto.
//
// Códigos de salida (ver GATE_EXIT en scripts/release/migrations-logic.mjs):
//   0 = al día: el remoto tiene todas las migraciones locales y ninguna extra.
//   2 = pendientes: faltan migraciones locales en remoto (se listan).
//   1 = error: falta URL o carpeta, CLI con error, target no soportado, o drift
//       (versiones solo en remoto, se listan).
//
// La URL de BD nunca se imprime: los logs la sustituyen por [REDACTED_DB_URL].

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyMigrations,
  GATE_EXIT,
  gateExitCode,
  parseRemoteVersions,
} from "./release/migrations-logic.mjs";

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

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(message);
  process.exit(GATE_EXIT.error);
}

/** @returns {"production" | "staging"} */
function getTarget() {
  const value = getArgValue("target") ?? "production";
  if (value !== "production" && value !== "staging") {
    fail(`[BLOCK] Unsupported target "${value}". Use production or staging.`);
  }
  return value;
}

/** @param {"production" | "staging"} target */
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
    fail("[BLOCK] supabase/migrations directory is missing.");
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

loadEnvFileIfPresent();

const target = getTarget();
const databaseUrl = getDatabaseUrl(target);

console.log("GlowBook Migration Gate");
console.log(`Target: ${target}`);
console.log("");

if (!databaseUrl) {
  const expected = target === "production" ? "PRODUCTION_DATABASE_URL" : "STAGING_DATABASE_URL";
  fail(`[BLOCK] Missing ${expected}.\nSet it in .env.local or provide SUPABASE_DB_URL for this command.`);
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

/** @param {string} text */
const redact = (text) =>
  text.replaceAll(databaseUrl, "[REDACTED_DB_URL]").replaceAll(effectiveDatabaseUrl, "[REDACTED_DB_URL]");

if (result.status !== 0) {
  console.error("[BLOCK] Could not read remote migration history.");
  console.error("Supabase CLI returned an error. Re-run the command after confirming DB credentials and network.");
  if (result.error) console.error(result.error.message);
  if (result.stderr) console.error(redact(result.stderr).trim());
  if (result.stdout) console.error(redact(result.stdout).trim());
  process.exit(GATE_EXIT.error);
}

const remoteVersions = parseRemoteVersions(`${result.stdout}\n${result.stderr}`);
const classification = classifyMigrations(localVersions, remoteVersions);

console.log(`Local migrations: ${localVersions.length}`);
console.log(`Remote migrations: ${remoteVersions.length}`);

if (classification.remoteOnly.length > 0) {
  console.log("");
  console.error("[BLOCK] Remote database has migrations that do not exist locally (drift):");
  for (const version of classification.remoteOnly) console.error(`- ${version}`);
  console.error("");
  console.error("Sincroniza el repositorio con el historial remoto antes de desplegar. No se aplica nada automáticamente.");
  process.exit(gateExitCode(classification.status));
}

if (classification.pending.length > 0) {
  console.log("");
  console.error("[PENDING] Remote database is missing local migrations:");
  for (const version of classification.pending) console.error(`- ${version}`);
  console.error("");
  console.error("Apply migrations to the correct Supabase project before deploying code that depends on them.");
  process.exit(gateExitCode(classification.status));
}

console.log("");
console.log("[OK] Remote database has all local migration versions.");
process.exit(gateExitCode(classification.status));
