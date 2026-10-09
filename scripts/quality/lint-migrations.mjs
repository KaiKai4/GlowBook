// Lint de migraciones con squawk y reglas propias de forward-only.
//
// Forward-only: las migraciones ya aplicadas en producción son inmutables. El lint
// BLOQUEA sobre migraciones posteriores al corte (CUTOFF): squawk y las reglas de
// migration-rules.mjs. Además informa, sin fallar, del conteo de squawk por regla
// sobre TODAS las migraciones (modo informe).
// Solo usa el CLI de squawk instalado en node_modules; no toca ninguna base de datos.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runArgv } from "./lib-process.mjs";
import { analyzeMigration } from "./migration-rules.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const SQUAWK_CONFIG = path.join(ROOT, ".squawk.toml");

// Última migración ya aplicada en producción: todo lo posterior se bloquea.
const CUTOFF = 20240101000063;
const MIGRATION_PATTERN = /^(\d+)_.+\.sql$/;

/**
 * Lista las migraciones SQL ordenadas por nombre.
 * @returns {{ name: string, id: number, file: string }[]}
 */
function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => MIGRATION_PATTERN.test(name))
    .sort()
    .map((name) => ({
      name,
      id: Number(MIGRATION_PATTERN.exec(name)?.[1]),
      file: path.join("supabase", "migrations", name),
    }));
}

/**
 * Ejecuta squawk a través del script npm "squawk" (binario de squawk-cli).
 * @param {string[]} files
 * @param {string} reporter
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function runSquawk(files, reporter) {
  const result = runArgv(["npm", "run", "-s", "squawk", "--", "-c", SQUAWK_CONFIG, "--reporter", reporter, ...files], { capture: true });
  if (result.error) throw result.error;
  return result;
}

/** @param {string[]} newFiles @returns {number} */
function lintNewMigrations(newFiles) {
  if (newFiles.length === 0) {
    console.log(`0 migraciones nuevas (posteriores a ${CUTOFF}): nada que bloquear.`);
    return 0;
  }

  console.log(`Lint bloqueante sobre ${newFiles.length} migracion(es) nueva(s):`);
  const result = runSquawk(newFiles, "tty");
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) {
    console.error("squawk encontro problemas en migraciones nuevas. Las migraciones aplicadas no se modifican: corrige la nueva.");
    return 1;
  }
  console.log("Migraciones nuevas sin problemas de squawk.");
  return 0;
}

/**
 * Reglas forward-only (migration-rules.mjs) sobre las migraciones nuevas. Cada violación bloquea.
 * @param {{ name: string, id: number, file: string }[]} newMigrations
 * @param {{ id: number }[]} allMigrations
 * @returns {number}
 */
function lintForwardOnlyRules(newMigrations, allMigrations) {
  const existingIds = allMigrations.map((migration) => migration.id);
  let total = 0;
  for (const migration of newMigrations) {
    const sql = readFileSync(path.join(ROOT, migration.file), "utf8");
    const { violations } = analyzeMigration(migration.name, sql, existingIds);
    for (const violation of violations) {
      console.error(`  ${migration.name} [${violation.rule}] ${violation.message}`);
    }
    total += violations.length;
  }
  if (total > 0) {
    console.error(`Reglas forward-only: ${total} violación(es) en migraciones nuevas. Corrige la migración nueva.`);
    return 1;
  }
  console.log("Migraciones nuevas sin violaciones de reglas forward-only.");
  return 0;
}

/** @param {string[]} allFiles @returns {number | null} */
function reportAllMigrations(allFiles) {
  const result = runSquawk(allFiles, "json");
  /** @type {{ rule_name: string }[]} */
  let violations;
  try {
    violations = JSON.parse(result.stdout || "[]");
  } catch {
    console.error("No se pudo interpretar la salida JSON de squawk (modo informe).");
    process.stderr.write(result.stderr ?? "");
    return null;
  }

  const counts = new Map();
  for (const violation of violations) {
    counts.set(violation.rule_name, (counts.get(violation.rule_name) ?? 0) + 1);
  }

  console.log(`\nModo informe: ${violations.length} aviso(s) en ${allFiles.length} migracion(es) (no bloquea).`);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (rows.length === 0) {
    console.log("  Sin avisos.");
  }
  for (const [rule, count] of rows) {
    console.log(`  ${String(count).padStart(5)}  ${rule}`);
  }
  return violations.length;
}

const migrations = listMigrations();
const newMigrations = migrations.filter((m) => m.id > CUTOFF);

const squawkStatus = lintNewMigrations(newMigrations.map((m) => m.file));
const rulesStatus = lintForwardOnlyRules(newMigrations, migrations);
const reported = reportAllMigrations(migrations.map((m) => m.file));

if (reported === null) process.exit(1);
process.exit(squawkStatus || rulesStatus);
