// Gate de npm audit.
//   --prod  npm audit --omit=dev. Falla con cualquier aviso de producción. Las excepciones (solo para paquetes de desarrollo) no se aplican en --prod, aunque se validan.
//   --all   npm audit completo. Falla con cualquier aviso sin excepción vigente.
//
// Formato de security/audit-exceptions.json (array):
//   { advisory, package, owner, reason, mitigation, created, expires }
// Reglas: paquete no productivo, expires - created <= 30 días, no expirada,
// campos no vacíos y no obsoleta (debe corresponder a un aviso actual).
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, runArgv } from "./lib-process.mjs";

export const EXCEPTIONS_PATH = join(ROOT, "security", "audit-exceptions.json");
export const LOCKFILE_PATH = join(ROOT, "package-lock.json");
export const MAX_EXCEPTION_DAYS = 30;

/**
 * Entrada de security/audit-exceptions.json. El contrato tipa los campos como
 * cadenas; validateExceptions comprueba los tipos reales en tiempo de ejecución.
 * @typedef {{ advisory: string, package: string, owner: string, reason: string, mitigation: string, created: string, expires: string }} ExceptionRecord
 * @typedef {{ package: string, id: string, url: string | null, severity: string | undefined, title: string }} Advisory
 * @typedef {{ source?: string | number, url?: string, severity?: string, title?: string }} AuditVia
 * @typedef {{ severity?: string, via?: (string | AuditVia)[] }} AuditVulnerability
 * @typedef {{ vulnerabilities?: Record<string, AuditVulnerability>, error?: { summary?: string, code?: string } }} AuditReport
 */

/** @type {(keyof ExceptionRecord)[]} */
const REQUIRED_FIELDS = ["advisory", "package", "owner", "reason", "mitigation", "created", "expires"];
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte YYYY-MM-DD a milisegundos UTC, o null si no es una fecha válida.
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

/** Nombres de paquetes que llegan a producción según las banderas del lockfile. */
/** @param {{ packages?: Record<string, { dev?: boolean, devOptional?: boolean }> }} lockfile @returns {Set<string>} */
export function productionPackageNames(lockfile) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const [key, entry] of Object.entries(lockfile.packages ?? {})) {
    if (key === "" || entry.dev || entry.devOptional) continue;
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
    names.add(name);
  }
  return names;
}

/**
 * Aplana npm audit --json en avisos { package, id, url, severity, title }.
 * Solo cuentan las vías que son objetos (avisos propios); las cadenas son
 * referencias a otro paquete que ya aparece con su propio aviso.
 */
/** @param {AuditReport} auditJson @returns {Advisory[]} */
export function extractAdvisories(auditJson) {
  /** @type {Advisory[]} */
  const advisories = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const [name, vulnerability] of Object.entries(auditJson.vulnerabilities ?? {})) {
    const ownVias = (vulnerability.via ?? []).filter((via) => typeof via === "object" && via !== null);
    // Sin vías propias, el paquete hereda el aviso de otro paquete que sí aparece.
    for (const via of ownVias) {
      const id = String(via.source ?? via.url ?? `npm:${name}`);
      const key = `${name}|${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      advisories.push({
        package: name,
        id,
        url: typeof via.url === "string" ? via.url : null,
        severity: via.severity ?? vulnerability.severity,
        title: via.title ?? "",
      });
    }
  }
  return advisories;
}

/** Indica si una excepción cubre un aviso (por id numérico, GHSA o URL, y paquete). */
/** @param {ExceptionRecord} exception @param {Advisory} advisory @returns {boolean} */
export function exceptionMatches(exception, advisory) {
  if (exception.package !== advisory.package) return false;
  const reference = exception.advisory;
  if (reference === advisory.id) return true;
  if (advisory.url && (advisory.url === reference || advisory.url.endsWith(`/${reference}`))) {
    return true;
  }
  return false;
}

/**
 * Valida el contenido de audit-exceptions.json.
 * Devuelve la lista de errores (vacía si todo es correcto).
 */
/** @param {ExceptionRecord[]} exceptions @param {{ today: number, productionPackages: Set<string> }} context @returns {string[]} */
export function validateExceptions(exceptions, { today, productionPackages }) {
  /** @type {string[]} */
  const errors = [];
  if (!Array.isArray(exceptions)) {
    return ["security/audit-exceptions.json debe contener un array."];
  }

  exceptions.forEach((exception, index) => {
    const position = `excepción #${index + 1}`;
    if (typeof exception !== "object" || exception === null) {
      errors.push(`${position}: no es un objeto.`);
      return;
    }

    let complete = true;
    for (const field of REQUIRED_FIELDS) {
      const value = exception[field];
      if (typeof value !== "string" || value.trim() === "") {
        errors.push(`${position}: el campo "${field}" es obligatorio y no puede estar vacío.`);
        complete = false;
      }
    }
    if (!complete) return;

    const detail = `${position} (${exception.package} / ${exception.advisory})`;
    if (productionPackages.has(exception.package)) {
      errors.push(`${detail}: el paquete es de producción; no se admiten excepciones para producción.`);
    }

    const created = parseDate(exception.created);
    const expires = parseDate(exception.expires);
    if (created === null) errors.push(`${detail}: "created" debe ser una fecha YYYY-MM-DD válida.`);
    if (expires === null) errors.push(`${detail}: "expires" debe ser una fecha YYYY-MM-DD válida.`);
    if (created !== null && expires !== null) {
      const days = Math.round((expires - created) / DAY_MS);
      if (days <= 0) errors.push(`${detail}: "expires" debe ser posterior a "created".`);
      if (days > MAX_EXCEPTION_DAYS) {
        errors.push(`${detail}: la excepción dura ${days} días; el máximo es ${MAX_EXCEPTION_DAYS}.`);
      }
      if (expires < today) errors.push(`${detail}: excepción expirada el ${exception.expires}.`);
    }
  });

  return errors;
}

