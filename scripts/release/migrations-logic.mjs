// Lógica pura para aplicar migraciones en production (sin I/O).
// Doble guarda: GLOWBOOK_RELEASE_AUTOMATION=true y --confirm=<PRODUCTION_PROJECT_REF>.
// La URL de BD debe referenciar exactamente ese proyecto.

import { getArgValue } from "./args.mjs";

const RELEASE_AUTOMATION_FLAG = "GLOWBOOK_RELEASE_AUTOMATION";

/**
 * @param {string} value
 * @returns {boolean}
 */
function isPostgresUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

/**
 * Valida si se puede aplicar migraciones a production.
 * @param {{ env: Record<string, string | undefined>, args: readonly string[] }} input
 * @returns {{ ok: true, projectRef: string } | { ok: false, errors: string[] }}
 */
export function validateApplyRequest({ env, args }) {
  /** @type {string[]} */
  const errors = [];

  if (env[RELEASE_AUTOMATION_FLAG] !== "true") {
    errors.push(`${RELEASE_AUTOMATION_FLAG} debe ser "true": solo la automatización de release aplica migraciones`);
  }

  const projectRef = (env.PRODUCTION_PROJECT_REF ?? "").trim();
  if (projectRef === "") errors.push("falta PRODUCTION_PROJECT_REF");

  const confirm = getArgValue(args, "confirm");
  if (confirm === null || confirm === "") {
    errors.push("falta --confirm=<PRODUCTION_PROJECT_REF>");
  } else if (projectRef !== "" && confirm !== projectRef) {
    errors.push("--confirm no coincide con PRODUCTION_PROJECT_REF");
  }

  const dbUrl = (env.PRODUCTION_DB_URL ?? "").trim();
  if (dbUrl === "") {
    errors.push("falta PRODUCTION_DB_URL");
  } else if (!isPostgresUrl(dbUrl)) {
    errors.push("PRODUCTION_DB_URL debe ser una URL postgres:// o postgresql://");
  } else if (projectRef !== "" && !dbUrl.includes(projectRef)) {
    errors.push("PRODUCTION_DB_URL no referencia el proyecto confirmado");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, projectRef };
}

/**
 * Argumentos de `supabase db push` contra la URL indicada (CLI del paquete npm).
 * @param {string} dbUrl
 * @returns {string[]}
 */
export function buildPushArgs(dbUrl) {
  return ["supabase", "db", "push", "--db-url", dbUrl, "--yes"];
}

/**
 * Sustituye la URL de BD en un texto para que no aparezca en logs.
 * @param {string} text
 * @param {string} dbUrl
 * @returns {string}
 */
export function redactDbUrl(text, dbUrl) {
  if (dbUrl === "") return text;
  return text.split(dbUrl).join("[REDACTED_DB_URL]");
}

/**
 * Extrae las versiones (14 dígitos) de la columna "Remote" de `supabase migration list`.
 * Acepta separadores `|` y `│`.
 * @param {string} output
 * @returns {string[]}
 */
export function parseRemoteVersions(output) {
  /** @type {Set<string>} */
  const versions = new Set();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.replaceAll("│", "|");
    if (!line.includes("|")) continue;

    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 2) continue;

    const match = parts[1].match(/\b(\d{14})\b/);
    if (match) versions.add(match[1]);
  }

  return [...versions].sort();
}

/**
 * Compara migraciones locales con las remotas.
 * - "drift": hay versiones solo en remoto (aunque también falten pendientes).
 * - "pending": faltan versiones locales en remoto.
 * - "up-to-date": no hay diferencias.
 * @param {readonly string[]} localVersions
 * @param {readonly string[]} remoteVersions
 * @returns {{ status: "up-to-date" | "pending" | "drift", pending: string[], remoteOnly: string[] }}
 */
export function classifyMigrations(localVersions, remoteVersions) {
  const localSet = new Set(localVersions);
  const remoteSet = new Set(remoteVersions);
  const pending = [...localSet].filter((version) => !remoteSet.has(version)).sort();
  const remoteOnly = [...remoteSet].filter((version) => !localSet.has(version)).sort();

  /** @type {"up-to-date" | "pending" | "drift"} */
  let status = "up-to-date";
  if (pending.length > 0) status = "pending";
  if (remoteOnly.length > 0) status = "drift";

  return { status, pending, remoteOnly };
}

/**
 * Códigos de salida del gate de migraciones.
 * 0 = al día, 1 = error o drift, 2 = migraciones pendientes.
 */
export const GATE_EXIT = Object.freeze({ upToDate: 0, error: 1, pending: 2 });

/**
 * Traduce el estado de `classifyMigrations` a código de salida del gate.
 * @param {"up-to-date" | "pending" | "drift"} status
 * @returns {0 | 1 | 2}
 */
export function gateExitCode(status) {
  if (status === "up-to-date") return GATE_EXIT.upToDate;
  if (status === "pending") return GATE_EXIT.pending;
  return GATE_EXIT.error;
}