/** Excepciones que ya no corresponden a ningún aviso actual. */
/** @param {ExceptionRecord[]} exceptions @param {Advisory[]} advisories @returns {ExceptionRecord[]} */
export function findObsoleteExceptions(exceptions, advisories) {
  return exceptions.filter(
    (exception) => !advisories.some((advisory) => exceptionMatches(exception, advisory))
  );
}

function todayUtc() {
  return Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
}

/**
 * @template T
 * @param {string} path
 * @param {string} label
 * @returns {T}
 */
function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer ${label} (${path}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** @param {"prod" | "all"} mode @returns {AuditReport} */
function runAudit(mode) {
  const argv = mode === "prod"
    ? ["npm", "audit", "--omit=dev", "--json"]
    : ["npm", "audit", "--json"];
  const result = runArgv(argv, { capture: true });
  if (result.error) throw new Error(`No se pudo ejecutar npm audit: ${result.error.message}`);

  /** @type {AuditReport} */
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit no devolvió JSON (exit ${result.status}). ${result.stderr.trim()}`);
  }
  if (parsed.error) {
    throw new Error(`npm audit falló: ${parsed.error.summary ?? parsed.error.code ?? "error desconocido"}`);
  }
  return parsed;
}

/** @returns {void} */
function main() {
  const mode = process.argv.includes("--prod") ? "prod" : process.argv.includes("--all") ? "all" : null;
  if (!mode || (process.argv.includes("--prod") && process.argv.includes("--all"))) {
    console.error("Uso: check-audit.mjs --prod | --all");
    process.exit(2);
  }

  /** @type {ExceptionRecord[]} */
  const exceptions = existsSync(EXCEPTIONS_PATH)
    ? readJson(EXCEPTIONS_PATH, "security/audit-exceptions.json")
    : [];
  const productionPackages = productionPackageNames(readJson(LOCKFILE_PATH, "package-lock.json"));

  /** @type {string[]} */
  const errors = validateExceptions(exceptions, { today: todayUtc(), productionPackages });

  const advisories = extractAdvisories(runAudit(mode));
  const obsolete = Array.isArray(exceptions) && mode === "all"
    ? findObsoleteExceptions(exceptions, advisories)
    : [];
  for (const exception of obsolete) {
    errors.push(`excepción obsoleta: ${exception.package} / ${exception.advisory} ya no corresponde a ningún aviso.`);
  }

  const uncovered = advisories.filter(
    (advisory) => !(Array.isArray(exceptions) && mode === "all" &&
      exceptions.some((exception) => exceptionMatches(exception, advisory)))
  );

  const scope = mode === "prod" ? "npm audit --omit=dev" : "npm audit (todas las dependencias)";
  console.log(`[audit] ${scope}: ${advisories.length} aviso(s), ${uncovered.length} sin excepción.`);
  for (const advisory of uncovered) {
    console.error(`  - ${advisory.severity} ${advisory.package} ${advisory.id}${advisory.url ? ` ${advisory.url}` : ""}${advisory.title ? ` (${advisory.title})` : ""}`);
  }
  for (const error of errors) console.error(`[audit] ${error}`);

  if (uncovered.length > 0 || errors.length > 0) {
    console.error("[audit] FALLO. Corrige las dependencias o registra una excepción válida (solo --all).");
    process.exit(1);
  }
  console.log("[audit] Sin avisos sin cubrir.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
